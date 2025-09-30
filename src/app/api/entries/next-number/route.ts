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

  // Generate the next registry number in format RGSTXXX/YYYY
  const currentYear = new Date().getFullYear();
  const yearSuffix = currentYear.toString();
  
  // Find all entries for the current year
  const entriesThisYear = await prisma.registryEntry.findMany({
    where: {
      no: {
        endsWith: `/${yearSuffix}`
      }
    },
    select: { no: true },
    orderBy: { no: 'desc' }
  });
  
  // Extract the sequence number from the last entry
  let nextSequence = 1;
  if (entriesThisYear.length > 0) {
    const lastNo = entriesThisYear[0].no;
    const match = lastNo.match(/^RGST(\d{3})\//);
    if (match) {
      nextSequence = parseInt(match[1], 10) + 1;
    }
  }
  
  // Format: RGST001/2025
  const nextNumber = `RGST${nextSequence.toString().padStart(3, '0')}/${yearSuffix}`;
  
  return NextResponse.json({ nextNumber });
}
