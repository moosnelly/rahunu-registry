import { Prisma, Status } from "@prisma/client";
import { format as formatDate } from "date-fns";
import { PDFDocument, PageSizes, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";
import { z } from "zod";

import { prisma } from "@/lib/db";

export const reportRequestSchema = z.object({
  reportType: z.enum(["SUMMARY", "DETAILED", "CUSTOM"]),
  format: z.enum(["CSV", "XLSX", "PDF"]),
  filters: z
    .object({
      status: z.string().optional(),
      island: z.string().optional(),
      branch: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      minAmount: z.union([z.number(), z.string()]).optional(),
      maxAmount: z.union([z.number(), z.string()]).optional(),
    })
    .default({}),
});

export type ReportRequestInput = z.infer<typeof reportRequestSchema>;
export type ReportType = ReportRequestInput["reportType"];
export type ReportFormat = ReportRequestInput["format"];

export type NormalizedReportFilters = {
  status?: Status;
  island?: string;
  branch?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
};

const toNumber = (value?: string | number | null) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseDate = (value?: string | null) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
};

export const normalizeFilters = (raw: ReportRequestInput["filters"]): NormalizedReportFilters => {
  const statusValue = raw.status && raw.status !== "ALL" ? raw.status.toUpperCase() : undefined;
  const status = statusValue && (Object.values(Status) as string[]).includes(statusValue) ? (statusValue as Status) : undefined;

  const island = raw.island && raw.island !== "ALL" && raw.island.trim().length > 0 ? raw.island : undefined;
  const branch = raw.branch && raw.branch !== "ALL" && raw.branch.trim().length > 0 ? raw.branch : undefined;

  const startDate = parseDate(raw.startDate);
  const endDate = parseDate(raw.endDate);
  const minAmount = toNumber(raw.minAmount as string | number | null | undefined);
  const maxAmount = toNumber(raw.maxAmount as string | number | null | undefined);

  return {
    status,
    island,
    branch,
    startDate,
    endDate,
    minAmount,
    maxAmount,
  };
};

export const buildWhereClause = (filters: NormalizedReportFilters): Prisma.RegistryEntryWhereInput => {
  const where: Prisma.RegistryEntryWhereInput = {
    isDeleted: false,
  };

  if (filters.status) where.status = filters.status;
  if (filters.island) where.island = filters.island;
  if (filters.branch) where.branch = filters.branch;

  if (filters.startDate || filters.endDate) {
    where.date = {};
    if (filters.startDate) where.date.gte = filters.startDate;
    if (filters.endDate) where.date.lte = filters.endDate;
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.loanAmount = {};
    if (filters.minAmount !== undefined) where.loanAmount.gte = new Prisma.Decimal(filters.minAmount);
    if (filters.maxAmount !== undefined) where.loanAmount.lte = new Prisma.Decimal(filters.maxAmount);
  }

  return where;
};

export const decimalToNumber = (value: Prisma.Decimal | number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value);
};

export const fetchSummary = async (filters: NormalizedReportFilters) => {
  const where = buildWhereClause(filters);

  const [totalCount, aggregates, statusGroups, islandGroups, recentEntries] = await Promise.all([
    prisma.registryEntry.count({ where }),
    prisma.registryEntry.aggregate({
      where,
      _sum: { loanAmount: true },
      _avg: { loanAmount: true },
    }),
    prisma.registryEntry.groupBy({
      where,
      by: ["status"],
      _count: { _all: true },
      _sum: { loanAmount: true },
    }),
    prisma.registryEntry.groupBy({
      where,
      by: ["island"],
      _count: { _all: true },
      _sum: { loanAmount: true },
    }),
    prisma.registryEntry.findMany({
      where,
      include: { borrowers: true },
      orderBy: [{ date: "desc" }, { no: "asc" }],
      take: 5,
    }),
  ]);

  const totalAmount = decimalToNumber(aggregates._sum.loanAmount);
  const averageAmount = decimalToNumber(aggregates._avg.loanAmount);

  const statusBreakdown = statusGroups
    .sort((a, b) => b._count._all - a._count._all)
    .map((group) => ({
      status: group.status,
      count: group._count._all,
      totalAmount: decimalToNumber(group._sum.loanAmount),
      percentage: totalCount === 0 ? 0 : (group._count._all / totalCount) * 100,
    }));

  const topIslands = islandGroups
    .filter((group) => group.island && group.island.trim().length > 0)
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 5)
    .map((group) => ({
      island: group.island,
      count: group._count._all,
      totalAmount: decimalToNumber(group._sum.loanAmount),
    }));

  const recent = recentEntries.map((entry) => ({
    id: entry.id,
    no: entry.no,
    agreementNumber: entry.agreementNumber,
    status: entry.status,
    island: entry.island,
    branch: entry.branch,
    loanAmount: decimalToNumber(entry.loanAmount),
    date: entry.date.toISOString(),
    borrowers: entry.borrowers.map((borrower) => borrower.fullName),
  }));

  return {
    totals: {
      entries: totalCount,
      amount: totalAmount,
      averageAmount,
    },
    statusBreakdown,
    topIslands,
    recentEntries: recent,
  };
};

export const fetchDetailedRows = async (filters: NormalizedReportFilters) => {
  const where = buildWhereClause(filters);
  const entries = await prisma.registryEntry.findMany({
    where,
    include: { borrowers: true },
    orderBy: [{ date: "desc" }, { no: "asc" }],
  });

  return entries.map((entry) => ({
    no: entry.no,
    agreementNumber: entry.agreementNumber,
    borrowers: entry.borrowers.map((borrower) => borrower.fullName),
    status: entry.status,
    island: entry.island,
    branch: entry.branch,
    loanAmount: decimalToNumber(entry.loanAmount),
    date: entry.date.toISOString(),
  }));
};

export const fetchCustomRows = async (filters: NormalizedReportFilters) => {
  const where = buildWhereClause(filters);
  const groups = await prisma.registryEntry.groupBy({
    where,
    by: ["branch"],
    _count: { _all: true },
    _sum: { loanAmount: true },
  });

  return groups
    .sort((a, b) => decimalToNumber(b._sum.loanAmount) - decimalToNumber(a._sum.loanAmount))
    .map((group) => {
    const totalAmount = decimalToNumber(group._sum.loanAmount);
    const count = group._count._all;
    return {
      branch: group.branch,
      count,
      totalAmount,
      averageAmount: count === 0 ? 0 : totalAmount / count,
    };
    });
};

const currencyFormatter = new Intl.NumberFormat("en-MV", {
  style: "currency",
  currency: "MVR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-MV");

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatInteger = (value: number) => numberFormatter.format(value);

type ReportTable = {
  title: string;
  columns: string[];
  rows: (string | number)[][];
};

const buildSummaryTable = async (filters: NormalizedReportFilters): Promise<ReportTable> => {
  const summary = await fetchSummary(filters);
  const rows: (string | number)[][] = summary.statusBreakdown.map((item) => [
    item.status,
    formatInteger(item.count),
    formatCurrency(item.totalAmount),
    `${item.percentage.toFixed(1)}%`,
  ]);

  rows.push([
    "Total",
    formatInteger(summary.totals.entries),
    formatCurrency(summary.totals.amount),
    "100%",
  ]);

  return {
    title: "Registry Summary Report",
    columns: ["Status", "Agreements", "Total Amount", "Share"],
    rows,
  };
};

const buildDetailedTable = async (filters: NormalizedReportFilters): Promise<ReportTable> => {
  const rows = await fetchDetailedRows(filters);
  return {
    title: "Registry Detailed Listing",
    columns: [
      "Registry No",
      "Agreement",
      "Borrowers",
      "Island",
      "Branch",
      "Status",
      "Loan Amount",
      "Date",
    ],
    rows: rows.map((row) => [
      row.no,
      row.agreementNumber,
      row.borrowers.join("; "),
      row.island,
      row.branch,
      row.status,
      formatCurrency(row.loanAmount),
      new Date(row.date).toLocaleDateString("en-GB"),
    ]),
  };
};

const buildCustomTable = async (filters: NormalizedReportFilters): Promise<ReportTable> => {
  const rows = await fetchCustomRows(filters);
  return {
    title: "Registry Branch Performance",
    columns: ["Branch", "Agreements", "Total Amount", "Average Amount"],
    rows: rows.map((row) => [
      row.branch,
      formatInteger(row.count),
      formatCurrency(row.totalAmount),
      formatCurrency(row.averageAmount),
    ]),
  };
};

const buildReportTable = (type: ReportType, filters: NormalizedReportFilters): Promise<ReportTable> => {
  if (type === "SUMMARY") return buildSummaryTable(filters);
  if (type === "DETAILED") return buildDetailedTable(filters);
  return buildCustomTable(filters);
};

const csvEscape = (value: string | number) => {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const buildCsvBuffer = (table: ReportTable) => {
  const lines = [[table.columns], ...table.rows.map((row) => row.map((value) => String(value)))];
  const serialized = lines
    .map((row) => row.map((cell) => csvEscape(cell)).join(","))
    .join("\r\n");

  return Buffer.from(serialized, "utf-8");
};

const buildXlsxBuffer = (table: ReportTable) => {
  const worksheetData = [table.columns, ...table.rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

const wrapLine = (text: string, maxWidth: number, font: any, fontSize: number) => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
};

const buildPdfBuffer = async (table: ReportTable) => {
  const pdfDoc = await PDFDocument.create();
  const [pageWidth, pageHeight] = PageSizes.A4;
  let page = pdfDoc.addPage(PageSizes.A4);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const titleSize = 18;
  const bodySize = 10;
  const marginX = 48;
  const marginY = 48;
  let cursorY = pageHeight - marginY;

  const drawText = (text: string, size: number) => {
    const lines = wrapLine(text, pageWidth - marginX * 2, font, size);
    for (const line of lines) {
      if (cursorY <= marginY) {
        page = pdfDoc.addPage(PageSizes.A4);
        cursorY = page.getHeight() - marginY;
      }
      page.drawText(line, { x: marginX, y: cursorY, size, font });
      cursorY -= size + 4;
    }
  };

  drawText(table.title, titleSize);
  cursorY -= 12;

  drawText(table.columns.join(" | "), bodySize);
  cursorY -= 6;

  for (const row of table.rows) {
    drawText(row.map((cell) => String(cell)).join(" | "), bodySize);
  }

  const generatedOn = `Generated on ${formatDate(new Date(), "dd MMM yyyy HH:mm")}`;
  cursorY -= 10;
  drawText(generatedOn, bodySize);

  return pdfDoc.save();
};

export const buildReportFile = async ({
  type,
  format,
  filters,
}: {
  type: ReportType;
  format: ReportFormat;
  filters: NormalizedReportFilters;
}) => {
  const table = await buildReportTable(type, filters);

  const timestamp = formatDate(new Date(), "yyyyMMdd-HHmm");
  const baseFilename = `rahunu-${type.toLowerCase()}-${timestamp}`;

  if (format === "CSV") {
    const buffer = buildCsvBuffer(table);
    return {
      filename: `${baseFilename}.csv`,
      contentType: "text/csv",
      body: buffer,
    };
  }

  if (format === "XLSX") {
    const buffer = buildXlsxBuffer(table);
    return {
      filename: `${baseFilename}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: buffer,
    };
  }

  const buffer = await buildPdfBuffer(table);
  return {
    filename: `${baseFilename}.pdf`,
    contentType: "application/pdf",
    body: buffer,
  };
};


