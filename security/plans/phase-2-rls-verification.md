# Database access / RLS verification plan

Covers checklist categories **2 (DATABASE_ACCESS)** and **4 (ACCESS_CONTROL)**, plus the
pharmacy-specific invariants. Goal: prove that authorization is enforced by Postgres, not by
the UI.

## Changes (shipped)

| File | Change |
| --- | --- |
| `supabase/migrations/0002_rls_audit.sql` | identity helpers, RLS on all 11 tables, policies for all verbs, audit trigger, auth.users→profiles trigger, column-level cost protection |
| `supabase/migrations/0003_harden_functions.sql` | revoke RPC access to trigger functions; signed-in-only helpers |
| `src/db/index.ts` | `withUser()` sets `role=authenticated` + `request.jwt.claims` locally |

## Verification goals — ALL must be true

- [x] Every table shows `rls_enabled = true`.
- [x] A cashier JWT sees `0` rows in `expenses`; an admin sees the same row.
- [x] A cashier INSERT into `expenses` raises `insufficient_privilege`.
- [x] A cashier cannot `select cost_price_paise` from `batches`.
- [x] `anon` cannot execute any `SECURITY DEFINER` function.
- [ ] Two concurrent sales of the last unit: exactly one succeeds (needs a live integration run).
- [ ] A forced failure mid-checkout leaves `batches.quantity` unchanged (needs a live run).

## Manual verification (for the human)

The automated DB check ran against the live project and was rolled back:

```sql
begin;
insert into public.profiles(id,email,full_name,role) values
 ('…a001','admin@test.local','A','admin'),
 ('…c001','cashier@test.local','C','cashier');
insert into public.expenses(category,description,amount_paise,expense_date,created_by)
 values ('rent','secret',12345,current_date,'…a001');

select set_config('request.jwt.claims', json_build_object('sub','…c001','role','authenticated')::text, true);
set local role authenticated;
select count(*) from public.expenses;              -- expect 0
select cost_price_paise from public.batches limit 1; -- expect permission denied
insert into public.expenses(category,description,amount_paise,expense_date)
 values ('misc','x',1,current_date);               -- expect insufficient_privilege
reset role;

select set_config('request.jwt.claims', json_build_object('sub','…a001','role','authenticated')::text, true);
set local role authenticated;
select count(*) from public.expenses;              -- expect 1
reset role;
rollback;
```

Observed: `cashier_expenses_visible=0`, `cashier_cost_read=DENIED`,
`cashier_expense_insert=DENIED`, `admin_expenses_visible=1`.

The concurrency and rollback invariants need a running app (or a Postgres test runner) and
are tracked in `TASKS.md` under Phase 6.
