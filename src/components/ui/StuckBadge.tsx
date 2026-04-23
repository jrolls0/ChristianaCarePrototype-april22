import { clsx } from 'clsx';
import { AlertTriangle } from 'lucide-react';

interface StuckBadgeProps {
  days: number;
  className?: string;
}

export function StuckBadge({ days, className }: StuckBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200',
        className
      )}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      Stuck · {days}d
    </span>
  );
}
