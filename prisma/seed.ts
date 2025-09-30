import { PrismaClient, Role, Status, AuditAction, SettingCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@example.com";
  const adminExists = await prisma.user.findUnique({ where: { email: adminEmail } });
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Admin",
      role: Role.ADMIN,
      passwordHash: await bcrypt.hash("Password1!", 10)
    }
  });
  if (!adminExists) {
    await prisma.auditLog.create({ data: { action: AuditAction.USER_CREATED, actorId: admin.id, targetUserId: admin.id, details: JSON.stringify({ email: admin.email }) } });
  }

  await prisma.user.upsert({
    where: { email: "viewer@example.com" },
    update: {},
    create: {
      email: "viewer@example.com",
      name: "Viewer",
      role: Role.VIEWER,
      passwordHash: await bcrypt.hash("Password1!", 10)
    }
  });

  const entryCoreData = {
    address: "Sunset Villa (reg 2477)",
    island: "S.Hithadhoo",
    formNumber: "41/2025",
    date: new Date("2025-06-01"),
    branch: "BML Hithadhoo Branch",
    agreementNumber: "S2C-B/2025/31",
    status: Status.ONGOING,
    loanAmount: "700000.00"
  } as const;

  const borrowerData = [{ fullName: "Mariyam Mahaa Abdul Samad", nationalId: "A354960" }];

  const existingEntry = await prisma.registryEntry.findUnique({ where: { no: 1 } });
  let entry;
  if (existingEntry) {
    entry = await prisma.registryEntry.update({
      where: { no: 1 },
      data: {
        ...entryCoreData,
        updatedById: admin.id,
        borrowers: {
          deleteMany: {},
          create: borrowerData
        }
      }
    });
  } else {
    entry = await prisma.registryEntry.create({
      data: {
        no: 1,
        ...entryCoreData,
        createdById: admin.id,
        borrowers: { create: borrowerData }
      }
    });
    await prisma.auditLog.create({ data: { action: AuditAction.ENTRY_CREATED, actorId: admin.id, targetEntryId: entry.id, details: JSON.stringify({ no: entry.no, agreementNumber: entry.agreementNumber }) } });
  }

  // Seed system settings
  const settingsData = [
    // Islands
    { category: SettingCategory.ISLAND, value: "Malé", displayName: "Malé", sortOrder: 1 },
    { category: SettingCategory.ISLAND, value: "Hulhumalé", displayName: "Hulhumalé", sortOrder: 2 },
    { category: SettingCategory.ISLAND, value: "Vilimalé", displayName: "Vilimalé", sortOrder: 3 },
    { category: SettingCategory.ISLAND, value: "S.Hithadhoo", displayName: "S. Hithadhoo", sortOrder: 4 },
    { category: SettingCategory.ISLAND, value: "Addu City", displayName: "Addu City", sortOrder: 5 },
    
    // Bank Branches
    { category: SettingCategory.BANK_BRANCH, value: "BML Male Branch", displayName: "BML Malé Branch", sortOrder: 1 },
    { category: SettingCategory.BANK_BRANCH, value: "BML Hulhumale Branch", displayName: "BML Hulhumalé Branch", sortOrder: 2 },
    { category: SettingCategory.BANK_BRANCH, value: "BML Hithadhoo Branch", displayName: "BML Hithadhoo Branch", sortOrder: 3 },
    { category: SettingCategory.BANK_BRANCH, value: "BML Fuvahmulah Branch", displayName: "BML Fuvahmulah Branch", sortOrder: 4 },
    
    // Regions/Atolls
    { category: SettingCategory.REGION, value: "Male Atoll", displayName: "Malé Atoll", sortOrder: 1 },
    { category: SettingCategory.REGION, value: "Addu Atoll", displayName: "Addu Atoll", sortOrder: 2 },
    { category: SettingCategory.REGION, value: "Fuvahmulah", displayName: "Fuvahmulah", sortOrder: 3 },
    
    // Document Types
    { category: SettingCategory.DOCUMENT_TYPE, value: "Bank Letter", displayName: "Bank Letter", sortOrder: 1 },
    { category: SettingCategory.DOCUMENT_TYPE, value: "Agreement Document", displayName: "Agreement Document", sortOrder: 2 },
    { category: SettingCategory.DOCUMENT_TYPE, value: "Land Registry", displayName: "Land Registry", sortOrder: 3 },
  ];

  for (const setting of settingsData) {
    await prisma.systemSetting.upsert({
      where: {
        category_value: {
          category: setting.category,
          value: setting.value,
        },
      },
      update: {},
      create: setting,
    });
  }

  console.log("Seeded admin + viewer + " + (existingEntry ? "updated" : "sample") + " entry + system settings");
}

main().catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
