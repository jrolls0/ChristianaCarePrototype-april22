'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  FileText,
  Languages,
  Mail,
  MessageSquare,
  Phone,
  PlusCircle,
  Send,
  Shield,
  Sparkles,
  Stethoscope,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { StaffShell, STAFF_CONTAINER } from '@/components/ui/StaffShell';
import { StatusPill } from '@/components/ui/StatusPill';
import { StuckBadge } from '@/components/ui/StuckBadge';
import { ThreadMessage } from '@/components/ui/ThreadMessage';
import { AttachButton, AttachmentChips } from '@/components/ui/AttachmentRow';
import { appendAttachmentSummary, type Attachment } from '@/lib/attachments';
import { useStore } from '@/lib/store';
import type { Patient, PatientStage, ThreadKey, Todo } from '@/lib/types';

const STAGE_FLOW: PatientStage[] = [
  'new-referral',
  'patient-onboarding',
  'initial-todos',
  'front-desk-review',
  'screening',
  'records-collection',
  'specialist-review',
  'scheduled',
];

const STAGE_LABEL: Record<PatientStage, string> = {
  'new-referral': 'New Referral',
  'patient-onboarding': 'Patient Onboarding',
  'initial-todos': 'Initial To-Dos',
  'front-desk-review': 'Front Desk Review',
  screening: 'Screening',
  'records-collection': 'Records Collection',
  'specialist-review': 'Specialist Review',
  scheduled: 'Scheduled',
};

const TODO_TEMPLATES = [
  'Upload additional documentation',
  'Schedule call with social worker',
  'Confirm preferred appointment times',
];

type MsgTab = 'patient' | 'clinic';

const MSG_THREAD: Record<MsgTab, ThreadKey> = {
  patient: 'tc-frontdesk',
  clinic: 'clinic-staff',
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function formatDob(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${Number(m)}/${Number(d)}/${y}`;
}

interface ActivityEvent {
  id: string;
  at: string;
  label: string;
  detail?: string;
  icon: typeof Sparkles;
  tone: 'blue' | 'emerald' | 'slate' | 'violet';
}

function buildActivity(patient: Patient): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  events.push({
    id: `referral-${patient.id}`,
    at: patient.referralDate,
    label:
      patient.referralSource === 'self'
        ? 'Patient self-registered'
        : 'Referral received',
    detail:
      patient.referralSource === 'self'
        ? patient.referringClinic
          ? `via portal · ${patient.referringClinic}`
          : 'via patient portal'
        : `from ${patient.referringClinic}`,
    icon: Sparkles,
    tone: 'violet',
  });
  patient.todos
    .filter((t) => t.status === 'completed' && t.completedAt)
    .forEach((t) => {
      events.push({
        id: `todo-${t.id}`,
        at: t.completedAt as string,
        label: `${t.title} completed`,
        icon: CheckCircle2,
        tone: 'emerald',
      });
    });
  patient.documents.forEach((d) => {
    events.push({
      id: `doc-${d.id}`,
      at: d.uploadedAt,
      label: `${d.name} uploaded`,
      detail: d.uploadedBy === 'patient' ? 'by patient' : 'by clinic',
      icon: FileText,
      tone: 'slate',
    });
  });
  return events.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}

function toneClasses(tone: ActivityEvent['tone']) {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-50 text-emerald-600 ring-emerald-100';
    case 'violet':
      return 'bg-violet-50 text-violet-600 ring-violet-100';
    case 'blue':
      return 'bg-[#eef6ff] text-[#1a66cc] ring-[#dbeeff]';
    case 'slate':
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-100';
  }
}

function TodoRow({ todo }: { todo: Todo }) {
  const done = todo.status === 'completed';
  return (
    <li className="flex items-start gap-3 py-2.5">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={clsx(
              'text-sm font-medium',
              done ? 'text-slate-500 line-through' : 'text-slate-900'
            )}
          >
            {todo.title}
          </p>
          {done && todo.completedAt && (
            <span className="shrink-0 text-xs text-slate-400">
              {relativeTime(todo.completedAt)}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">{todo.description}</p>
        {todo.isCustom && todo.addedByStaff && (
          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#eef6ff] px-2 py-0.5 text-[10px] font-medium text-[#1a66cc]">
            Added by {todo.addedByStaff}
          </p>
        )}
      </div>
    </li>
  );
}

export default function StaffCaseDetailPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params?.caseId ?? '';
  const patient = useStore((s) =>
    s.patients.find((p) => p.id === caseId) ?? null
  );
  const addCustomTodo = useStore((s) => s.addCustomTodo);
  const sendMessage = useStore((s) => s.sendMessage);
  const markThreadRead = useStore((s) => s.markThreadRead);
  const advanceStage = useStore((s) => s.advancePatientStage);

  const [todoOpen, setTodoOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MsgTab>('patient');
  const [quickReply, setQuickReply] = useState('');
  const [quickReplyAttachments, setQuickReplyAttachments] = useState<Attachment[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const patientThread = useMemo(() => {
    if (!patient) return [];
    return patient.messages
      .filter((m) => m.threadKey === 'tc-frontdesk')
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  }, [patient]);

  const clinicThread = useMemo(() => {
    if (!patient) return [];
    return patient.messages
      .filter((m) => m.threadKey === 'clinic-staff')
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  }, [patient]);

  const patientUnread = patientThread.some(
    (m) => m.fromRole !== 'staff' && !m.readByStaff
  );
  const clinicUnread = clinicThread.some(
    (m) => m.fromRole !== 'staff' && !m.readByStaff
  );

  const activeThread = activeTab === 'patient' ? patientThread : clinicThread;

  useEffect(() => {
    if (!patient) return;
    if (activeTab === 'clinic' && !patient.referringClinic) {
      setActiveTab('patient');
      return;
    }
    const threadKey = MSG_THREAD[activeTab];
    const thread = activeTab === 'patient' ? patientThread : clinicThread;
    if (thread.some((m) => m.fromRole !== 'staff' && !m.readByStaff)) {
      markThreadRead(patient.id, threadKey, 'staff');
    }
  }, [patient, activeTab, patientThread, clinicThread, markThreadRead]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeTab, activeThread.length]);

  // Drop the in-progress reply when switching channels — attachments
  // and draft text don't belong on the other thread.
  useEffect(() => {
    setQuickReply('');
    setQuickReplyAttachments([]);
  }, [activeTab]);

  const activity = useMemo(
    () => (patient ? buildActivity(patient) : []),
    [patient]
  );

  if (!patient) {
    return (
      <StaffShell>
        <main className={clsx('py-16 text-center', STAFF_CONTAINER)}>
          <p className="text-sm text-slate-600">
            This case isn&apos;t in the current seed. Reset the demo or return to the dashboard.
          </p>
          <Link
            href="/staff"
            className="mt-6 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-[#3399e6] hover:text-[#1a66cc]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </main>
      </StaffShell>
    );
  }

  const pendingTodos = patient.todos.filter((t) => t.status === 'pending');
  const completedCount = patient.todos.length - pendingTodos.length;
  const progressPct = patient.todos.length
    ? Math.round((completedCount / patient.todos.length) * 100)
    : 0;

  const nextStage = (() => {
    const idx = STAGE_FLOW.indexOf(patient.stage);
    if (idx === -1 || idx === STAGE_FLOW.length - 1) return null;
    return STAGE_FLOW[idx + 1];
  })();

  const nonSystemMsgCount = patient.messages.filter(
    (m) => m.fromName !== 'ChristianaCare System'
  ).length;
  const isEmptyCase =
    patient.todos.length === 0 &&
    patient.documents.length === 0 &&
    nonSystemMsgCount === 0;

  function handleQuickReply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!patient) return;
    const trimmed = quickReply.trim();
    if (trimmed.length === 0 && quickReplyAttachments.length === 0) return;
    const body = appendAttachmentSummary(trimmed, quickReplyAttachments);
    sendMessage(patient.id, 'staff', body, MSG_THREAD[activeTab]);
    setQuickReply('');
    setQuickReplyAttachments([]);
  }

  function removeQuickReplyAttachment(id: string) {
    setQuickReplyAttachments((previous) => previous.filter((a) => a.id !== id));
  }

  return (
    <StaffShell>
      <main className={clsx('py-6', STAFF_CONTAINER)}>
        <div className="mb-4">
          <Link
            href="/staff"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-[#1a66cc]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            All Cases
          </Link>
        </div>

        {/* Hero card — patient summary strip */}
        <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3399e6] to-[#1a66cc] text-lg font-semibold text-white shadow-md">
                {patient.firstName[0]}
                {patient.lastName[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-900">
                    {patient.firstName} {patient.lastName}
                  </h2>
                  {patient.isStuck && <StuckBadge days={patient.daysInStage} />}
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {patient.referralSource === 'self' ? (
                    <>
                      Self-registered {relativeTime(patient.referralDate)}
                      {patient.referringClinic && (
                        <>
                          {' · '}
                          <span className="text-slate-600">{patient.referringClinic}</span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      Referred {relativeTime(patient.referralDate)}
                      {patient.referringClinician && <> by {patient.referringClinician}</>}
                      {patient.referringClinic && (
                        <>
                          {' · '}
                          <span className="text-slate-600">{patient.referringClinic}</span>
                        </>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusPill stage={patient.stage} />
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                <Clock className="h-3.5 w-3.5" />
                {patient.daysInStage}d in stage
              </span>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT COLUMN — case content */}
          <div className="space-y-5 lg:col-span-7 xl:col-span-8">
            {isEmptyCase ? (
              <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-12 text-center shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-violet-50 text-violet-600 ring-1 ring-violet-100">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900">
                  Just arrived
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Waiting for {patient.firstName} to start onboarding. To-dos, documents,
                  and messages will show up here as they come in.
                </p>
              </section>
            ) : (
              <>
                {/* Onboarding & To-Dos */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-slate-900">
                        Onboarding & To-Dos
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {completedCount} of {patient.todos.length} complete
                      </p>
                      {patient.todos.length > 0 && (
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#3399e6] to-[#1a66cc] transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setTodoOpen(true)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#3399e6] bg-white px-3 py-1.5 text-xs font-semibold text-[#1a66cc] transition hover:bg-[#eef6ff]"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Add To-Do
                    </button>
                  </div>
                  {patient.todos.length === 0 ? (
                    <p className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                      No to-dos yet. Once this patient enters onboarding, the initial checklist will appear here.
                    </p>
                  ) : (
                    <ul className="mt-4 divide-y divide-slate-100">
                      {patient.todos.map((t) => (
                        <TodoRow key={t.id} todo={t} />
                      ))}
                    </ul>
                  )}
                </section>

                {/* Documents */}
                {patient.documents.length > 0 && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-base font-semibold text-slate-900">Documents</h3>
                      <span className="text-xs text-slate-500">
                        {patient.documents.length} file
                        {patient.documents.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {patient.documents.map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#1a66cc] ring-1 ring-slate-200">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {d.name}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {d.uploadedBy === 'patient' ? 'Patient upload' : 'Clinic upload'}
                              {' · '}
                              {relativeTime(d.uploadedAt)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Activity Timeline */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900">Activity Timeline</h3>
                  {activity.length === 0 ? (
                    <p className="mt-3 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                      No activity yet.
                    </p>
                  ) : (
                    <ol className="mt-4 space-y-3">
                      {activity.slice(0, 12).map((e) => {
                        const Icon = e.icon;
                        return (
                          <li key={e.id} className="flex items-start gap-3">
                            <div
                              className={clsx(
                                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
                                toneClasses(e.tone)
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="text-sm font-medium text-slate-800">
                                  {e.label}
                                </p>
                                <span className="shrink-0 text-xs text-slate-400">
                                  {relativeTime(e.at)}
                                </span>
                              </div>
                              {e.detail && (
                                <p className="text-xs text-slate-500">{e.detail}</p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              </>
            )}
          </div>

          {/* RIGHT COLUMN — Messages (primary), Patient, Actions */}
          <div className="space-y-5 lg:col-span-5 xl:col-span-4">
            {/* Messages — featured */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#1a66cc]" />
                  <h3 className="text-sm font-semibold text-slate-900">Messages</h3>
                </div>
                <Link
                  href={`/staff/messages?patient=${patient.id}&thread=${activeTab}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-[#1a66cc]"
                >
                  Open in Messages
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="flex gap-1 border-b border-slate-100 bg-slate-50/60 px-3 pt-2">
                <MsgTabButton
                  active={activeTab === 'patient'}
                  unread={patientUnread}
                  onClick={() => setActiveTab('patient')}
                  icon={<MessageSquare className="h-3.5 w-3.5" />}
                  label="Patient"
                />
                {patient.referringClinic && (
                  <MsgTabButton
                    active={activeTab === 'clinic'}
                    unread={clinicUnread}
                    onClick={() => setActiveTab('clinic')}
                    icon={<Building2 className="h-3.5 w-3.5" />}
                    label="Clinic"
                  />
                )}
              </div>
              <div
                ref={scrollRef}
                className="h-[420px] space-y-2.5 overflow-y-auto bg-slate-50/40 px-4 py-4"
              >
                {activeThread.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center px-4 py-8 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {activeTab === 'patient'
                        ? 'No messages with the patient yet.'
                        : `No messages with ${patient.referringClinic ?? 'the clinic'} yet.`}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Start the conversation below.
                    </p>
                  </div>
                ) : (
                  activeThread.map((m) => (
                    <ThreadMessage key={m.id} message={m} viewerRole="staff" />
                  ))
                )}
              </div>
              <div className="border-t border-slate-100 bg-white">
                <AttachmentChips
                  attachments={quickReplyAttachments}
                  onRemove={removeQuickReplyAttachment}
                  className="px-3"
                />
                <form
                  onSubmit={handleQuickReply}
                  className="flex items-end gap-2 px-3 py-3"
                >
                  <textarea
                    value={quickReply}
                    onChange={(e) => setQuickReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                      }
                    }}
                    rows={1}
                    placeholder={
                      activeTab === 'patient'
                        ? `Reply to ${patient.firstName}…`
                        : `Reply to ${patient.referringClinic ?? 'the clinic'}…`
                    }
                    className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm leading-relaxed outline-none transition focus:border-[#3399e6] focus:bg-white focus:ring-2 focus:ring-[#dbeeff]"
                  />
                  <AttachButton
                    size="sm"
                    onAttach={(next) =>
                      setQuickReplyAttachments((previous) => [...previous, ...next])
                    }
                  />
                  <button
                    type="submit"
                    disabled={!quickReply.trim() && quickReplyAttachments.length === 0}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#3399e6] px-3 text-sm font-semibold text-white transition hover:bg-[#1a66cc] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </button>
                </form>
              </div>
            </section>

            {/* Patient info — merged */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Patient</h3>
              <dl className="mt-3 space-y-3 text-sm">
                <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
                  {patient.phone}
                </InfoRow>
                <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email">
                  {patient.email}
                </InfoRow>
                <InfoRow label="DOB">{formatDob(patient.dob)}</InfoRow>
                <InfoRow
                  icon={<Languages className="h-3.5 w-3.5" />}
                  label="Language"
                >
                  {patient.preferredLanguage}
                </InfoRow>
                {patient.referringClinic && (
                  <InfoRow
                    icon={<Building2 className="h-3.5 w-3.5" />}
                    label="Clinic"
                  >
                    {patient.referringClinic}
                  </InfoRow>
                )}
                {patient.duswName && (
                  <InfoRow label="DUSW">{patient.duswName}</InfoRow>
                )}
                {patient.nephrologistName && (
                  <InfoRow
                    icon={<Stethoscope className="h-3.5 w-3.5" />}
                    label="Nephrologist"
                  >
                    {patient.nephrologistName}
                  </InfoRow>
                )}
              </dl>
              {patient.referralSource === 'self' &&
                !patient.referringClinic &&
                !patient.duswName &&
                !patient.nephrologistName && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50/80 p-3 text-xs text-amber-800 ring-1 ring-amber-100">
                    <UserPlus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Self-registered — clinical info pending. Reach out to capture clinic, social worker, and nephrologist details.
                    </span>
                  </div>
                )}
              <div className="mt-4 border-t border-slate-100 pt-4">
                {patient.emergencyContact ? (
                  <div className="rounded-xl bg-emerald-50/60 p-3 ring-1 ring-emerald-100">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                      <Shield className="h-3.5 w-3.5" />
                      Emergency Contact
                    </div>
                    <div className="mt-1 text-sm font-medium text-emerald-900">
                      {patient.emergencyContact.name}
                    </div>
                    <div className="text-xs text-emerald-700">
                      {patient.emergencyContact.phone} · {patient.emergencyContact.email}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-amber-50/80 p-3 text-xs text-amber-800 ring-1 ring-amber-100">
                    <UserPlus className="h-3.5 w-3.5" />
                    No emergency contact on file.
                  </div>
                )}
              </div>
            </section>

            {/* Stage action */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Stage</h3>
              <button
                type="button"
                onClick={() => advanceStage(patient.id)}
                disabled={!nextStage}
                className="mt-3 inline-flex w-full items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-600 hover:to-emerald-700 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300"
              >
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Mark Stage Complete
                </span>
                {nextStage ? (
                  <span className="inline-flex items-center gap-1 text-xs text-white/80">
                    → {STAGE_LABEL[nextStage]}
                  </span>
                ) : (
                  <span className="text-xs text-white/80">Final stage</span>
                )}
              </button>
            </section>
          </div>
        </div>
      </main>

      {todoOpen && (
        <AddTodoModal
          onClose={() => setTodoOpen(false)}
          onSubmit={(title, description, documentRequests) => {
            addCustomTodo(patient.id, title, description, documentRequests);
            setTodoOpen(false);
          }}
        />
      )}
    </StaffShell>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </dt>
      <dd className="text-right text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function MsgTabButton({
  active,
  unread,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  unread: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'relative inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-semibold transition',
        active
          ? 'bg-white text-[#1a66cc] ring-1 ring-slate-100'
          : 'text-slate-500 hover:text-slate-700'
      )}
    >
      {icon}
      {label}
      {unread && (
        <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
      )}
    </button>
  );
}

type DocRequestDraft = { key: string; title: string; description: string };

function AddTodoModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (
    title: string,
    description: string,
    documentRequests: { title: string; description?: string }[]
  ) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [docRequests, setDocRequests] = useState<DocRequestDraft[]>([]);

  function addDocRequest() {
    setDocRequests((prev) => [
      ...prev,
      { key: `dr-${Date.now()}-${prev.length}`, title: '', description: '' },
    ]);
  }

  function updateDocRequest(key: string, patch: Partial<DocRequestDraft>) {
    setDocRequests((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeDocRequest(key: string) {
    setDocRequests((prev) => prev.filter((r) => r.key !== key));
  }

  const cleanedRequests = docRequests
    .map((r) => ({
      title: r.title.trim(),
      description: r.description.trim() ? r.description.trim() : undefined,
    }))
    .filter((r) => r.title.length > 0);

  const hasDocRows = docRequests.length > 0;
  const allDocRowsValid = !hasDocRows || docRequests.every((r) => r.title.trim().length > 0);
  const canSubmit = title.trim().length > 0 && allDocRowsValid;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(title.trim(), description.trim(), cleanedRequests);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Add To-Do for Patient</h3>
            <p className="text-xs text-slate-500">
              Appears instantly in the patient&apos;s home screen.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Templates
              </label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {TODO_TEMPLATES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTitle(t)}
                    className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-medium text-[#1a66cc] transition hover:bg-[#dbeeff]"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Title *
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What does the patient need to do?"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
                autoFocus
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Description (optional)
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Add any helpful detail for the patient."
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Required uploads (optional)
                </span>
                <button
                  type="button"
                  onClick={addDocRequest}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#1a66cc] hover:bg-[#eef6ff]"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Add document
                </button>
              </div>
              {docRequests.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  Leave empty for a simple to-do. Add a row for each photo or document the patient
                  must upload (e.g. front + back of a card).
                </p>
              ) : (
                <div className="space-y-3">
                  {docRequests.map((req, idx) => (
                    <div
                      key={req.key}
                      className="space-y-2 rounded-xl border border-dashed border-[#cfdcec] bg-[#f8fbff] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#1a66cc]">
                          <Upload className="h-3.5 w-3.5" />
                          Document {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeDocRequest(req.key)}
                          className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-red-600"
                          aria-label="Remove document request"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={req.title}
                        onChange={(e) => updateDocRequest(req.key, { title: e.target.value })}
                        placeholder="Document title (e.g. Insurance Card — Front)"
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
                      />
                      <input
                        type="text"
                        value={req.description}
                        onChange={(e) => updateDocRequest(req.key, { description: e.target.value })}
                        placeholder="Short helper text (optional)"
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#3399e6] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a66cc] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <PlusCircle className="h-4 w-4" />
              Add To-Do
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
