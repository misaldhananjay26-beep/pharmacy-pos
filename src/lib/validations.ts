import { z } from "zod";

/** Reusable primitives */
const paise = z.number().int().nonnegative();
const rupeesInput = z.coerce.number().finite().nonnegative();

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Name is too short").max(160),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Include a letter")
    .regex(/[0-9]/, "Include a number"),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const roleSchema = z.enum(["admin", "pharmacist", "cashier"]);

export const productSchema = z.object({
  name: z.string().trim().min(2).max(200),
  genericName: z.string().trim().max(200).optional().or(z.literal("")),
  sku: z.string().trim().min(1).max(64),
  barcode: z.string().trim().max(64).optional().or(z.literal("")),
  hsnCode: z.string().trim().max(12).optional().or(z.literal("")),
  gstRateBp: z.coerce.number().int().min(0).max(2800),
  unit: z.string().trim().min(1).max(16).default("strip"),
  mrp: rupeesInput,
  sellingPrice: rupeesInput,
  reorderLevel: z.coerce.number().int().min(0).max(100000).default(10),
});
export type ProductInput = z.infer<typeof productSchema>;

/** POS checkout. Client sends identifiers + quantity ONLY — never prices. */
export const saleItemInput = z.object({
  productId: z.string().uuid(),
  batchId: z.string().uuid(),
  quantity: z.number().int().positive().max(10000),
});

export const saleInput = z.object({
  items: z.array(saleItemInput).min(1, "Cart is empty").max(200),
  paymentMode: z.enum(["cash", "card", "upi"]),
  customerName: z.string().trim().max(160).optional().or(z.literal("")),
  customerPhone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{0,20}$/, "Invalid phone")
    .optional()
    .or(z.literal("")),
  discountPaise: paise.default(0),
});
export type SaleInput = z.infer<typeof saleInput>;

export const purchaseItemInput = z.object({
  productId: z.string().uuid(),
  batchNumber: z.string().trim().min(1).max(64),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  quantity: z.number().int().positive().max(100000),
  costPrice: rupeesInput,
  gstRateBp: z.coerce.number().int().min(0).max(2800),
});

export const purchaseInput = z.object({
  supplierId: z.string().uuid().optional().or(z.literal("")),
  invoiceNumber: z.string().trim().max(64).optional().or(z.literal("")),
  items: z.array(purchaseItemInput).min(1).max(200),
});
export type PurchaseInput = z.infer<typeof purchaseInput>;

export const expenseSchema = z.object({
  category: z.enum(["rent", "salary", "utilities", "transport", "misc"]),
  description: z.string().trim().min(2).max(240),
  amount: rupeesInput,
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const adjustStockSchema = z.object({
  batchId: z.string().uuid(),
  newQuantity: z.number().int().min(0),
  reason: z.string().trim().min(3).max(240),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
