import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit uppercase tracking-widest text-xs text-muted-foreground">
          Edit Entry
        </Badge>
        <h1 className="text-3xl font-semibold text-foreground">Registry Entry</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Loading entry details...
        </p>
      </div>
      <Card className="backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/40">
        <CardHeader className="space-y-2 border-b border-border/60">
          <CardTitle className="text-xl text-foreground">Agreement Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
