-- AlterTable
ALTER TABLE "Report" ADD COLUMN "affectedArea" TEXT;
ALTER TABLE "Report" ADD COLUMN "classification" TEXT;
ALTER TABLE "Report" ADD COLUMN "followUpAnswer" TEXT;
ALTER TABLE "Report" ADD COLUMN "followUpQuestion" TEXT;
ALTER TABLE "Report" ADD COLUMN "reproSteps" TEXT;
ALTER TABLE "Report" ADD COLUMN "severity" TEXT;
ALTER TABLE "Report" ADD COLUMN "suggestedPriority" TEXT;
ALTER TABLE "Report" ADD COLUMN "triageConfidence" REAL;
ALTER TABLE "Report" ADD COLUMN "triageSummary" TEXT;
