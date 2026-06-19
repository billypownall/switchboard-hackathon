"use client";

import { usePathname } from "next/navigation";
import { BugReportWidget } from "@/components/BugReportWidget";

// The Feedback widget belongs to the QuickCart product, not the internal
// Switchboard console, so keep it off the /dashboard routes.
export function FeedbackMount() {
  const pathname = usePathname();

  if (pathname?.startsWith("/dashboard")) {
    return null;
  }

  return <BugReportWidget />;
}
