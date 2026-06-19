import { TriageResult, statusForTriage } from "@/lib/triage";

export function triageToReportData(result: TriageResult) {
  return {
    status: statusForTriage(result.classification),
    classification: result.classification,
    triageSummary: result.summary,
    triageConfidence: result.confidence,
    severity: result.severity ?? null,
    affectedArea: result.affectedArea ?? null,
    reproSteps: result.reproSteps ? JSON.stringify(result.reproSteps) : null,
    suggestedPriority: result.suggestedPriority ?? null,
    followUpQuestion: result.followUpQuestion ?? null,
  };
}
