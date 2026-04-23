'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Clock,
  Inbox,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { ShellHeader } from '@/components/ui/ShellHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { StuckBadge } from '@/components/ui/StuckBadge';
import { useStore } from '@/lib/store';
import type { Patient, PatientStage } from '@/lib/types';

type FilterKey =
  | 'all'
  | 'stuck'
  | 'new'
  | 'onboarding'
  | 'screening'
  | 'records'
  | 'specialists';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'stuck', label: 'Stuck' },
  { key: 'new', label: 'New' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'screening', label: 'In Screening' },
  { key: 'records', label: 'Records' },
  { key: 'specialists', label: 'Specialists' },
];

const FRONT_DESK_STAGES: PatientStage[] = [
  'new-referral',
  'front-desk-review',
  'screening',
];

function matchesFilter(patient: Patient, filter: FilterKey): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'stuck':
      return patient.isStuck;
    case 'new': {
      const days = (Date.now() - new Date(patient.referralDate).getTime()) / 86400000;
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

function waitingOn(patient: Patient): 'Patient' | 'Clinic' | 'Staff' {
  switch (patient.stage) {
    case 'new-referral':
    case 'front-desk-review':
    case 'screening':
      return 'Staff';
    case 'records-collection':
      return 'Clinic';
    default:
      return 'Patient';
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

function countForFilter(patients: Patient[], key: FilterKey) {
  return patients.filter((p) => matchesFilter(p, key)).length;
}

function KpiCard({
  label,
  value,
  tone = 'default',
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: 'default' | 'alert';
  icon: typeof Users;
  active?: boolean;
  onClick: () => void;
}) {
  const alert = tone === 'alert';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center justify-between gap-4 rounded-2xl border bg-white px-5 py-4 text-left shadow-sm transition hover:border-[#3399e6] hover:shadow-md ${
        active
          ? alert
            ? 'border-red-300 ring-2 ring-red-100'
            : 'border-[#3399e6] ring-2 ring-[#dbeeff]'
          : 'border-slate-200'
      }`}
    >
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div
          className={`mt-1 text-3xl font-semibold tabular-nums ${
            alert ? 'text-red-600' : 'text-slate-900'
          }`}
        >
          {value}
        </div>
      </div>
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${
          alert
            ? 'bg-red-50 text-red-600'
            : 'bg-[#eef6ff] text-[#1a66cc]'
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
    </button>
  );
}

export default function StaffDashboardPage() {
  const patients = useStore((s) => s.patients);
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>('all');

  const activeCases = patients.length;
  const stuckCount = patients.filter((p) => p.isStuck).length;
  const newThisWeek = patients.filter((p) => {
    const days = (Date.now() - new Date(p.referralDate).getTime()) / 86400000;
    return days <= 7;
  }).length;
  const awaitingMyAction = patients.filter((p) =>
    FRONT_DESK_STAGES.includes(p.stage)
  ).length;

  const filteredPatients = useMemo(() => {
    const copy = patients.filter((p) => matchesFilter(p, filter));
    return copy.sort((a, b) => {
      if (a.isStuck !== b.isStuck) return a.isStuck ? -1 : 1;
      return b.daysInStage - a.daysInStage;
    });
  }, [patients, filter]);

  const stuckPatients = patients.filter((p) => p.isStuck);

  return (
    <div className="min-h-screen bg-slate-50">
      <ShellHeader
        eyebrow="ChristianaCare · Transplant Referrals"
        title="Sarah Martinez"
        subtitle="Front Desk Coordinator"
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* KPI strip */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="Active Cases"
            value={activeCases}
            icon={Users}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <KpiCard
            label="Stuck > 5 Days"
            value={stuckCount}
            tone="alert"
            icon={AlertTriangle}
            active={filter === 'stuck'}
            onClick={() => setFilter('stuck')}
          />
          <KpiCard
            label="New This Week"
            value={newThisWeek}
            icon={Sparkles}
            active={filter === 'new'}
            onClick={() => setFilter('new')}
          />
          <KpiCard
            label="Awaiting My Action"
            value={awaitingMyAction}
            icon={Inbox}
            active={false}
            onClick={() => setFilter('all')}
          />
        </section>

        {/* Stuck banner */}
        {stuckCount > 0 && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-900">
                  {stuckCount} {stuckCount === 1 ? 'patient has' : 'patients have'} not moved in over 5 days
                </p>
                <p className="mt-0.5 text-xs text-red-800/80">
                  {stuckPatients
                    .map((p) => `${p.firstName} ${p.lastName[0]}. (${p.daysInStage}d)`)
                    .join(' · ')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFilter('stuck')}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              View stuck cases
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {FILTERS.map((f) => {
            const count = countForFilter(patients, f.key);
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
                <th className="px-4 py-3 text-left font-semibold">Waiting On</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                    No patients match this filter.
                  </td>
                </tr>
              )}
              {filteredPatients.map((p) => (
                <tr
                  key={p.id}
                  className="group cursor-pointer transition hover:bg-[#f5faff]"
                  onClick={() => router.push(`/staff/${p.id}`)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3399e6] to-[#1a66cc] text-xs font-semibold text-white">
                        {p.firstName[0]}
                        {p.lastName[0]}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">
                          {p.firstName} {p.lastName}
                          {p.isStuck && (
                            <StuckBadge days={p.daysInStage} className="ml-2 align-middle" />
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          DOB {new Date(p.dob).toLocaleDateString('en-US')}
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
                  <td className="px-4 py-4 text-xs text-slate-500">
                    {relativeTime(p.lastActivityAt)}
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                      <TrendingUp className="h-3 w-3 text-slate-400" />
                      {waitingOn(p)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/staff/${p.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-[#3399e6] hover:text-[#1a66cc] group-hover:border-[#3399e6] group-hover:text-[#1a66cc]"
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

        {/* Tiny footer hint */}
        <div className="mt-4 flex items-center justify-end gap-1.5 text-xs text-slate-400">
          <Bell className="h-3 w-3" />
          Refresh the patient tab to see cross-view updates
        </div>
      </main>
    </div>
  );
}
