"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type DashboardAutoRefreshProps = {
  enabled: boolean;
};

export function DashboardAutoRefresh({ enabled }: DashboardAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const interval = window.setInterval(() => {
      router.refresh();
    }, 2000);

    return () => window.clearInterval(interval);
  }, [enabled, router]);

  return null;
}
