import { PrismaClient, Role, Status, AuditAction } from '@prisma/client';
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
  console.log("Seeded admin + viewer + " + (existingEntry ? "updated" : "sample") + " entry");
}

main().catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
