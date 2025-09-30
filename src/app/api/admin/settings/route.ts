import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/options";
import { prisma } from "@/lib/db";
import { SystemSettingCreateSchema } from "@/lib/validation";
import { AuditAction } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  // Allow all authenticated users to read settings (needed for entry form dropdowns)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const categoryParam = searchParams.get("category");

  const where = categoryParam
    ? { category: categoryParam as any }
    : {};

  const settings = await prisma.systemSetting.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
  });

  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const actorId = (session?.user as any)?.id as string | undefined;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = SystemSettingCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }

  const { category, value, displayName, sortOrder } = parsed.data;

  // Check if setting already exists
  const existing = await prisma.systemSetting.findUnique({
    where: {
      category_value: {
        category,
        value,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "A setting with this value already exists in this category" },
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

  const setting = await prisma.systemSetting.create({
    data: {
      category,
      value,
      displayName: displayName || value,
      sortOrder: sortOrder ?? 0,
    },
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      action: AuditAction.SETTINGS_UPDATED,
      ...(validActorId && { actorId: validActorId }),
      details: JSON.stringify({
        action: "create",
        category,
        value,
      }),
    },
  });

  return NextResponse.json({ setting }, { status: 201 });
}
