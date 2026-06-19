"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ReproduceButtonProps = {
  reportId: string;
  disabled?: boolean;
};

export function ReproduceButton({ reportId, disabled = false }: ReproduceButtonProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startReproduction() {
    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${reportId}/reproduce`, {
        method: "POST",
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to start reproduction.");
      }

      router.refresh();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to start reproduction.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={disabled || isStarting}
        onClick={startReproduction}
        type="button"
      >
        {isStarting ? "Starting..." : "Reproduce"}
      </button>
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
