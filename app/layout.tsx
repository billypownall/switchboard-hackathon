import type { Metadata } from "next";
import { FeedbackMount } from "@/components/FeedbackMount";
import { SiteHeader } from "@/components/SiteHeader";
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
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <FeedbackMount />
      </body>
    </html>
  );
}
