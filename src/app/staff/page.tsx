'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Inbox,
  MessageSquare,
  Sparkles,
  Stethoscope,
  Upload,
  Users,
} from 'lucide-react';
import { clsx } from 'clsx';
import { StaffShell, STAFF_CONTAINER } from '@/components/ui/StaffShell';
import { StatusPill } from '@/components/ui/StatusPill';
import { StuckBadge } from '@/components/ui/StuckBadge';
import { useStore } from '@/lib/store';
import { useInboxUnread } from '@/lib/inbox';
import type { Patient } from '@/lib/types';

type KpiKey = 'all' | 'stuck' | 'new';
type StageKey = 'onboarding' | 'screening' | 'records' | 'specialists';
type FilterKey = KpiKey | StageKey;

const STAGE_FILTERS: { key: StageKey; label: string }[] = [
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'screening', label: 'Screening' },
  { key: 'records', label: 'Records' },
  { key: 'specialists', label: 'Specialists' },
];

function matchesFilter(patient: Patient, filter: FilterKey, now: number): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'stuck':
      return patient.isStuck;
    case 'new': {
      const days = (now - new Date(patient.referralDate).getTime()) / 86400000;
      return days <= 7;
    }
    case 'onboarding':
      return patient.stage === 'patient-onboarding' || patient.stage === 'initial-todos';
    case 'screening':
      return patient.stage === 'screening' || patient.stage === 'front-desk-review';
    case 'records':
      return patient.stage === 'records-collection';
    case 'specialists':
      return patient.stage === 'specialist-review' || patient.stage === 'scheduled';
    default:
      return true;
  }
}

function daysInStageTone(days: number) {
  if (days >= 6) return 'text-red-700 bg-red-50 ring-red-200';
  if (days >= 4) return 'text-amber-700 bg-amber-50 ring-amber-200';
  return 'text-emerald-700 bg-emerald-50 ring-emerald-200';
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

type ActivityKind = 'msg' | 'todo' | 'doc' | 'referral';

interface ActivitySummary {
  kind: ActivityKind;
  at: string;
  label: string;
}

function lastActivity(p: Patient): ActivitySummary {
  const candidates: ActivitySummary[] = [];
  for (const m of p.messages) {
    if (m.fromName === 'ChristianaCare System') continue;
    candidates.push({ kind: 'msg', at: m.sentAt, label: 'message' });
  }
  for (const t of p.todos) {
    if (t.status === 'completed' && t.completedAt) {
      candidates.push({ kind: 'todo', at: t.completedAt, label: 'todo done' });
    }
  }
  for (const d of p.documents) {
    candidates.push({ kind: 'doc', at: d.uploadedAt, label: 'upload' });
  }
  candidates.push({ kind: 'referral', at: p.referralDate, label: 'referred' });
  candidates.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return candidates[0];
}

function ActivityDot({ kind }: { kind: ActivityKind }) {
  const tone =
    kind === 'msg'
      ? 'text-[#1a66cc]'
      : kind === 'todo'
        ? 'text-emerald-600'
        : kind === 'doc'
          ? 'text-slate-500'
          : 'text-violet-600';
  const Icon =
    kind === 'msg'
      ? MessageSquare
      : kind === 'todo'
        ? CheckCircle2
        : kind === 'doc'
          ? Upload
          : Sparkles;
  return <Icon className={`h-3.5 w-3.5 ${tone}`} />;
}

export default function StaffDashboardPage() {
  const allPatients = useStore((s) => s.patients);
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [now] = useState<number>(() => Date.now());

  const { total: inboxTotal } = useInboxUnread();

  const patients = useMemo(
    () => allPatients.filter((p) => p.stage !== 'new-referral'),
    [allPatients]
  );

  const { activeCases, stuckCount, newThisWeek, unreadMessages } = useMemo(
    () => ({
      activeCases: patients.length,
      stuckCount: patients.filter((p) => p.isStuck).length,
      newThisWeek: patients.filter((p) => {
        const days = (now - new Date(p.referralDate).getTime()) / 86400000;
        return days <= 7;
      }).length,
      unreadMessages: inboxTotal,
    }),
    [patients, now, inboxTotal]
  );

  const filteredPatients = useMemo(() => {
    const copy = patients.filter((p) => matchesFilter(p, filter, now));
    return copy.sort((a, b) => {
      if (a.isStuck !== b.isStuck) return a.isStuck ? -1 : 1;
      return b.daysInStage - a.daysInStage;
    });
  }, [patients, filter, now]);

  const stuckPatients = useMemo(
    () => patients.filter((p) => p.isStuck),
    [patients]
  );

  const stageTabCounts = useMemo(() => {
    const result = {} as Record<StageKey, number>;
    for (const f of STAGE_FILTERS) {
      result[f.key] = patients.filter((p) => matchesFilter(p, f.key, now)).length;
    }
    return result;
  }, [patients, now]);

  return (
    <StaffShell>
      <main className={clsx('py-6', STAFF_CONTAINER)}>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              Case Queue
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {activeCases} active {activeCases === 1 ? 'case' : 'cases'} in the pipeline
            </p>
          </div>
        </div>

        {/* KPI strip */}
        <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QuietKpi
            label="Active Cases"
            value={activeCases}
            icon={Users}
            caption="All patients in pipeline"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />

          <StuckKpi
            count={stuckCount}
            patients={stuckPatients}
            active={filter === 'stuck'}
            onClick={() => setFilter('stuck')}
          />

          <QuietKpi
            label="New This Week"
            value={newThisWeek}
            icon={Sparkles}
            caption="Referred in last 7 days"
            active={filter === 'new'}
            onClick={() => setFilter('new')}
          />

          <UnreadKpi count={unreadMessages} />
        </section>

        {/* Stage filter */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {STAGE_FILTERS.map((f) => {
            const count = stageTabCounts[f.key];
            const isActive = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-[#1a66cc] text-white shadow-sm'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300'
                )}
              >
                {f.label}
                <span
                  className={clsx(
                    'rounded-full px-1.5 text-xs tabular-nums',
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
          {(filter === 'all' ||
            filter === 'stuck' ||
            filter === 'new' ||
            STAGE_FILTERS.some((f) => f.key === filter)) &&
            filter !== 'all' && (
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-[#1a66cc]"
              >
                Clear filter
              </button>
            )}
        </div>

        {/* Patient table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Patient</th>
                <th className="px-4 py-3 text-left font-semibold">Referring Clinic</th>
                <th className="px-4 py-3 text-left font-semibold">Stage</th>
                <th className="px-4 py-3 text-left font-semibold">Days in Stage</th>
                <th className="px-4 py-3 text-left font-semibold">Last Activity</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    No patients match this filter.
                  </td>
                </tr>
              )}
              {filteredPatients.map((p) => {
                const act = lastActivity(p);
                return (
                  <tr
                    key={p.id}
                    className={clsx(
                      'group relative cursor-pointer transition hover:bg-[#f5faff]',
                      p.isStuck && 'bg-red-50/30'
                    )}
                    onClick={() => router.push(`/staff/${p.id}`)}
                  >
                    <td className="relative px-5 py-4">
                      {p.isStuck && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-red-500"
                        />
                      )}
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3399e6] to-[#1a66cc] text-xs font-semibold text-white shadow-sm">
                          {p.firstName[0]}
                          {p.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 truncate font-semibold text-slate-900">
                            {p.firstName} {p.lastName}
                            {p.isStuck && <StuckBadge days={p.daysInStage} />}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Stethoscope className="h-3 w-3 text-slate-400" />
                            {p.nephrologistName}
                            <span className="text-slate-300">·</span>
                            <span>{p.preferredLanguage}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {p.referringClinic}
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill stage={p.stage} />
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset',
                          daysInStageTone(p.daysInStage)
                        )}
                      >
                        <Clock className="h-3 w-3" />
                        {p.daysInStage}d
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                        <ActivityDot kind={act.kind} />
                        <span className="font-medium text-slate-700">{act.label}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{relativeTime(act.at)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/staff/${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-[#3399e6] hover:text-[#1a66cc] group-hover:border-[#3399e6] group-hover:text-[#1a66cc]"
                      >
                        Open
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </StaffShell>
  );
}

function QuietKpi({
  label,
  value,
  icon: Icon,
  caption,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  caption: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group flex flex-col rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md',
        active
          ? 'border-[#3399e6] ring-2 ring-[#dbeeff]'
          : 'border-slate-200 hover:border-[#3399e6]'
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#eef6ff] text-[#1a66cc]">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>
      <div className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{caption}</div>
    </button>
  );
}

function StuckKpi({
  count,
  patients,
  active,
  onClick,
}: {
  count: number;
  patients: Patient[];
  active: boolean;
  onClick: () => void;
}) {
  const hasStuck = count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group flex flex-col rounded-xl border p-4 text-left shadow-sm transition hover:shadow-md',
        hasStuck
          ? active
            ? 'border-red-400 bg-red-50/80 ring-2 ring-red-100'
            : 'border-red-200 bg-red-50/50 hover:border-red-300'
          : active
            ? 'border-emerald-300 bg-white ring-2 ring-emerald-100'
            : 'border-slate-200 bg-white hover:border-emerald-300'
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
            hasStuck ? 'bg-red-100 text-red-600' : 'bg-emerald-50 text-emerald-600'
          )}
        >
          {hasStuck ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
        </span>
        <span
          className={clsx(
            'text-xs font-semibold uppercase tracking-wider',
            hasStuck ? 'text-red-700' : 'text-emerald-700'
          )}
        >
          Stuck &gt; 5 Days
        </span>
      </div>
      <div
        className={clsx(
          'mt-3 text-3xl font-bold tabular-nums tracking-tight',
          hasStuck ? 'text-red-700' : 'text-slate-900'
        )}
      >
        {count}
      </div>
      {hasStuck ? (
        <ul className="mt-2 space-y-1">
          {patients.slice(0, 3).map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <Link
                href={`/staff/${p.id}`}
                onClick={(e) => e.stopPropagation()}
                className="truncate font-medium text-red-800 underline-offset-2 hover:underline"
              >
                {p.firstName} {p.lastName}
              </Link>
              <span className="shrink-0 text-red-600">{p.daysInStage}d</span>
            </li>
          ))}
          {patients.length > 3 && (
            <li className="text-xs text-red-600">+{patients.length - 3} more</li>
          )}
        </ul>
      ) : (
        <div className="mt-1 text-xs text-emerald-700">All cases moving on schedule</div>
      )}
    </button>
  );
}

function UnreadKpi({ count }: { count: number }) {
  const hasUnread = count > 0;
  return (
    <Link
      href="/staff/messages"
      className={clsx(
        'group flex flex-col rounded-xl border p-4 text-left shadow-sm transition hover:shadow-md',
        hasUnread
          ? 'border-[#1a66cc] bg-gradient-to-br from-[#eef6ff] to-white hover:border-[#0f4fa8]'
          : 'border-slate-200 bg-white hover:border-[#3399e6]'
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
            hasUnread ? 'bg-[#1a66cc] text-white' : 'bg-[#eef6ff] text-[#1a66cc]'
          )}
        >
          <Inbox className="h-3.5 w-3.5" />
        </span>
        <span
          className={clsx(
            'text-xs font-semibold uppercase tracking-wider',
            hasUnread ? 'text-[#1a66cc]' : 'text-slate-500'
          )}
        >
          Unread Messages
        </span>
      </div>
      <div
        className={clsx(
          'mt-3 text-3xl font-bold tabular-nums tracking-tight',
          hasUnread ? 'text-[#1a66cc]' : 'text-slate-900'
        )}
      >
        {count}
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs font-medium">
        {hasUnread ? (
          <>
            <span className="text-[#1a66cc]">Open inbox to reply</span>
            <ArrowRight className="h-3 w-3 text-[#1a66cc] transition group-hover:translate-x-0.5" />
          </>
        ) : (
          <span className="text-slate-500">Inbox is clear</span>
        )}
      </div>
    </Link>
  );
}
