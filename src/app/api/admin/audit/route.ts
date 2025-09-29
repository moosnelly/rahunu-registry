import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/options";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest){
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || undefined;
  const entity = searchParams.get("entity") || undefined;
  const target = searchParams.get("target") || undefined;
  const take = Math.min(200, Number(searchParams.get("limit") || 100));

  const where:any = {};
  if (action) where.action = action as any;
  if (entity === "user") where.targetUserId = { not: null };
  if (entity === "entry") where.targetEntryId = { not: null };
  if (target) { if (entity === "user") where.targetUserId = target; if (entity === "entry") where.targetEntryId = target; }

  const logs = await prisma.auditLog.findMany({
    where,
    include: { actor: { select: { email: true } }, targetUser: { select: { email: true } }, targetEntry: { select: { id: true, no: true, agreementNumber: true } } },
    orderBy: { createdAt: "desc" },
    take
  });
  return NextResponse.json({ logs });
}
