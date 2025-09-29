export const actionBadgeStyles = (action: string) => {
  if (action.startsWith('USER_')) {
    return 'bg-sky-500/15 text-sky-600 dark:text-sky-200';
  }

  if (action.startsWith('ENTRY_')) {
    return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-200';
  }

  return 'bg-accent text-accent-foreground';
};

export const formatActionLabel = (value: string) =>
  value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
