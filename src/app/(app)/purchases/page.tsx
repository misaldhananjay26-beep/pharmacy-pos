import { requirePageRole } from "@/lib/auth/guard";
import { listProductsForPurchase, listSuppliers } from "@/server/actions/purchases";

import { PurchaseForm } from "./purchase-form";

export default async function PurchasesPage() {
  await requirePageRole(["admin", "pharmacist"]);
  const [products, suppliers] = await Promise.all([listProductsForPurchase(), listSuppliers()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Purchases</h1>
        <p className="text-sm text-muted-foreground">
          Record stock received. Each line creates or tops up a batch and books the cost.
        </p>
      </div>
      <PurchaseForm
        products={products.map((p) => ({ id: p.id, name: p.name, gstRateBp: p.gstRateBp }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
