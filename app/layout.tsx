import type { Metadata } from "next";
import Link from "next/link";
import { BugReportWidget } from "@/components/BugReportWidget";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuickCart",
  description: "A deliberately buggy commerce demo for automated reproduction.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link className="text-xl font-bold text-slate-950" href="/">
              QuickCart
            </Link>
            <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
              <Link className="hover:text-slate-950" href="/cart">
                Cart
              </Link>
              <Link className="hover:text-slate-950" href="/checkout">
                Checkout
              </Link>
              <Link className="hover:text-slate-950" href="/dashboard">
                Dashboard
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <BugReportWidget />
      </body>
    </html>
  );
}
