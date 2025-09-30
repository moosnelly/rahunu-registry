'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { actionBadgeStyles, formatActionLabel, formatAuditDetails } from './utils';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const DEFAULT_FILTER_VALUE = 'all';

const entityOptions = [
  { value: DEFAULT_FILTER_VALUE, label: 'All entities' },
  { value: 'user', label: 'User' },
  { value: 'entry', label: 'Entry' },
] as const;

const actionGroups = [
  {
    label: 'User',
    actions: [
      { value: 'USER_CREATED', label: 'User created' },
      { value: 'USER_ROLE_CHANGED', label: 'Role changed' },
      { value: 'USER_PASSWORD_RESET', label: 'Password reset' },
      { value: 'USER_STATUS_CHANGED', label: 'Status changed' },
      { value: 'USER_SIGNED_IN', label: 'Signed in' },
    ],
  },
  {
    label: 'Entry',
    actions: [
      { value: 'ENTRY_CREATED', label: 'Entry created' },
      { value: 'ENTRY_UPDATED', label: 'Entry updated' },
      { value: 'ENTRY_DELETED', label: 'Entry deleted' },
      { value: 'ENTRY_VIEWED', label: 'Entry viewed' },
    ],
  },
] as const;

export default function AuditClient() {
  const [entity, setEntity] = useState<string>(DEFAULT_FILTER_VALUE);
  const [action, setAction] = useState<string>(DEFAULT_FILTER_VALUE);
  const [limit, setLimit] = useState<string>('100');

  const queryString = useMemo(() => {
    const search = new URLSearchParams();

    if (entity !== DEFAULT_FILTER_VALUE) {
      search.set('entity', entity);
    }

    if (action !== DEFAULT_FILTER_VALUE) {
      search.set('action', action);
    }

    if (limit) {
      search.set('limit', limit);
    }

    return search.toString();
  }, [action, entity, limit]);

  const [page, setPage] = useState<number>(1);

  const baseEndpoint = useMemo(() => {
    const url = queryString ? `/api/admin/audit?${queryString}` : '/api/admin/audit';
    return url;
  }, [queryString]);

  const endpoint = useMemo(() => {
    const url = new URL(baseEndpoint, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const pageSize = Number(limit || '100') || 100;
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));
    return url.pathname + url.search;
  }, [baseEndpoint, page, limit]);

  const { data, error, isLoading, mutate, isValidating } = useSWR(endpoint, fetcher, {
    refreshInterval: 60_000,
  });

  const logs = data?.logs ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;
  const isEmpty = !isLoading && logs.length === 0;

  const normalizeLog = (log: any) => {
    const rawDetails = log.details ?? null;

    // Use the new user-friendly formatter
    const details = formatAuditDetails(log.action || '', rawDetails);

    const target = log.targetUser
      ? `User • ${log.targetUser.email}`
      : log.targetEntry
      ? `Entry • #${log.targetEntry.no} (${log.targetEntry.agreementNumber})`
      : "—";

    return { details, target };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-foreground">Audit Trail</h1>
        <p className="text-sm text-muted-foreground">
          Review administrative actions across the registry and trace changes to records.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-xl text-foreground">Activity Log</CardTitle>
          <CardDescription>
            Filter by entity, action type, or limit the window of recent events.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="space-y-4 px-6 py-6">
            <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-muted p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-6">
              <div className="grid w-full gap-4 sm:grid-cols-2 md:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Entity</p>
                  <Select value={entity} onValueChange={setEntity}>
                    <SelectTrigger>
                      <SelectValue placeholder="All entities" />
                    </SelectTrigger>
                    <SelectContent>
                      {entityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Action</p>
                  <Select value={action} onValueChange={setAction}>
                    <SelectTrigger>
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DEFAULT_FILTER_VALUE}>All actions</SelectItem>
                      {actionGroups.map((group) => (
                        <SelectGroup key={group.label}>
                          <SelectLabel>{group.label}</SelectLabel>
                          {group.actions.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Limit</p>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={limit}
                    onChange={(event) => {
                      const next = event.target.value.replace(/[^0-9]/g, "");
                      setLimit(next ? String(Math.max(1, Math.min(500, Number(next)))) : "");
                    }}
                    placeholder="100"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 self-start sm:flex-row sm:justify-end lg:flex-row lg:items-center lg:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEntity(DEFAULT_FILTER_VALUE);
                    setAction(DEFAULT_FILTER_VALUE);
                    setLimit("100");
                    setPage(1);
                    mutate();
                  }}
                >
                  Reset
                </Button>
                <Button onClick={() => { setPage(1); mutate(); }}>Refresh</Button>
              </div>
            </div>
          </div>
          <div className="border-t border-border/60 px-6 pb-6">
            {error ? (
              <div className="py-12 text-center text-sm text-destructive">
                Unable to load audit logs. Please try again shortly.
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background p-4"
                      >
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 w-24" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-20 w-full" />
                      </div>
                    ))
                  ) : isEmpty ? (
                    <div className="rounded-lg border border-border/60 bg-muted/50 p-6 text-center text-sm text-muted-foreground sm:col-span-2">
                      No audit events match the current filters.
                    </div>
                  ) : (
                    logs.map((log: any, idx: number) => {
                      const { details, target } = normalizeLog(log);

                      return (
                        <div
                          key={log.id ?? `${log.createdAt}-${idx}`}
                          className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "border-0 font-medium",
                                actionBadgeStyles(log.action || "")
                              )}
                            >
                              {log.action ? formatActionLabel(log.action) : "—"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {log.createdAt
                                ? new Date(log.createdAt).toLocaleString("en-GB", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })
                                : "—"}
                            </span>
                          </div>
                          <div className="grid gap-2 text-sm sm:grid-cols-2 sm:gap-4">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Actor
                              </p>
                              <p className="text-muted-foreground">{log.actor?.email ?? "—"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Target
                              </p>
                              <p className="text-muted-foreground">{target}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              Details
                            </p>
                            <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/80 p-3 text-xs leading-relaxed text-muted-foreground">
                              {details}
                            </pre>
                          </div>
                        </div>
                      );
                    })
                  )}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || isValidating}>
                    Prev
                  </Button>
                  {Array.from({ length: Math.min(7, totalPages) }).map((_, idx) => {
                    // Simple window: center current when possible
                    const windowSize = 7;
                    const half = Math.floor(windowSize / 2);
                    let start = Math.max(1, page - half);
                    let end = Math.min(totalPages, start + windowSize - 1);
                    start = Math.max(1, end - windowSize + 1);
                    const pageNum = start + idx;
                    if (pageNum > end) return null;
                    const isActive = pageNum === page;
                    return (
                      <Button
                        key={pageNum}
                        variant={isActive ? 'default' : 'outline'}
                        onClick={() => setPage(pageNum)}
                        disabled={isValidating}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || isValidating}>
                    Next
                  </Button>
                </div>
                </div>
                <div className="hidden lg:block">
                  <div className="w-full overflow-x-auto">
                    <Table className="min-w-[960px]">
                  <TableHeader className="bg-background/80 backdrop-blur">
                    <TableRow>
                      <TableHead className="w-48">When</TableHead>
                      <TableHead className="w-40">Action</TableHead>
                      <TableHead className="w-48">Actor</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {isLoading ? (
                        Array.from({ length: 6 }).map((_, rowIdx) => (
                          <TableRow key={rowIdx}>
                            {Array.from({ length: 5 }).map((__, cellIdx) => (
                              <TableCell key={cellIdx}>
                                <Skeleton className="h-4 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : isEmpty ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                            No audit events match the current filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        logs.map((log: any, idx: number) => {
                          const { details, target } = normalizeLog(log);

                          return (
                            <TableRow key={log.id ?? `${log.createdAt}-${idx}`}>
                              <TableCell className="align-top text-muted-foreground">
                                {log.createdAt
                                  ? new Date(log.createdAt).toLocaleString("en-GB", {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })
                                  : "—"}
                              </TableCell>
                              <TableCell className="align-top">
                                <Badge
                                  variant="outline"
                                  className={cn("border-0 font-medium", actionBadgeStyles(log.action || ""))}
                                >
                                  {log.action ? formatActionLabel(log.action) : "—"}
                                </Badge>
                              </TableCell>
                              <TableCell className="align-top text-muted-foreground">{log.actor?.email ?? "—"}</TableCell>
                              <TableCell className="align-top text-muted-foreground">{target}</TableCell>
                              <TableCell className="align-top">
                                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/80 p-3 text-xs leading-relaxed text-muted-foreground">
                                  {details}
                                </pre>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                  </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || isValidating}>
                      Prev
                    </Button>
                    {Array.from({ length: Math.min(9, totalPages) }).map((_, idx) => {
                      const windowSize = 9;
                      const half = Math.floor(windowSize / 2);
                      let start = Math.max(1, page - half);
                      let end = Math.min(totalPages, start + windowSize - 1);
                      start = Math.max(1, end - windowSize + 1);
                      const pageNum = start + idx;
                      if (pageNum > end) return null;
                      const isActive = pageNum === page;
                      return (
                        <Button
                          key={pageNum}
                          variant={isActive ? 'default' : 'outline'}
                          onClick={() => setPage(pageNum)}
                          disabled={isValidating}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    <Button variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || isValidating}>
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
