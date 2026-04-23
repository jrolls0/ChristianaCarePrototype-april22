'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, Inbox, LayoutList } from 'lucide-react';
import { clsx } from 'clsx';
import { useInboxUnread } from '@/lib/inbox';

const CONTAINER = 'mx-auto w-full max-w-[1600px] px-6 lg:px-10 xl:px-12';

interface StaffShellProps {
  children: React.ReactNode;
}

export function StaffShell({ children }: StaffShellProps) {
  const pathname = usePathname() ?? '';
  const { total } = useInboxUnread();

  const onMessages = pathname.startsWith('/staff/messages');
  const onCases = !onMessages;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="h-1 w-full bg-gradient-to-r from-[#3399e6] to-[#1a66cc]" />
        <div className={clsx('flex items-center justify-between gap-4 py-4', CONTAINER)}>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              ChristianaCare · Transplant Referrals
            </div>
            <h1 className="truncate text-lg font-semibold text-slate-900">
              Sarah Martinez
              <span className="ml-2 text-sm font-normal text-slate-500">
                Front Desk Coordinator
              </span>
            </h1>
          </div>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Demo home
          </Link>
        </div>

        <nav className={clsx('flex items-center gap-1 pb-0 pt-0', CONTAINER)}>
          <TabLink href="/staff" active={onCases} icon={<LayoutList className="h-4 w-4" />}>
            Cases
          </TabLink>
          <TabLink
            href="/staff/messages"
            active={onMessages}
            icon={<Inbox className="h-4 w-4" />}
            badge={total}
          >
            Messages
          </TabLink>
        </nav>
      </header>

      {children}
    </div>
  );
}

function TabLink({
  href,
  active,
  icon,
  badge,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'relative inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition',
        active
          ? 'border-[#1a66cc] text-[#1a66cc]'
          : 'border-transparent text-slate-500 hover:text-slate-800'
      )}
    >
      {icon}
      {children}
      {badge && badge > 0 ? (
        <span
          className={clsx(
            'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
            active ? 'bg-[#1a66cc] text-white' : 'bg-red-500 text-white'
          )}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export const STAFF_CONTAINER = CONTAINER;
