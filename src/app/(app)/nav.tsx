"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  Pill,
  Receipt,
  ScanBarcode,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppUser } from "@/db";
import { can, type Permission } from "@/lib/auth/roles";
import { signOut } from "@/server/actions/auth";

type NavItem = { href: string; label: string; icon: React.ElementType; permission: Permission };

const ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "audit" }, // admin
  { href: "/pos", label: "POS", icon: ScanBarcode, permission: "pos" },
  { href: "/inventory", label: "Inventory", icon: Package, permission: "inventory" },
  { href: "/purchases", label: "Purchases", icon: Truck, permission: "purchases" },
  { href: "/expenses", label: "Expenses", icon: Receipt, permission: "expenses" },
  { href: "/accounting", label: "Accounting", icon: BarChart3, permission: "accounting" },
  { href: "/users", label: "Users", icon: Users, permission: "users" },
  { href: "/audit", label: "Audit log", icon: ClipboardList, permission: "audit" },
];

export function Nav({ user }: { user: AppUser }) {
  const pathname = usePathname();
  // Dashboard is visible to pharmacists too, so give it its own rule.
  const visible = ITEMS.filter(
    (item) =>
      (item.href === "/dashboard" && (user.role === "admin" || user.role === "pharmacist")) ||
      (item.href !== "/dashboard" && can(user.role, item.permission)),
  );

  return (
    <aside className="flex shrink-0 flex-col gap-1 border-b bg-card p-3 lg:h-dvh lg:w-64 lg:border-b-0 lg:border-r lg:p-4">
      <div className="mb-2 flex items-center gap-2 px-2 py-1">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Pill className="h-4 w-4" />
        </div>
        <span className="font-semibold tracking-tight">Pharmacy POS</span>
      </div>

      <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
        {visible.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden flex-col gap-2 rounded-lg border bg-muted/40 p-3 lg:flex">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Signed in as
        </div>
        <div className="truncate text-sm font-medium">{user.email}</div>
        <div className="text-xs capitalize text-muted-foreground">{user.role}</div>
        <form action={signOut}>
          <Button variant="outline" size="sm" className="w-full" type="submit">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
