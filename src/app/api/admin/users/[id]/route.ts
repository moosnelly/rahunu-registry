import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/options";
import { prisma } from "@/lib/db";
import { AdminUserUpdateSchema } from "@/lib/validation";
import bcrypt from "bcryptjs";
import { AuditAction } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  const actorId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = AdminUserUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  const { role: newRole, isActive, resetPassword } = parsed.data;

  const updates:any = {};
  const logs:any[] = [];

  if (newRole) { updates.role = newRole; logs.push({ action: AuditAction.USER_ROLE_CHANGED, details: { to: newRole } }); }
  if (typeof isActive === "boolean") { updates.isActive = isActive; logs.push({ action: AuditAction.USER_STATUS_CHANGED, details: { isActive } }); }
  if (resetPassword) { updates.passwordHash = await bcrypt.hash(resetPassword, 10); logs.push({ action: AuditAction.USER_PASSWORD_RESET }); }

  // Validate that the actor user exists in the database
  let validActorId: string | undefined = undefined;
  if (actorId) {
    const actorExists = await prisma.user.findUnique({ 
      where: { id: actorId },
      select: { id: true }
    });
    validActorId = actorExists?.id;
  }

  const updated = await prisma.user.update({ where: { id: params.id }, data: updates, select: { id:true, email:true, role:true, isActive:true } });
  for (const l of logs) { await prisma.auditLog.create({ data: { action: l.action, ...(validActorId && { actorId: validActorId }), targetUserId: updated.id, details: l.details ? JSON.stringify(l.details) : undefined } }); }
  return NextResponse.json(updated);
}
