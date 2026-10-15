-- ============================================================================
-- seed.sql — demo data for the pharmacy POS
--
-- PRIVILEGED, OFFLINE ONLY. Run it with a database owner (never the app role):
--     psql "$SEED_DATABASE_URL" -f supabase/seed.sql
--   or
--     npm run db:seed          # reads SEED_DATABASE_URL from .env.local
--
-- It is idempotent: re-running updates the same rows instead of duplicating them.
--
-- WHY IT NEEDS A PRIVILEGED CONNECTION
--   * New users are inserted straight into auth.users (the GoTrue/Admin API needs
--     the service-role key, which this offline script deliberately does not use).
--   * `profiles.id` rows are created by the on_auth_user_created trigger, then the
--     seed promotes roles. `prevent_role_escalation` blocks any non-admin from
--     changing a role — including the very first admin — so the trigger is briefly
--     disabled *for this trusted transaction only*. Runtime behaviour is untouched.
--
-- PASSWORDS: every demo user gets the same bcrypt-hashed password below.
--   Do NOT reuse these credentials anywhere real.
-- ============================================================================

-- ── 1. Auth users ────────────────────────────────────────────────────────────
-- gen_salt('bf') → bcrypt, which GoTrue accepts. email_confirmed_at is set so the
-- accounts are usable without a confirmation round-trip.
do $$
declare
  rec record;
  v_id uuid;
  v_password text := 'Pharmacy#12345';
begin
  for rec in
    select email, full_name from (values
      ('admin@pharmacy.local',      'Pharmacy Admin'),
      ('pharmacist@pharmacy.local', 'Priya Pharmacist'),
      ('cashier@pharmacy.local',    'Rahul Cashier')
    ) as t(email, full_name)
  loop
    select id into v_id from auth.users where email = rec.email;

    if v_id is null then
      v_id := gen_random_uuid();

      insert into auth.users
        (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
         raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values
        ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
         rec.email, extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('full_name', rec.full_name), now(), now());

      -- GoTrue expects a matching identity row for email/password sign-in.
      insert into auth.identities
        (provider_id, user_id, identity_data, provider, created_at, updated_at)
      values
        (v_id::text, v_id,
         jsonb_build_object('sub', v_id::text, 'email', rec.email, 'email_verified', true),
         'email', now(), now());
    end if;
  end loop;
end $$;

-- ── 2. Promote roles (bootstrap) ─────────────────────────────────────────────
alter table public.profiles disable trigger profiles_prevent_escalation;

update public.profiles set role = 'admin',      full_name = 'Pharmacy Admin'    where email = 'admin@pharmacy.local';
update public.profiles set role = 'pharmacist', full_name = 'Priya Pharmacist'  where email = 'pharmacist@pharmacy.local';
update public.profiles set role = 'cashier',    full_name = 'Rahul Cashier'     where email = 'cashier@pharmacy.local';

alter table public.profiles enable trigger profiles_prevent_escalation;

-- ── 3. Supplier ──────────────────────────────────────────────────────────────
insert into public.suppliers (name, phone, gstin)
select 'MediSupply Wholesale', '+919000000000', '27AAAAA0000A1Z5'
where not exists (select 1 from public.suppliers where name = 'MediSupply Wholesale');

-- ── 4. Catalogue ─────────────────────────────────────────────────────────────
insert into public.products
  (name, generic_name, sku, barcode, hsn_code, gst_rate_bp, unit, mrp_paise, selling_price_paise)
values
  ('Paracetamol 500mg',   'Acetaminophen',         'PARA-500', '8901234567890', '3004', 1200, 'strip',  3000, 2800),
  ('Amoxicillin 250mg',   'Amoxicillin',           'AMOX-250', '8901234567891', '3004', 1200, 'strip',  8500, 8000),
  ('Cetirizine 10mg',     'Cetirizine Hydrochloride', 'CET-10', '8901234567892', '3004', 1200, 'strip',  2500, 2300),
  ('Insulin Glargine 100IU', 'Insulin Glargine',   'INS-GLA',  '8901234567893', '3004',  500, 'vial',  65000, 62000),
  ('Vitamin D3 60000IU',  'Cholecalciferol',       'VITD-60K', '8901234567894', '3004', 1200, 'sachet', 4500, 4200)
on conflict (sku) do update set
  selling_price_paise = excluded.selling_price_paise,
  mrp_paise           = excluded.mrp_paise;

-- ── 5. Batches (stock) ───────────────────────────────────────────────────────
-- cost_price_paise is written here directly; the app role can never read it.
insert into public.batches (product_id, batch_number, expiry_date, quantity, cost_price_paise)
select p.id, v.batch_number, v.expiry_date::date, v.quantity, v.cost_price_paise
from (values
  ('PARA-500', 'PA24A', '2027-03-31', 120,  1500),
  ('PARA-500', 'PA24B', '2025-12-31',  40,  1450),
  ('AMOX-250', 'AM24X', '2026-08-31',  60,  5200),
  ('CET-10',   'CE24A', '2027-01-31', 200,  1100),
  ('INS-GLA',  'IN24A', '2026-06-30',  25, 45000),
  ('VITD-60K', 'VD24A', '2027-06-30',  80,  2200)
) as v(sku, batch_number, expiry_date, quantity, cost_price_paise)
join public.products p on p.sku = v.sku
on conflict (product_id, batch_number) do update set
  quantity        = excluded.quantity,
  expiry_date     = excluded.expiry_date,
  cost_price_paise = excluded.cost_price_paise;
