import { Pill } from "lucide-react";

import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="grid min-h-dvh place-items-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Pill className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Pharmacy POS</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to bill, manage stock, and track the day.
          </p>
        </div>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
