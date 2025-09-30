'use client';

import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import useSWR from 'swr';
import { format } from 'date-fns';
import { CalendarIcon, Check, DownloadCloud, Loader2, Eye } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type EntryFiltersResponse = {
  filters?: {
    islands: string[];
    branches: string[];
  };
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ReportType = 'SUMMARY' | 'DETAILED' | 'CUSTOM';
type ReportFormat = 'CSV' | 'XLSX' | 'PDF';

const reportTypes: { value: ReportType; label: string; description: string }[] = [
  {
    value: 'SUMMARY',
    label: 'Summary Report',
    description: 'Totals, averages, and status breakdowns for quick analysis.',
  },
  {
    value: 'DETAILED',
    label: 'Detailed Listing',
    description: 'Full agreement listing with borrower names and loan data.',
  },
  {
    value: 'CUSTOM',
    label: 'Custom Report',
    description: 'Branch performance grouped totals with averages per branch.',
  },
];

const exportFormats: { value: ReportFormat; label: string }[] = [
  { value: 'CSV', label: 'CSV' },
  { value: 'XLSX', label: 'XLSX' },
  { value: 'PDF', label: 'PDF' },
];

const statusOptions: { value: 'ALL' | 'ONGOING' | 'COMPLETED' | 'CANCELLED'; label: string }[] = [
  { value: 'ALL', label: 'Any Status' },
  { value: 'ONGOING', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const formatDateRangeLabel = (range?: DateRange | undefined) => {
  const from = range?.from;
  const to = range?.to ?? range?.from;
  if (from && to) {
    return `${format(from, 'd MMM yyyy')} – ${format(to, 'd MMM yyyy')}`;
  }
  if (from) {
    return format(from, 'd MMM yyyy');
  }
  return 'Select Date Range';
};

const parseNumberInput = (value: string) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const extractFilename = (disposition: string | null, fallback: string) => {
  if (!disposition) return fallback;
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  if (match?.[1]) return match[1];
  return fallback;
};

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('SUMMARY');
  const [formatValue, setFormatValue] = useState<ReportFormat>('CSV');
  const [status, setStatus] = useState<'ALL' | 'ONGOING' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [island, setIsland] = useState<string>('ALL');
  const [branch, setBranch] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: filtersResponse, isLoading: isFiltersLoading } = useSWR<EntryFiltersResponse>(
    '/api/entries?size=1',
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  const islands = useMemo(() => {
    const values = filtersResponse?.filters?.islands ?? [];
    return ['ALL', ...values.filter((value) => value && value.trim().length > 0)];
  }, [filtersResponse?.filters?.islands]);

  const branches = useMemo(() => {
    const values = filtersResponse?.filters?.branches ?? [];
    return ['ALL', ...values.filter((value) => value && value.trim().length > 0)];
  }, [filtersResponse?.filters?.branches]);

  const handleClearDateRange = () => {
    setDateRange(undefined);
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        reportType,
        format: formatValue,
        filters: {
          status: status !== 'ALL' ? status : undefined,
          island: island !== 'ALL' ? island : undefined,
          branch: branch !== 'ALL' ? branch : undefined,
          startDate: dateRange?.from?.toISOString(),
          endDate: dateRange?.to?.toISOString() ?? dateRange?.from?.toISOString(),
          minAmount: parseNumberInput(minAmount),
          maxAmount: parseNumberInput(maxAmount),
        },
      };

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error ?? 'Failed to generate report');
      }

      const blob = await response.blob();
      const filename = extractFilename(response.headers.get('Content-Disposition'), 'rahunu-report');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setSuccessMessage(`Report generated successfully as ${formatValue}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreviewReport = async () => {
    setIsPreviewing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        reportType,
        format: formatValue,
        filters: {
          status: status !== 'ALL' ? status : undefined,
          island: island !== 'ALL' ? island : undefined,
          branch: branch !== 'ALL' ? branch : undefined,
          startDate: dateRange?.from?.toISOString(),
          endDate: dateRange?.to?.toISOString() ?? dateRange?.from?.toISOString(),
          minAmount: parseNumberInput(minAmount),
          maxAmount: parseNumberInput(maxAmount),
        },
      };

      const response = await fetch('/api/reports/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error ?? 'Failed to generate preview');
      }

      const data = await response.json();
      setPreviewData(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate preview');
      setPreviewData(null);
    } finally {
      setIsPreviewing(false);
    }
  };

  const onMinAmountChange = (value: string) => {
    setMinAmount(value);
  };

  const onMaxAmountChange = (value: string) => {
    setMaxAmount(value);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Generate Reports</h1>
        <p className="text-sm text-muted-foreground">
          Customize and export Rahunu registry reports with the filters you need.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-xl text-foreground">Report Builder</CardTitle>
          <CardDescription>Create on-demand summaries, detailed listings, or branch-level reports.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pt-6">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Report Type</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {reportTypes.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setReportType(option.value)}
                  className={cn(
                    'flex h-full flex-col items-start gap-2 rounded-xl border p-4 text-left transition hover:border-primary/60 hover:shadow-sm',
                    reportType === option.value
                      ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                      : 'border-border/70 bg-background',
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-base font-semibold text-foreground">{option.label}</span>
                    {reportType === option.value ? <Check className="h-5 w-5 text-primary" /> : null}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{option.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Filters</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                  <SelectTrigger id="status" className="h-11 rounded-lg border-border/70">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="island">Island</Label>
                <Select
                  value={island}
                  onValueChange={(value) => setIsland(value)}
                  disabled={isFiltersLoading && islands.length <= 1}
                >
                  <SelectTrigger id="island" className="h-11 rounded-lg border-border/70">
                    <SelectValue placeholder="Select Island" />
                  </SelectTrigger>
                  <SelectContent>
                    {islands.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option === 'ALL' ? 'All Islands' : option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="branch">Branch</Label>
                <Select
                  value={branch}
                  onValueChange={(value) => setBranch(value)}
                  disabled={isFiltersLoading && branches.length <= 1}
                >
                  <SelectTrigger id="branch" className="h-11 rounded-lg border-border/70">
                    <SelectValue placeholder="Select Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option === 'ALL' ? 'All Branches' : option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Date Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 justify-between rounded-lg border-border/70 px-4 text-sm font-normal"
                    >
                      <span className="flex items-center gap-2 text-left">
                        <CalendarIcon className="h-4 w-4" />
                        {formatDateRangeLabel(dateRange)}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto space-y-4 p-4" align="start">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">Select date range</p>
                        <p className="text-xs text-muted-foreground">
                          Choose a start and end date to limit included agreements.
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleClearDateRange}>
                        Clear
                      </Button>
                    </div>
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="min-amount">Min Amount</Label>
                <Input
                  id="min-amount"
                  type="number"
                  inputMode="decimal"
                  placeholder="Min Amount"
                  value={minAmount}
                  onChange={(event) => onMinAmountChange(event.target.value)}
                  className="h-11 rounded-lg border-border/70"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="max-amount">Max Amount</Label>
                <Input
                  id="max-amount"
                  type="number"
                  inputMode="decimal"
                  placeholder="Max Amount"
                  value={maxAmount}
                  onChange={(event) => onMaxAmountChange(event.target.value)}
                  className="h-11 rounded-lg border-border/70"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Export Format</h2>
            <div className="grid w-full gap-3 sm:grid-cols-3">
              {exportFormats.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={formatValue === option.value ? 'default' : 'outline'}
                  className={cn(
                    'h-12 rounded-xl border border-border/70 text-base font-medium transition',
                    formatValue === option.value ? 'border-primary bg-primary/90 text-primary-foreground' : '',
                  )}
                  onClick={() => setFormatValue(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </section>

          {(errorMessage || successMessage) && (
            <Alert variant={errorMessage ? 'destructive' : 'default'}>
              <AlertTitle>{errorMessage ? 'Failed to generate report' : 'Success'}</AlertTitle>
              <AlertDescription>{errorMessage ?? successMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-col-reverse gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Reports include data from the national Rahunu registry. Filters apply before export.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={handlePreviewReport}
              disabled={isPreviewing || isGenerating}
              variant="outline"
              className="min-w-[160px]"
            >
              {isPreviewing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </>
              )}
            </Button>
            <Button onClick={handleGenerateReport} disabled={isGenerating || isPreviewing} className="min-w-[180px]">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <DownloadCloud className="mr-2 h-4 w-4" />
                  Generate Report
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>

      {previewData && (
        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-xl text-foreground">Report Preview</CardTitle>
            <CardDescription>
              Preview of {reportTypes.find((t) => t.value === reportType)?.label.toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {previewData.reportType === 'SUMMARY' && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Entries</CardDescription>
                      <CardTitle className="text-2xl">{previewData.data.totals.entries.toLocaleString()}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Amount</CardDescription>
                      <CardTitle className="text-2xl">
                        {new Intl.NumberFormat('en-MV', {
                          style: 'currency',
                          currency: 'MVR',
                        }).format(previewData.data.totals.amount)}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Average Amount</CardDescription>
                      <CardTitle className="text-2xl">
                        {new Intl.NumberFormat('en-MV', {
                          style: 'currency',
                          currency: 'MVR',
                        }).format(previewData.data.totals.averageAmount)}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Status Breakdown
                  </h3>
                  <div className="rounded-lg border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Count</TableHead>
                          <TableHead>Total Amount</TableHead>
                          <TableHead>Percentage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.data.statusBreakdown.map((item: any) => (
                          <TableRow key={item.status}>
                            <TableCell className="font-medium">{item.status}</TableCell>
                            <TableCell>{item.count.toLocaleString()}</TableCell>
                            <TableCell>
                              {new Intl.NumberFormat('en-MV', {
                                style: 'currency',
                                currency: 'MVR',
                              }).format(item.totalAmount)}
                            </TableCell>
                            <TableCell>{item.percentage.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {previewData.data.topIslands.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Top Islands
                    </h3>
                    <div className="rounded-lg border border-border/60">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Island</TableHead>
                            <TableHead>Count</TableHead>
                            <TableHead>Total Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.data.topIslands.map((item: any) => (
                            <TableRow key={item.island}>
                              <TableCell className="font-medium">{item.island}</TableCell>
                              <TableCell>{item.count.toLocaleString()}</TableCell>
                              <TableCell>
                                {new Intl.NumberFormat('en-MV', {
                                  style: 'currency',
                                  currency: 'MVR',
                                }).format(item.totalAmount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {previewData.reportType === 'DETAILED' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {previewData.data.length} entries
                  </p>
                </div>
                <div className="rounded-lg border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Registry No</TableHead>
                        <TableHead>Agreement</TableHead>
                        <TableHead>Borrowers</TableHead>
                        <TableHead>Island</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Loan Amount</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.data.slice(0, 20).map((row: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{row.no}</TableCell>
                          <TableCell>{row.agreementNumber}</TableCell>
                          <TableCell>{row.borrowers.join(', ')}</TableCell>
                          <TableCell>{row.island}</TableCell>
                          <TableCell>{row.branch}</TableCell>
                          <TableCell>{row.status}</TableCell>
                          <TableCell>
                            {new Intl.NumberFormat('en-MV', {
                              style: 'currency',
                              currency: 'MVR',
                            }).format(row.loanAmount)}
                          </TableCell>
                          <TableCell>{new Date(row.date).toLocaleDateString('en-GB')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {previewData.data.length > 20 && (
                  <p className="text-sm text-muted-foreground">
                    Showing first 20 of {previewData.data.length} entries. Download the full report to see all data.
                  </p>
                )}
              </div>
            )}

            {previewData.reportType === 'CUSTOM' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {previewData.data.length} branches
                  </p>
                </div>
                <div className="rounded-lg border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Branch</TableHead>
                        <TableHead>Agreements</TableHead>
                        <TableHead>Total Amount</TableHead>
                        <TableHead>Average Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.data.map((row: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{row.branch}</TableCell>
                          <TableCell>{row.count.toLocaleString()}</TableCell>
                          <TableCell>
                            {new Intl.NumberFormat('en-MV', {
                              style: 'currency',
                              currency: 'MVR',
                            }).format(row.totalAmount)}
                          </TableCell>
                          <TableCell>
                            {new Intl.NumberFormat('en-MV', {
                              style: 'currency',
                              currency: 'MVR',
                            }).format(row.averageAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


