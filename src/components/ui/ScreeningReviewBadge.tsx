import { clsx } from 'clsx';
import { AlertTriangle } from 'lucide-react';

interface ScreeningReviewBadgeProps {
  className?: string;
}

export function ScreeningReviewBadge({ className }: ScreeningReviewBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex max-w-full shrink-0 items-center gap-1 truncate whitespace-nowrap rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200',
        className
      )}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      Screening review needed
    </span>
  );
}
