'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { clsx } from 'clsx';

interface ShellHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  className?: string;
  accent?: 'blue' | 'navy';
  containerClassName?: string;
}

export function ShellHeader({
  eyebrow,
  title,
  subtitle,
  className,
  accent = 'blue',
  containerClassName = 'max-w-7xl',
}: ShellHeaderProps) {
  const accentClass =
    accent === 'navy'
      ? 'bg-gradient-to-r from-[#0f3e80] to-[#0a2a5c]'
      : 'bg-gradient-to-r from-[#3399e6] to-[#1a66cc]';

  return (
    <header
      className={clsx(
        'border-b border-slate-200 bg-white/80 backdrop-blur',
        className
      )}
    >
      <div className={clsx('h-1 w-full', accentClass)} />
      <div
        className={clsx(
          'mx-auto flex items-center justify-between gap-4 px-6 py-4 lg:px-10 xl:px-12',
          containerClassName
        )}
      >
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {eyebrow}
          </div>
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Demo home
        </Link>
      </div>
    </header>
  );
}
