import { requirePageRole } from "@/lib/auth/guard";
import { listUsers } from "@/server/actions/users";

import { UsersTable } from "./users-table";

export default async function UsersPage() {
  const me = await requirePageRole(["admin"]);
  const rows = await listUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Roles decide what the database will let a person do. You cannot change your own admin access.
        </p>
      </div>
      <UsersTable
        currentUserId={me.id}
        rows={rows.map((r) => ({
          id: r.id,
          email: r.email,
          fullName: r.fullName,
          role: r.role,
          isActive: r.isActive,
        }))}
      />
    </div>
  );
}
