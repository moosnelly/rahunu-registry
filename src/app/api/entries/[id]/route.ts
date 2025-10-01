import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EntrySchema } from "@/lib/validation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/options";
import { canRead, canWrite, canDelete } from "@/lib/rbac";
import { AuditAction } from "@prisma/client";
import { sanitizeAttachmentRecord } from "@/lib/attachments";
import { validateAttachmentRecord, FileValidationError } from "@/lib/file-validation";

function shallowDiff(prev:any, next:any){
  const diffs:any = {};
  for (const k of Object.keys(next)){
    if (['createdAt','updatedAt','borrowers'].includes(k)) continue;
    const a = prev[k]; const b = next[k];
    const av = a instanceof Date ? a.toISOString() : a;
    const bv = b instanceof Date ? b.toISOString() : b;
    if (JSON.stringify(av) !== JSON.stringify(bv)) diffs[k] = { from: av, to: bv };
  }
  return diffs;
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const actorId = (session?.user as any)?.id as string | undefined;
  if (!session || !canRead(role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const item = await prisma.registryEntry.findFirst({ where: { id: params.id, isDeleted: false }, include: { borrowers: true } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
  // Log entry view with context
  const { searchParams } = new URL(req.url);
  const viewContext = searchParams.get('context') || 'view';
  
  // Validate that the actor user exists in the database
  let validActorId: string | undefined = undefined;
  if (actorId) {
    const actorExists = await prisma.user.findUnique({ 
      where: { id: actorId },
      select: { id: true }
    });
    validActorId = actorExists?.id;
  }
  
  await prisma.auditLog.create({ 
    data: { 
      action: AuditAction.ENTRY_VIEWED, 
      ...(validActorId && { actorId: validActorId }), 
      targetEntryId: item.id, 
      details: JSON.stringify({ 
        entryNo: item.no, 
        agreementNumber: item.agreementNumber,
        viewContext 
      }) 
    } 
  });
  
  return NextResponse.json({ ...item, attachments: sanitizeAttachmentRecord(item.attachments) });
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const actorId = (session?.user as any)?.id as string | undefined;
  if (!session || !canWrite(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const before = await prisma.registryEntry.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = EntrySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  
  // Validate file attachments on server side
  try {
    validateAttachmentRecord(d.attachments || {});
  } catch (error) {
    if (error instanceof FileValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  
  const attachments = sanitizeAttachmentRecord(d.attachments);
  
  // Validate that the actor user exists in the database
  let validActorId: string | undefined = undefined;
  if (actorId) {
    const actorExists = await prisma.user.findUnique({ 
      where: { id: actorId },
      select: { id: true }
    });
    validActorId = actorExists?.id;
  }
  
  const updated = await prisma.registryEntry.update({
    where: { id: params.id },
    data: {
      no: d.no, address: d.address, island: d.island, formNumber: d.formNumber,
      date: new Date(d.date), branch: d.branch, agreementNumber: d.agreementNumber, status: d.status as any,
      loanAmount: d.loanAmount, dateOfCancelled: d.dateOfCancelled ? new Date(d.dateOfCancelled) : null,
      dateOfCompleted: d.dateOfCompleted ? new Date(d.dateOfCompleted) : null,
      attachments,
      updatedById: validActorId, borrowers: { deleteMany: { registryEntryId: params.id }, create: d.borrowers.map(b => ({ fullName: b.fullName, nationalId: b.nationalId })) }
    }, include: { borrowers: true }
  });
  const diffs = shallowDiff(before, updated);
  await prisma.auditLog.create({ data: { action: AuditAction.ENTRY_UPDATED, ...(validActorId && { actorId: validActorId }), targetEntryId: updated.id, details: JSON.stringify({ changes: diffs }) } });
  return NextResponse.json({ ...updated, attachments });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const actorId = (session?.user as any)?.id as string | undefined;
  if (!session || !canDelete(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const before = await prisma.registryEntry.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Parse request body to get deletion reason
  const body = await req.json().catch(() => ({}));
  const reason = body.reason?.trim();
  
  if (!reason) {
    return NextResponse.json({ error: "Deletion reason is required" }, { status: 400 });
  }

  // Validate that the actor user exists in the database
  let validActorId: string | undefined = undefined;
  if (actorId) {
    const actorExists = await prisma.user.findUnique({ 
      where: { id: actorId },
      select: { id: true }
    });
    validActorId = actorExists?.id;
  }

  // Use a transaction to ensure both operations succeed or fail together
  await prisma.$transaction([
    prisma.registryEntry.update({ 
      where: { id: params.id }, 
      data: { isDeleted: true, deletedAt: new Date() } 
    }),
    prisma.auditLog.create({ 
      data: { 
        action: AuditAction.ENTRY_DELETED, 
        ...(validActorId && { actorId: validActorId }), 
        targetEntryId: params.id, 
        details: JSON.stringify({ 
          no: before.no, 
          agreementNumber: before.agreementNumber,
          reason: reason,
          deletedBy: (session?.user as any)?.email || 'Unknown'
        }) 
      } 
    })
  ]);
  
  return NextResponse.json({ ok: true });
}
