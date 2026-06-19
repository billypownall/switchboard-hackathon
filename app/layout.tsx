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
        <header className="border-b border-[#e3e4e9] bg-white">
          <nav className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3.5">
            <Link className="flex items-center gap-2.5" href="/">
              <span className="jack" aria-hidden />
              <span className="mono-label text-[13px] font-semibold text-[#16191f]">
                QuickCart
              </span>
            </Link>
            <div className="ml-auto flex items-center gap-5 text-[11px] font-medium">
              <Link className="mono-label text-[#6a7180] hover:text-[#16191f]" href="/cart">
                Cart
              </Link>
              <Link className="mono-label text-[#6a7180] hover:text-[#16191f]" href="/checkout">
                Checkout
              </Link>
              <Link className="mono-label text-[#6a7180] hover:text-[#16191f]" href="/dashboard">
                Console
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
