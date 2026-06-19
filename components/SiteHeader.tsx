"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const isConsole = pathname?.startsWith("/dashboard") ?? false;

  if (isConsole) {
    return (
      <header className="border-b border-[#e3e4e9] bg-white">
        <nav className="mx-auto flex max-w-6xl items-center gap-2.5 px-6 py-3.5">
          <Link className="flex items-center gap-2.5" href="/dashboard">
            <span className="jack" aria-hidden />
            <span className="mono-label text-[13px] font-semibold text-[#16191f]">Switchboard</span>
          </Link>
          <span className="mono-label ml-1 text-[10px] text-[#9aa0ad]">Reproduction console</span>
        </nav>
      </header>
    );
  }

  return (
    <header className="border-b border-[#e3e4e9] bg-white">
      <nav className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3.5">
        <Link className="flex items-center gap-2.5" href="/">
          <span className="h-5 w-5 rounded-[6px] bg-[#16191f]" aria-hidden />
          <span className="text-[15px] font-bold text-[#16191f]">QuickCart</span>
        </Link>
        <div className="ml-auto flex items-center gap-5 text-[13px] font-medium">
          <Link className="text-[#6a7180] hover:text-[#16191f]" href="/cart">
            Cart
          </Link>
          <Link className="text-[#6a7180] hover:text-[#16191f]" href="/checkout">
            Checkout
          </Link>
        </div>
      </nav>
    </header>
  );
}
