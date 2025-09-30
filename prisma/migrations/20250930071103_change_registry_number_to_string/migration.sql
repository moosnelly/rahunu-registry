/*
  Warnings:

  - You are about to alter the column `attachments` on the `RegistryEntry` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.

*/
-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RegistryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "no" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "island" TEXT NOT NULL,
    "formNumber" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "branch" TEXT NOT NULL,
    "agreementNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "loanAmount" DECIMAL NOT NULL,
    "dateOfCancelled" DATETIME,
    "dateOfCompleted" DATETIME,
    "attachments" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "RegistryEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RegistryEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RegistryEntry" ("address", "agreementNumber", "attachments", "branch", "createdAt", "createdById", "date", "dateOfCancelled", "dateOfCompleted", "deletedAt", "formNumber", "id", "isDeleted", "island", "loanAmount", "no", "status", "updatedAt", "updatedById") SELECT "address", "agreementNumber", "attachments", "branch", "createdAt", "createdById", "date", "dateOfCancelled", "dateOfCompleted", "deletedAt", "formNumber", "id", "isDeleted", "island", "loanAmount", "no", "status", "updatedAt", "updatedById" FROM "RegistryEntry";
DROP TABLE "RegistryEntry";
ALTER TABLE "new_RegistryEntry" RENAME TO "RegistryEntry";
CREATE UNIQUE INDEX "RegistryEntry_no_key" ON "RegistryEntry"("no");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SystemSetting_category_isActive_idx" ON "SystemSetting"("category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_category_value_key" ON "SystemSetting"("category", "value");
