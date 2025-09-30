import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/options";
import { prisma } from "@/lib/db";
import { SystemSettingUpdateSchema } from "@/lib/validation";
import { AuditAction } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const actorId = (session?.user as any)?.id as string | undefined;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json();
  const parsed = SystemSettingUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }

  const { displayName, isActive, sortOrder } = parsed.data;
  const updateData: any = {};

  if (displayName !== undefined) updateData.displayName = displayName;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
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

  const setting = await prisma.systemSetting.update({
    where: { id },
    data: updateData,
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      action: AuditAction.SETTINGS_UPDATED,
      ...(validActorId && { actorId: validActorId }),
      details: JSON.stringify({
        action: "update",
        settingId: id,
        changes: updateData,
      }),
    },
  });

  return NextResponse.json({ setting });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const actorId = (session?.user as any)?.id as string | undefined;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const setting = await prisma.systemSetting.findUnique({
    where: { id },
  });

  if (!setting) {
    return NextResponse.json({ error: "Setting not found" }, { status: 404 });
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

  await prisma.systemSetting.delete({
    where: { id },
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      action: AuditAction.SETTINGS_UPDATED,
      ...(validActorId && { actorId: validActorId }),
      details: JSON.stringify({
        action: "delete",
        category: setting.category,
        value: setting.value,
      }),
    },
  });

  return NextResponse.json({ success: true });
}
