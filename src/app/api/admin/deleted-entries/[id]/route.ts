import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/options";
import { isAdmin } from "@/lib/rbac";
import { AuditAction } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// PATCH - Restore a soft-deleted entry
export async function PATCH(_: NextRequest, context: RouteContext) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const actorId = (session?.user as any)?.id as string | undefined;

  if (!session || !isAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entry = await prisma.registryEntry.findUnique({
    where: { id: params.id },
  });

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!entry.isDeleted) {
    return NextResponse.json(
      { error: "Entry is not deleted" },
      { status: 400 }
    );
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

  const restored = await prisma.registryEntry.update({
    where: { id: params.id },
    data: { isDeleted: false, deletedAt: null },
  });

  await prisma.auditLog.create({
    data: {
      action: AuditAction.ENTRY_RESTORED,
      ...(validActorId && { actorId: validActorId }),
      targetEntryId: params.id,
      details: JSON.stringify({
        no: restored.no,
        agreementNumber: restored.agreementNumber,
      }),
    },
  });

  return NextResponse.json({ ok: true, entry: restored });
}

// DELETE - Permanently delete an entry
export async function DELETE(_: NextRequest, context: RouteContext) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const actorId = (session?.user as any)?.id as string | undefined;

  if (!session || !isAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entry = await prisma.registryEntry.findUnique({
    where: { id: params.id },
    include: { borrowers: true, auditLogs: true },
  });

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!entry.isDeleted) {
    return NextResponse.json(
      { error: "Entry must be soft-deleted first" },
      { status: 400 }
    );
  }

  // Delete related records first due to foreign key constraints
  await prisma.borrower.deleteMany({
    where: { registryEntryId: params.id },
  });

  // Keep audit logs but remove the relation
  await prisma.auditLog.updateMany({
    where: { targetEntryId: params.id },
    data: { targetEntryId: null },
  });

  // Validate that the actor user exists in the database
  let validActorId: string | undefined = undefined;
  if (actorId) {
    const actorExists = await prisma.user.findUnique({ 
      where: { id: actorId },
      select: { id: true }
    });
    validActorId = actorExists?.id;
  }

  // Create a final audit log before deletion
  await prisma.auditLog.create({
    data: {
      action: AuditAction.ENTRY_DELETED,
      ...(validActorId && { actorId: validActorId }),
      targetEntryId: null,
      details: JSON.stringify({
        permanentlyDeleted: true,
        no: entry.no,
        agreementNumber: entry.agreementNumber,
        borrowersCount: entry.borrowers.length,
      }),
    },
  });

  // Now delete the entry permanently
  await prisma.registryEntry.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ ok: true });
}
