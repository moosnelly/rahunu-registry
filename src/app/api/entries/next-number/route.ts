import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/options";
import { canWrite } from "@/lib/rbac";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  
  if (!session || !canWrite(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get the maximum registry number
  const maxEntry = await prisma.registryEntry.findFirst({
    orderBy: { no: 'desc' },
    select: { no: true }
  });
  
  const nextNumber = (maxEntry?.no ?? 0) + 1;
  
  return NextResponse.json({ nextNumber });
}
