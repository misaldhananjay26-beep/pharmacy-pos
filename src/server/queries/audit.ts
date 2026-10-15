import { desc } from "drizzle-orm";

import { withUser } from "@/db";
import { auditLogs, stockMovements } from "@/db/schema";
import { requireRole } from "@/lib/auth/guard";

/** WHO: admin only. The audit trail is append-only and written by a DB trigger. */
export async function listAuditLogs(limit = 100) {
  const user = await requireRole(["admin"]);
  return withUser(user, async (tx) =>
    tx
      .select({
        id: auditLogs.id,
        tableName: auditLogs.tableName,
        recordId: auditLogs.recordId,
        action: auditLogs.action,
        actorId: auditLogs.actorId,
        oldData: auditLogs.oldData,
        newData: auditLogs.newData,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit),
  );
}

export async function listStockMovements(limit = 100) {
  const user = await requireRole(["admin", "pharmacist"]);
  return withUser(user, async (tx) =>
    tx
      .select({
        id: stockMovements.id,
        batchId: stockMovements.batchId,
        type: stockMovements.type,
        quantityDelta: stockMovements.quantityDelta,
        referenceId: stockMovements.referenceId,
        actorId: stockMovements.actorId,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit),
  );
}
