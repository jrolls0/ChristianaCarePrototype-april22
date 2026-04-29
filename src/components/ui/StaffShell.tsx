'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronLeft,
  Inbox,
  LayoutList,
  RotateCcw,
  Settings,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useInboxUnread } from '@/lib/inbox';
import { useStore } from '@/lib/store';

const CONTAINER = 'w-full px-4 sm:px-6 lg:px-8 xl:px-10';

interface StaffShellProps {
  children: React.ReactNode;
}

export function StaffShell({ children }: StaffShellProps) {
  const pathname = usePathname() ?? '';
  const { total } = useInboxUnread();
  const resetDemo = useStore((s) => s.resetDemo);

  const onAdmin = pathname.startsWith('/staff/admin');
  const onMessages = pathname.startsWith('/staff/messages');
  const onCases = !onMessages && !onAdmin;

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="h-1 w-full bg-gradient-to-r from-[#3399e6] to-[#1a66cc]" />
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            ChristianaCare
          </div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
            Transplant Referrals
          </div>
        </div>

        <nav className="space-y-1 p-4">
          <SideNavLink
            href="/staff"
            active={onCases}
            icon={<LayoutList className="h-4 w-4" />}
          >
            Cases
          </SideNavLink>
          <SideNavLink
            href="/staff/messages"
            active={onMessages}
            icon={<Inbox className="h-4 w-4" />}
            badge={total}
          >
            Inbox
          </SideNavLink>
          <SideNavLink
            href="/staff/admin"
            active={onAdmin}
            icon={<Settings className="h-4 w-4" />}
          >
            Admin
          </SideNavLink>
        </nav>

        <div className="mt-auto border-t border-slate-200 px-5 py-4 text-xs leading-relaxed text-slate-500">
          Staff portal for referral intake, case queue management, and care-team coordination.
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="h-1 w-full bg-gradient-to-r from-[#3399e6] to-[#1a66cc] lg:hidden" />
          <div className={clsx('py-4', CONTAINER)}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 lg:hidden">
                  ChristianaCare · Transplant Referrals
                </div>
                <h1 className="truncate text-lg font-semibold text-slate-900">
                  Sarah Martinez
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    Front Desk Coordinator
                  </span>
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={resetDemo}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset demo data
                </button>
                <Link
                  href="/"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Demo home
                </Link>
              </div>
            </div>

            <nav className="mt-4 grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 lg:hidden">
              <MobileNavLink href="/staff" active={onCases}>
                Cases
              </MobileNavLink>
              <MobileNavLink href="/staff/messages" active={onMessages} badge={total}>
                Inbox
              </MobileNavLink>
              <MobileNavLink href="/staff/admin" active={onAdmin}>
                Admin
              </MobileNavLink>
            </nav>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}

function SideNavLink({
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
        'group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition',
        active
          ? 'bg-[#eef6ff] text-[#1a66cc] ring-1 ring-inset ring-[#bfdeff]'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      )}
    >
      <span className="flex items-center gap-2">
        {icon}
        {children}
      </span>
      {badge && badge > 0 ? (
        <span
          className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#1a66cc] px-1.5 text-[11px] font-semibold tabular-nums text-white"
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function MobileNavLink({
  href,
  active,
  badge,
  children,
}: {
  href: string;
  active: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold transition',
        active
          ? 'bg-white text-[#1a66cc] shadow-sm ring-1 ring-slate-200'
          : 'text-slate-600 hover:text-slate-900'
      )}
    >
      {children}
      {badge && badge > 0 ? (
        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#1a66cc] px-1.5 text-[11px] font-semibold tabular-nums text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export const STAFF_CONTAINER = CONTAINER;
