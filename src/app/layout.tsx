import type { Metadata } from "next";

import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Pharmacy POS",
  description: "Point of sale, inventory, and accounting for pharmacies.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
