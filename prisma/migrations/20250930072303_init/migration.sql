-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'DATA_ENTRY', 'VIEWER');

-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('ONGOING', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('USER_CREATED', 'USER_ROLE_CHANGED', 'USER_PASSWORD_RESET', 'USER_STATUS_CHANGED', 'USER_SIGNED_IN', 'ENTRY_CREATED', 'ENTRY_UPDATED', 'ENTRY_DELETED', 'ENTRY_RESTORED', 'ENTRY_VIEWED', 'SETTINGS_UPDATED');

-- CreateEnum
CREATE TYPE "public"."SettingCategory" AS ENUM ('ISLAND', 'BANK_BRANCH', 'REGION', 'DOCUMENT_TYPE');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'VIEWER',
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RegistryEntry" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "island" TEXT NOT NULL,
    "formNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "branch" TEXT NOT NULL,
    "agreementNumber" TEXT NOT NULL,
    "status" "public"."Status" NOT NULL,
    "loanAmount" DECIMAL(65,30) NOT NULL,
    "dateOfCancelled" TIMESTAMP(3),
    "dateOfCompleted" TIMESTAMP(3),
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "RegistryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Borrower" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "registryEntryId" TEXT NOT NULL,

    CONSTRAINT "Borrower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "action" "public"."AuditAction" NOT NULL,
    "actorId" TEXT,
    "targetUserId" TEXT,
    "targetEntryId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."SystemSetting" (
    "id" TEXT NOT NULL,
    "category" "public"."SettingCategory" NOT NULL,
    "value" TEXT NOT NULL,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RegistryEntry_no_key" ON "public"."RegistryEntry"("no");

-- CreateIndex
CREATE INDEX "Borrower_nationalId_idx" ON "public"."Borrower"("nationalId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "public"."AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetUserId_createdAt_idx" ON "public"."AuditLog"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetEntryId_createdAt_idx" ON "public"."AuditLog"("targetEntryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "SystemSetting_category_isActive_idx" ON "public"."SystemSetting"("category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_category_value_key" ON "public"."SystemSetting"("category", "value");

-- AddForeignKey
ALTER TABLE "public"."RegistryEntry" ADD CONSTRAINT "RegistryEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistryEntry" ADD CONSTRAINT "RegistryEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Borrower" ADD CONSTRAINT "Borrower_registryEntryId_fkey" FOREIGN KEY ("registryEntryId") REFERENCES "public"."RegistryEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_targetEntryId_fkey" FOREIGN KEY ("targetEntryId") REFERENCES "public"."RegistryEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
