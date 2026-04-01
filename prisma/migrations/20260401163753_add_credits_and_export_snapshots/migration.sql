-- CreateTable
CREATE TABLE "ExportSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "productsCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExportSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "profileId" INTEGER NOT NULL,
    "productsPerKeyword" INTEGER NOT NULL DEFAULT 5,
    "randomProducts" BOOLEAN NOT NULL DEFAULT false,
    "randomMin" INTEGER NOT NULL DEFAULT 5,
    "scrapeMode" TEXT NOT NULL DEFAULT 'full',
    "concurrency" INTEGER NOT NULL DEFAULT 20,
    "totalKeywords" INTEGER NOT NULL DEFAULT 0,
    "completedKeywords" INTEGER NOT NULL DEFAULT 0,
    "failedKeywords" INTEGER NOT NULL DEFAULT 0,
    "elapsedMs" INTEGER NOT NULL DEFAULT 0,
    "relevanceFilter" BOOLEAN NOT NULL DEFAULT false,
    "relevanceThreshold" INTEGER NOT NULL DEFAULT 50,
    "relevanceStatus" TEXT NOT NULL DEFAULT '',
    "relevanceDropped" INTEGER NOT NULL DEFAULT 0,
    "relevanceProgress" INTEGER NOT NULL DEFAULT 0,
    "relevanceTotal" INTEGER NOT NULL DEFAULT 0,
    "relevanceError" TEXT NOT NULL DEFAULT '',
    "queuedAt" DATETIME,
    "sheetsSpreadsheetId" TEXT NOT NULL DEFAULT '',
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ScrapeProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("completedKeywords", "concurrency", "createdAt", "elapsedMs", "failedKeywords", "id", "name", "productsPerKeyword", "profileId", "queuedAt", "randomMin", "randomProducts", "relevanceDropped", "relevanceError", "relevanceFilter", "relevanceProgress", "relevanceStatus", "relevanceThreshold", "relevanceTotal", "scrapeMode", "sheetsSpreadsheetId", "status", "totalKeywords", "updatedAt") SELECT "completedKeywords", "concurrency", "createdAt", "elapsedMs", "failedKeywords", "id", "name", "productsPerKeyword", "profileId", "queuedAt", "randomMin", "randomProducts", "relevanceDropped", "relevanceError", "relevanceFilter", "relevanceProgress", "relevanceStatus", "relevanceThreshold", "relevanceTotal", "scrapeMode", "sheetsSpreadsheetId", "status", "totalKeywords", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
