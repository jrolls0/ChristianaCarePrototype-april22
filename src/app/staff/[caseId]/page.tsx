'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowRight,
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
  UserPlus,
  X,
} from 'lucide-react';
import { ShellHeader } from '@/components/ui/ShellHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { StuckBadge } from '@/components/ui/StuckBadge';
import { useStore } from '@/lib/store';
import type { Message, Patient, PatientStage, Todo } from '@/lib/types';

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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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
    label: 'Referral received',
    detail: `from ${patient.referringClinic}`,
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
  patient.messages.forEach((m) => {
    events.push({
      id: `msg-${m.id}`,
      at: m.sentAt,
      label: `Message from ${m.fromName}`,
      detail: m.body.length > 60 ? `${m.body.slice(0, 60)}…` : m.body,
      icon: MessageSquare,
      tone: 'blue',
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
            className={`text-sm font-medium ${
              done ? 'text-slate-500 line-through' : 'text-slate-900'
            }`}
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

function ThreadMessage({ message }: { message: Message }) {
  const fromStaff = message.fromRole === 'staff';
  return (
    <div className={`flex ${fromStaff ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
          fromStaff
            ? 'bg-[#3399e6] text-white'
            : message.fromRole === 'clinic'
              ? 'bg-violet-50 text-violet-900 ring-1 ring-violet-100'
              : 'bg-slate-100 text-slate-800'
        }`}
      >
        <div
          className={`text-[10px] font-semibold uppercase tracking-wider ${
            fromStaff ? 'text-white/80' : 'text-slate-500'
          }`}
        >
          {message.fromName}
        </div>
        <p className="mt-1 whitespace-pre-wrap leading-relaxed">{message.body}</p>
        <div
          className={`mt-1 text-[10px] ${
            fromStaff ? 'text-white/70' : 'text-slate-400'
          }`}
        >
          {formatDateTime(message.sentAt)}
        </div>
      </div>
    </div>
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
  const advanceStage = useStore((s) => s.advancePatientStage);

  const [todoOpen, setTodoOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [quickReply, setQuickReply] = useState('');

  const staffThread = useMemo(() => {
    if (!patient) return [];
    return patient.messages
      .filter((m) => m.threadKey === 'tc-frontdesk')
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  }, [patient]);

  const activity = useMemo(
    () => (patient ? buildActivity(patient) : []),
    [patient]
  );

  if (!patient) {
    return (
      <div className="min-h-screen bg-slate-50">
        <ShellHeader
          eyebrow="Front Desk · Case"
          title="Case not found"
          subtitle={caseId}
        />
        <main className="mx-auto max-w-2xl px-6 py-16 text-center">
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
      </div>
    );
  }

  const pendingTodos = patient.todos.filter((t) => t.status === 'pending');
  const completedCount = patient.todos.length - pendingTodos.length;
  const nextStage = (() => {
    const idx = STAGE_FLOW.indexOf(patient.stage);
    if (idx === -1 || idx === STAGE_FLOW.length - 1) return null;
    return STAGE_FLOW[idx + 1];
  })();

  function handleQuickReply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = quickReply.trim();
    if (!body || !patient) return;
    sendMessage(patient.id, 'staff', body, 'tc-frontdesk');
    setQuickReply('');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ShellHeader
        eyebrow="ChristianaCare · Case Detail"
        title={`${patient.firstName} ${patient.lastName}`}
        subtitle={`DOB ${new Date(patient.dob).toLocaleDateString('en-US')} · ${patient.referringClinic}`}
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-4">
          <Link
            href="/staff"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-[#1a66cc]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            All Cases
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* LEFT COLUMN */}
          <div className="space-y-6 lg:col-span-2">
            {/* Header card */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4 px-6 pt-6">
                <div className="flex items-start gap-4">
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
                      Referred {relativeTime(patient.referralDate)} by {patient.referringClinician}
                    </p>
                  </div>
                </div>
                <StatusPill stage={patient.stage} />
              </div>
              <div className="grid grid-cols-1 gap-x-8 gap-y-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-sm sm:grid-cols-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="h-4 w-4 text-slate-400" />
                  {patient.phone}
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="h-4 w-4 text-slate-400" />
                  {patient.email}
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Languages className="h-4 w-4 text-slate-400" />
                  {patient.preferredLanguage}
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="h-4 w-4 text-slate-400" />
                  {patient.daysInStage}d in current stage
                </div>
              </div>
            </section>

            {/* TODOs card */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Onboarding & To-Dos</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {completedCount} of {patient.todos.length} complete
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTodoOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#3399e6] bg-white px-3 py-1.5 text-xs font-semibold text-[#1a66cc] transition hover:bg-[#eef6ff]"
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
                <ul className="mt-3 divide-y divide-slate-100">
                  {patient.todos.map((t) => (
                    <TodoRow key={t.id} todo={t} />
                  ))}
                </ul>
              )}
            </section>

            {/* Documents card */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">Documents</h3>
              {patient.documents.length === 0 ? (
                <p className="mt-3 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  No documents uploaded yet.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {patient.documents.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#1a66cc] ring-1 ring-slate-200">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{d.name}</p>
                          <p className="text-xs text-slate-500">
                            Uploaded by {d.uploadedBy} · {relativeTime(d.uploadedAt)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Activity timeline */}
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
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${toneClasses(e.tone)}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-sm font-medium text-slate-800">{e.label}</p>
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
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {/* Quick actions */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Quick Actions</h3>
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => setMsgOpen(true)}
                  className="inline-flex w-full items-center justify-between gap-2 rounded-xl bg-[#3399e6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a66cc]"
                >
                  <span className="inline-flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Send Message to Patient
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTodoOpen(true)}
                  className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-[#3399e6] bg-white px-4 py-2.5 text-sm font-semibold text-[#1a66cc] transition hover:bg-[#eef6ff]"
                >
                  <span className="inline-flex items-center gap-2">
                    <PlusCircle className="h-4 w-4" />
                    Add To-Do for Patient
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => advanceStage(patient.id)}
                  disabled={!nextStage}
                  className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Mark Stage Complete
                  </span>
                  {nextStage ? (
                    <span className="text-xs text-slate-500">
                      → {STAGE_LABEL[nextStage]}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">final</span>
                  )}
                </button>
              </div>
            </section>

            {/* Messages thread */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <h3 className="text-sm font-semibold text-slate-900">Messages</h3>
                <span className="text-xs text-slate-400">
                  {staffThread.length} {staffThread.length === 1 ? 'message' : 'messages'}
                </span>
              </div>
              <div className="max-h-[360px] space-y-2.5 overflow-y-auto bg-slate-50/40 px-4 py-4">
                {staffThread.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    No messages yet. Send the first one below.
                  </p>
                ) : (
                  staffThread.map((m) => <ThreadMessage key={m.id} message={m} />)
                )}
              </div>
              <form
                onSubmit={handleQuickReply}
                className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-3"
              >
                <input
                  type="text"
                  value={quickReply}
                  onChange={(e) => setQuickReply(e.target.value)}
                  placeholder="Quick reply to patient…"
                  className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm outline-none transition focus:border-[#3399e6] focus:bg-white focus:ring-2 focus:ring-[#dbeeff]"
                />
                <button
                  type="submit"
                  disabled={!quickReply.trim()}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#3399e6] px-3 text-sm font-semibold text-white transition hover:bg-[#1a66cc] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send
                </button>
              </form>
            </section>

            {/* Patient details */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Patient Details</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Preferred language
                  </dt>
                  <dd className="text-slate-800">{patient.preferredLanguage}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Dialysis clinic
                  </dt>
                  <dd className="text-right text-slate-800">{patient.referringClinic}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    DUSW
                  </dt>
                  <dd className="text-right text-slate-800">{patient.duswName}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Nephrologist
                  </dt>
                  <dd className="text-right text-slate-800">{patient.nephrologistName}</dd>
                </div>
              </dl>
              {patient.emergencyContact ? (
                <div className="mt-4 rounded-xl bg-emerald-50/60 p-3 ring-1 ring-emerald-100">
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
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50/80 p-3 text-xs text-amber-800 ring-1 ring-amber-100">
                  <UserPlus className="h-3.5 w-3.5" />
                  No emergency contact on file.
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* Add TODO modal */}
      {todoOpen && (
        <AddTodoModal
          onClose={() => setTodoOpen(false)}
          onSubmit={(title, description) => {
            addCustomTodo(patient.id, title, description);
            setTodoOpen(false);
          }}
        />
      )}

      {/* Send Message modal */}
      {msgOpen && (
        <SendMessageModal
          recipientLabel={`${patient.firstName} ${patient.lastName} (Patient)`}
          onClose={() => setMsgOpen(false)}
          onSubmit={(subject, body) => {
            const combined = subject ? `${subject}\n\n${body}` : body;
            sendMessage(patient.id, 'staff', combined, 'tc-frontdesk');
            setMsgOpen(false);
          }}
        />
      )}
    </div>
  );
}

function AddTodoModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (title: string, description: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit(title.trim(), description.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
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
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
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
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
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

function SendMessageModal({
  recipientLabel,
  onClose,
  onSubmit,
}: {
  recipientLabel: string;
  onClose: () => void;
  onSubmit: (subject: string, body: string) => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim()) return;
    onSubmit(subject.trim(), body.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">Send Message</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              To
            </span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <MessageSquare className="h-4 w-4 text-slate-400" />
              {recipientLabel}
            </div>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Subject (optional)
            </span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What is this about?"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Message *
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Write a message to the patient…"
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
              autoFocus
            />
          </label>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!body.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#3399e6] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a66cc] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Send className="h-4 w-4" />
              Send Message
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
