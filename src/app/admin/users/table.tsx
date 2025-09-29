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

type CreateUserState = {
  name: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const roleLabels: Record<string, string> = {
  VIEWER: 'Viewer',
  DATA_ENTRY: 'Data Entry',
  ADMIN: 'Admin',
};

const statusBadge = (isActive: boolean) =>
  cn(
    "rounded-full px-2 py-1 text-xs font-medium",
    isActive
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-200"
      : "bg-rose-500/15 text-rose-600 dark:text-rose-200",
  );

export default function AdminUsersClient() {
  const { data, error, isLoading, mutate } = useSWR('/api/admin/users', fetcher, {
    refreshInterval: 30_000,
  });
  const users = data?.users || [];
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createState, setCreateState] = useState<CreateUserState>({
    name: '',
    email: '',
    password: '',
    role: 'VIEWER',
    isActive: true,
  });

  const createDisabled = useMemo(() => {
    if (!createState.email || !createState.password) return true;
    if (creating) return true;
    return false;
  }, [createState.email, createState.password, creating]);

  const updateUser = async (id: string, payload: any) => {
    setBusy(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(null);
    if (!res.ok) {
      alert('Error updating user');
    } else {
      mutate();
    }
  };

  const resetCreateForm = () => {
    setCreateState({ name: '', email: '', password: '', role: 'VIEWER', isActive: true });
  };

  const handleCreate = async () => {
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createState),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        if (payload?.errors?.fieldErrors) {
          const firstError = Object.values(payload.errors.fieldErrors)[0] as string[] | undefined;
          setCreateError(firstError?.[0] ?? 'Unable to create user');
        } else if (payload?.error) {
          setCreateError(payload.error);
        } else {
          setCreateError('Unable to create user');
        }
        return;
      }

      resetCreateForm();
      mutate();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-foreground">Manage Users</h1>
        <p className="text-sm text-muted-foreground">
          Promote, deactivate, or reset credentials for registry staff across islands.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-xl text-foreground">Invite Staff User</CardTitle>
          <CardDescription>
            Provision secure access for a new administrator or data entry officer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {createError ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to save user</AlertTitle>
              <AlertDescription>{createError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-name">Full name</Label>
              <Input
                id="user-name"
                value={createState.name}
                onChange={(e) => setCreateState((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={createState.email}
                onChange={(e) => setCreateState((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="user@example.gov"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Temporary password</Label>
              <Input
                id="user-password"
                type="password"
                value={createState.password}
                onChange={(e) => setCreateState((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Minimum 6 characters"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <Select
                value={createState.role}
                onValueChange={(value) => setCreateState((prev) => ({ ...prev, role: value }))}
              >
                <SelectTrigger id="user-role">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                id="user-active"
                type="checkbox"
                className="size-4 rounded border-input bg-background text-primary focus:ring-2 focus:ring-ring"
                checked={createState.isActive}
                onChange={(e) => setCreateState((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              <Label htmlFor="user-active" className="cursor-pointer text-foreground">
                Activate immediately
              </Label>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={creating} onClick={resetCreateForm}>
                Clear
              </Button>
              <Button type="button" disabled={createDisabled} onClick={handleCreate}>
                {creating ? 'Creating…' : 'Create User'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-xl text-foreground">User Directory</CardTitle>
          <CardDescription>
            Role assignments, account status, and administrative actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {error ? (
            <div className="py-12 text-center text-sm text-destructive">
              Unable to load users. Please retry shortly.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-background/80 backdrop-blur">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-48">Role</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-48 text-right">Actions</TableHead>
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
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          disabled={busy === user.id}
                          onValueChange={(value) => updateUser(user.id, { role: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(roleLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <span className={statusBadge(user.isActive)}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy === user.id}
                            onClick={() => {
                              const pw = prompt('Enter new temporary password (min 6 chars)');
                              if (pw) updateUser(user.id, { resetPassword: pw });
                            }}
                          >
                            Reset Password
                          </Button>
                          <Button
                            variant={user.isActive ? 'destructive' : 'secondary'}
                            size="sm"
                            disabled={busy === user.id}
                            onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
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
    </div>
  );
}
