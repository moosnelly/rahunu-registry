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
  const cursorParam = searchParams.get("cursor") || undefined; // ISO date string of createdAt
  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");

  const where:any = {};
  if (action) where.action = action as any;
  if (entity === "user") where.targetUserId = { not: null };
  if (entity === "entry") where.targetEntryId = { not: null };
  if (target) { if (entity === "user") where.targetUserId = target; if (entity === "entry") where.targetEntryId = target; }
  // For forward pagination on descending createdAt, fetch records with createdAt < cursor
  if (cursorParam) {
    const cursorDate = new Date(cursorParam);
    if (!isNaN(cursorDate.getTime())) {
      where.createdAt = { lt: cursorDate };
    }
  }

  // Numbered pagination if page is provided
  if (pageParam) {
    const page = Math.max(1, Number(pageParam) || 1);
    const pageSize = Math.min(200, Number(pageSizeParam || take) || 100);

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { email: true } },
          targetUser: { select: { email: true } },
          targetEntry: { select: { id: true, no: true, agreementNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return NextResponse.json({ logs, page, pageSize, total, totalPages });
  }

  // Default to cursor-based pagination (backwards compatible)
  const logs = await prisma.auditLog.findMany({
    where,
    include: { actor: { select: { email: true } }, targetUser: { select: { email: true } }, targetEntry: { select: { id: true, no: true, agreementNumber: true } } },
    orderBy: { createdAt: "desc" },
    take: take + 1 // fetch one extra to determine if there's another page
  });
  const hasMore = logs.length > take;
  const pageItems = hasMore ? logs.slice(0, take) : logs;
  const last = pageItems[pageItems.length - 1];
  const nextCursor = hasMore && last ? last.createdAt : null;
  return NextResponse.json({ logs: pageItems, nextCursor, hasMore });
}
