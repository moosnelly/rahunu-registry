import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/auth/options";
import { prisma } from "@/lib/db";
import { AdminUserCreateSchema } from "@/lib/validation";
import { AuditAction, Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const actorId = (session?.user as any)?.id as string | undefined;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = AdminUserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, name, role: newRole, isActive } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 400 });
  }

  const roleToAssign = newRole ?? Role.VIEWER;

  // Validate that the actor user exists in the database
  let validActorId: string | undefined = undefined;
  if (actorId) {
    const actorExists = await prisma.user.findUnique({ 
      where: { id: actorId },
      select: { id: true }
    });
    validActorId = actorExists?.id;
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: roleToAssign,
      passwordHash: await bcrypt.hash(password, 10),
      isActive: isActive ?? true,
    },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });

  await prisma.auditLog.create({
    data: {
      action: AuditAction.USER_CREATED,
      ...(validActorId && { actorId: validActorId }),
      targetUserId: user.id,
      details: JSON.stringify({ email: user.email, role: user.role }),
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
