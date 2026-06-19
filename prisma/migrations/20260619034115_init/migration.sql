-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "whatHappened" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "consoleErrors" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
