import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NoAccessPage() {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-sm space-y-4 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">You don&apos;t have access to that page</h1>
        <p className="text-sm text-muted-foreground">
          Your role doesn&apos;t permit it. If you believe this is a mistake, ask an administrator.
        </p>
        <Button asChild>
          <Link href="/">Back to your workspace</Link>
        </Button>
      </div>
    </div>
  );
}
