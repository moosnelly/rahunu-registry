import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EntrySchema } from "@/lib/validation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/options";
import { canRead, canWrite } from "@/lib/rbac";
import { AuditAction, Prisma } from "@prisma/client";
import { sanitizeAttachmentRecord } from "@/lib/attachments";
import { validateAttachmentRecord, FileValidationError } from "@/lib/file-validation";

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
        no: {
          contains: trimmedQuery,
        },
      },
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

  const items = entries.map((entry: any) => ({ ...entry, attachments: sanitizeAttachmentRecord(entry.attachments) }));

  const filters = {
    islands: islands
      .map((entry: any) => entry.island)
      .filter((value: any): value is string => !!value && value.trim().length > 0),
    branches: branches
      .map((entry: any) => entry.branch)
      .filter((value: any): value is string => !!value && value.trim().length > 0),
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
  
  // Validate file attachments on server side
  try {
    validateAttachmentRecord(data.attachments || {});
  } catch (error) {
    if (error instanceof FileValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  
  const attachments = sanitizeAttachmentRecord(data.attachments);
  
  // Validate that the actor user exists in the database
  let validActorId: string | undefined = undefined;
  if (actorId) {
    const actorExists = await prisma.user.findUnique({ 
      where: { id: actorId },
      select: { id: true }
    });
    validActorId = actorExists?.id;
  }
  
  // Auto-generate the next registry number in format RGSTXXX/YYYY
  const currentYear = new Date().getFullYear();
  const yearSuffix = currentYear.toString();
  
  // Find all entries for the current year
  const yearPattern = `%/${yearSuffix}`;
  const entriesThisYear = await prisma.registryEntry.findMany({
    where: {
      no: {
        endsWith: `/${yearSuffix}`
      }
    },
    select: { no: true },
    orderBy: { no: 'desc' }
  });
  
  // Extract the sequence number from the last entry
  let nextSequence = 1;
  if (entriesThisYear.length > 0) {
    const lastNo = entriesThisYear[0].no;
    const match = lastNo.match(/^RGST(\d{3})\//);
    if (match) {
      nextSequence = parseInt(match[1], 10) + 1;
    }
  }
  
  // Format: RGST001/2025
  const nextNo = `RGST${nextSequence.toString().padStart(3, '0')}/${yearSuffix}`;
  
  const created = await prisma.registryEntry.create({
    data: {
      no: nextNo, address: data.address, island: data.island, formNumber: data.formNumber,
      date: new Date(data.date), branch: data.branch, agreementNumber: data.agreementNumber, status: data.status as any,
      loanAmount: data.loanAmount,
      dateOfCancelled: data.dateOfCancelled ? new Date(data.dateOfCancelled) : null,
      dateOfCompleted: data.dateOfCompleted ? new Date(data.dateOfCompleted) : null,
      attachments,
      createdById: validActorId, borrowers: { create: data.borrowers.map(b => ({ fullName: b.fullName, nationalId: b.nationalId })) }
    }, include: { borrowers: true }
  });
  await prisma.auditLog.create({ data: { action: AuditAction.ENTRY_CREATED, ...(validActorId && { actorId: validActorId }), targetEntryId: created.id, details: JSON.stringify({ agreementNumber: created.agreementNumber, loanAmount: created.loanAmount.toString(), borrowersCount: created.borrowers.length }) } });
  return NextResponse.json({ ...created, attachments }, { status: 201 });
}
