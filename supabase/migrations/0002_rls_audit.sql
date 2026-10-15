-- ============================================================================
-- 0002_rls_audit.sql — Row-Level Security, audit trail, and role plumbing
--
-- This is the security spine of the app. Read it before changing any policy.
--
-- Threat model
--   * The app connects to Postgres as `authenticated` (see src/db/index.ts#withUser),
--     carrying the caller's identity in request.jwt.claims. So RLS *is* the boundary.
--   * App-level `requireRole()` is a second fence, not the fence. Assume it can be
--     forgotten; assume every client is hostile.
--   * A cashier must be PHYSICALLY unable to read expenses, purchases or another
--     cashier's sales. Those are row policies below, not UI decisions.
--   * Cost price is a column other cashiers must not read, so it is enforced with
--     *column privileges* (a row policy cannot hide a column).
--
-- Order matters: helper functions → triggers → RLS enable → policies → grants.
-- ============================================================================

-- ── 1. Identity helpers ─────────────────────────────────────────────────────
-- SECURITY DEFINER so they can read profiles even while RLS is applied to the caller.
-- STABLE so Postgres can cache within a statement. search_path pinned to defeat
-- search_path hijacking of a definer function.

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.is_active
$$;

-- has_role('admin','pharmacist') → true if the caller holds one of those roles.
create or replace function public.has_role(variadic allowed public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.role = any(allowed) from public.profiles p where p.id = auth.uid() and p.is_active),
    false
  )
$$;

-- Privileged read of a batch cost. Returns NULL unless admin/pharmacist, so the
-- raw cost column can stay revoked from `authenticated` entirely.
create or replace function public.batch_cost_price(p_batch_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.cost_price_paise
  from public.batches b
  where b.id = p_batch_id
    and public.has_role('admin', 'pharmacist')
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.has_role(public.user_role[]) from public;
revoke all on function public.batch_cost_price(uuid) from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.has_role(public.user_role[]) to authenticated;
grant execute on function public.batch_cost_price(uuid) to authenticated;

-- ── 2. auth.users → profiles ────────────────────────────────────────────────
-- Every new auth user gets a profile. Role defaults to 'cashier' and is
-- deliberately NOT taken from signup metadata (that would be self-promotion).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''),
             split_part(coalesce(new.email, 'user'), '@', 1)),
    'cashier'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 3. updated_at maintenance ───────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists batches_touch_updated_at on public.batches;
create trigger batches_touch_updated_at
  before update on public.batches
  for each row execute function public.touch_updated_at();

-- ── 4. Privilege-escalation guard on profiles ───────────────────────────────
-- Only an admin may change role / is_active, even on their own row. This closes
-- the hole where a cashier with UPDATE-own-row could promote themselves.

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_role('admin') then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.id is distinct from old.id then
      raise exception 'Only an admin may change a user role or active status'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_escalation on public.profiles;
create trigger profiles_prevent_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ── 5. Audit trail ──────────────────────────────────────────────────────────
-- One generic AFTER trigger writes INSERT/UPDATE/DELETE rows into append-only
-- audit_logs. It is SECURITY DEFINER, so the actor needs no write grant on
-- audit_logs, and no app role can forge or erase entries.

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
begin
  insert into public.audit_logs (table_name, record_id, action, actor_id, old_data, new_data)
  values (
    tg_table_name,
    coalesce(new.id, old.id)::text,
    tg_op,
    actor,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null; -- AFTER trigger; return value is ignored.
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'suppliers', 'products', 'batches',
    'purchases', 'purchase_items',
    'sales', 'sale_items',
    'expenses'
  ]
  loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$s
         for each row execute function public.audit_row_change()', t);
  end loop;
end;
$$;

-- ── 6. Enable RLS on every table ────────────────────────────────────────────
-- Enabling RLS with no matching policy = deny, so this is the safe default; the
-- policies below then re-open exactly what each role needs.

alter table public.profiles        enable row level security;
alter table public.suppliers       enable row level security;
alter table public.products        enable row level security;
alter table public.batches         enable row level security;
alter table public.purchases       enable row level security;
alter table public.purchase_items  enable row level security;
alter table public.sales           enable row level security;
alter table public.sale_items      enable row level security;
alter table public.expenses        enable row level security;
alter table public.audit_logs      enable row level security;
alter table public.stock_movements enable row level security;

-- ── 7. Policies ─────────────────────────────────────────────────────────────

-- profiles: admins/pharmacists see everyone; a user sees only themselves.
-- Writes are admin-only except a user editing their own name (guarded by trigger).
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role('admin', 'pharmacist'));

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (public.has_role('admin'));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_role('admin'))
  with check (id = auth.uid() or public.has_role('admin'));

create policy profiles_delete on public.profiles
  for delete to authenticated
  using (public.has_role('admin'));

-- suppliers: back-office only.
create policy suppliers_select on public.suppliers
  for select to authenticated using (public.has_role('admin', 'pharmacist'));
create policy suppliers_insert on public.suppliers
  for insert to authenticated with check (public.has_role('admin', 'pharmacist'));
create policy suppliers_update on public.suppliers
  for update to authenticated
  using (public.has_role('admin', 'pharmacist'))
  with check (public.has_role('admin', 'pharmacist'));
create policy suppliers_delete on public.suppliers
  for delete to authenticated using (public.has_role('admin'));

-- products: every role reads the catalogue (POS needs it); back office writes.
create policy products_select on public.products
  for select to authenticated using (public.has_role('admin', 'pharmacist', 'cashier'));
create policy products_insert on public.products
  for insert to authenticated with check (public.has_role('admin', 'pharmacist'));
create policy products_update on public.products
  for update to authenticated
  using (public.has_role('admin', 'pharmacist'))
  with check (public.has_role('admin', 'pharmacist'));
create policy products_delete on public.products
  for delete to authenticated using (public.has_role('admin'));

-- batches: every role reads stock (cost is hidden by column privileges below);
-- back office writes / adjusts.
create policy batches_select on public.batches
  for select to authenticated using (public.has_role('admin', 'pharmacist', 'cashier'));
create policy batches_insert on public.batches
  for insert to authenticated with check (public.has_role('admin', 'pharmacist'));
create policy batches_update on public.batches
  for update to authenticated
  using (public.has_role('admin', 'pharmacist'))
  with check (public.has_role('admin', 'pharmacist'));
create policy batches_delete on public.batches
  for delete to authenticated using (public.has_role('admin'));

-- purchases + items: back office only. Cashier is blocked here (blocks COGS/profit).
create policy purchases_select on public.purchases
  for select to authenticated using (public.has_role('admin', 'pharmacist'));
create policy purchases_insert on public.purchases
  for insert to authenticated with check (public.has_role('admin', 'pharmacist'));
create policy purchases_update on public.purchases
  for update to authenticated
  using (public.has_role('admin', 'pharmacist'))
  with check (public.has_role('admin', 'pharmacist'));
create policy purchases_delete on public.purchases
  for delete to authenticated using (public.has_role('admin'));

create policy purchase_items_select on public.purchase_items
  for select to authenticated using (public.has_role('admin', 'pharmacist'));
create policy purchase_items_insert on public.purchase_items
  for insert to authenticated with check (public.has_role('admin', 'pharmacist'));
create policy purchase_items_update on public.purchase_items
  for update to authenticated
  using (public.has_role('admin', 'pharmacist'))
  with check (public.has_role('admin', 'pharmacist'));
create policy purchase_items_delete on public.purchase_items
  for delete to authenticated using (public.has_role('admin'));

-- sales: a cashier sees only their own till; back office sees all.
-- NO update/delete policy on purpose — invoices are immutable.
create policy sales_select on public.sales
  for select to authenticated
  using (created_by = auth.uid() or public.has_role('admin', 'pharmacist'));

create policy sales_insert on public.sales
  for insert to authenticated
  with check (public.has_role('admin', 'pharmacist', 'cashier'));

-- sale_items: visible with their parent sale; insertable onto your own sale.
create policy sale_items_select on public.sale_items
  for select to authenticated
  using (
    public.has_role('admin', 'pharmacist')
    or exists (
      select 1 from public.sales s
      where s.id = sale_id and s.created_by = auth.uid()
    )
  );

create policy sale_items_insert on public.sale_items
  for insert to authenticated
  with check (
    public.has_role('admin', 'pharmacist')
    or exists (
      select 1 from public.sales s
      where s.id = sale_id and s.created_by = auth.uid()
    )
  );

-- expenses: admin ONLY. A cashier or pharmacist gets zero rows and cannot insert.
create policy expenses_select on public.expenses
  for select to authenticated using (public.has_role('admin'));
create policy expenses_insert on public.expenses
  for insert to authenticated with check (public.has_role('admin'));
create policy expenses_update on public.expenses
  for update to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));
create policy expenses_delete on public.expenses
  for delete to authenticated using (public.has_role('admin'));

-- audit_logs: admin reads. No insert/update/delete policy — only the definer
-- trigger writes, so the trail is tamper-evident from the app's perspective.
create policy audit_logs_select on public.audit_logs
  for select to authenticated using (public.has_role('admin'));

-- stock_movements: back office reads the whole ledger; a cashier may only add
-- their own movement rows (and read none — POS never lists the ledger).
create policy stock_movements_select on public.stock_movements
  for select to authenticated using (public.has_role('admin', 'pharmacist'));
create policy stock_movements_insert on public.stock_movements
  for insert to authenticated
  with check (public.has_role('admin', 'pharmacist') or actor_id = auth.uid());

-- ── 8. Grants ───────────────────────────────────────────────────────────────
-- anon is for unauthenticated traffic only and must see nothing in these tables.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- audit_logs is append-only from the app's point of view: the definer trigger
-- writes it, so the app role never needs (and must never have) write access.
revoke insert, update, delete on public.audit_logs from authenticated;

-- ── 9. Cost price is column-protected, not just row-protected ────────────────
-- A row policy cannot hide a column, and a table-level SELECT would override a
-- column-level revoke, so: drop table-level SELECT on batches and re-grant the
-- safe columns only. cost_price_paise is then unreadable by *any* app role;
-- privileged code reads it through public.batch_cost_price().
revoke select on public.batches from authenticated;
grant select (id, product_id, batch_number, expiry_date, quantity, created_at, updated_at)
  on public.batches to authenticated;

-- purchase_items is already back-office-only by row policy, but we keep cost
-- out of the general read path for defence in depth.
revoke select on public.purchase_items from authenticated;
grant select (id, purchase_id, product_id, batch_id, quantity, gst_rate_bp, line_total_paise)
  on public.purchase_items to authenticated;

-- ── 10. Reload the PostgREST schema cache so new functions/policies are live ─
notify pgrst, 'reload schema';
