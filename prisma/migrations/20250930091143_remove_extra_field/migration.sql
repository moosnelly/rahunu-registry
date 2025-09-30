-- DropColumn
-- AlterTable
PRAGMA foreign_keys=OFF;

-- Create a new table without the extra column
CREATE TABLE "RegistryEntry_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "no" INTEGER NOT NULL,
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
    "attachments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "RegistryEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RegistryEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Copy data from the old table to the new table (excluding the extra column)
INSERT INTO "RegistryEntry_new" (
    "id", "no", "address", "island", "formNumber", "date", "branch", 
    "agreementNumber", "status", "loanAmount", "dateOfCancelled", 
    "dateOfCompleted", "attachments", "createdAt", "updatedAt", 
    "isDeleted", "deletedAt", "createdById", "updatedById"
)
SELECT 
    "id", "no", "address", "island", "formNumber", "date", "branch", 
    "agreementNumber", "status", "loanAmount", "dateOfCancelled", 
    "dateOfCompleted", "attachments", "createdAt", "updatedAt", 
    "isDeleted", "deletedAt", "createdById", "updatedById"
FROM "RegistryEntry";

-- Drop the old table
DROP TABLE "RegistryEntry";

-- Rename the new table to the original name
ALTER TABLE "RegistryEntry_new" RENAME TO "RegistryEntry";

-- Recreate the unique index
CREATE UNIQUE INDEX "RegistryEntry_no_key" ON "RegistryEntry"("no");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
