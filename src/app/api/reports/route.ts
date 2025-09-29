import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth/options";
import { canRead } from "@/lib/rbac";
import { buildReportFile, normalizeFilters, reportRequestSchema } from "@/lib/reports";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;

  if (!session || !canRead(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reportRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const filters = normalizeFilters(parsed.data.filters ?? {});

  try {
    const report = await buildReportFile({
      type: parsed.data.reportType,
      format: parsed.data.format,
      filters,
    });

    return new NextResponse(report.body, {
      status: 200,
      headers: {
        "Content-Type": report.contentType,
        "Content-Disposition": `attachment; filename="${report.filename}"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate report", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}


