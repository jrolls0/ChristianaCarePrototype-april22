'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { clsx } from 'clsx';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  FileText,
  MessageSquare,
  Send,
  Upload,
  X,
} from 'lucide-react';
import { ClinicShell, CLINIC_CONTAINER } from '@/components/ui/ClinicShell';
import { StatusPill } from '@/components/ui/StatusPill';
import { ThreadMessage } from '@/components/ui/ThreadMessage';
import { AttachButton, AttachmentChips } from '@/components/ui/AttachmentRow';
import { appendAttachmentSummary, type Attachment } from '@/lib/attachments';
import { CLINIC_THREAD_KEY } from '@/lib/clinicInbox';
import {
  clinicDocuments,
  clinicRoiDocuments,
  formatDate,
  relativeTime,
  todoCompletedAt,
  waitingOnLabel,
} from '@/lib/clinicPortal';
import { PATIENT_STAGE_LABEL, PATIENT_STAGE_SHORT_LABEL, VISIBLE_PATIENT_STAGES } from '@/lib/stages';
import { useStore } from '@/lib/store';
import type { DocumentRecord, Patient, Todo } from '@/lib/types';

type ClinicCaseTab = 'summary' | 'todos' | 'documents' | 'messages' | 'activity';

const TABS: { id: ClinicCaseTab; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'todos', label: 'To-Dos' },
  { id: 'documents', label: 'Documents' },
  { id: 'messages', label: 'Messages' },
  { id: 'activity', label: 'Activity' },
];

function waitingTone(tone: 'patient' | 'transplant-center') {
  return tone === 'patient'
    ? 'bg-blue-50 text-blue-700 ring-blue-200'
    : 'bg-slate-100 text-slate-700 ring-slate-200';
}

function formatDob(value: string): string {
  if (!value) return 'Not provided';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

function isRoiSigned(patient: Patient, type: 'sign-roi-services' | 'sign-roi-medical') {
  return Boolean(todoCompletedAt(patient, type) ?? patient.roiSignedAt);
}

export default function ClinicCasePage() {
  const params = useParams<{ caseId: string }>();
  const patientId = params?.caseId;
  const patients = useStore((state) => state.patients);
  const clinicUser = useStore((state) => state.currentClinicUser);
  const markThreadRead = useStore((state) => state.markThreadRead);
  const sendMessage = useStore((state) => state.sendMessage);
  const uploadDocument = useStore((state) => state.uploadDocument);
  const [activeTab, setActiveTab] = useState<ClinicCaseTab>('summary');

  const patient = patients.find(
    (candidate) =>
      candidate.id === patientId &&
      candidate.referringClinic === clinicUser.clinicName &&
      candidate.stage !== 'new-referral'
  );

  useEffect(() => {
    if (!patient) return;
    const hasUnread = patient.messages.some(
      (message) =>
        message.threadKey === CLINIC_THREAD_KEY &&
        message.fromRole !== 'clinic' &&
        !message.readByClinic
    );
    if (hasUnread) {
      markThreadRead(patient.id, CLINIC_THREAD_KEY, 'clinic');
    }
  }, [patient, markThreadRead]);

  if (!patient) {
    return (
      <ClinicShell>
        <main className={clsx('py-6', CLINIC_CONTAINER)}>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Referral not available</h2>
            <p className="mt-2 text-sm text-slate-500">
              This referral is not attached to {clinicUser.clinicName}.
            </p>
            <Link
              href="/clinic"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1a66cc] px-4 py-2 text-sm font-semibold text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to referrals
            </Link>
          </section>
        </main>
      </ClinicShell>
    );
  }

  return (
    <ClinicShell>
      <main className={clsx('space-y-5 py-6', CLINIC_CONTAINER)}>
        <Link
          href="/clinic"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#1a66cc]"
        >
          <ArrowLeft className="h-4 w-4" />
          All referrals
        </Link>

        <PatientHeader patient={patient} />
        <WorkflowProgress patient={patient} />

        <nav className="grid gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:grid-cols-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                activeTab === tab.id
                  ? 'bg-[#1a66cc] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'summary' && <SummaryTab patient={patient} />}
        {activeTab === 'todos' && <TodosTab patient={patient} />}
        {activeTab === 'documents' && (
          <DocumentsTab
            patient={patient}
            onUploadDocument={(name) => uploadDocument(patient.id, name, 'clinic')}
          />
        )}
        {activeTab === 'messages' && (
          <MessagesTab
            patient={patient}
            onSendMessage={(body) => sendMessage(patient.id, 'clinic', body, CLINIC_THREAD_KEY)}
          />
        )}
        {activeTab === 'activity' && <ActivityTab patient={patient} />}
      </main>
    </ClinicShell>
  );
}

function PatientHeader({ patient }: { patient: Patient }) {
  const waiting = waitingOnLabel(patient.stage);
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3399e6] to-[#1a66cc] text-lg font-semibold text-white shadow-md">
              {patient.firstName[0]}
              {patient.lastName[0]}
            </div>
            <div className="min-w-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {patient.firstName} {patient.lastName}
                </h2>
                <StatusPill stage={patient.stage} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Clinic referral · Referred {relativeTime(patient.referralDate)} · {patient.daysInStage} days in stage
              </p>
            </div>
          </div>
          <span
            className={clsx(
              'inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
              waitingTone(waiting.tone)
            )}
          >
            Waiting on {waiting.label}
          </span>
        </div>
      </div>

      <div className="grid gap-x-10 gap-y-6 px-5 py-5 md:grid-cols-2 xl:grid-cols-3">
        <HeaderColumn title="Patient Contact">
          <InfoRow label="DOB">{formatDob(patient.dob)}</InfoRow>
          <InfoRow label="Phone">{patient.phone || 'Not provided'}</InfoRow>
          <InfoRow label="Email">{patient.email}</InfoRow>
          <InfoRow label="Preferred language">{patient.preferredLanguage}</InfoRow>
        </HeaderColumn>

        <HeaderColumn title="Referral Details">
          <InfoRow label="Dialysis social worker">{patient.duswName ?? 'Not assigned'}</InfoRow>
          <InfoRow label="Nephrologist">{patient.nephrologistName ?? 'Not assigned'}</InfoRow>
          <InfoRow label="Referral date">{formatDate(patient.referralDate)}</InfoRow>
        </HeaderColumn>

        <HeaderColumn title="ROI Status">
          <ConsentRow checked={isRoiSigned(patient, 'sign-roi-services')} label="Services ROI" />
          <ConsentRow
            checked={isRoiSigned(patient, 'sign-roi-medical')}
            label="Medical Records ROI"
          />
        </HeaderColumn>
      </div>
    </section>
  );
}

function HeaderColumn({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">
        {title}
      </h3>
      <dl className="space-y-2.5">{children}</dl>
    </div>
  );
}

function InfoRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-3 text-sm">
      <dt className="whitespace-nowrap text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-slate-900">{children}</dd>
    </div>
  );
}

function ConsentRow({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {checked ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-slate-300" />
      )}
      <span className={checked ? 'font-medium text-slate-900' : 'text-slate-500'}>
        {label}
      </span>
    </div>
  );
}

function WorkflowProgress({ patient }: { patient: Patient }) {
  const currentIndex = Math.max(
    0,
    VISIBLE_PATIENT_STAGES.findIndex((stage) => stage === patient.stage)
  );
  const progress = currentIndex / (VISIBLE_PATIENT_STAGES.length - 1);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Workflow Progress</h3>
          <p className="mt-1 text-sm text-slate-500">
            Stage {currentIndex + 1} of {VISIBLE_PATIENT_STAGES.length}: {PATIENT_STAGE_LABEL[patient.stage]}
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Read-only clinic view
        </span>
      </div>
      <div className="relative mt-6">
        <div className="absolute left-[6.25%] right-[6.25%] top-5 h-1 rounded-full bg-slate-100" />
        <div
          className="absolute left-[6.25%] top-5 h-1 rounded-full bg-[#1a66cc]"
          style={{ width: `${progress * 87.5}%` }}
        />
        <div className="relative grid grid-cols-8 gap-2">
          {VISIBLE_PATIENT_STAGES.map((stage, index) => {
            const done = index < currentIndex;
            const current = index === currentIndex;
            return (
              <div key={stage} className="flex min-w-0 flex-col items-center text-center">
                <div
                  className={clsx(
                    'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold',
                    done
                      ? 'border-[#1a66cc] bg-[#1a66cc] text-white'
                      : current
                        ? 'border-[#3399e6] bg-[#eef6ff] text-[#1a66cc]'
                        : 'border-slate-200 bg-slate-50 text-slate-400'
                  )}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>
                <span
                  className={clsx(
                    'mt-2 max-w-full truncate text-xs font-medium',
                    current ? 'text-[#1a66cc]' : done ? 'text-slate-700' : 'text-slate-400'
                  )}
                >
                  {PATIENT_STAGE_SHORT_LABEL[stage]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SummaryTab({ patient }: { patient: Patient }) {
  const waiting = waitingOnLabel(patient.stage);
  const completedTodos = patient.todos.filter((todo) => todo.status === 'completed').length;
  const roiCount = clinicRoiDocuments(patient).length;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Referral summary</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <SummaryMetric label="Waiting on" value={waiting.label} />
          <SummaryMetric label="Last update" value={relativeTime(patient.lastActivityAt)} />
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-500">
          The clinic can track ChristianaCare-side progress, view completed ROI forms,
          upload clinic documents, and message the Front Desk team.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Clinic snapshot</h3>
        <div className="mt-4 space-y-3">
          <SummaryMetric label="Patient to-dos" value={`${completedTodos}/${patient.todos.length}`} />
          <SummaryMetric label="ROI documents" value={`${roiCount}/2`} />
          <SummaryMetric label="Clinic uploads" value={clinicDocuments(patient).length.toString()} />
        </div>
      </section>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function TodosTab({ patient }: { patient: Patient }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-slate-900">Patient To-Dos</h3>
        <span className="text-xs text-slate-500">Read-only</span>
      </div>
      <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
        {patient.todos.map((todo) => (
          <TodoRow key={todo.id} todo={todo} />
        ))}
      </ul>
    </section>
  );
}

function TodoRow({ todo }: { todo: Todo }) {
  const done = todo.status === 'completed';
  return (
    <li className="flex items-start gap-3 bg-white px-4 py-3">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <p className={clsx('text-sm font-semibold', done ? 'text-slate-500' : 'text-slate-900')}>
            {todo.title}
          </p>
          {done && todo.completedAt && (
            <span className="text-xs text-slate-400">{relativeTime(todo.completedAt)}</span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">{todo.description}</p>
      </div>
    </li>
  );
}

function DocumentsTab({
  onUploadDocument,
  patient,
}: {
  onUploadDocument: (name: string) => void;
  patient: Patient;
}) {
  const [documentName, setDocumentName] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);
  const roiDocs = clinicRoiDocuments(patient);
  const uploadedDocs = clinicDocuments(patient).sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = documentName.trim();
    if (!trimmed) return;
    onUploadDocument(trimmed);
    setDocumentName('');
  }

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h3 className="text-base font-semibold text-slate-900">Documents</h3>
          <span className="text-xs text-slate-500">
            {roiDocs.length + uploadedDocs.length} file
            {roiDocs.length + uploadedDocs.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mt-4 space-y-5">
          <DocumentSection
            documents={roiDocs}
            emptyText="ROI documents will appear after the patient completes onboarding."
            onView={setSelectedDocument}
            title="Patient ROI Documents"
          />
          <DocumentSection
            documents={uploadedDocs}
            emptyText="No documents uploaded yet."
            onView={setSelectedDocument}
            title="Dialysis Clinic-Provided Documents"
          />
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Upload clinic document</h3>
        <p className="mt-1 text-sm text-slate-500">
          Simulate sharing a dialysis clinic document with ChristianaCare.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Document name
            </span>
            <input
              value={documentName}
              onChange={(event) => setDocumentName(event.target.value)}
              placeholder="e.g. Dialysis treatment summary"
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
            />
          </label>
          <button
            type="submit"
            disabled={!documentName.trim()}
            className="inline-flex h-11 items-center justify-center gap-1.5 self-end rounded-xl bg-[#1a66cc] px-4 text-sm font-semibold text-white transition hover:bg-[#1558ad] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Upload className="h-4 w-4" />
            Upload document
          </button>
        </form>
      </section>

      {selectedDocument && (
        <DocumentViewerModal
          document={selectedDocument}
          patient={patient}
          onClose={() => setSelectedDocument(null)}
        />
      )}
    </>
  );
}

function DocumentSection({
  documents,
  emptyText,
  onView,
  title,
}: {
  documents: DocumentRecord[];
  emptyText: string;
  onView: (document: DocumentRecord) => void;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">
          {title}
        </h4>
      </div>
      {documents.length === 0 ? (
        <div className="px-4 py-6 text-sm text-slate-500">{emptyText}</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex flex-col gap-3 bg-white px-4 py-3 transition hover:bg-[#f5faff] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eef6ff] text-[#1a66cc] ring-1 ring-[#dbeeff]">
                  <FileText className="h-4 w-4" />
                </div>
                <p className="truncate text-sm font-semibold text-slate-900">
                  {document.name}
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                <span className="text-xs text-slate-500">{formatDate(document.uploadedAt)}</span>
                <button
                  type="button"
                  onClick={() => onView(document)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[#3399e6] hover:text-[#1a66cc]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DocumentViewerModal({
  document,
  onClose,
  patient,
}: {
  document: DocumentRecord;
  onClose: () => void;
  patient: Patient;
}) {
  const source =
    document.uploadedBy === 'clinic'
      ? 'Dialysis Clinic-Provided Documents'
      : 'Patient ROI Documents';
  const lines =
    document.name.toLowerCase().includes('roi')
      ? [
          document.name.toUpperCase(),
          '',
          `Patient: ${patient.firstName} ${patient.lastName}`,
          `Signed: ${formatDate(document.uploadedAt)}`,
          `Source: ${source}`,
          '',
          'This is a simulated read-only ROI document preview for the prototype.',
        ]
      : [
          document.name.toUpperCase(),
          '',
          `Patient: ${patient.firstName} ${patient.lastName}`,
          `Uploaded: ${formatDate(document.uploadedAt)}`,
          `Source: ${source}`,
          '',
          '[Simulated clinic document preview]',
        ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <FileText className="h-5 w-5 text-[#1a66cc]" />
              {document.name}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {source} · Submitted {relativeTime(document.uploadedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close document viewer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <pre className="min-h-[300px] whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700">
              {lines.join('\n')}
            </pre>
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#1a66cc] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1558ad]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function MessagesTab({
  onSendMessage,
  patient,
}: {
  onSendMessage: (body: string) => void;
  patient: Patient;
}) {
  const [reply, setReply] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const thread = patient.messages
    .filter((message) => message.threadKey === CLINIC_THREAD_KEY)
    .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = reply.trim();
    if (!trimmed && attachments.length === 0) return;
    onSendMessage(appendAttachmentSummary(trimmed, attachments));
    setReply('');
    setAttachments([]);
  }

  return (
    <section className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="shrink-0 border-b border-slate-100 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">Messages</h3>
        <p className="text-sm text-slate-500">
          Clinic messages are routed to the ChristianaCare Front Desk team.
        </p>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/40 px-5 py-4">
        {thread.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            No messages with ChristianaCare yet.
          </div>
        ) : (
          thread.map((message) => (
            <ThreadMessage key={message.id} message={message} viewerRole="clinic" />
          ))
        )}
      </div>
      <div className="shrink-0 border-t border-slate-100 bg-white">
        <AttachmentChips
          attachments={attachments}
          onRemove={(id) => setAttachments((previous) => previous.filter((item) => item.id !== id))}
        />
        <form onSubmit={handleSubmit} className="flex items-end gap-2 px-4 py-3">
          <textarea
            rows={1}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder="Message ChristianaCare Front Desk..."
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm leading-relaxed outline-none transition focus:border-[#3399e6] focus:bg-white focus:ring-2 focus:ring-[#dbeeff]"
          />
          <AttachButton
            onAttach={(next) => setAttachments((previous) => [...previous, ...next])}
          />
          <button
            type="submit"
            disabled={!reply.trim() && attachments.length === 0}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#1a66cc] px-4 text-sm font-semibold text-white transition hover:bg-[#1558ad] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </form>
      </div>
    </section>
  );
}

function ActivityTab({ patient }: { patient: Patient }) {
  const events = useMemo(() => {
    const rows = [
      {
        id: `referral-${patient.id}`,
        at: patient.referralDate,
        label: 'Referral submitted',
        detail: patient.referringClinic ?? 'Dialysis clinic',
      },
      ...patient.todos
        .filter((todo) => todo.completedAt)
        .map((todo) => ({
          id: `todo-${todo.id}`,
          at: todo.completedAt as string,
          label: `${todo.title} completed`,
          detail: 'Patient portal',
        })),
      ...clinicDocuments(patient).map((document) => ({
        id: `doc-${document.id}`,
        at: document.uploadedAt,
        label: `${document.name} uploaded`,
        detail: 'Dialysis clinic upload',
      })),
      ...patient.messages
        .filter((message) => message.threadKey === CLINIC_THREAD_KEY)
        .map((message) => ({
          id: `msg-${message.id}`,
          at: message.sentAt,
          label: `${message.fromName} sent a message`,
          detail: 'ChristianaCare thread',
        })),
    ];

    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [patient]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Activity</h3>
      <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {events.map((event) => (
          <li key={event.id} className="flex items-start gap-3 px-4 py-3">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#3399e6]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{event.label}</p>
              <p className="text-xs text-slate-500">{event.detail}</p>
            </div>
            <span className="shrink-0 text-xs text-slate-400">{relativeTime(event.at)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
