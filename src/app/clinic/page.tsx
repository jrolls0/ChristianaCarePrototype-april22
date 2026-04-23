'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileClock,
  FileText,
  Hospital,
  MessageSquare,
  Plus,
  Send,
  UserRound,
  X,
} from 'lucide-react';
import { ShellHeader } from '@/components/ui/ShellHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { useStore } from '@/lib/store';
import type { Message, PatientStage } from '@/lib/types';

const AWAITING_PATIENT_STAGES: PatientStage[] = [
  'patient-onboarding',
  'initial-todos',
];

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function waitingOnLabel(stage: PatientStage): {
  label: string;
  tone: 'patient' | 'staff' | 'records';
} {
  switch (stage) {
    case 'new-referral':
    case 'patient-onboarding':
    case 'initial-todos':
      return { label: 'Patient', tone: 'patient' };
    case 'records-collection':
      return { label: 'Records (clinic)', tone: 'records' };
    default:
      return { label: 'ChristianaCare', tone: 'staff' };
  }
}

function waitingTone(tone: 'patient' | 'staff' | 'records') {
  switch (tone) {
    case 'patient':
      return 'bg-blue-50 text-blue-700 ring-blue-200';
    case 'records':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'staff':
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

function daysInStageTone(days: number) {
  if (days >= 6) return 'text-red-700 bg-red-50 ring-red-200';
  if (days >= 4) return 'text-amber-700 bg-amber-50 ring-amber-200';
  return 'text-emerald-700 bg-emerald-50 ring-emerald-200';
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
  accent: 'navy' | 'blue' | 'amber';
}) {
  const wrap =
    accent === 'navy'
      ? 'bg-[#0f3e80]/10 text-[#0f3e80]'
      : accent === 'amber'
        ? 'bg-amber-100/80 text-amber-700'
        : 'bg-[#e4efff] text-[#1a66cc]';
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
          {value}
        </div>
      </div>
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${wrap}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function StageProgressBar({ stage }: { stage: PatientStage }) {
  const STAGES: { key: PatientStage; label: string }[] = [
    { key: 'patient-onboarding', label: 'Onboarding' },
    { key: 'initial-todos', label: 'To-Dos' },
    { key: 'front-desk-review', label: 'Review' },
    { key: 'screening', label: 'Screening' },
    { key: 'records-collection', label: 'Records' },
    { key: 'specialist-review', label: 'Specialists' },
    { key: 'scheduled', label: 'Scheduled' },
  ];
  const currentIdx = STAGES.findIndex((s) => s.key === stage);
  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((s, idx) => {
        const done = idx < currentIdx;
        const current = idx === currentIdx;
        return (
          <div key={s.key} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`h-1.5 w-full rounded-full ${
                done
                  ? 'bg-emerald-400'
                  : current
                    ? 'bg-[#0f3e80]'
                    : 'bg-slate-200'
              }`}
            />
            <span
              className={`text-[10px] font-medium ${
                current
                  ? 'text-[#0f3e80]'
                  : done
                    ? 'text-emerald-700'
                    : 'text-slate-400'
              }`}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ThreadMessage({ message }: { message: Message }) {
  const fromClinic = message.fromRole === 'clinic';
  const isSystem = message.fromName === 'ChristianaCare System';
  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
          {message.body}
        </span>
      </div>
    );
  }
  return (
    <div className={`flex ${fromClinic ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
          fromClinic
            ? 'bg-[#0f3e80] text-white'
            : message.fromRole === 'staff'
              ? 'bg-white text-slate-800 ring-1 ring-slate-200'
              : 'bg-slate-50 text-slate-700 ring-1 ring-slate-100'
        }`}
      >
        <div
          className={`text-[10px] font-semibold uppercase tracking-wider ${
            fromClinic ? 'text-white/80' : 'text-slate-500'
          }`}
        >
          {message.fromName}
        </div>
        <p className="mt-1 whitespace-pre-wrap leading-relaxed">{message.body}</p>
        <div
          className={`mt-1 text-[10px] ${
            fromClinic ? 'text-white/70' : 'text-slate-400'
          }`}
        >
          {formatDateTime(message.sentAt)}
        </div>
      </div>
    </div>
  );
}

export default function ClinicDashboardPage() {
  const router = useRouter();
  const allPatients = useStore((s) => s.patients);
  const clinicUser = useStore((s) => s.currentClinicUser);
  const sendMessage = useStore((s) => s.sendMessage);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  // Filter to this clinic's patients. Exclude any patient still in
  // `new-referral` — per Resolved Decision 7, Jack is invisible here until the
  // clinic user actually submits his referral in Scene 1.
  const patients = useMemo(
    () =>
      allPatients
        .filter(
          (p) =>
            p.referringClinic === clinicUser.clinicName &&
            p.stage !== 'new-referral'
        )
        .sort(
          (a, b) =>
            new Date(b.referralDate).getTime() -
            new Date(a.referralDate).getTime()
        ),
    [allPatients, clinicUser.clinicName]
  );

  const { activeReferrals, awaitingPatient, awaitingRecords } = useMemo(
    () => ({
      activeReferrals: patients.length,
      awaitingPatient: patients.filter((p) =>
        AWAITING_PATIENT_STAGES.includes(p.stage)
      ).length,
      awaitingRecords: patients.filter(
        (p) => p.stage === 'records-collection'
      ).length,
    }),
    [patients]
  );

  const drawerPatient = drawerId
    ? (allPatients.find((p) => p.id === drawerId) ?? null)
    : null;

  const drawerThread = useMemo(() => {
    if (!drawerPatient) return [];
    return drawerPatient.messages
      .filter(
        (m) =>
          m.threadKey === 'clinic-staff' ||
          (m.threadKey === 'tc-frontdesk' &&
            m.fromName === 'ChristianaCare System')
      )
      .sort(
        (a, b) =>
          new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
      );
  }, [drawerPatient]);

  function handleSendReply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!drawerPatient) return;
    const body = reply.trim();
    if (!body) return;
    sendMessage(drawerPatient.id, 'clinic', body, 'clinic-staff');
    setReply('');
  }

  function closeDrawer() {
    setDrawerId(null);
    setReply('');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ShellHeader
        accent="navy"
        eyebrow={`${clinicUser.clinicName} · Referrals`}
        title={clinicUser.name}
        subtitle="Dialysis Unit Social Worker"
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* KPI strip + CTA */}
        <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <KpiCard
            label="Active Referrals"
            value={activeReferrals}
            icon={Activity}
            accent="navy"
          />
          <KpiCard
            label="Awaiting Patient Action"
            value={awaitingPatient}
            icon={UserRound}
            accent="blue"
          />
          <KpiCard
            label="Awaiting Records"
            value={awaitingRecords}
            icon={FileClock}
            accent="amber"
          />
          <button
            type="button"
            onClick={() => router.push('/clinic/new-referral')}
            className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#0f3e80] to-[#0a2a5c] px-6 py-4 text-sm font-semibold text-white shadow-md transition hover:from-[#123f85] hover:to-[#0b2e64] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3e80] focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Submit New Referral
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </button>
        </section>

        {/* Referral list */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <Hospital className="h-4 w-4 text-[#0f3e80]" />
              <h2 className="text-sm font-semibold text-slate-900">
                Referrals from {clinicUser.clinicName}
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              {patients.length} {patients.length === 1 ? 'patient' : 'patients'}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Patient</th>
                <th className="px-4 py-3 text-left font-semibold">Referred</th>
                <th className="px-4 py-3 text-left font-semibold">Stage</th>
                <th className="px-4 py-3 text-left font-semibold">Days in Stage</th>
                <th className="px-4 py-3 text-left font-semibold">Waiting On</th>
                <th className="px-4 py-3 text-left font-semibold">Last Update</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    No active referrals yet. Use <span className="font-medium text-slate-700">Submit New Referral</span> to send a patient to ChristianaCare.
                  </td>
                </tr>
              )}
              {patients.map((p) => {
                const waiting = waitingOnLabel(p.stage);
                return (
                  <tr
                    key={p.id}
                    className="group cursor-pointer transition hover:bg-[#f4f6fb]"
                    onClick={() => setDrawerId(p.id)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#0f3e80] to-[#0a2a5c] text-xs font-semibold text-white">
                          {p.firstName[0]}
                          {p.lastName[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {p.firstName} {p.lastName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {p.preferredLanguage} · {p.nephrologistName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {formatDate(p.referralDate)}
                    </td>
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
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${waitingTone(waiting.tone)}`}
                      >
                        {waiting.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      {relativeTime(p.lastActivityAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition group-hover:border-[#0f3e80] group-hover:text-[#0f3e80]">
                        View
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <div className="mt-4 text-right text-xs text-slate-400">
          Read-only view of ChristianaCare-side progress.
        </div>
      </main>

      {/* Right drawer */}
      <Dialog.Root
        open={drawerPatient !== null}
        onOpenChange={(open) => {
          if (!open) closeDrawer();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
          <Dialog.Content
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right"
            aria-describedby={undefined}
          >
            {drawerPatient && (
              <>
                <div className="border-b border-slate-200 bg-gradient-to-br from-[#0f3e80] to-[#0a2a5c] px-6 py-5 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-sm font-semibold backdrop-blur">
                        {drawerPatient.firstName[0]}
                        {drawerPatient.lastName[0]}
                      </div>
                      <div>
                        <Dialog.Title className="text-lg font-semibold">
                          {drawerPatient.firstName} {drawerPatient.lastName}
                        </Dialog.Title>
                        <p className="text-xs text-white/80">
                          Referred {formatDate(drawerPatient.referralDate)} · {drawerPatient.nephrologistName}
                        </p>
                      </div>
                    </div>
                    <Dialog.Close className="rounded-lg p-1 text-white/80 transition hover:bg-white/10 hover:text-white">
                      <X className="h-5 w-5" />
                    </Dialog.Close>
                  </div>
                  <div className="mt-4 rounded-xl bg-white/10 p-3 backdrop-blur">
                    <StageProgressBar stage={drawerPatient.stage} />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50/60">
                  {/* Progress detail */}
                  <section className="border-b border-slate-200 bg-white px-6 py-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Current status
                    </h3>
                    <div className="mt-3 flex items-center gap-3">
                      <StatusPill stage={drawerPatient.stage} />
                      <span className="text-xs text-slate-500">
                        {drawerPatient.daysInStage}d in this stage · last update {relativeTime(drawerPatient.lastActivityAt)}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          To-Dos
                        </div>
                        <div className="mt-1 text-slate-800">
                          {drawerPatient.todos.filter((t) => t.status === 'completed').length}
                          <span className="text-slate-400">
                            {' / '}
                            {drawerPatient.todos.length} complete
                          </span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          <FileText className="h-3.5 w-3.5" />
                          Documents
                        </div>
                        <div className="mt-1 text-slate-800">
                          {drawerPatient.documents.length} on file
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Message thread */}
                  <section className="px-6 py-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Messages with ChristianaCare
                      </h3>
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <MessageSquare className="h-3 w-3" />
                        Clinic ↔ Front Desk
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {drawerThread.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500">
                          No messages with ChristianaCare yet. Send the first note below.
                        </p>
                      ) : (
                        drawerThread.map((m) => (
                          <ThreadMessage key={m.id} message={m} />
                        ))
                      )}
                    </div>
                  </section>
                </div>

                <form
                  onSubmit={handleSendReply}
                  className="border-t border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Message ChristianaCare Front Desk…"
                      className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm outline-none transition focus:border-[#0f3e80] focus:bg-white focus:ring-2 focus:ring-[#0f3e80]/15"
                    />
                    <button
                      type="submit"
                      disabled={!reply.trim()}
                      className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#0f3e80] px-4 text-sm font-semibold text-white transition hover:bg-[#123f85] disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send
                    </button>
                  </div>
                  <p className="mt-1.5 px-1 text-[11px] text-slate-400">
                    Clinic messages are routed to the Front Desk team, not the patient.
                  </p>
                </form>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
