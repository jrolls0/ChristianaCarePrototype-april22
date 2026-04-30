'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Clock,
  ListChecks,
  Search,
  Sparkles,
  Stethoscope,
  UserPlus,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { StaffShell, STAFF_CONTAINER } from '@/components/ui/StaffShell';
import { StatusPill } from '@/components/ui/StatusPill';
import { StuckBadge } from '@/components/ui/StuckBadge';
import { ScreeningReviewBadge } from '@/components/ui/ScreeningReviewBadge';
import { useStore } from '@/lib/store';
import { PATIENT_STAGE_LABEL } from '@/lib/stages';
import type { Patient, PatientStage } from '@/lib/types';

type PriorityFilter = 'all' | 'stuck' | 'new' | 'self-signups';
type StageKey = Exclude<PatientStage, 'new-referral'>;
type StageFilter = 'all' | StageKey;

const STAGE_FILTERS: { key: StageKey; label: string }[] = [
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'initial-todos', label: 'Initial To-Dos' },
  { key: 'initial-screening', label: 'Initial Screening' },
  { key: 'financial-screening', label: 'Financial' },
  { key: 'records-clinical-review', label: 'Records & Clinical' },
  { key: 'final-decision', label: 'Final Decision' },
  { key: 'education', label: 'Education' },
  { key: 'scheduling', label: 'Scheduling' },
];

const PRIORITY_LABEL: Record<PriorityFilter, string> = {
  all: 'All active cases',
  stuck: 'Needs action',
  new: 'New referrals',
  'self-signups': 'Self-signups',
};

function isSelfSignupNeedingFollowup(p: Patient): boolean {
  return p.referralSource === 'self' && !p.referringClinic;
}

function isNewThisWeek(patient: Patient, now: number): boolean {
  const days = (now - new Date(patient.referralDate).getTime()) / 86400000;
  return days <= 7;
}

function hasUnreadStaffMessage(patient: Patient): boolean {
  return patient.messages.some((m) => !m.readByStaff && m.fromRole !== 'staff');
}

function needsStaffAction(patient: Patient): boolean {
  return (
    patient.isStuck ||
    isSelfSignupNeedingFollowup(patient) ||
    patient.stage === 'initial-screening'
  );
}

function matchesPriority(patient: Patient, filter: PriorityFilter, now: number): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'stuck':
      return needsStaffAction(patient);
    case 'new':
      return isNewThisWeek(patient, now);
    case 'self-signups':
      return isSelfSignupNeedingFollowup(patient);
  }
}

function matchesStage(patient: Patient, filter: StageFilter): boolean {
  return filter === 'all' || patient.stage === filter;
}

function daysInStageTone(days: number) {
  if (days >= 6) return 'text-red-700 bg-red-50 ring-red-200';
  if (days >= 4) return 'text-amber-700 bg-amber-50 ring-amber-200';
  return 'text-emerald-700 bg-emerald-50 ring-emerald-200';
}

function nextAction(patient: Patient): string {
  if (isSelfSignupNeedingFollowup(patient)) return 'Capture clinic info';
  if (patient.stage === 'initial-screening') return 'Review screening responses';
  if (patient.isStuck) return 'Unblock case';
  if (hasUnreadStaffMessage(patient)) return 'Reply in Inbox';
  return 'Open case';
}

function searchText(patient: Patient): string {
  return [
    patient.firstName,
    patient.lastName,
    patient.email,
    patient.referringClinic,
    patient.referringClinician,
    patient.duswName,
    patient.nephrologistName,
    patient.referralSource,
    PATIENT_STAGE_LABEL[patient.stage],
    nextAction(patient),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function SourceCell({ patient }: { patient: Patient }) {
  if (patient.referralSource === 'self') {
    const noFollowup = !patient.referringClinic;
    return (
      <span
        className={clsx(
          'inline-flex max-w-full items-center gap-1.5 truncate whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
          noFollowup
            ? 'bg-amber-50 text-amber-800 ring-amber-200'
            : 'bg-violet-50 text-violet-700 ring-violet-200'
        )}
      >
        <UserPlus className="h-3 w-3 shrink-0" />
        <span className="shrink-0">Self-signup</span>
        <span className="min-w-0 truncate font-normal text-slate-500">
          · {noFollowup ? 'needs follow-up' : patient.referringClinic}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
      <Building2 className="h-3.5 w-3.5 text-slate-400" />
      {patient.referringClinic ?? '—'}
    </span>
  );
}

export default function StaffDashboardPage() {
  const allPatients = useStore((s) => s.patients);
  const router = useRouter();
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  const [query, setQuery] = useState('');
  const [now] = useState<number>(() => Date.now());

  const patients = useMemo(
    () => allPatients.filter((p) => p.stage !== 'new-referral'),
    [allPatients]
  );

  const activeCases = patients.length;
  const needsActionPatients = useMemo(() => patients.filter(needsStaffAction), [patients]);
  const needsActionCount = needsActionPatients.length;
  const newThisWeek = useMemo(
    () => patients.filter((p) => isNewThisWeek(p, now)).length,
    [patients, now]
  );
  const selfSignupsCount = useMemo(
    () => patients.filter(isSelfSignupNeedingFollowup).length,
    [patients]
  );

  const stageTabCounts = useMemo(() => {
    const result = {} as Record<StageKey, number>;
    for (const f of STAGE_FILTERS) {
      result[f.key] = patients.filter((p) => matchesStage(p, f.key)).length;
    }
    return result;
  }, [patients]);

  const filteredPatients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const copy = patients.filter((p) => {
      if (!matchesPriority(p, priorityFilter, now)) return false;
      if (!matchesStage(p, stageFilter)) return false;
      if (normalizedQuery && !searchText(p).includes(normalizedQuery)) return false;
      return true;
    });

    return copy.sort((a, b) => {
      if (a.isStuck !== b.isStuck) return a.isStuck ? -1 : 1;
      const aClinic = a.referralSource === 'clinic';
      const bClinic = b.referralSource === 'clinic';
      if (aClinic !== bClinic) return aClinic ? -1 : 1;
      return b.daysInStage - a.daysInStage;
    });
  }, [patients, priorityFilter, stageFilter, query, now]);

  return (
    <StaffShell>
      <main className={clsx('py-6', STAFF_CONTAINER)}>
        <div className="mb-5">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Case Queue
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {activeCases} active {activeCases === 1 ? 'case' : 'cases'} · {needsActionCount}{' '}
            {needsActionCount === 1 ? 'needs' : 'need'} staff action
          </p>
        </div>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Queue views</h3>
              <p className="text-xs text-slate-500">
                Choose which cases to show in the table.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <PriorityCard
              label="All active cases"
              value={activeCases}
              description="Every patient in the pipeline"
              icon={ListChecks}
              tone="slate"
              active={priorityFilter === 'all'}
              onClick={() => setPriorityFilter('all')}
            />
            <PriorityCard
              label="Needs action"
              value={needsActionCount}
              description={
                needsActionCount > 0
                  ? 'Staff follow-up needed'
                  : 'No staff actions pending'
              }
              icon={AlertTriangle}
              tone="red"
              active={priorityFilter === 'stuck'}
              onClick={() => setPriorityFilter('stuck')}
            />
            <PriorityCard
              label="New referrals"
              value={newThisWeek}
              description="Referred in the last 7 days"
              icon={Sparkles}
              tone="blue"
              active={priorityFilter === 'new'}
              onClick={() => setPriorityFilter('new')}
            />
            <PriorityCard
              label="Self-signups"
              value={selfSignupsCount}
              description="Need clinic follow-up"
              icon={UserPlus}
              tone="amber"
              active={priorityFilter === 'self-signups'}
              onClick={() => setPriorityFilter('self-signups')}
            />
          </div>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-4">
            <div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Case queue controls</h3>
                <p className="text-xs text-slate-500">
                  Showing {filteredPatients.length}{' '}
                  {filteredPatients.length === 1 ? 'case' : 'cases'} in{' '}
                  <span className="font-medium text-slate-700">
                    {PRIORITY_LABEL[priorityFilter]}
                  </span>
                </p>
              </div>
            </div>

            <div className="max-w-xl">
              <label
                htmlFor="staff-case-search"
                className="text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Search
              </label>
              <div className="relative mt-1.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="staff-case-search"
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search patients, clinics, nephrologists..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm text-slate-900 outline-none transition focus:border-[#3399e6] focus:bg-white focus:ring-2 focus:ring-[#dbeeff]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Stage
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <StageChip
                  label="All"
                  count={activeCases}
                  active={stageFilter === 'all'}
                  onClick={() => setStageFilter('all')}
                />
                {STAGE_FILTERS.map((f) => (
                  <StageChip
                    key={f.key}
                    label={f.label}
                    count={stageTabCounts[f.key]}
                    active={stageFilter === f.key}
                    onClick={() => setStageFilter(f.key)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <MobileCaseList patients={filteredPatients} />

        <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Patient</th>
                  <th className="px-4 py-3 text-left font-semibold">Source</th>
                  <th className="px-4 py-3 text-left font-semibold">Current step</th>
                  <th className="px-4 py-3 text-left font-semibold">SLA</th>
                  <th className="px-4 py-3 text-left font-semibold">Next action</th>
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
                      No patients match this view.
                    </td>
                  </tr>
                )}
                {filteredPatients.map((p) => (
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
                          className="absolute bottom-2 left-0 top-2 w-1 rounded-r bg-red-500"
                        />
                      )}
                      <PatientIdentity patient={p} />
                    </td>
                    <td className="px-4 py-4">
                      <SourceCell patient={p} />
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill stage={p.stage} />
                    </td>
                    <td className="px-4 py-4">
                      <SlaBadge days={p.daysInStage} />
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-slate-700">
                        {nextAction(p)}
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </StaffShell>
  );
}

function PatientIdentity({ patient }: { patient: Patient }) {
  const alertBadge =
    patient.stage === 'initial-screening' ? (
      <ScreeningReviewBadge className="px-2 py-0.5" />
    ) : patient.isStuck ? (
      <StuckBadge days={patient.daysInStage} className="px-2 py-0.5" />
    ) : null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3399e6] to-[#1a66cc] text-xs font-semibold text-white shadow-sm">
        {patient.firstName[0]}
        {patient.lastName[0]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">
          {patient.firstName} {patient.lastName}
        </p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          {alertBadge}
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Stethoscope className="h-3 w-3 shrink-0 text-slate-400" />
            <span className="truncate">
              {patient.nephrologistName ?? 'No nephrologist on file'}
            </span>
          </span>
          <span className="text-slate-300">·</span>
          <span className="shrink-0">{patient.preferredLanguage}</span>
        </div>
      </div>
    </div>
  );
}

function SlaBadge({ days }: { days: number }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset',
        daysInStageTone(days)
      )}
    >
      <Clock className="h-3 w-3" />
      {days}d
    </span>
  );
}

function PriorityCard({
  label,
  value,
  description,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  description: string;
  icon: typeof AlertTriangle;
  tone: 'slate' | 'red' | 'blue' | 'amber';
  active: boolean;
  onClick: () => void;
}) {
  const toneClass = {
    slate: {
      icon: 'bg-slate-100 text-slate-600',
      active: 'border-slate-400 bg-slate-50 ring-2 ring-slate-100',
      idle: 'border-slate-200 bg-white hover:border-slate-300',
      value: 'text-slate-900',
    },
    red: {
      icon: 'bg-red-100 text-red-600',
      active: 'border-red-400 bg-red-50 ring-2 ring-red-100',
      idle: 'border-red-200 bg-red-50/40 hover:border-red-300',
      value: 'text-red-700',
    },
    blue: {
      icon: 'bg-[#eef6ff] text-[#1a66cc]',
      active: 'border-[#3399e6] bg-[#f5faff] ring-2 ring-[#dbeeff]',
      idle: 'border-slate-200 bg-white hover:border-[#3399e6]',
      value: 'text-slate-900',
    },
    amber: {
      icon: 'bg-amber-100 text-amber-700',
      active: 'border-amber-300 bg-amber-50 ring-2 ring-amber-100',
      idle: 'border-amber-200 bg-amber-50/40 hover:border-amber-300',
      value: 'text-amber-800',
    },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group min-h-[122px] rounded-xl border p-4 text-left shadow-sm transition hover:shadow-md',
        active ? toneClass.active : toneClass.idle
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', toneClass.icon)}>
          <Icon className="h-4 w-4" />
        </span>
        {active && (
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
            Active
          </span>
        )}
      </div>
      <div className={clsx('mt-3 text-3xl font-bold tabular-nums tracking-tight', toneClass.value)}>
        {value}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{label}</div>
      <div className="mt-1 truncate text-xs text-slate-500">{description}</div>
    </button>
  );
}

function StageChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition',
        active
          ? 'bg-[#1a66cc] text-white shadow-sm'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300'
      )}
    >
      {label}
      <span
        className={clsx(
          'rounded-full px-1.5 text-xs tabular-nums',
          active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
        )}
      >
        {count}
      </span>
    </button>
  );
}

function MobileCaseList({ patients }: { patients: Patient[] }) {
  if (patients.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500 md:hidden">
        No patients match this view.
      </div>
    );
  }

  return (
    <div className="space-y-3 md:hidden">
      {patients.map((p) => (
        <Link
          key={p.id}
          href={`/staff/${p.id}`}
          className={clsx(
            'block rounded-2xl border bg-white p-4 shadow-sm transition hover:border-[#3399e6]',
            p.isStuck ? 'border-red-200 bg-red-50/40' : 'border-slate-200'
          )}
        >
          <PatientIdentity patient={p} />
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <SourceCell patient={p} />
              <StatusPill stage={p.stage} />
              <SlaBadge days={p.daysInStage} />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Next action
              </span>
              <span className="text-sm font-semibold text-slate-900">{nextAction(p)}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
