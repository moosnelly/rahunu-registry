import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth/options";
import { canRead } from "@/lib/rbac";
import { normalizeFilters, reportRequestSchema, fetchSummary, fetchDetailedRows, fetchCustomRows } from "@/lib/reports";

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
    let previewData;

    switch (parsed.data.reportType) {
      case "SUMMARY":
        previewData = await fetchSummary(filters);
        break;
      case "DETAILED":
        previewData = await fetchDetailedRows(filters);
        break;
      case "CUSTOM":
        previewData = await fetchCustomRows(filters);
        break;
      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    return NextResponse.json({
      reportType: parsed.data.reportType,
      data: previewData,
    });
  } catch (error) {
    console.error("Failed to generate report preview", error);
    return NextResponse.json({ error: "Failed to generate report preview" }, { status: 500 });
  }
}
