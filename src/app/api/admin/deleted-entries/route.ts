import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/options";
import { isAdmin } from "@/lib/rbac";
import { AuditAction } from "@prisma/client";
import { sanitizeAttachmentRecord } from "@/lib/attachments";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || !isAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deletedEntries = await prisma.registryEntry.findMany({
    where: { isDeleted: true },
    include: { borrowers: true },
    orderBy: { deletedAt: "desc" },
  });

  const items = deletedEntries.map((entry: any) => ({
    ...entry,
    attachments: sanitizeAttachmentRecord(entry.attachments),
  }));

  return NextResponse.json({ items });
}
