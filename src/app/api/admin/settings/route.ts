import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/options";
import { prisma } from "@/lib/db";
import { SystemSettingCreateSchema } from "@/lib/validation";
import { AuditAction } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      actorId,
      details: JSON.stringify({
        action: "create",
        category,
        value,
      }),
    },
  });

  return NextResponse.json({ setting }, { status: 201 });
}
