-- ============================================================================
-- 0001_schema.sql — baseline schema for Pharmacy POS
--
-- This mirrors src/db/schema.ts (the Drizzle source of truth for the app layer).
-- Drizzle's out dir is ./drizzle, so `npm run db:generate` produces *future*
-- diffs; this baseline is reviewed by a human because schema mistakes cascade.
-- ============================================================================

create type user_role as enum ('admin', 'pharmacist', 'cashier');
create type payment_mode as enum ('cash', 'card', 'upi');
create type expense_category as enum ('rent', 'salary', 'utilities', 'transport', 'misc');
create type stock_movement_type as enum ('purchase', 'sale', 'adjustment', 'return', 'expiry');

-- Human-readable invoice numbers for POS sales.
create sequence if not exists public.sale_invoice_seq start with 1;

-- ── profiles: mirrors auth.users, holds the authoritative role ───────────────
create table public.profiles (
  id uuid primary key,
  email varchar(255) not null,
  full_name varchar(160) not null,
  role user_role not null default 'cashier',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_uq unique (email)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name varchar(160) not null,
  phone varchar(20),
  gstin varchar(15),
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index suppliers_name_idx on public.suppliers (name);

-- ── products: catalogue + pricing. Quantity/expiry live on batches. ──────────
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name varchar(200) not null,
  generic_name varchar(200),
  sku varchar(64) not null,
  barcode varchar(64),
  hsn_code varchar(12),
  gst_rate_bp integer not null default 1200,     -- basis points: 1200 = 12%
  unit varchar(16) not null default 'strip',
  mrp_paise integer not null,                    -- integer minor units
  selling_price_paise integer not null,
  reorder_level integer not null default 10,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_sku_uq unique (sku),
  constraint products_barcode_uq unique (barcode),   -- NULLs are distinct in Postgres
  constraint products_mrp_nonneg check (mrp_paise >= 0),
  constraint products_price_nonneg check (selling_price_paise >= 0),
  constraint products_gst_valid check (gst_rate_bp between 0 and 2800)
);
create index products_name_idx on public.products (name);

-- ── batches: the authoritative stock record (FEFO) ──────────────────────────
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  batch_number varchar(64) not null,
  expiry_date date not null,
  quantity integer not null default 0,
  cost_price_paise integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batches_product_batch_uq unique (product_id, batch_number),
  -- CRITICAL: stock can never go negative, at the database level.
  constraint batches_quantity_nonneg check (quantity >= 0),
  constraint batches_cost_nonneg check (cost_price_paise >= 0)
);
create index batches_expiry_idx on public.batches (expiry_date);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers (id) on delete set null,
  invoice_number varchar(64),
  subtotal_paise integer not null default 0,
  tax_paise integer not null default 0,
  total_paise integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index purchases_created_at_idx on public.purchases (created_at);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  batch_id uuid references public.batches (id) on delete set null,
  quantity integer not null check (quantity > 0),
  cost_price_paise integer not null check (cost_price_paise >= 0),
  gst_rate_bp integer not null default 0,
  line_total_paise integer not null
);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  invoice_number varchar(32) not null,
  customer_name varchar(160),
  customer_phone varchar(20),
  subtotal_paise integer not null default 0,
  tax_paise integer not null default 0,
  discount_paise integer not null default 0,
  total_paise integer not null default 0,
  payment_mode payment_mode not null default 'cash',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint sales_invoice_uq unique (invoice_number)
);
create index sales_created_at_idx on public.sales (created_at);
create index sales_created_by_idx on public.sales (created_by);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  batch_id uuid not null references public.batches (id) on delete restrict,
  product_name varchar(200) not null,       -- snapshot: invoices are immutable
  quantity integer not null check (quantity > 0),
  unit_price_paise integer not null,
  gst_rate_bp integer not null default 0,
  tax_paise integer not null default 0,
  line_total_paise integer not null
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category expense_category not null,
  description varchar(240) not null,
  amount_paise integer not null check (amount_paise >= 0),
  expense_date date not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index expenses_date_idx on public.expenses (expense_date);

-- Append-only. Written by a SECURITY DEFINER trigger; no app role may write it.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name varchar(64) not null,
  record_id text not null,
  action varchar(10) not null,
  actor_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_table_idx on public.audit_logs (table_name);
create index audit_logs_created_at_idx on public.audit_logs (created_at);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete restrict,
  type stock_movement_type not null,
  quantity_delta integer not null,
  reference_id uuid,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index stock_movements_batch_idx on public.stock_movements (batch_id);
