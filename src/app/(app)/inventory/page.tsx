import { requirePageRole } from "@/lib/auth/guard";
import { listProducts } from "@/server/actions/products";

import { ProductTable } from "./product-table";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }>;
}) {
  const user = await requirePageRole(["admin", "pharmacist"]);
  const sp = await searchParams;

  const sortParam = sp.sort === "stock" || sp.sort === "price" ? sp.sort : "name";
  const dirParam = sp.dir === "desc" ? "desc" : "asc";

  const data = await listProducts({
    search: sp.q,
    page: Number(sp.page ?? "1") || 1,
    sort: sortParam,
    dir: dirParam,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Catalogue, pricing, and stock. Stock is the sum of non-expired batches.
        </p>
      </div>
      <ProductTable
        rows={data.rows}
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        canEdit={user.role === "admin" || user.role === "pharmacist"}
      />
    </div>
  );
}
