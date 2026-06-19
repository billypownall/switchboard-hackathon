import type { Report } from "@prisma/client";

export type ReproOutcome = {
  reproduced?: boolean;
  confidence?: number;
  narrative?: string;
  observedVsExpected?: string;
  stepsSummary?: string;
};

export type ReproTraceEntry = {
  ts?: string;
  stepNumber?: number | null;
  text?: string | null;
  toolCalls?: Array<{
    toolName?: string;
    inputSummary?: string;
  }>;
  toolResults?: Array<{
    toolName?: string;
    outputSummary?: string;
  }>;
};

export type Lane = {
  id: string;
  name: string;
  color: string;
  blurb: string;
};

// Issue categories for the console board. These map to our triage + reproduction
// lifecycle rather than the source POC's columns.
export const LANES: Lane[] = [
  { id: "intake", name: "Intake", color: "#8B93A7", blurb: "New / triaging" },
  { id: "reproducing", name: "Reproducing", color: "#5B7CFA", blurb: "Agent in browser" },
  { id: "confirmed", name: "Confirmed bug", color: "#E5484D", blurb: "Reproduced · ticket filed" },
  { id: "escalated", name: "Escalated", color: "#D6A23B", blurb: "Could not reproduce" },
  { id: "roadmap", name: "Roadmap", color: "#2FA39A", blurb: "Feature requests" },
  { id: "needs_info", name: "Needs info", color: "#B5792A", blurb: "Awaiting user" },
];

export function laneForReport(report: Report): string {
  if (report.classification === "feature_request") {
    return "roadmap";
  }

  if (report.classification === "unclear") {
    return "needs_info";
  }

  if (report.reproStatus === "running") {
    return "reproducing";
  }

  if (report.reproStatus === "reproduced") {
    return "confirmed";
  }

  if (
    report.reproStatus === "not_reproduced" ||
    report.reproStatus === "error" ||
    report.ticketStatus === "escalated"
  ) {
    return "escalated";
  }

  return "intake";
}

export function laneById(id: string): Lane | undefined {
  return LANES.find((lane) => lane.id === id);
}

export function laneCardMeta(report: Report): string {
  const parts: string[] = [report.id.slice(0, 8)];

  if (report.severity) {
    parts.push(report.severity);
  }

  if (report.ticketKey) {
    parts.push(report.ticketKey);
  } else if (report.reproStatus && report.classification === "bug") {
    parts.push(report.reproStatus.replace(/_/g, " "));
  }

  return parts.join(" · ");
}

export function classificationLabel(classification: string | null) {
  if (classification === "feature_request") {
    return "Feature request";
  }

  if (classification === "bug") {
    return "Bug";
  }

  if (classification === "unclear") {
    return "Unclear";
  }

  return "Pending";
}

export function classificationBadgeClass(classification: string | null) {
  if (classification === "bug") {
    return "bg-red-50 text-red-700 ring-red-100";
  }

  if (classification === "feature_request") {
    return "bg-teal-50 text-teal-700 ring-teal-100";
  }

  if (classification === "unclear") {
    return "bg-amber-50 text-amber-800 ring-amber-100";
  }

  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function parseConsoleErrors(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export function parseJsonStringArray(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export function parseJsonObject(value: string | null): ReproOutcome | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as ReproOutcome) : null;
  } catch {
    return null;
  }
}

export function parseTrace(value: string | null): ReproTraceEntry[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as ReproTraceEntry[]) : [];
  } catch {
    return [];
  }
}
