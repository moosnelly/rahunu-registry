import Link from "next/link";
import { getServerSession } from "next-auth";
import { Status } from "@prisma/client";

import { authOptions } from "@/auth/options";
import { canRead, canWrite, type Role } from "@/lib/rbac";
import { fetchSummary } from "@/lib/reports";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpRight, BarChart3, ClipboardList, FileText, MapPin, PlusCircle } from "lucide-react";

export const revalidate = 60;

const numberFormatter = new Intl.NumberFormat("en-MV");
const currencyFormatter = new Intl.NumberFormat("en-MV", {
  style: "currency",
  currency: "MVR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatNumber = (value: number) => numberFormatter.format(value);
const formatCurrency = (value: number) => currencyFormatter.format(value);

const statusLabels: Record<Status, string> = {
  ONGOING: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const statusAccent: Record<Status, string> = {
  ONGOING: "bg-emerald-500",
  COMPLETED: "bg-sky-500",
  CANCELLED: "bg-rose-500",
};

const statusBadgeStyles: Record<Status, string> = {
  ONGOING: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  COMPLETED: "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
  CANCELLED: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
};

const allStatuses: Status[] = ["ONGOING", "COMPLETED", "CANCELLED"];

export default async function Page() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as Role | undefined;

  if (!session || !canRead(role)) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          You do not have permission to view the dashboard.
        </div>
      </div>
    );
  }

  let summary: Awaited<ReturnType<typeof fetchSummary>> | null = null;
  let summaryError: Error | null = null;

  try {
    summary = await fetchSummary({});
  } catch (error) {
    summaryError = error instanceof Error ? error : new Error("Failed to load summary");
  }

  const totals = summary?.totals ?? { entries: 0, amount: 0, averageAmount: 0 };
  const breakdownByStatus = allStatuses.map((status) =>
    summary?.statusBreakdown.find((item: any) => item.status === status) ?? {
      status,
      count: 0,
      totalAmount: 0,
      percentage: 0,
    },
  );
  const topIslands = summary?.topIslands ?? [];
  const recentEntries = summary?.recentEntries ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor registry activity, track performance, and jump straight to common actions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/entries">
              <FileText className="h-4 w-4" />
              View Entries
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/reports">
              <BarChart3 className="h-4 w-4" />
              Reports
            </Link>
          </Button>
          {canWrite(role) ? (
            <Button asChild>
              <Link href="/entries/new">
                <PlusCircle className="h-4 w-4" />
                Create New Entry
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {summaryError ? (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">We ran into a problem</CardTitle>
            <CardDescription className="text-destructive/80">
              {summaryError.message || "Unable to load registry metrics right now."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-destructive/80">
            Please try refreshing the page or return in a few minutes.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <div>
              <CardTitle className="text-sm text-muted-foreground">Total Entries</CardTitle>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(totals.entries)}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            All active, completed, and cancelled registry agreements.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <div>
              <CardTitle className="text-sm text-muted-foreground">Total Loan Volume</CardTitle>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(totals.amount)}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Sum of loan amounts across every registry entry on record.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <div>
              <CardTitle className="text-sm text-muted-foreground">Average Loan Size</CardTitle>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(totals.averageAmount)}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Average agreement value calculated over the full registry.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Status Breakdown</CardTitle>
            <CardDescription>Distribution of entries by lifecycle stage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {breakdownByStatus.every((item) => item.count === 0) ? (
              <p className="text-sm text-muted-foreground">No registry data yet. New entries will appear here.</p>
            ) : (
              breakdownByStatus.map((item) => {
                const width = item.percentage > 0 ? Math.max(item.percentage, 8) : 0;
                const status = item.status as Status;
                return (
                  <div key={item.status} className="space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full", statusAccent[status])} aria-hidden />
                        <span className="text-sm font-medium text-foreground">{statusLabels[status]}</span>
                        <span className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="text-sm font-semibold text-foreground">{formatNumber(item.count)}</div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(item.totalAmount)}</span>
                      <span>{item.count === 1 ? "1 record" : `${formatNumber(item.count)} records`}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", statusAccent[status])}
                        style={{ width: width ? `${Math.min(width, 100)}%` : "0%" }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Islands</CardTitle>
            <CardDescription>Where the most agreements originate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topIslands.length === 0 ? (
              <p className="text-sm text-muted-foreground">Island insights will appear once entries include island details.</p>
            ) : (
              <div className="space-y-3">
                {topIslands.map((island: any) => (
                  <div key={island.island} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{island.island}</p>
                        <p className="text-xs text-muted-foreground">{formatNumber(island.count)} entries</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(island.totalAmount)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Entries</CardTitle>
          <CardDescription>Latest agreements recorded in the registry.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {recentEntries.length === 0 ? (
            <div className="px-6 py-12 text-sm text-muted-foreground">
              No recent activity. Start by creating a new entry.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">No</TableHead>
                    <TableHead>Agreement</TableHead>
                    <TableHead>Borrower(s)</TableHead>
                    <TableHead>Island</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEntries.map((entry: any) => {
                    const borrowerCount = entry.borrowers?.length ?? 0;
                    const borrowerLabel = borrowerCount
                      ? `${entry.borrowers[0]}${borrowerCount > 1 ? ` +${borrowerCount - 1} more` : ""}`
                      : "—";
                    const entryStatus = entry.status as Status;

                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-muted-foreground">{entry.no}</TableCell>
                        <TableCell>
                          <Link href={`/entries/${entry.id}/edit`} className="font-medium text-primary hover:underline" prefetch={true}>
                            {entry.agreementNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{borrowerLabel}</TableCell>
                        <TableCell className="text-muted-foreground">{entry.island || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("border-0 text-xs font-semibold", statusBadgeStyles[entryStatus])}
                          >
                            {statusLabels[entryStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(entry.loanAmount)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.date
                            ? new Date(entry.date).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-t border-border/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Data updates every minute. Visit the entries list for full search, filters, and exports.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/entries">
                <ArrowUpRight className="h-4 w-4" />
                Go to entries
              </Link>
            </Button>
            {canWrite(role) ? (
              <Button asChild>
                <Link href="/entries/new">
                  <PlusCircle className="h-4 w-4" />
                  Create new entry
                </Link>
              </Button>
            ) : null}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
