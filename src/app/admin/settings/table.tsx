'use client';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2, Pencil, RotateCcw, AlertTriangle } from 'lucide-react';

type SettingCategory = 'ISLAND' | 'BANK_BRANCH' | 'REGION' | 'DOCUMENT_TYPE';

type DeletedEntry = {
  id: string;
  no: number;
  agreementNumber: string;
  borrowers: { fullName: string }[];
  island: string;
  status: string;
  loanAmount: string;
  deletedAt: string;
  auditLogs?: Array<{
    details: string | null;
    action: string;
  }>;
};

type SystemSetting = {
  id: string;
  category: SettingCategory;
  value: string;
  displayName: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type CreateSettingState = {
  category: SettingCategory;
  value: string;
  displayName: string;
  sortOrder: number;
};

type EditSettingState = {
  displayName: string;
  sortOrder: number;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const categoryLabels: Record<SettingCategory, string> = {
  ISLAND: 'Islands',
  BANK_BRANCH: 'Bank Branches',
  REGION: 'Regions/Atolls',
  DOCUMENT_TYPE: 'Document Types',
};

const categoryDescriptions: Record<SettingCategory, string> = {
  ISLAND: 'Manage islands for property locations',
  BANK_BRANCH: 'Manage bank branch locations',
  REGION: 'Manage administrative regions and atolls',
  DOCUMENT_TYPE: 'Manage document type classifications',
};

const statusBadge = (isActive: boolean) =>
  cn(
    'rounded-full px-2 py-1 text-xs font-medium',
    isActive
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-200'
      : 'bg-rose-500/15 text-rose-600 dark:text-rose-200'
  );

export default function SettingsClient() {
  const [activeTab, setActiveTab] = useState<SettingCategory | 'DELETED_ENTRIES'>('ISLAND');
  const { data, error, isLoading, mutate } = useSWR('/api/admin/settings', fetcher, {
    refreshInterval: 30_000,
  });
  const settings = (data?.settings || []) as SystemSetting[];
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createState, setCreateState] = useState<CreateSettingState>({
    category: 'ISLAND',
    value: '',
    displayName: '',
    sortOrder: 0,
  });
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<SystemSetting | null>(null);
  const [editState, setEditState] = useState<EditSettingState>({
    displayName: '',
    sortOrder: 0,
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Deleted entries state
  const { data: deletedData, error: deletedError, isLoading: deletedLoading, mutate: mutateDeleted } = useSWR(
    '/api/admin/deleted-entries',
    fetcher,
    { refreshInterval: 30_000 }
  );
  const deletedEntries = (deletedData?.items || []) as DeletedEntry[];
  const [busyEntry, setBusyEntry] = useState<string | null>(null);

  // Filter settings by active tab
  const filteredSettings = useMemo(
    () => settings.filter((s) => s.category === activeTab),
    [settings, activeTab]
  );

  const createDisabled = useMemo(() => {
    if (!createState.value.trim()) return true;
    if (creating) return true;
    return false;
  }, [createState.value, creating]);

  const updateSetting = async (id: string, payload: any) => {
    setBusy(id);
    const res = await fetch(`/api/admin/settings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(null);
    if (!res.ok) {
      alert('Error updating setting');
    } else {
      mutate();
    }
  };

  const deleteSetting = async (id: string) => {
    if (!confirm('Are you sure you want to delete this setting?')) return;
    
    setBusy(id);
    const res = await fetch(`/api/admin/settings/${id}`, {
      method: 'DELETE',
    });
    setBusy(null);
    if (!res.ok) {
      alert('Error deleting setting');
    } else {
      mutate();
    }
  };

  const resetCreateForm = () => {
    setCreateState({
      category: activeTab,
      value: '',
      displayName: '',
      sortOrder: 0,
    });
  };

  const handleCreate = async () => {
    setCreateError(null);
    setCreating(true);
    try {
      const payload = {
        ...createState,
        category: activeTab,
        displayName: createState.displayName.trim() || createState.value.trim(),
      };

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        if (payload?.errors?.fieldErrors) {
          const firstError = Object.values(payload.errors.fieldErrors)[0] as string[] | undefined;
          setCreateError(firstError?.[0] ?? 'Unable to create setting');
        } else if (payload?.error) {
          setCreateError(payload.error);
        } else {
          setCreateError('Unable to create setting');
        }
        return;
      }

      resetCreateForm();
      mutate();
    } finally {
      setCreating(false);
    }
  };

  const openEditDialog = (setting: SystemSetting) => {
    setEditingSetting(setting);
    setEditState({
      displayName: setting.displayName || setting.value,
      sortOrder: setting.sortOrder,
    });
    setEditError(null);
    setEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setEditingSetting(null);
    setEditError(null);
  };

  const handleEdit = async () => {
    if (!editingSetting) return;

    setEditError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/settings/${editingSetting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editState),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        if (payload?.errors?.fieldErrors) {
          const firstError = Object.values(payload.errors.fieldErrors)[0] as string[] | undefined;
          setEditError(firstError?.[0] ?? 'Unable to update setting');
        } else if (payload?.error) {
          setEditError(payload.error);
        } else {
          setEditError('Unable to update setting');
        }
        return;
      }

      closeEditDialog();
      mutate();
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreEntry = async (entryId: string, agreementNumber: string) => {
    if (!confirm(`Are you sure you want to restore entry "${agreementNumber}"?`)) {
      return;
    }

    setBusyEntry(entryId);
    try {
      const res = await fetch(`/api/admin/deleted-entries/${entryId}`, {
        method: 'PATCH',
      });

      if (!res.ok) {
        throw new Error('Failed to restore entry');
      }

      alert('Entry restored successfully!');
      mutateDeleted();
    } catch (error) {
      alert('Failed to restore entry. Please try again.');
      console.error('Restore error:', error);
    } finally {
      setBusyEntry(null);
    }
  };

  const handlePermanentDelete = async (entryId: string, agreementNumber: string) => {
    if (!confirm(
      `⚠️ PERMANENT DELETE WARNING\n\nAre you sure you want to permanently delete entry "${agreementNumber}"?\n\nThis action CANNOT be undone. All data including borrower information and attachments will be permanently removed.\n\nType the agreement number to confirm: ${agreementNumber}`
    )) {
      return;
    }

    const userInput = prompt(`Type "${agreementNumber}" to confirm permanent deletion:`);
    if (userInput !== agreementNumber) {
      alert('Deletion cancelled. Agreement number did not match.');
      return;
    }

    setBusyEntry(entryId);
    try {
      const res = await fetch(`/api/admin/deleted-entries/${entryId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to permanently delete entry');
      }

      alert('Entry permanently deleted.');
      mutateDeleted();
    } catch (error) {
      alert('Failed to delete entry. Please try again.');
      console.error('Delete error:', error);
    } finally {
      setBusyEntry(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-foreground">System Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure islands, bank branches, regions, and other system-wide properties.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SettingCategory | 'DELETED_ENTRIES')}>
        <TabsList className="grid w-full grid-cols-5">
          {(Object.keys(categoryLabels) as SettingCategory[]).map((category) => (
            <TabsTrigger key={category} value={category}>
              {categoryLabels[category]}
            </TabsTrigger>
          ))}
          <TabsTrigger value="DELETED_ENTRIES">
            Deleted Entries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="DELETED_ENTRIES" className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-xl text-foreground">Deleted Entries</CardTitle>
              <CardDescription>
                Restore or permanently delete registry entries that have been soft-deleted.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {deletedError ? (
                <div className="py-12 text-center text-sm text-destructive">
                  Unable to load deleted entries. Please retry shortly.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-background/80 backdrop-blur">
                    <TableRow>
                      <TableHead className="w-16">No</TableHead>
                      <TableHead>Agreement</TableHead>
                      <TableHead>Borrower(s)</TableHead>
                      <TableHead>Island</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Deleted</TableHead>
                      <TableHead className="w-48 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedLoading ? (
                      Array.from({ length: 5 }).map((_, rowIdx) => (
                        <TableRow key={rowIdx}>
                          {Array.from({ length: 8 }).map((__, cellIdx) => (
                            <TableCell key={cellIdx}>
                              <Skeleton className="h-5 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : deletedEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                          No deleted entries found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      deletedEntries.map((entry) => {
                        const borrowerCount = entry.borrowers?.length ?? 0;
                        const topBorrower = entry.borrowers?.[0]?.fullName ?? '—';
                        const additional = borrowerCount > 1 ? `+${borrowerCount - 1} more` : '';
                        const amount = Number(entry.loanAmount).toLocaleString('en-MV', {
                          style: 'currency',
                          currency: 'MVR',
                          minimumFractionDigits: 2,
                        });
                        const deletedDate = entry.deletedAt
                          ? new Date(entry.deletedAt).toLocaleDateString('en-GB')
                          : '—';
                        
                        // Extract deletion reason from audit log
                        let deletionReason = '—';
                        if (entry.auditLogs && entry.auditLogs.length > 0) {
                          try {
                            const details = JSON.parse(entry.auditLogs[0].details || '{}');
                            deletionReason = details.reason || '—';
                          } catch {
                            deletionReason = '—';
                          }
                        }

                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="text-muted-foreground">{entry.no}</TableCell>
                            <TableCell className="font-medium">{entry.agreementNumber}</TableCell>
                            <TableCell className="text-muted-foreground">
                              <span>{topBorrower}</span>{' '}
                              <span className="text-xs text-muted-foreground/80">{additional}</span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{entry.island}</TableCell>
                            <TableCell className="font-medium">{amount}</TableCell>
                            <TableCell className="text-muted-foreground text-sm max-w-[200px]">
                              <span className="line-clamp-2" title={deletionReason}>
                                {deletionReason}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">{deletedDate}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busyEntry === entry.id}
                                  onClick={() => handleRestoreEntry(entry.id, entry.agreementNumber)}
                                  className="gap-2"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  Restore
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busyEntry === entry.id}
                                  onClick={() => handlePermanentDelete(entry.id, entry.agreementNumber)}
                                  className="gap-2 text-destructive hover:text-destructive"
                                >
                                  <AlertTriangle className="h-4 w-4" />
                                  Delete Forever
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {(Object.keys(categoryLabels) as SettingCategory[]).map((category) => (
          <TabsContent key={category} value={category} className="space-y-6">
            <Card>
              <CardHeader className="border-b border-border/60">
                <CardTitle className="text-xl text-foreground">
                  Add {categoryLabels[category].slice(0, -1)}
                </CardTitle>
                <CardDescription>{categoryDescriptions[category]}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {createError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Unable to save setting</AlertTitle>
                    <AlertDescription>{createError}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="setting-value">Value</Label>
                    <Input
                      id="setting-value"
                      value={createState.value}
                      onChange={(e) =>
                        setCreateState((prev) => ({ ...prev, value: e.target.value }))
                      }
                      placeholder="e.g. Malé"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setting-displayName">Display Name (Optional)</Label>
                    <Input
                      id="setting-displayName"
                      value={createState.displayName}
                      onChange={(e) =>
                        setCreateState((prev) => ({ ...prev, displayName: e.target.value }))
                      }
                      placeholder="Leave empty to use value"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setting-sortOrder">Sort Order</Label>
                    <Input
                      id="setting-sortOrder"
                      type="number"
                      value={createState.sortOrder}
                      onChange={(e) =>
                        setCreateState((prev) => ({
                          ...prev,
                          sortOrder: parseInt(e.target.value) || 0,
                        }))
                      }
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={creating}
                    onClick={resetCreateForm}
                  >
                    Clear
                  </Button>
                  <Button type="button" disabled={createDisabled} onClick={handleCreate}>
                    {creating ? 'Adding…' : 'Add Setting'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-border/60">
                <CardTitle className="text-xl text-foreground">
                  {categoryLabels[category]} List
                </CardTitle>
                <CardDescription>
                  Manage existing {categoryLabels[category].toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {error ? (
                  <div className="py-12 text-center text-sm text-destructive">
                    Unable to load settings. Please retry shortly.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-background/80 backdrop-blur">
                      <TableRow>
                        <TableHead>Value</TableHead>
                        <TableHead>Display Name</TableHead>
                        <TableHead className="w-24">Sort Order</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead className="w-32 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        Array.from({ length: 5 }).map((_, rowIdx) => (
                          <TableRow key={rowIdx}>
                            {Array.from({ length: 5 }).map((__, cellIdx) => (
                              <TableCell key={cellIdx}>
                                <Skeleton className="h-5 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : filteredSettings.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                            No {categoryLabels[category].toLowerCase()} found. Add one above to get started.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredSettings.map((setting) => (
                          <TableRow key={setting.id}>
                            <TableCell className="font-medium">{setting.value}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {setting.displayName || '—'}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                className="w-20"
                                value={setting.sortOrder}
                                disabled={busy === setting.id}
                                onChange={(e) =>
                                  updateSetting(setting.id, {
                                    sortOrder: parseInt(e.target.value) || 0,
                                  })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <button
                                className={statusBadge(setting.isActive)}
                                disabled={busy === setting.id}
                                onClick={() =>
                                  updateSetting(setting.id, { isActive: !setting.isActive })
                                }
                              >
                                {setting.isActive ? 'Active' : 'Inactive'}
                              </button>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy === setting.id}
                                  onClick={() => openEditDialog(setting)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy === setting.id}
                                  onClick={() => deleteSetting(setting.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Setting</DialogTitle>
            <DialogDescription>
              Update the display name and sort order for this setting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {editError ? (
              <Alert variant="destructive">
                <AlertTitle>Unable to update setting</AlertTitle>
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            ) : null}

            {editingSetting && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-value">Value (Read-only)</Label>
                  <Input
                    id="edit-value"
                    value={editingSetting.value}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-displayName">Display Name</Label>
                  <Input
                    id="edit-displayName"
                    value={editState.displayName}
                    onChange={(e) =>
                      setEditState((prev) => ({ ...prev, displayName: e.target.value }))
                    }
                    placeholder="Display name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-sortOrder">Sort Order</Label>
                  <Input
                    id="edit-sortOrder"
                    type="number"
                    value={editState.sortOrder}
                    onChange={(e) =>
                      setEditState((prev) => ({
                        ...prev,
                        sortOrder: parseInt(e.target.value) || 0,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeEditDialog}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
