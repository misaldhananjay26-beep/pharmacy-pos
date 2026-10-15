"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/server/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      if (mode === "signin") {
        const res = await signIn({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        // Reason: the framework auto-handles redirectTo from ok({redirectTo}) responses,
        // but an explicit replace ensures navigation even when CSP or client handlers
        // interfere. Use the role-based home so cashier→/pos, pharmacist→/inventory, admin→/dashboard.
        router.replace(res.data.redirectTo);
      } else {
        const res = await signUp({
          fullName: String(form.get("fullName") ?? ""),
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        if (res.data.needsConfirmation) {
          toast.success("Account created. Check your email to confirm, then sign in.");
          setMode("signin");
        } else {
          toast.success("Account created. You are signed in as a cashier.");
          router.replace("/pos");
        }
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "signin" ? "Sign in" : "Create an account"}</CardTitle>
        <CardDescription>
          {mode === "signin"
            ? "Use the credentials your administrator gave you."
            : "New accounts start as cashiers. An admin can raise your role."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* SECURITY: this form does no validation of its own. The server action re-validates with Zod. */}
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" name="fullName" autoComplete="name" required minLength={2} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <button type="button" className="underline" onClick={() => setMode("signup")}>
              Need an account?
            </button>
          ) : (
            <button type="button" className="underline" onClick={() => setMode("signin")}>
              Already have an account?
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
