import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

import { Nav } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Defence in depth: middleware already gates this, but a Server Component never trusts that alone.
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Nav user={user} />
      <main className="flex-1 overflow-x-hidden p-4 lg:p-8">{children}</main>
    </div>
  );
}
