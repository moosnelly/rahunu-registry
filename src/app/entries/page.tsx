'use client';
import type { ReactNode } from 'react';
import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DateRange } from 'react-day-picker';
import useSWR from 'swr';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { endOfDay, startOfDay, startOfYear, subDays, format } from 'date-fns';
import { CalendarIcon, Download, Edit, ExternalLink, Eye, FileText, History, MoreHorizontal, SearchIcon, Trash2, XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { actionBadgeStyles, formatActionLabel, formatAuditDetails } from '@/app/admin/audit/utils';

type EntryAttachment = {
  name?: string | null;
  dataUrl?: string | null;
  size?: number | null;
};

type EntryAttachmentRecord = Record<string, EntryAttachment | null | undefined>;

type Entry = {
  id: string;
  no: number;
  agreementNumber: string;
  borrowers: { id?: string; fullName: string; nationalId?: string | null }[];
  island: string;
  status: 'ONGOING' | 'CANCELLED' | 'COMPLETED';
  loanAmount: string;
  date: string;
  branch?: string | null;
  formNumber?: string | null;
  address?: string | null;
  dateOfCancelled?: string | null;
  attachments?: EntryAttachmentRecord | null;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type DatePreset = 'ALL' | 'LAST_30_DAYS' | 'LAST_90_DAYS' | 'THIS_YEAR' | 'CUSTOM';
type AmountRangeKey = 'ANY' | 'UNDER_50K' | '50K_100K' | '100K_250K' | '250K_PLUS';

type Filters = {
  query: string;
  status: Entry['status'] | 'ALL';
  island: string | 'ALL';
  branch: string | 'ALL';
  datePreset: DatePreset;
  customRange?: DateRange | undefined;
  amountRange: AmountRangeKey;
};

type ApiResponse = {
  items: Entry[];
  total: number;
  page: number;
  size: number;
  filters?: {
    islands: string[];
    branches: string[];
  };
};

const statusOptions: { value: Entry['status'] | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Any Status' },
  { value: 'ONGOING', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const datePresetOptions: { value: DatePreset; label: string }[] = [
  { value: 'ALL', label: 'All Time' },
  { value: 'LAST_30_DAYS', label: 'Last 30 Days' },
  { value: 'LAST_90_DAYS', label: 'Last 90 Days' },
  { value: 'THIS_YEAR', label: 'This Year' },
  { value: 'CUSTOM', label: 'Custom Range' },
];

const amountRangeOptions: { value: AmountRangeKey; label: string }[] = [
  { value: 'ANY', label: 'Any Amount' },
  { value: 'UNDER_50K', label: 'Up to MVR 50,000' },
  { value: '50K_100K', label: 'MVR 50,000 – 100,000' },
  { value: '100K_250K', label: 'MVR 100,000 – 250,000' },
  { value: '250K_PLUS', label: 'MVR 250,000+' },
];

const amountRangeMap: Record<AmountRangeKey, { min?: number; max?: number }> = {
  ANY: {},
  UNDER_50K: { max: 50_000 },
  '50K_100K': { min: 50_000, max: 100_000 },
  '100K_250K': { min: 100_000, max: 250_000 },
  '250K_PLUS': { min: 250_000 },
};

const defaultFilters: Filters = {
  query: '',
  status: 'ALL',
  island: 'ALL',
  branch: 'ALL',
  datePreset: 'ALL',
  customRange: undefined,
  amountRange: 'ANY',
};

const statusStyles: Record<Entry['status'], string> = {
  ONGOING: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  COMPLETED: 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
  CANCELLED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
};

const formatCurrency = (value: string | number) => {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(amount)) return '—';
  return amount.toLocaleString('en-MV', {
    style: 'currency',
    currency: 'MVR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const attachmentLabels: Record<string, string> = {
  bankLetter: 'Bank Letter',
  agreementDocument: 'Agreement Document',
  landRegistry: 'Land Registry',
};

const formatAttachmentLabel = (key: string) => {
  if (attachmentLabels[key]) return attachmentLabels[key];
  const withSpaces = key.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ');
  return withSpaces.replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatFileSize = (bytes?: number | null) => {
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const getDateRange = (filters: Filters) => {
  if (filters.datePreset === 'ALL') return { start: undefined as Date | undefined, end: undefined as Date | undefined };

  if (filters.datePreset === 'CUSTOM') {
    const from = filters.customRange?.from ? startOfDay(filters.customRange.from) : undefined;
    const toSource = filters.customRange?.to ?? filters.customRange?.from;
    const to = toSource ? endOfDay(toSource) : undefined;
    return { start: from, end: to };
  }

  const now = new Date();
  const end = endOfDay(now);

  if (filters.datePreset === 'LAST_30_DAYS') {
    return { start: startOfDay(subDays(now, 30)), end };
  }

  if (filters.datePreset === 'LAST_90_DAYS') {
    return { start: startOfDay(subDays(now, 90)), end };
  }

  if (filters.datePreset === 'THIS_YEAR') {
    return { start: startOfDay(startOfYear(now)), end };
  }

  return { start: undefined, end: undefined };
};

const getDatePresetLabel = (filters: Filters) => {
  if (filters.datePreset === 'CUSTOM') {
    const from = filters.customRange?.from;
    const to = filters.customRange?.to ?? filters.customRange?.from;
    if (from && to) {
      return `${format(from, 'd MMM yyyy')} – ${format(to, 'd MMM yyyy')}`;
    }
    if (from) return format(from, 'd MMM yyyy');
    return 'Custom Range';
  }
  return datePresetOptions.find((option) => option.value === filters.datePreset)?.label ?? 'Date Range';
};

const getAmountRangeLabel = (value: AmountRangeKey) =>
  amountRangeOptions.find((option) => option.value === value)?.label ?? 'Any Amount';

export default function EntriesPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const canWrite = role === 'ADMIN' || role === 'DATA_ENTRY';
  const [filters, setFilters] = useState<Filters>(() => ({ ...defaultFilters }));
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedFilters(filters);
      setCurrentPage(1); // Reset to first page when filters change
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [filters]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (debouncedFilters.query.trim()) params.set('query', debouncedFilters.query.trim());
    if (debouncedFilters.status !== 'ALL') params.set('status', debouncedFilters.status);
    if (debouncedFilters.island !== 'ALL') params.set('island', debouncedFilters.island);
    if (debouncedFilters.branch !== 'ALL') params.set('branch', debouncedFilters.branch);

    const { start, end } = getDateRange(debouncedFilters);
    if (start) params.set('startDate', start.toISOString());
    if (end) params.set('endDate', end.toISOString());

    const amountConfig = amountRangeMap[debouncedFilters.amountRange];
    if (amountConfig?.min !== undefined) params.set('minAmount', String(amountConfig.min));
    if (amountConfig?.max !== undefined) params.set('maxAmount', String(amountConfig.max));

    // Add pagination parameters
    params.set('page', String(currentPage));
    params.set('size', String(pageSize));

    return params.toString();
  }, [debouncedFilters, currentPage, pageSize]);

  const { data, error, isLoading } = useSWR<ApiResponse>(`/api/entries${queryString ? `?${queryString}` : ''}`, fetcher, {
    refreshInterval: 60_000,
  });

  const handleFilterChange = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const islands = useMemo(
    () => ['ALL', ...(data?.filters?.islands ?? []).filter((value) => !!value && value.trim().length > 0)],
    [data?.filters?.islands],
  );
  const branches = useMemo(
    () => ['ALL', ...(data?.filters?.branches ?? []).filter((value) => !!value && value.trim().length > 0)],
    [data?.filters?.branches],
  );

  const handlePresetSelect = (value: DatePreset) => {
    setFilters((prev) => ({
      ...prev,
      datePreset: value,
      customRange: value === 'CUSTOM' ? prev.customRange : undefined,
    }));
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setFilters((prev) => ({
      ...prev,
      datePreset: 'CUSTOM',
      customRange: range,
    }));
  };

  const items: Entry[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [auditEntryId, setAuditEntryId] = useState<string | null>(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenEntry = (entry: Entry) => {
    setSelectedEntry(entry);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEntry(null);
  };

  const handleOpenAudit = (entryId: string) => {
    setAuditEntryId(entryId);
    setIsAuditOpen(true);
  };

  const handleCloseAudit = () => {
    setAuditEntryId(null);
    setIsAuditOpen(false);
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this entry? You can restore it later from System Settings.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/entries/${entryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete entry');
      }

      // Refresh the entries list
      await data && (window.location.reload());
    } catch (error) {
      alert('Failed to delete entry. Please try again.');
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
      setDeleteEntryId(null);
    }
  };

  const dateLabel = getDatePresetLabel(filters);
  const amountLabel = getAmountRangeLabel(filters.amountRange);
  const hasActiveFilters = useMemo(() => {
    return (
      filters.query.trim().length > 0 ||
      filters.status !== 'ALL' ||
      filters.island !== 'ALL' ||
      filters.branch !== 'ALL' ||
      filters.amountRange !== 'ANY' ||
      filters.datePreset !== 'ALL'
    );
  }, [filters]);

  const resetFilters = () => {
    setFilters({ ...defaultFilters });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">Registry Entries</h1>
          <p className="text-sm text-muted-foreground">
            Browse the registry, filter for borrowers, and manage loan agreements.
          </p>
        </div>
        {canWrite ? (
          <Button asChild>
            <Link href="/entries/new">New Entry</Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-xl text-foreground">Entries Overview</CardTitle>
          <CardDescription>
            A searchable list of borrower agreements with status, island, amount, and quick actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-0">
          <div className="space-y-4 px-6 pt-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.query}
                  onChange={(event) => handleFilterChange('query', event.target.value)}
                  placeholder="Search by Agreement Number, Borrower Name/ID"
                  className="h-11 rounded-xl pl-10"
                />
                {filters.query ? (
                  <button
                    type="button"
                    onClick={() => handleFilterChange('query', '')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{total.toLocaleString()} results</span>
                <Button variant="outline" onClick={resetFilters} disabled={!hasActiveFilters}>
                  Reset
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value as Filters['status'])}>
                <SelectTrigger className="h-11 rounded-lg border-border/70">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.island} onValueChange={(value) => handleFilterChange('island', value as Filters['island'])}>
                <SelectTrigger className="h-11 rounded-lg border-border/70">
                  <SelectValue placeholder="Island" />
                </SelectTrigger>
                <SelectContent>
                  {islands.map((island) => (
                    <SelectItem key={island} value={island}>
                      {island === 'ALL' ? 'All Islands' : island}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.branch} onValueChange={(value) => handleFilterChange('branch', value as Filters['branch'])}>
                <SelectTrigger className="h-11 rounded-lg border-border/70">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch === 'ALL' ? 'All Branches' : branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.amountRange}
                onValueChange={(value) => handleFilterChange('amountRange', value as Filters['amountRange'])}
              >
                <SelectTrigger className="h-11 rounded-lg border-border/70">
                  <SelectValue placeholder="Amount Range" />
                </SelectTrigger>
                <SelectContent>
                  {amountRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11 justify-between rounded-lg border-border/70 px-4 text-sm font-normal">
                    <span className="flex items-center gap-2 text-left">
                      <CalendarIcon className="h-4 w-4" />
                      {dateLabel}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] space-y-4 p-4" align="start">
                  <div className="grid grid-cols-2 gap-2">
                    {datePresetOptions.map((option) => (
                      <Button
                        key={option.value}
                        variant={option.value === filters.datePreset ? 'default' : 'outline'}
                        size="sm"
                        className="justify-start"
                        onClick={() => handlePresetSelect(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <Calendar mode="range" numberOfMonths={2} selected={filters.customRange} onSelect={handleRangeSelect} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {error ? (
            <div className="py-12 text-center text-sm text-destructive">
              Failed to load entries. Please refresh the page.
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background/80 backdrop-blur">
                <TableRow>
                  <TableHead className="w-16">No</TableHead>
                  <TableHead>Agreement</TableHead>
                  <TableHead>Borrower(s)</TableHead>
                  <TableHead>Island</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <TableRow key={idx}>
                      {Array.from({ length: 8 }).map((__, cellIdx) => (
                        <TableCell key={cellIdx}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      No entries found. {canWrite ? 'Create a new registry entry to get started.' : ''}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((entry) => {
                    const borrowerCount = entry.borrowers?.length ?? 0;
                    const topBorrower = entry.borrowers?.[0]?.fullName ?? '—';
                    const additional = borrowerCount > 1 ? `+${borrowerCount - 1} more` : '';

                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-muted-foreground">{entry.no}</TableCell>
                        <TableCell className="font-medium">
                          <Link href={`/entries/${entry.id}/edit`} className="hover:underline">
                            {entry.agreementNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <span>{topBorrower}</span> <span className="text-xs text-muted-foreground/80">{additional}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{entry.island}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('border-0 font-medium', statusStyles[entry.status])}>
                            {entry.status === 'ONGOING'
                              ? 'Active'
                              : entry.status === 'COMPLETED'
                              ? 'Completed'
                              : 'Cancelled'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(entry.loanAmount)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.date ? new Date(entry.date).toLocaleDateString('en-GB') : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onSelect={() => handleOpenEntry(entry)} className="gap-2">
                                <Eye className="h-4 w-4" />
                                Quick view
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleOpenAudit(entry.id)} className="gap-2">
                                <History className="h-4 w-4" />
                                View history
                              </DropdownMenuItem>
                              {canWrite ? <DropdownMenuSeparator /> : null}
                              {canWrite ? (
                                <DropdownMenuItem asChild>
                                  <Link href={`/entries/${entry.id}/edit`} className="gap-2 flex items-center">
                                    <Edit className="h-4 w-4" />
                                    Edit entry
                                  </Link>
                                </DropdownMenuItem>
                              ) : null}
                              {canWrite ? (
                                <DropdownMenuItem 
                                  onSelect={() => handleDeleteEntry(entry.id)}
                                  className="gap-2 text-destructive focus:text-destructive"
                                  disabled={isDeleting}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete entry
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {!error && total > 0 && (
          <CardFooter className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, total)} of {total.toLocaleString()} entries
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || isLoading}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, Math.ceil(total / pageSize)) }, (_, i) => {
                  const totalPages = Math.ceil(total / pageSize);
                  let pageNumber: number;
                  
                  if (totalPages <= 5) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + i;
                  } else {
                    pageNumber = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNumber}
                      variant={currentPage === pageNumber ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNumber)}
                      disabled={isLoading}
                      className="h-9 w-9 p-0"
                    >
                      {pageNumber}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(Math.ceil(total / pageSize), prev + 1))}
                disabled={currentPage >= Math.ceil(total / pageSize) || isLoading}
              >
                Next
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
      <EntryDetailsModal entry={selectedEntry} open={isModalOpen} onClose={handleCloseModal} canEdit={canWrite} />
      <EntryAuditDialog entryId={auditEntryId} open={isAuditOpen} onClose={handleCloseAudit} />
    </div>
  );
}

type EntryDetailsModalProps = {
  entry: Entry | null;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
};

function EntryDetailsModal({ entry, open, onClose, canEdit }: EntryDetailsModalProps) {
  const [mounted, setMounted] = useState(false);
  const labelId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  // Log entry view when modal opens
  useEffect(() => {
    if (!open || !entry) return;
    
    const logView = async () => {
      try {
        await fetch(`/api/entries/${entry.id}?context=modal`);
      } catch (error) {
        // Silently fail - logging is not critical
        console.error('Failed to log entry view:', error);
      }
    };
    
    logView();
  }, [open, entry]);

  const attachmentEntries = useMemo(() => {
    if (!entry?.attachments) return [] as [string, EntryAttachment | null | undefined][];
    return Object.entries(entry.attachments).filter(([, value]) => value?.dataUrl);
  }, [entry?.attachments]);

  if (!mounted || !open || !entry) return null;

  const borrowers = entry.borrowers ?? [];

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-background/80 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      onClick={onClose}
    >
      <div className="flex min-h-full items-start justify-center px-4 py-6 sm:items-center sm:py-10">
        <Card
          className="mx-auto flex w-full max-w-2xl flex-col overflow-hidden max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]"
          onClick={(event) => event.stopPropagation()}
        >
          <CardHeader className="space-y-3">
            <CardTitle id={labelId} className="flex flex-wrap items-baseline gap-2 text-2xl">
              <span>Entry #{entry.no}</span>
              <span className="text-base font-normal text-muted-foreground">{entry.agreementNumber}</span>
            </CardTitle>
            <CardDescription>
              Detailed view of the registry entry including borrower information and status.
            </CardDescription>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className={cn('border-0 font-medium', statusStyles[entry.status])}>
                {entry.status === 'ONGOING'
                  ? 'Active'
                  : entry.status === 'COMPLETED'
                  ? 'Completed'
                  : 'Cancelled'}
              </Badge>
              <span className="text-muted-foreground">
                {entry.date ? new Date(entry.date).toLocaleDateString('en-GB') : '—'}
              </span>
              <span className="text-muted-foreground">{formatCurrency(entry.loanAmount)}</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 space-y-6 overflow-y-auto min-h-0 pr-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Registry No" value={entry.no ?? '—'} />
              <DetailItem label="Agreement" value={entry.agreementNumber || '—'} />
              <DetailItem label="Island" value={entry.island || '—'} />
              <DetailItem label="Branch" value={entry.branch || '—'} />
              <DetailItem label="Form Number" value={entry.formNumber || '—'} />
              <DetailItem label="Date" value={entry.date ? new Date(entry.date).toLocaleDateString('en-GB') : '—'} />
              {entry.dateOfCancelled ? (
                <DetailItem
                  label="Date Cancelled"
                  value={new Date(entry.dateOfCancelled).toLocaleDateString('en-GB')}
                />
              ) : null}
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Borrowers</p>
              {borrowers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No borrower details available.</p>
              ) : (
                <ul className="space-y-2">
                  {borrowers.map((borrower) => (
                    <li key={borrower.id ?? borrower.fullName} className="rounded-lg border border-border/60 p-3 text-sm">
                      <p className="font-medium text-foreground">{borrower.fullName}</p>
                      {borrower.nationalId ? (
                        <p className="text-xs text-muted-foreground">{borrower.nationalId}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {attachmentEntries.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Attachments</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {attachmentEntries.map(([key, value]) => {
                    const label = formatAttachmentLabel(key);
                    const sizeLabel = formatFileSize(value?.size ?? undefined);
                    return (
                      <div
                        key={key}
                        className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/30 p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              {label}
                            </p>
                            <p className="text-xs text-muted-foreground">{value?.name || 'Document'}</p>
                          </div>
                          <Badge variant="outline" className="border-0 text-[0.65rem] font-semibold uppercase">
                            {sizeLabel}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-9 flex-1 min-w-[120px]"
                          >
                            <a href={value?.dataUrl ?? ''} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" /> View
                            </a>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-9 flex-1 min-w-[120px]"
                            onClick={() => {
                              if (!value?.dataUrl) return;
                              const link = document.createElement('a');
                              link.href = value.dataUrl;
                              link.download = value.name || `${key}.pdf`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                          >
                            <Download className="mr-2 h-4 w-4" /> Download
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {entry.address ? (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Address</p>
                <p className="text-sm text-foreground">{entry.address}</p>
              </div>
            ) : null}
          </CardContent>
        <CardFooter className="flex items-center justify-between gap-2">
          {canEdit ? (
            <Button asChild variant="outline">
              <Link href={`/entries/${entry.id}/edit`}>Edit Entry</Link>
            </Button>
          ) : (
            <div />
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </CardFooter>
      </Card>
    </div>
  </div>,
  document.body,
);
}

type DetailItemProps = {
  label: string;
  value: ReactNode;
};

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div className="space-y-1 rounded-lg border border-border/60 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value ?? '—'}</p>
    </div>
  );
}

function EntryAuditDialog({ entryId, open, onClose }: { entryId: string | null; open: boolean; onClose: () => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!open || !entryId) {
      setLogs([]);
      setIsLoading(false);
      setError(null);
      setRefreshToken(0);
      return;
    }

    let isCancelled = false;

    const fetchAudit = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/audit?entity=entry&target=${entryId}&limit=50`);
        if (!response.ok) {
          throw new Error('Unable to load audit history');
        }
        const data = await response.json();
        if (!isCancelled) {
          setLogs(Array.isArray(data.logs) ? data.logs : []);
        }
      } catch (fetchError) {
        if (!isCancelled) {
          setError((fetchError as Error).message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchAudit();

    return () => {
      isCancelled = true;
    };
  }, [entryId, open, refreshToken]);

  const handleRefresh = () => {
    if (!entryId) return;
    setRefreshToken((prev) => prev + 1);
  };

  const renderSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={idx} className="flex gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/30 py-12 text-center">
      <History className="h-8 w-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">No audit events yet</p>
        <p className="text-xs text-muted-foreground">Changes to this entry will appear here once recorded.</p>
      </div>
    </div>
  );

  const renderError = () => (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      {error}
    </div>
  );

  const renderTimeline = () => (
    <ul className="space-y-6">
      {logs.map((log, idx) => {
        const isLast = idx === logs.length - 1;
        const timestamp = log.createdAt
          ? new Date(log.createdAt).toLocaleString('en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : '—';
        const initials = log.actor?.email?.[0]?.toUpperCase() ?? 'A';
        const detailText = formatAuditDetails(log.action || '', log.details);

        return (
          <li key={log.id ?? `${log.createdAt}-${idx}`} className="relative pl-12">
            {!isLast ? <span className="absolute left-5 top-10 h-full w-px bg-border" aria-hidden /> : null}
            <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {initials}
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{log.actor?.email ?? 'Admin User'}</p>
                <Badge
                  variant="outline"
                  className={cn(
                    'border-0 text-[0.65rem] font-semibold uppercase tracking-wide',
                    actionBadgeStyles(log.action || ''),
                  )}
                >
                  {formatActionLabel(log.action || '')}
                </Badge>
                <span className="text-xs text-muted-foreground">{timestamp}</span>
              </div>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  {detailText}
                </pre>
                {log.targetEntry?.agreementNumber ? (
                  <p className="text-xs text-muted-foreground/80">
                    Agreement: <span className="font-medium text-foreground">{log.targetEntry.agreementNumber}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="space-y-2 border-b border-border/60 bg-muted/40 px-6 py-5 text-left">
          <DialogTitle className="text-lg font-semibold">Entry Audit Trail</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            A chronological log of updates, deletions, and other activity related to this registry entry.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[calc(100vh-200px)] grid-rows-[auto,1fr] gap-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-6 py-4 text-xs text-muted-foreground">
            {entryId ? (
              <span>
                Entry ID: <span className="font-medium text-foreground">{entryId}</span>
              </span>
            ) : (
              <span>No entry selected</span>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading || !entryId}
              className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background px-3 py-1 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-6 scroll-smooth">
            {isLoading ? renderSkeleton() : error ? renderError() : logs.length === 0 ? renderEmpty() : renderTimeline()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
