-- CreateTable
CREATE TABLE "ScrapeProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "titleSelector" TEXT NOT NULL,
    "imageSelector" TEXT NOT NULL,
    "textSelectors" TEXT NOT NULL,
    "affiliateCode" TEXT NOT NULL DEFAULT '',
    "treatAsReview" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Project" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ScrapeProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KeywordResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "keyword" TEXT NOT NULL,
    "productUrls" TEXT,
    "searchUrl" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KeywordResult_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keywordResultId" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "asin" TEXT NOT NULL DEFAULT '',
    "productUrl" TEXT NOT NULL DEFAULT '',
    "affiliateUrl" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "featureBullets" TEXT NOT NULL DEFAULT '',
    "productDescription" TEXT NOT NULL DEFAULT '',
    "productFacts" TEXT NOT NULL DEFAULT '',
    "techDetails" TEXT NOT NULL DEFAULT '',
    "reviews" TEXT NOT NULL DEFAULT '',
    "mergedText" TEXT NOT NULL DEFAULT '',
    "scrapeDebug" TEXT NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_keywordResultId_fkey" FOREIGN KEY ("keywordResultId") REFERENCES "KeywordResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
