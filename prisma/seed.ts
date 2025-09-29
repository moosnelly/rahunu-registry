import { PrismaClient, Role, Status, AuditAction } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin",
      role: Role.ADMIN,
      passwordHash: await bcrypt.hash("Password1!", 10)
    }
  });
  await prisma.auditLog.create({ data: { action: AuditAction.USER_CREATED, actorId: admin.id, targetUserId: admin.id, details: JSON.stringify({ email: admin.email }) } });

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

  const entry = await prisma.registryEntry.create({
    data: {
      no: 1,
      address: "Sunset Villa (reg 2477)",
      extra: "ސަންސެޓްވިލާ/ސ.ހިތަދޫ",
      island: "S.Hithadhoo",
      formNumber: "41/2025",
      date: new Date("2025-06-01"),
      branch: "BML Hithadhoo Branch",
      agreementNumber: "S2C-B/2025/31",
      status: Status.ONGOING,
      loanAmount: "700000.00",
      createdById: admin.id,
      borrowers: { create: [{ fullName: "Mariyam Mahaa Abdul Samad", nationalId: "A354960" }] }
    }
  });
  await prisma.auditLog.create({ data: { action: AuditAction.ENTRY_CREATED, actorId: admin.id, targetEntryId: entry.id, details: JSON.stringify({ no: entry.no, agreementNumber: entry.agreementNumber }) } });
  console.log("Seeded admin + viewer + sample entry");
}

main().catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
