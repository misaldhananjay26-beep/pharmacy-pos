import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * MONEY: every *_paise column is an integer number of paise (1 rupee = 100 paise).
 *        Never use floats for money.
 * GST:   gst_rate_bp is basis points, i.e. 500 = 5.00%, 1200 = 12.00%.
 * TIME:  all timestamps are timestamptz, stored UTC.
 */

export const userRole = pgEnum("user_role", ["admin", "pharmacist", "cashier"]);
export const paymentMode = pgEnum("payment_mode", ["cash", "card", "upi"]);
export const expenseCategory = pgEnum("expense_category", [
  "rent",
  "salary",
  "utilities",
  "transport",
  "misc",
]);
export const stockMovementType = pgEnum("stock_movement_type", [
  "purchase",
  "sale",
  "adjustment",
  "return",
  "expiry",
]);

/** Mirrors a subset of auth.users. Role lives here, not in client state. */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(), // == auth.users.id
    email: varchar("email", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    role: userRole("role").notNull().default("cashier"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("profiles_email_uq").on(t.email)],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    gstin: varchar("gstin", { length: 15 }),
    address: text("address"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("suppliers_name_idx").on(t.name)],
);

/**
 * products holds catalogue + pricing. NOTE: quantity and expiry are per-batch, not here.
 * cost_price deliberately lives on `batches` (it is what we actually paid for that batch).
 */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    genericName: varchar("generic_name", { length: 200 }),
    sku: varchar("sku", { length: 64 }).notNull(),
    barcode: varchar("barcode", { length: 64 }),
    hsnCode: varchar("hsn_code", { length: 12 }),
    gstRateBp: integer("gst_rate_bp").notNull().default(1200), // 12%
    unit: varchar("unit", { length: 16 }).notNull().default("strip"),
    mrpPaise: integer("mrp_paise").notNull(),
    sellingPricePaise: integer("selling_price_paise").notNull(),
    reorderLevel: integer("reorder_level").notNull().default(10),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("products_sku_uq").on(t.sku),
    // Reason: barcodes may be NULL for non-barcoded items. Postgres treats NULLs as distinct,
    // so this still allows many products without a barcode while keeping supplied ones unique.
    uniqueIndex("products_barcode_uq").on(t.barcode),
    index("products_name_idx").on(t.name),
  ],
);

/** The authoritative stock record. FEFO selling reads from here. cost_price hidden from cashiers. */
export const batches = pgTable(
  "batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    batchNumber: varchar("batch_number", { length: 64 }).notNull(),
    expiryDate: date("expiry_date").notNull(),
    quantity: integer("quantity").notNull().default(0),
    costPricePaise: integer("cost_price_paise").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("batches_product_batch_uq").on(t.productId, t.batchNumber),
    index("batches_expiry_idx").on(t.expiryDate),
  ],
);

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    invoiceNumber: varchar("invoice_number", { length: 64 }),
    subtotalPaise: integer("subtotal_paise").notNull().default(0),
    taxPaise: integer("tax_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull().default(0),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("purchases_created_at_idx").on(t.createdAt)],
);

export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id").references(() => batches.id, { onDelete: "set null" }),
    quantity: integer("quantity").notNull(),
    costPricePaise: integer("cost_price_paise").notNull(),
    gstRateBp: integer("gst_rate_bp").notNull().default(0),
    lineTotalPaise: integer("line_total_paise").notNull(),
  },
  (t) => [index("purchase_items_purchase_idx").on(t.purchaseId)],
);

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceNumber: varchar("invoice_number", { length: 32 }).notNull(),
    customerName: varchar("customer_name", { length: 160 }),
    customerPhone: varchar("customer_phone", { length: 20 }),
    subtotalPaise: integer("subtotal_paise").notNull().default(0),
    taxPaise: integer("tax_paise").notNull().default(0),
    discountPaise: integer("discount_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull().default(0),
    paymentMode: paymentMode("payment_mode").notNull().default("cash"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sales_invoice_uq").on(t.invoiceNumber),
    index("sales_created_at_idx").on(t.createdAt),
    index("sales_created_by_idx").on(t.createdBy),
  ],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "restrict" }),
    // Snapshot fields: an invoice must never change if the catalogue changes later.
    productName: varchar("product_name", { length: 200 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    gstRateBp: integer("gst_rate_bp").notNull().default(0),
    taxPaise: integer("tax_paise").notNull().default(0),
    lineTotalPaise: integer("line_total_paise").notNull(),
  },
  (t) => [
    index("sale_items_sale_idx").on(t.saleId),
    index("sale_items_product_idx").on(t.productId),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: expenseCategory("category").notNull(),
    description: varchar("description", { length: 240 }).notNull(),
    amountPaise: integer("amount_paise").notNull(),
    expenseDate: date("expense_date").notNull(),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("expenses_date_idx").on(t.expenseDate)],
);

/** Append-only. Written by a SECURITY DEFINER trigger. No app role may insert/update/delete. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tableName: varchar("table_name", { length: 64 }).notNull(),
    recordId: text("record_id").notNull(),
    action: varchar("action", { length: 10 }).notNull(), // INSERT | UPDATE | DELETE
    actorId: uuid("actor_id"),
    oldData: jsonb("old_data"),
    newData: jsonb("new_data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_table_idx").on(t.tableName),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ],
);

/** Immutable ledger of every stock movement, for reconciliation beyond audit_logs. */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "restrict" }),
    type: stockMovementType("type").notNull(),
    quantityDelta: integer("quantity_delta").notNull(), // negative for sales
    referenceId: uuid("reference_id"),
    actorId: uuid("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stock_movements_batch_idx").on(t.batchId)],
);

// ── Relations (used by Drizzle's relational query API) ───────────────────────

export const productsRelations = relations(products, ({ many }) => ({
  batches: many(batches),
}));

export const batchesRelations = relations(batches, ({ one }) => ({
  product: one(products, { fields: [batches.productId], references: [products.id] }),
}));

export const salesRelations = relations(sales, ({ many, one }) => ({
  items: many(saleItems),
  cashier: one(profiles, { fields: [sales.createdBy], references: [profiles.id] }),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  product: one(products, { fields: [saleItems.productId], references: [products.id] }),
}));

export const purchasesRelations = relations(purchases, ({ many, one }) => ({
  items: many(purchaseItems),
  supplier: one(suppliers, { fields: [purchases.supplierId], references: [suppliers.id] }),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, { fields: [purchaseItems.purchaseId], references: [purchases.id] }),
  product: one(products, { fields: [purchaseItems.productId], references: [products.id] }),
}));

export type Profile = typeof profiles.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Batch = typeof batches.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
