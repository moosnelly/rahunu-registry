import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/options';
import SettingsClient from './table';

export default async function Page() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;

  if (role !== 'ADMIN') {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <span className="rounded-full border border-border/60 bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Restricted
        </span>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Access denied</h2>
          <p className="text-sm text-muted-foreground">
            You need admin privileges to manage system settings.
          </p>
        </div>
      </main>
    );
  }

  return <SettingsClient />;
}
