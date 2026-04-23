'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Mail,
  MessageSquare,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';
import { ShellHeader } from '@/components/ui/ShellHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { StuckBadge } from '@/components/ui/StuckBadge';
import { InboxDrawer, InboxPill, useInboxUnread } from '@/components/InboxDrawer';
import { useStore } from '@/lib/store';
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
  type Candidate = { kind: ActivityKind; at: string; label: string };
  const candidates: Candidate[] = [];
  for (const m of p.messages) {
    if (m.fromName === 'ChristianaCare System') continue;
    candidates.push({ kind: 'msg', at: m.sentAt, label: 'message' });
  }
  for (const t of p.todos) {
    if (t.status === 'completed' && t.completedAt) {
      candidates.push({ kind: 'todo', at: t.completedAt, label: 'todo' });
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
  const Icon = kind === 'msg' ? MessageSquare : kind === 'todo' ? CheckCircle2 : kind === 'doc' ? Upload : Sparkles;
  return <Icon className={`h-3.5 w-3.5 ${tone}`} />;
}

function KpiCard({
  label,
  value,
  tone = 'default',
  icon: Icon,
  active,
  caption,
  onClick,
}: {
  label: string;
  value: number;
  tone?: 'default' | 'alert' | 'accent';
  icon: typeof Users;
  active?: boolean;
  caption?: string;
  onClick: () => void;
}) {
  const isAlert = tone === 'alert';
  const isAccent = tone === 'accent';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col justify-between gap-3 rounded-2xl border bg-white px-5 py-4 text-left shadow-sm transition hover:shadow-md ${
        active
          ? isAlert
            ? 'border-red-300 ring-2 ring-red-100'
            : isAccent
              ? 'border-[#1a66cc] ring-2 ring-[#dbeeff]'
              : 'border-[#3399e6] ring-2 ring-[#dbeeff]'
          : 'border-slate-200 hover:border-[#3399e6]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
            isAlert
              ? 'bg-red-50 text-red-600'
              : isAccent
                ? 'bg-[#1a66cc]/10 text-[#1a66cc]'
                : 'bg-[#eef6ff] text-[#1a66cc]'
          }`}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <div>
        <div
          className={`text-4xl font-bold tabular-nums tracking-tight ${
            isAlert ? 'text-red-600' : 'text-slate-900'
          }`}
        >
          {value}
        </div>
        {caption && (
          <div className="mt-1 text-xs text-slate-500">{caption}</div>
        )}
      </div>
    </button>
  );
}

export default function StaffDashboardPage() {
  const allPatients = useStore((s) => s.patients);
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [now] = useState<number>(() => Date.now());
  const [inboxOpen, setInboxOpen] = useState(false);

  const { total: inboxTotal } = useInboxUnread();

  // Patients stay hidden from Front Desk until the clinic has submitted their
  // referral (Scene 1 → Scene 2 "watch Jack appear" moment).
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
    <div className="min-h-screen bg-slate-50">
      <ShellHeader
        eyebrow="ChristianaCare · Transplant Referrals"
        title="Sarah Martinez"
        subtitle="Front Desk Coordinator"
      />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Page top row: title + inbox pill */}
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              Case Queue
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {activeCases} active {activeCases === 1 ? 'case' : 'cases'} in the pipeline
            </p>
          </div>
          <InboxPill onClick={() => setInboxOpen(true)} />
        </div>

        {/* KPI strip */}
        <section className="mb-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            label="Active Cases"
            value={activeCases}
            icon={Users}
            caption="All patients in progress"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <KpiCard
            label="Stuck > 5 Days"
            value={stuckCount}
            tone="alert"
            icon={AlertTriangle}
            caption={stuckCount === 0 ? 'All moving' : 'Needs intervention'}
            active={filter === 'stuck'}
            onClick={() => setFilter('stuck')}
          />
          <KpiCard
            label="New This Week"
            value={newThisWeek}
            icon={Sparkles}
            caption="Referred within 7 days"
            active={filter === 'new'}
            onClick={() => setFilter('new')}
          />
          <KpiCard
            label="Unread Messages"
            value={unreadMessages}
            tone="accent"
            icon={Mail}
            caption={unreadMessages === 0 ? 'Inbox clear' : 'Open inbox to reply'}
            onClick={() => setInboxOpen(true)}
          />
        </section>

        {/* Inline stuck summary (replaces the red banner) */}
        {stuckCount > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-red-700">
              Stuck:
            </span>
            {stuckPatients.map((p, i) => (
              <span key={p.id} className="inline-flex items-center">
                <Link
                  href={`/staff/${p.id}`}
                  className="font-medium text-slate-700 transition hover:text-[#1a66cc]"
                >
                  {p.firstName} {p.lastName[0]}.
                </Link>
                <span className="ml-1 text-slate-500">({p.daysInStage}d)</span>
                {i < stuckPatients.length - 1 && <span className="mx-1 text-slate-300">·</span>}
              </span>
            ))}
          </div>
        )}

        {/* Stage filter tabs */}
        <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <span className="inline-flex items-center rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Stage
          </span>
          {STAGE_FILTERS.map((f) => {
            const count = stageTabCounts[f.key];
            const isActive = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-[#3399e6] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-1.5 text-xs tabular-nums ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Patient table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
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
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                    No patients match this filter.
                  </td>
                </tr>
              )}
              {filteredPatients.map((p) => {
                const act = lastActivity(p);
                return (
                  <tr
                    key={p.id}
                    className="group cursor-pointer transition odd:bg-slate-50/40 hover:bg-[#f5faff]"
                    onClick={() => router.push(`/staff/${p.id}`)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3399e6] to-[#1a66cc] text-xs font-semibold text-white shadow-sm">
                          {p.firstName[0]}
                          {p.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">
                            {p.firstName} {p.lastName}
                            {p.isStuck && (
                              <StuckBadge days={p.daysInStage} className="ml-2 align-middle" />
                            )}
                          </div>
                          <div className="truncate text-xs text-slate-500">
                            {p.preferredLanguage} · {p.nephrologistName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{p.referringClinic}</td>
                    <td className="px-4 py-4">
                      <StatusPill stage={p.stage} />
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset ${daysInStageTone(p.daysInStage)}`}
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

      <InboxDrawer open={inboxOpen} onOpenChange={setInboxOpen} />
    </div>
  );
}
