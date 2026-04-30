'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { ChevronRight, Clock, Plus, Search, X } from 'lucide-react';
import { ClinicShell, CLINIC_CONTAINER } from '@/components/ui/ClinicShell';
import { StatusPill } from '@/components/ui/StatusPill';
import { clinicScopedPatients } from '@/lib/clinicInbox';
import {
  AWAITING_PATIENT_STAGES,
  clinicDocuments,
  clinicSearchText,
  hasClinicUnread,
  relativeTime,
  waitingOnLabel,
} from '@/lib/clinicPortal';
import { useStore } from '@/lib/store';

type QueueFilter = 'all' | 'patient' | 'transplant-center' | 'unread';

function waitingTone(tone: 'patient' | 'transplant-center') {
  return tone === 'patient'
    ? 'bg-blue-50 text-blue-700 ring-blue-200'
    : 'bg-slate-100 text-slate-700 ring-slate-200';
}

export default function ClinicDashboardPage() {
  const allPatients = useStore((state) => state.patients);
  const clinicUser = useStore((state) => state.currentClinicUser);
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [query, setQuery] = useState('');

  const patients = useMemo(
    () =>
      clinicScopedPatients(allPatients, clinicUser.clinicName).sort(
        (a, b) => new Date(b.referralDate).getTime() - new Date(a.referralDate).getTime()
      ),
    [allPatients, clinicUser.clinicName]
  );

  const filteredPatients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return patients.filter((patient) => {
      const waiting = waitingOnLabel(patient.stage);
      if (filter === 'patient' && waiting.tone !== 'patient') return false;
      if (filter === 'transplant-center' && waiting.tone !== 'transplant-center') {
        return false;
      }
      if (filter === 'unread' && !hasClinicUnread(patient)) return false;
      if (normalizedQuery && !clinicSearchText(patient).includes(normalizedQuery)) {
        return false;
      }
      return true;
    });
  }, [patients, filter, query]);

  const waitingOnPatient = patients.filter((patient) =>
    AWAITING_PATIENT_STAGES.includes(patient.stage)
  ).length;
  const waitingOnTransplantCenter = patients.filter(
    (patient) => waitingOnLabel(patient.stage).tone === 'transplant-center'
  ).length;
  const unreadMessages = patients.filter(hasClinicUnread).length;

  return (
    <ClinicShell>
      <main className={clsx('py-6', CLINIC_CONTAINER)}>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Referrals
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {patients.length} active {patients.length === 1 ? 'patient' : 'patients'} ·{' '}
              {waitingOnTransplantCenter} waiting on Transplant Center
            </p>
          </div>
          <Link
            href="/clinic/new-referral"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1a66cc] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1558ad]"
          >
            <Plus className="h-4 w-4" />
            Submit New Referral
          </Link>
        </div>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Queue views</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <QueueFilterButton
                  active={filter === 'all'}
                  count={patients.length}
                  label="All active"
                  onClick={() => setFilter('all')}
                />
                <QueueFilterButton
                  active={filter === 'patient'}
                  count={waitingOnPatient}
                  label="Waiting on patient"
                  onClick={() => setFilter('patient')}
                />
                <QueueFilterButton
                  active={filter === 'transplant-center'}
                  count={waitingOnTransplantCenter}
                  label="Waiting on Transplant Center"
                  onClick={() => setFilter('transplant-center')}
                />
                <QueueFilterButton
                  active={filter === 'unread'}
                  count={unreadMessages}
                  label="Unread messages"
                  onClick={() => setFilter('unread')}
                />
              </div>
            </div>
            <div className="relative w-full xl:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search patient, nephrologist, stage..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm outline-none transition focus:border-[#3399e6] focus:bg-white focus:ring-2 focus:ring-[#dbeeff]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Patient</th>
                  <th className="px-4 py-3 text-left font-semibold">Stage</th>
                  <th className="px-4 py-3 text-left font-semibold">Waiting on</th>
                  <th className="px-4 py-3 text-left font-semibold">Clinic docs</th>
                  <th className="px-4 py-3 text-left font-semibold">Last update</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                      No referrals match this view.
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => {
                    const waiting = waitingOnLabel(patient.stage);
                    return (
                      <tr key={patient.id} className="group transition hover:bg-[#f5faff]">
                        <td className="px-5 py-4">
                          <Link href={`/clinic/${patient.id}`} className="flex items-center gap-3">
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3399e6] to-[#1a66cc] text-xs font-semibold text-white">
                              {patient.firstName[0]}
                              {patient.lastName[0]}
                              {hasClinicUnread(patient) && (
                                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900">
                                {patient.firstName} {patient.lastName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {patient.nephrologistName ?? 'No nephrologist'} · {patient.preferredLanguage}
                              </p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill stage={patient.stage} />
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={clsx(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                              waitingTone(waiting.tone)
                            )}
                          >
                            {waiting.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {clinicDocuments(patient).length}
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {relativeTime(patient.lastActivityAt)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link
                            href={`/clinic/${patient.id}`}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition group-hover:border-[#3399e6] group-hover:text-[#1a66cc]"
                          >
                            Open
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </ClinicShell>
  );
}

function QueueFilterButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
        active ? 'bg-[#1a66cc] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      )}
    >
      {label}
      <span
        className={clsx(
          'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] tabular-nums',
          active ? 'bg-white/20 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'
        )}
      >
        {count}
      </span>
    </button>
  );
}
