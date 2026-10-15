import { requirePageRole } from "@/lib/auth/guard";

import { PosClient } from "./pos-client";

export default async function PosPage() {
  await requirePageRole(["admin", "pharmacist", "cashier"]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Point of sale</h1>
        <p className="text-sm text-muted-foreground">
          Scan or type a barcode, press Enter, then take payment. Stock is deducted atomically.
        </p>
      </div>
      <PosClient />
    </div>
  );
}
