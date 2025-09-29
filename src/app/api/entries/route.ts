import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EntrySchema } from "@/lib/validation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/options";
import { canRead, canWrite } from "@/lib/rbac";
import { AuditAction, Prisma } from "@prisma/client";
import { sanitizeAttachmentRecord } from "@/lib/attachments";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || !canRead(role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") || undefined;
  const status = searchParams.get("status") || undefined;
  const island = searchParams.get("island") || undefined;
  const branch = searchParams.get("branch") || undefined;
  const startDateParam = searchParams.get("startDate") || undefined;
  const endDateParam = searchParams.get("endDate") || undefined;
  const minAmountParam = searchParams.get("minAmount") || undefined;
  const maxAmountParam = searchParams.get("maxAmount") || undefined;
  const page = Number(searchParams.get("page") || 1);
  const size = Math.min(100, Number(searchParams.get("size") || 20));

  const where: any = { isDeleted: false };
  if (status) where.status = status;
  if (island) where.island = island;
  if (branch) where.branch = branch;

  const toNumber = (value?: string) => {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const minAmount = toNumber(minAmountParam);
  const maxAmount = toNumber(maxAmountParam);

  if (minAmount !== undefined || maxAmount !== undefined) {
    where.loanAmount = {};
    if (minAmount !== undefined) where.loanAmount.gte = new Prisma.Decimal(minAmount);
    if (maxAmount !== undefined) where.loanAmount.lte = new Prisma.Decimal(maxAmount);
  }

  const parseDate = (value?: string) => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };

  const startDate = parseDate(startDateParam);
  const endDate = parseDate(endDateParam);

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = startDate;
    if (endDate) where.date.lte = endDate;
  }
  if (query) {
    const trimmedQuery = query.trim();
    const tokens = trimmedQuery.split(/\s+/).filter(Boolean);
    const numericValue = Number(trimmedQuery);
    const normalizedId = trimmedQuery.replace(/\s+/g, "");

    const borrowerNameCondition = tokens.length > 1
      ? {
          borrowers: {
            some: {
              AND: tokens.map((token) => ({
                fullName: {
                  contains: token,
                },
              })),
            },
          },
        }
      : {
          borrowers: {
            some: {
              fullName: {
                contains: trimmedQuery,
              },
            },
          },
        };

    const orConditions: any[] = [
      {
        agreementNumber: {
          contains: trimmedQuery,
        },
      },
      {
        address: {
          contains: trimmedQuery,
        },
      },
      borrowerNameCondition,
      {
        borrowers: {
          some: {
            nationalId: {
              contains: normalizedId,
            },
          },
        },
      },
    ];

    if (!Number.isNaN(numericValue)) {
      orConditions.push({ no: numericValue });
    }

    where.OR = orConditions;
  }
  const [entries, total, islands, branches] = await Promise.all([
    prisma.registryEntry.findMany({ where, include: { borrowers: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size }),
    prisma.registryEntry.count({ where }),
    prisma.registryEntry.findMany({
      where: { isDeleted: false },
      select: { island: true },
      distinct: ["island"],
      orderBy: { island: "asc" },
    }),
    prisma.registryEntry.findMany({
      where: { isDeleted: false },
      select: { branch: true },
      distinct: ["branch"],
      orderBy: { branch: "asc" },
    }),
  ]);

  const items = entries.map((entry) => ({ ...entry, attachments: sanitizeAttachmentRecord(entry.attachments) }));

  const filters = {
    islands: islands
      .map((entry) => entry.island)
      .filter((value): value is string => !!value && value.trim().length > 0),
    branches: branches
      .map((entry) => entry.branch)
      .filter((value): value is string => !!value && value.trim().length > 0),
  };

  return NextResponse.json({ items, total, page, size, filters });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const actorId = (session?.user as any)?.id as string | undefined;
  if (!session || !canWrite(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = EntrySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;
  const attachments = sanitizeAttachmentRecord(data.attachments);
  const created = await prisma.registryEntry.create({
    data: {
      no: data.no, address: data.address, extra: data.extra, island: data.island, formNumber: data.formNumber,
      date: new Date(data.date), branch: data.branch, agreementNumber: data.agreementNumber, status: data.status as any,
      loanAmount: data.loanAmount,
      dateOfCancelled: data.dateOfCancelled ? new Date(data.dateOfCancelled) : null,
      attachments,
      createdById: actorId, borrowers: { create: data.borrowers.map(b => ({ fullName: b.fullName, nationalId: b.nationalId })) }
    }, include: { borrowers: true }
  });
  await prisma.auditLog.create({ data: { action: AuditAction.ENTRY_CREATED, actorId, targetEntryId: created.id, details: JSON.stringify({ no: created.no, agreementNumber: created.agreementNumber }) } });
  return NextResponse.json({ ...created, attachments }, { status: 201 });
}
