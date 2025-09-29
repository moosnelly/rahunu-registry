'use client';

import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import useSWR from 'swr';
import { format } from 'date-fns';
import { CalendarIcon, Check, DownloadCloud, Loader2 } from 'lucide-react';

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
          <Button onClick={handleGenerateReport} disabled={isGenerating} className="min-w-[180px]">
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
        </CardFooter>
      </Card>
    </div>
  );
}


