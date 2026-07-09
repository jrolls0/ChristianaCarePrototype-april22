'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock,
  Eye,
  FileText,
  MessageSquare,
  PlusCircle,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { StaffShell, STAFF_CONTAINER } from '@/components/ui/StaffShell';
import { StatusPill } from '@/components/ui/StatusPill';
import { StuckBadge } from '@/components/ui/StuckBadge';
import { ScreeningReviewBadge } from '@/components/ui/ScreeningReviewBadge';
import { ThreadMessage } from '@/components/ui/ThreadMessage';
import { AttachButton, AttachmentChips } from '@/components/ui/AttachmentRow';
import { appendAttachmentSummary, type Attachment } from '@/lib/attachments';
import { END_REASON_OPTIONS, buildEndReferralLetter } from '@/lib/endReasons';
import {
  REFERRAL_SNAPSHOT_GENERAL_FIELDS,
  REFERRAL_SNAPSHOT_LAB_FIELDS,
  hasReferralSnapshot,
  referralSnapshotConcernLabels,
  referralSnapshotValueLabel,
} from '@/lib/referralClinicalSnapshot';
import {
  PATIENT_STAGE_LABEL,
  PATIENT_STAGE_SHORT_LABEL,
  VISIBLE_PATIENT_STAGES,
  getNextPatientStage,
} from '@/lib/stages';
import {
  formatSlotDate,
  formatSlotRange,
  isValidFutureSlot,
  selectedInitialEvaluationSlot,
} from '@/lib/initialEvaluationScheduling';
import {
  DECEASED_DONOR_PREFERENCES_DESCRIPTION,
  DECEASED_DONOR_PREFERENCES_TITLE,
  DECEASED_DONOR_PREFERENCES_TODO_TYPE,
  DONOR_PREFERENCE_FIELDS,
  declinedDonorPreferenceLabels,
  donorAgePreferenceLabel,
  latestDeceasedDonorPreferences,
  previousDeceasedDonorPreferences,
} from '@/lib/deceasedDonorPreferences';
import { useStore } from '@/lib/store';
import type {
  DeceasedDonorPreferencesResponse,
  DocumentRecord,
  InitialEvaluationSlot,
  Patient,
  ScreeningResponses,
  ThreadKey,
  Todo,
} from '@/lib/types';

const TODO_TEMPLATES: Array<
  | {
      kind: 'deceased-donor-preferences';
      title: string;
      description: string;
    }
  | {
      kind: 'custom';
      title: string;
    }
> = [
  {
    kind: 'deceased-donor-preferences',
    title: DECEASED_DONOR_PREFERENCES_TITLE,
    description: DECEASED_DONOR_PREFERENCES_DESCRIPTION,
  },
  { kind: 'custom', title: 'Upload additional documentation' },
  { kind: 'custom', title: 'Schedule call with social worker' },
  { kind: 'custom', title: 'Confirm preferred appointment times' },
];

type CockpitTab =
  | 'summary'
  | 'todos'
  | 'screening'
  | 'documents'
  | 'messages'
  | 'scheduling'
  | 'end-reason'
  | 'activity';

const COCKPIT_TABS: Array<{ id: CockpitTab; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'todos', label: 'Onboarding & To-Dos' },
  { id: 'screening', label: 'Screening' },
  { id: 'documents', label: 'Documents' },
  { id: 'messages', label: 'Messages' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'end-reason', label: 'End Referral' },
  { id: 'activity', label: 'Activity' },
];

type MsgTab = 'patient' | 'clinic';

const MSG_THREAD: Record<MsgTab, ThreadKey> = {
  patient: 'tc-frontdesk',
  clinic: 'clinic-staff',
};

interface ActivityEvent {
  id: string;
  at: string;
  label: string;
  detail?: string;
  icon: LucideIcon;
  tone: 'blue' | 'emerald' | 'red' | 'slate' | 'violet';
}

function relativeTime(iso: string): string {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return 'recently';
  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function formatDate(iso?: string): string {
  if (!iso) return 'Not recorded';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso?: string): string {
  if (!iso) return 'Not recorded';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDob(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso || 'Not provided';
  return `${Number(m)}/${Number(d)}/${y}`;
}

function valueLabel(value: string | undefined): string {
  if (!value) return 'Not provided';
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  if (value === 'notSure') return "I'm not sure";
  if (value === 'preferNotToAnswer') return 'Prefer not to answer';
  return value;
}

function bmiFromResponses(responses: ScreeningResponses): number | null {
  if (
    responses.heightUnknown ||
    responses.weightUnknown ||
    !responses.heightFeet ||
    responses.heightInches === undefined ||
    !responses.weightPounds
  ) {
    return null;
  }
  const totalInches = responses.heightFeet * 12 + responses.heightInches;
  if (!totalInches) return null;
  return (responses.weightPounds / (totalInches * totalInches)) * 703;
}

function isTodoComplete(patient: Patient, type: Todo['type']): boolean {
  return patient.todos.some((todo) => todo.type === type && todo.status === 'completed');
}

function roiSignedAt(patient: Patient): string | undefined {
  return (
    patient.roiSignedAt ??
    patient.todos.find((todo) => todo.type === 'sign-roi-medical' && todo.completedAt)
      ?.completedAt ??
    patient.todos.find((todo) => todo.type === 'sign-roi-services' && todo.completedAt)
      ?.completedAt
  );
}

function hasRoi(patient: Patient): boolean {
  return (
    patient.roiSigned ??
    (isTodoComplete(patient, 'sign-roi-services') && isTodoComplete(patient, 'sign-roi-medical'))
  );
}

function hasEmergencyConsent(patient: Patient): boolean {
  return Boolean(
    patient.emergencyContactConsent ??
      patient.emergencyContact?.consented ??
      isTodoComplete(patient, 'add-emergency-contact')
  );
}

function nextActionFor(patient: Patient): string {
  if (patient.endReferral) return 'Referral ended';
  if (patient.referralSource === 'self' && !patient.referringClinic) return 'Capture clinic info';
  if (patient.stage === 'initial-screening') return 'Review screening responses';
  if (patient.stage === 'scheduling') {
    return patient.initialEvaluationScheduling?.sentAt
      ? 'Waiting for patient to schedule'
      : 'Send initial evaluation times';
  }
  if (patient.stage === 'evaluation-scheduled') {
    const selected = selectedInitialEvaluationSlot(patient.initialEvaluationScheduling);
    return selected
      ? `Initial evaluation scheduled for ${formatSlotRange(selected)}`
      : 'Initial evaluation scheduled';
  }
  if (patient.isStuck) return 'Unblock current stage';
  const pendingTodo = patient.todos.find((todo) => todo.status === 'pending');
  if (pendingTodo) return `Waiting on ${patient.firstName}: ${pendingTodo.title}`;
  if (patient.stage === 'final-decision') return 'Prepare final decision review';
  return 'Open case';
}

function blockersFor(patient: Patient): string[] {
  const blockers: string[] = [];
  if (patient.referralSource === 'self' && !patient.referringClinic) {
    blockers.push('Capture clinic info');
  }
  if (patient.isStuck) {
    blockers.push(`${patient.daysInStage} days in current stage`);
  }
  patient.todos
    .filter((todo) => todo.status === 'pending')
    .slice(0, 3)
    .forEach((todo) => blockers.push(todo.title));
  if (patient.endReferral) {
    blockers.unshift(`Referral ended: ${patient.endReferral.reasonLabel}`);
  }
  return blockers;
}

function buildActivity(patient: Patient): ActivityEvent[] {
  const events: ActivityEvent[] = [
    {
      id: `referral-${patient.id}`,
      at: patient.referralDate,
      label:
        patient.referralSource === 'self'
          ? 'Patient self-registered'
          : 'Referral received',
      detail:
        patient.referralSource === 'self'
          ? patient.referringClinic
            ? `Portal signup · ${patient.referringClinic}`
            : 'Portal signup · clinic info needed'
          : `from ${patient.referringClinic}`,
      icon: ClipboardCheck,
      tone: 'violet',
    },
  ];

  if (patient.screeningResponses) {
    events.push({
      id: `screening-${patient.id}`,
      at: patient.screeningResponses.completedAt,
      label: 'Health questionnaire submitted',
      icon: ShieldCheck,
      tone: 'blue',
    });
  }

  patient.todos
    .filter((todo) => todo.type === DECEASED_DONOR_PREFERENCES_TODO_TYPE && todo.addedAt)
    .forEach((todo) => {
      events.push({
        id: `donor-prefs-assigned-${todo.id}`,
        at: todo.addedAt as string,
        label: 'Deceased donor preferences assigned',
        detail: todo.addedByStaff ? `Assigned by ${todo.addedByStaff}` : undefined,
        icon: ClipboardCheck,
        tone: 'violet',
      });
    });

  patient.deceasedDonorPreferencesResponses?.forEach((response) => {
    events.push({
      id: `donor-prefs-submitted-${response.id}`,
      at: response.submittedAt,
      label: 'Deceased donor preferences submitted',
      detail: donorAgePreferenceLabel(response),
      icon: ShieldCheck,
      tone: 'blue',
    });
  });

  patient.todos
    .filter(
      (todo) =>
        todo.status === 'completed' &&
        todo.completedAt &&
        todo.type !== DECEASED_DONOR_PREFERENCES_TODO_TYPE
    )
    .forEach((todo) => {
      events.push({
        id: `todo-${todo.id}`,
        at: todo.completedAt as string,
        label: `${todo.title} completed`,
        icon: CheckCircle2,
        tone: 'emerald',
      });
    });

  patient.documents.forEach((document) => {
    events.push({
      id: `doc-${document.id}`,
      at: document.uploadedAt,
      label: `${document.name} attached`,
      detail:
        document.uploadedBy === 'patient'
          ? 'Patient upload'
          : document.uploadedBy === 'clinic'
            ? 'Clinic upload'
            : 'Staff upload',
      icon: FileText,
      tone: 'slate',
    });
  });

  patient.messages
    .filter((message) => message.fromName !== 'ChristianaCare System')
    .slice(-8)
    .forEach((message) => {
      events.push({
        id: `msg-${message.id}`,
        at: message.sentAt,
        label: `Message from ${message.fromName}`,
        detail: message.threadKey === 'clinic-staff' ? 'Clinic thread' : 'Patient thread',
        icon: MessageSquare,
        tone: 'blue',
      });
    });

  if (patient.initialEvaluationScheduling?.sentAt) {
    events.push({
      id: `eval-slots-${patient.id}`,
      at: patient.initialEvaluationScheduling.sentAt,
      label: 'Initial evaluation times sent',
      detail: `${patient.initialEvaluationScheduling.slots.length} available ${
        patient.initialEvaluationScheduling.slots.length === 1 ? 'time' : 'times'
      } offered`,
      icon: CalendarDays,
      tone: 'blue',
    });
  }

  const selectedSlot = selectedInitialEvaluationSlot(patient.initialEvaluationScheduling);
  if (selectedSlot && patient.initialEvaluationScheduling?.selectedAt) {
    events.push({
      id: `eval-selected-${patient.id}`,
      at: patient.initialEvaluationScheduling.selectedAt,
      label: 'Initial evaluation scheduled',
      detail: formatSlotRange(selectedSlot),
      icon: CheckCircle2,
      tone: 'emerald',
    });
  }

  if (patient.endReferral) {
    events.push({
      id: `end-${patient.id}`,
      at: patient.endReferral.endedAt,
      label: 'End referral letter approved',
      detail: patient.endReferral.reasonLabel,
      icon: XCircle,
      tone: 'red',
    });
  }

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function toneClasses(tone: ActivityEvent['tone']) {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-50 text-emerald-600 ring-emerald-100';
    case 'red':
      return 'bg-red-50 text-red-600 ring-red-100';
    case 'violet':
      return 'bg-violet-50 text-violet-600 ring-violet-100';
    case 'blue':
      return 'bg-[#eef6ff] text-[#1a66cc] ring-[#dbeeff]';
    case 'slate':
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-100';
  }
}

export default function StaffCaseDetailPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params?.caseId ?? '';
  const patient = useStore((s) =>
    s.patients.find((p) => p.id === caseId) ?? null
  );
  const addCustomTodo = useStore((s) => s.addCustomTodo);
  const addDeceasedDonorPreferencesTodo = useStore((s) => s.addDeceasedDonorPreferencesTodo);
  const sendMessage = useStore((s) => s.sendMessage);
  const markThreadRead = useStore((s) => s.markThreadRead);
  const advanceStage = useStore((s) => s.advancePatientStage);
  const sendInitialEvaluationSlots = useStore((s) => s.sendInitialEvaluationSlots);
  const uploadDocument = useStore((s) => s.uploadDocument);
  const endReferral = useStore((s) => s.endReferral);

  const [activeCockpitTab, setActiveCockpitTab] = useState<CockpitTab>('summary');
  const [todoOpen, setTodoOpen] = useState(false);
  const [stageConfirmOpen, setStageConfirmOpen] = useState(false);
  const [activeMsgTab, setActiveMsgTab] = useState<MsgTab>('patient');
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

  const activeThread = activeMsgTab === 'patient' ? patientThread : clinicThread;
  const activity = useMemo(
    () => (patient ? buildActivity(patient) : []),
    [patient]
  );

  useEffect(() => {
    if (!patient) return;
    if (activeMsgTab === 'clinic' && !patient.referringClinic) {
      setActiveMsgTab('patient');
      return;
    }
    const threadKey = MSG_THREAD[activeMsgTab];
    const thread = activeMsgTab === 'patient' ? patientThread : clinicThread;
    if (thread.some((m) => m.fromRole !== 'staff' && !m.readByStaff)) {
      markThreadRead(patient.id, threadKey, 'staff');
    }
  }, [patient, activeMsgTab, patientThread, clinicThread, markThreadRead]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeMsgTab, activeThread.length]);

  useEffect(() => {
    setQuickReply('');
    setQuickReplyAttachments([]);
  }, [activeMsgTab]);

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
            All Cases
          </Link>
        </main>
      </StaffShell>
    );
  }

  const nextStage =
    patient.stage === 'scheduling' || patient.stage === 'evaluation-scheduled'
      ? null
      : getNextPatientStage(patient.stage);

  function handleQuickReply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!patient) return;
    const trimmed = quickReply.trim();
    if (trimmed.length === 0 && quickReplyAttachments.length === 0) return;
    const body = appendAttachmentSummary(trimmed, quickReplyAttachments);
    sendMessage(patient.id, 'staff', body, MSG_THREAD[activeMsgTab]);
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

        <PatientHeader patient={patient} />

        <WorkflowProgress
          patient={patient}
          nextStage={nextStage}
          onAdvance={() => setStageConfirmOpen(true)}
        />

        <nav className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {COCKPIT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCockpitTab(tab.id)}
              className={clsx(
                'rounded-xl px-3 py-2 text-sm font-semibold transition',
                activeCockpitTab === tab.id
                  ? 'bg-[#1a66cc] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="mt-5">
          {activeCockpitTab === 'summary' && (
            <SummaryTab patient={patient} activity={activity} onSwitchTab={setActiveCockpitTab} />
          )}
          {activeCockpitTab === 'todos' && (
            <TodosTab patient={patient} onAddTodo={() => setTodoOpen(true)} />
          )}
          {activeCockpitTab === 'screening' && <ScreeningTab patient={patient} />}
          {activeCockpitTab === 'documents' && (
            <DocumentsTab
              documents={patient.documents}
              patient={patient}
              onUpload={(name) => uploadDocument(patient.id, name, 'staff')}
            />
          )}
          {activeCockpitTab === 'messages' && (
            <MessagesTab
              activeMsgTab={activeMsgTab}
              activeThread={activeThread}
              clinicThreadAvailable={Boolean(patient.referringClinic)}
              clinicUnread={clinicUnread}
              patient={patient}
              patientUnread={patientUnread}
              quickReply={quickReply}
              quickReplyAttachments={quickReplyAttachments}
              scrollRef={scrollRef}
              onAttach={(attachments) =>
                setQuickReplyAttachments((previous) => [...previous, ...attachments])
              }
              onChangeMsgTab={setActiveMsgTab}
              onChangeReply={setQuickReply}
              onRemoveAttachment={removeQuickReplyAttachment}
              onSubmit={handleQuickReply}
            />
          )}
          {activeCockpitTab === 'scheduling' && (
            <SchedulingTab
              patient={patient}
              onSendSlots={(slots) => sendInitialEvaluationSlots(patient.id, slots)}
            />
          )}
          {activeCockpitTab === 'end-reason' && (
            <EndReasonTab
              patient={patient}
              onApprove={(payload) => endReferral(patient.id, payload)}
            />
          )}
          {activeCockpitTab === 'activity' && <ActivityTab activity={activity} />}
        </div>
      </main>

      {todoOpen && (
        <AddTodoModal
          onClose={() => setTodoOpen(false)}
          onSubmit={(payload) => {
            if (payload.kind === 'deceased-donor-preferences') {
              addDeceasedDonorPreferencesTodo(patient.id);
            } else {
              addCustomTodo(patient.id, payload.title, payload.description, payload.documentRequests);
            }
            setTodoOpen(false);
          }}
        />
      )}

      {stageConfirmOpen && nextStage && (
        <StageAdvanceConfirmModal
          nextStage={nextStage}
          patient={patient}
          onClose={() => setStageConfirmOpen(false)}
          onConfirm={() => {
            advanceStage(patient.id);
            setStageConfirmOpen(false);
          }}
        />
      )}
    </StaffShell>
  );
}

function PatientHeader({ patient }: { patient: Patient }) {
  const missingClinicInfo = patient.referralSource === 'self' && !patient.referringClinic;
  const referralLabel = patient.referralSource === 'self' ? 'Self-signup' : 'Clinic referral';
  const referralTimingLabel = patient.referralSource === 'self' ? 'Registered' : 'Referred';

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3399e6] to-[#1a66cc] text-lg font-semibold text-white shadow-md">
              {patient.firstName[0]}
              {patient.lastName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {patient.firstName} {patient.lastName}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {patient.endReferral ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                      <XCircle className="h-3.5 w-3.5" />
                      Referral ended
                    </span>
                  ) : (
                    <>
                      <StatusPill stage={patient.stage} />
                      {patient.stage === 'initial-screening' && <ScreeningReviewBadge />}
                      {patient.stage !== 'initial-screening' && patient.isStuck && (
                        <StuckBadge days={patient.daysInStage} />
                      )}
                    </>
                  )}
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {referralLabel} · {referralTimingLabel} {relativeTime(patient.referralDate)} ·{' '}
                {patient.endReferral
                  ? `Ended ${relativeTime(patient.endReferral.endedAt)}`
                  : `${patient.daysInStage} days in stage`}
              </p>
              {patient.endReferral && (
                <p className="mt-2 text-sm font-medium text-red-700">
                  Referral ended: {patient.endReferral.reasonLabel}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {missingClinicInfo && !patient.endReferral && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                Needs action
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              <Clock className="h-3.5 w-3.5" />
              Last activity {relativeTime(patient.lastActivityAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-x-10 gap-y-6 px-5 py-5 md:grid-cols-2 xl:grid-cols-4 2xl:gap-x-12">
        <HeaderColumn title="Patient Contact">
          <InfoRow label="DOB">{formatDob(patient.dob)}</InfoRow>
          <InfoRow label="Phone" nowrap>{patient.phone || 'Not provided'}</InfoRow>
          <InfoRow label="Email" nowrap>{patient.email}</InfoRow>
          <InfoRow label="Preferred language">{patient.preferredLanguage}</InfoRow>
        </HeaderColumn>

        <HeaderColumn title="Referral / Owner">
          <InfoRow label="Referral source">
            {patient.referralSource === 'self' ? 'Patient self-signup' : 'Clinic referral'}
          </InfoRow>
          <InfoRow label="Dialysis clinic">
            {patient.referringClinic || 'Not captured yet'}
          </InfoRow>
          <InfoRow label="Dialysis social worker">
            {patient.duswName || 'Not assigned'}
          </InfoRow>
          <InfoRow label="Nephrologist">{patient.nephrologistName || 'Not assigned'}</InfoRow>
          <InfoRow label="TC Coordinator">Sarah Martinez</InfoRow>
        </HeaderColumn>

        <EmergencyContactColumn patient={patient} />

        <HeaderColumn title="Status & Consents">
          <ConsentRow
            checked={hasRoi(patient)}
            label="ROI Signed"
            detail={hasRoi(patient) ? formatDate(roiSignedAt(patient)) : undefined}
          />
          <ConsentRow checked={Boolean(patient.emailConsent)} label="Email Consent" />
          <ConsentRow checked={Boolean(patient.smsConsent)} label="SMS Consent" />
          <ConsentRow checked={Boolean(patient.phoneConsent)} label="Phone Consent" />
        </HeaderColumn>
      </div>
    </section>
  );
}

function EmergencyContactColumn({ patient }: { patient: Patient }) {
  const contact = patient.emergencyContact;
  return (
    <HeaderColumn title="Emergency Contact">
      {contact ? (
        <>
          <InfoRow label="Name">{contact.name}</InfoRow>
          <InfoRow label="Relationship">{contact.relationship || 'Not provided'}</InfoRow>
          <InfoRow label="Phone">{contact.phone || 'Not provided'}</InfoRow>
          <InfoRow label="Email" nowrap>{contact.email || 'Not provided'}</InfoRow>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-sm font-semibold text-slate-700">Not provided yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Optional patient to-do not completed.
          </p>
        </div>
      )}
    </HeaderColumn>
  );
}

function HeaderColumn({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">
        {title}
      </h3>
      <dl className="space-y-2.5">{children}</dl>
    </div>
  );
}

function InfoRow({
  label,
  nowrap = false,
  children,
}: {
  label: string;
  nowrap?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1 text-sm min-[1900px]:grid-cols-[9.5rem_minmax(0,1fr)] min-[1900px]:gap-2">
      <dt className="text-slate-500 min-[1900px]:whitespace-nowrap">
        {label}
      </dt>
      <dd
        className={clsx(
          'min-w-0 font-medium text-slate-900',
          nowrap
            ? 'break-words min-[1900px]:whitespace-nowrap min-[1900px]:break-normal'
            : 'break-words'
        )}
        title={typeof children === 'string' ? children : undefined}
      >
        {children}
      </dd>
    </div>
  );
}

function ConsentRow({
  checked,
  detail,
  label,
}: {
  checked: boolean;
  detail?: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {checked ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-slate-300" />
      )}
      <span className={checked ? 'font-medium text-slate-900' : 'text-slate-500'}>
        {label}
      </span>
      {detail && <span className="text-xs text-slate-400">({detail})</span>}
    </div>
  );
}

function WorkflowProgress({
  nextStage,
  onAdvance,
  patient,
}: {
  nextStage: Patient['stage'] | null;
  onAdvance: () => void;
  patient: Patient;
}) {
  const visibleIndex = VISIBLE_PATIENT_STAGES.findIndex((stage) => stage === patient.stage);
  const currentIndex = Math.max(0, visibleIndex);
  const stageCount = VISIBLE_PATIENT_STAGES.length;
  const progressPct = stageCount > 1 ? (currentIndex / (stageCount - 1)) * 100 : 100;
  const disabled = Boolean(patient.endReferral || !nextStage);
  const patientOwnedStage =
    patient.stage === 'onboarding' ||
    patient.stage === 'initial-todos' ||
    patient.stage === 'education';
  const schedulingStage = patient.stage === 'scheduling';
  const scheduledStage = patient.stage === 'evaluation-scheduled';
  const railInsetPct = 50 / stageCount;

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Workflow Progress</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Stage {currentIndex + 1} of {VISIBLE_PATIENT_STAGES.length}: {PATIENT_STAGE_LABEL[patient.stage]}
          </p>
        </div>
        {patientOwnedStage ? (
          <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
            <Clock className="h-4 w-4" />
            {patient.stage === 'education'
              ? 'Patient completes education in the portal'
              : 'Patient completes this step in the portal'}
          </div>
        ) : schedulingStage ? (
          <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
            <CalendarDays className="h-4 w-4" />
            Send available times in the Scheduling tab
          </div>
        ) : scheduledStage ? (
          <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            Initial evaluation scheduled
          </div>
        ) : (
          <button
            type="button"
            onClick={onAdvance}
            disabled={disabled}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#1a66cc] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1558ad] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <CheckCircle2 className="h-4 w-4" />
            {patient.endReferral
              ? 'Referral ended'
              : nextStage
                ? `Mark stage complete → ${PATIENT_STAGE_LABEL[nextStage]}`
                : 'Final stage'}
          </button>
        )}
      </div>

      <div className="mt-5 overflow-x-auto pb-1">
        <div className="relative min-w-[720px] pt-1">
          <div
            className="absolute top-[18px] h-2 rounded-full bg-slate-100"
            style={{ left: `${railInsetPct}%`, right: `${railInsetPct}%` }}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#3399e6] to-[#1a66cc]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div
            className="relative grid"
            style={{ gridTemplateColumns: `repeat(${stageCount}, minmax(0, 1fr))` }}
          >
            {VISIBLE_PATIENT_STAGES.map((stage, index) => {
              const isComplete = index < currentIndex;
              const isCurrent = index === currentIndex;
              return (
                <div key={stage} className="flex min-w-0 flex-col items-center text-center">
                  <div
                    className={clsx(
                      'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset',
                      isComplete && 'bg-[#1a66cc] text-white ring-[#1a66cc]',
                      isCurrent && 'bg-[#eef6ff] text-[#1a66cc] ring-[#3399e6]',
                      !isComplete && !isCurrent && 'bg-slate-50 text-slate-400 ring-slate-100'
                    )}
                  >
                    {isComplete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                  </div>
                  <span
                    className={clsx(
                      'mt-1.5 max-w-[7rem] text-xs font-medium leading-tight',
                      isCurrent ? 'text-[#1a66cc]' : isComplete ? 'text-slate-700' : 'text-slate-400'
                    )}
                  >
                    {PATIENT_STAGE_SHORT_LABEL[stage]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function StageAdvanceConfirmModal({
  nextStage,
  onClose,
  onConfirm,
  patient,
}: {
  nextStage: Patient['stage'];
  onClose: () => void;
  onConfirm: () => void;
  patient: Patient;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Confirm Stage Completion</h3>
            <p className="mt-1 text-sm text-slate-500">
              This will move the case forward in the transplant center workflow.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close confirmation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                Only continue if staff review for this stage is complete. This change is saved
                immediately in the demo state.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
              {patient.firstName} {patient.lastName}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Current stage: <span className="font-medium text-slate-900">{PATIENT_STAGE_LABEL[patient.stage]}</span>
            </p>
            <p className="text-sm text-slate-600">
              New stage: <span className="font-medium text-slate-900">{PATIENT_STAGE_LABEL[nextStage]}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1a66cc] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1558ad]"
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirm stage complete
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryTab({
  activity,
  onSwitchTab,
  patient,
}: {
  activity: ActivityEvent[];
  onSwitchTab: (tab: CockpitTab) => void;
  patient: Patient;
}) {
  const blockers = blockersFor(patient);
  const pendingTodos = patient.todos.filter((todo) => todo.status === 'pending');
  const screeningReviewNeeded = patient.stage === 'initial-screening';

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {screeningReviewNeeded && (
          <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-indigo-950">Staff Review Needed</p>
                <p className="mt-1 text-sm leading-relaxed text-indigo-900">
                  The patient has completed the health questionnaire. Review the Screening tab,
                  then decide whether this case should move to Financial Screening.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSwitchTab('screening')}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-100"
              >
                <ClipboardCheck className="h-4 w-4" />
                Review Screening Responses
              </button>
            </div>
          </div>
        )}
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Next Action
        </p>
        <h3 className="mt-2 text-xl font-semibold text-slate-900">
          {nextActionFor(patient)}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {patient.endReferral
            ? 'This referral has been ended. The approved letter is visible in the patient portal.'
            : patient.isStuck
              ? 'This case is flagged because it has remained in the current stage longer than expected.'
              : 'Use the tabs below to review the current case work and move the referral forward.'}
        </p>

        <SchedulingSummaryCallout patient={patient} onSwitchTab={onSwitchTab} />
        <DonorPreferencesSummaryCallout patient={patient} onSwitchTab={onSwitchTab} />
        <ClinicReferralSnapshotSummary patient={patient} />

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <SummaryMetric label="Open to-dos" value={pendingTodos.length.toString()} />
          <SummaryMetric label="Documents" value={patient.documents.length.toString()} />
          <SummaryMetric
            label="Messages"
            value={patient.messages.filter((m) => m.fromName !== 'ChristianaCare System').length.toString()}
          />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-slate-900">Blockers & Flags</h4>
            <button
              type="button"
              onClick={() => onSwitchTab('todos')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1a66cc]"
            >
              Review to-dos
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {blockers.length === 0 ? (
            <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-100">
              No active blockers. This case is ready for staff review.
            </div>
          ) : (
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {blockers.map((blocker) => (
                <li
                  key={blocker}
                  className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-100"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  {blocker}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
          <button
            type="button"
            onClick={() => onSwitchTab('activity')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1a66cc]"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <ActivityList activity={activity.slice(0, 6)} />
      </section>
    </div>
  );
}

function DonorPreferencesSummaryCallout({
  onSwitchTab,
  patient,
}: {
  onSwitchTab: (tab: CockpitTab) => void;
  patient: Patient;
}) {
  const pending = patient.todos.find(
    (todo) => todo.type === DECEASED_DONOR_PREFERENCES_TODO_TYPE && todo.status === 'pending'
  );
  const latest = latestDeceasedDonorPreferences(patient);
  if (!pending && !latest) return null;

  return (
    <div className="mt-5 rounded-xl border border-[#dbeeff] bg-[#eef6ff] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            {pending ? 'Donor preferences form assigned' : `Donor preferences updated ${relativeTime(latest?.submittedAt ?? '')}`}
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            {pending
              ? `${patient.firstName} has a pending donor type preferences form in the patient portal.`
              : `Maximum donor age: ${latest ? donorAgePreferenceLabel(latest) : 'Not recorded'}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSwitchTab('todos')}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#1a66cc] ring-1 ring-[#dbeeff] transition hover:bg-[#f8fbff]"
        >
          <ClipboardCheck className="h-4 w-4" />
          Review To-Dos
        </button>
      </div>
    </div>
  );
}

function SchedulingSummaryCallout({
  onSwitchTab,
  patient,
}: {
  onSwitchTab: (tab: CockpitTab) => void;
  patient: Patient;
}) {
  if (patient.stage !== 'scheduling' && patient.stage !== 'evaluation-scheduled') return null;
  const selected = selectedInitialEvaluationSlot(patient.initialEvaluationScheduling);
  const slotsSent = Boolean(patient.initialEvaluationScheduling?.sentAt);
  const title =
    patient.stage === 'evaluation-scheduled'
      ? 'Initial evaluation scheduled'
      : slotsSent
        ? 'Waiting for patient to choose'
        : 'Send initial evaluation times';
  const detail =
    selected
      ? `${patient.firstName} selected ${formatSlotRange(selected)}.`
      : slotsSent
        ? `${patient.initialEvaluationScheduling?.slots.length ?? 0} appointment ${
            patient.initialEvaluationScheduling?.slots.length === 1 ? 'time was' : 'times were'
          } sent to the patient.`
        : 'Add available appointment windows so the patient can choose a time in the portal.';

  return (
    <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-emerald-950">{title}</h4>
          <p className="mt-1 text-sm leading-relaxed text-emerald-900">{detail}</p>
        </div>
        {patient.stage === 'scheduling' && (
          <button
            type="button"
            onClick={() => onSwitchTab('scheduling')}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
          >
            <CalendarDays className="h-4 w-4" />
            Open Scheduling
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}

function ClinicReferralSnapshotSummary({ patient }: { patient: Patient }) {
  const snapshot = patient.referralClinicalSnapshot;
  if (!hasReferralSnapshot(snapshot)) return null;

  const concerns = referralSnapshotConcernLabels(snapshot);
  const comments = snapshot?.comments?.trim();

  return (
    <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50/50 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Clinic Referral Snapshot</h4>
          <p className="mt-0.5 text-xs text-slate-500">
            {concerns.length} {concerns.length === 1 ? 'concern' : 'concerns'} flagged · submitted by{' '}
            {patient.referringClinic ?? 'dialysis clinic'}
          </p>
        </div>
        {concerns.length === 0 && (
          <span className="inline-flex w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
            No concerns flagged
          </span>
        )}
      </div>

      {concerns.length > 0 && (
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {concerns.map((concern) => (
            <li
              key={concern}
              className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-amber-900 ring-1 ring-amber-100"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              Concern: {concern}
            </li>
          ))}
        </ul>
      )}

      {comments && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Comments
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {comments}
          </p>
        </div>
      )}
    </div>
  );
}

function TodosTab({
  onAddTodo,
  patient,
}: {
  onAddTodo: () => void;
  patient: Patient;
}) {
  const roiRows: Todo[] = patient.todos.filter((todo) =>
    ['sign-roi-services', 'sign-roi-medical'].includes(todo.type)
  );
  const requiredRows = patient.todos.filter((todo) =>
    ['upload-government-id', 'upload-insurance-card', 'complete-health-questionnaire'].includes(todo.type)
  );
  const optionalRows = patient.todos.filter((todo) => todo.type === 'add-emergency-contact');
  const laterStageRows = patient.todos.filter((todo) =>
    ['watch-education-video', 'schedule-initial-evaluation'].includes(todo.type)
  );
  const staffAssignedRows = patient.todos.filter((todo) =>
    ['custom', DECEASED_DONOR_PREFERENCES_TODO_TYPE].includes(todo.type)
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Onboarding & To-Dos</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Staff-created tasks appear in the patient portal immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddTodo}
            className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-[#3399e6] bg-white px-3 py-2 text-sm font-semibold text-[#1a66cc] transition hover:bg-[#eef6ff]"
          >
            <PlusCircle className="h-4 w-4" />
            Add To-Do
          </button>
        </div>

        <TodoGroup
          fallbackRows={[
            {
              id: `roi-${patient.id}`,
              title: 'Release of Information forms',
              description: hasRoi(patient)
                ? `Signed ${formatDate(roiSignedAt(patient))}`
                : 'Patient has not completed ROI consent.',
              status: hasRoi(patient) ? 'completed' : 'pending',
              type: 'custom',
            },
          ]}
          rows={roiRows}
          title="Consent Onboarding"
        />
        <TodoGroup rows={requiredRows} title="Required Initial To-Dos" />
        <TodoGroup rows={optionalRows} title="Optional Support Contact" />
        <TodoGroup
          description="Standard tasks that appear later in the referral workflow."
          rows={laterStageRows}
          title="Later-Stage Workflow Tasks"
        />
        <TodoGroup
          description="Manually assigned by transplant center staff."
          rows={staffAssignedRows}
          title="Staff-Assigned To-Dos"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Progress Snapshot</h3>
        <div className="mt-4 space-y-3">
          <ProgressRow label="ROI signed" complete={hasRoi(patient)} />
          <ProgressRow
            label="Government ID"
            complete={isTodoComplete(patient, 'upload-government-id')}
          />
          <ProgressRow
            label="Insurance card"
            complete={isTodoComplete(patient, 'upload-insurance-card')}
          />
          <ProgressRow
            label="Health questionnaire"
            complete={isTodoComplete(patient, 'complete-health-questionnaire')}
          />
          <ProgressRow
            label="Emergency contact"
            complete={hasEmergencyConsent(patient)}
            optional
          />
        </div>
      </section>
    </div>
  );
}

function TodoGroup({
  description,
  fallbackRows,
  rows,
  title,
}: {
  description?: string;
  fallbackRows?: Todo[];
  rows: Todo[];
  title: string;
}) {
  const displayRows = rows.length > 0 ? rows : fallbackRows ?? [];
  if (displayRows.length === 0) return null;
  return (
    <div className="mt-5">
      <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </h4>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
        {displayRows.map((todo) => (
          <TodoRow key={todo.id} todo={todo} />
        ))}
      </ul>
    </div>
  );
}

function TodoRow({ todo }: { todo: Todo }) {
  const done = todo.status === 'completed';
  return (
    <li className="flex items-start gap-3 bg-white px-3 py-3 first:rounded-t-xl last:rounded-b-xl">
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

function DonorPreferencesResultsSection({ patient }: { patient: Patient }) {
  const latest = latestDeceasedDonorPreferences(patient);
  const previous = previousDeceasedDonorPreferences(patient);
  const [selectedResponse, setSelectedResponse] =
    useState<DeceasedDonorPreferencesResponse | null>(null);
  if (!latest) return null;

  const declined = declinedDonorPreferenceLabels(latest);

  return (
    <div className="mt-5 rounded-2xl border border-[#dbeeff] bg-[#f8fbff] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            Deceased Donor Preferences
          </h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Submitted {formatDateTime(latest.submittedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSelectedResponse(latest)}
          className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#1a66cc] ring-1 ring-[#dbeeff] transition hover:bg-[#eef6ff]"
        >
          <Eye className="h-4 w-4" />
          View Details
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-white p-3 ring-1 ring-[#dbeeff]">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Maximum donor age
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {donorAgePreferenceLabel(latest)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-[#dbeeff]">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Patient signature
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {latest.patientSignature}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Donor types declined
        </p>
        {declined.length === 0 ? (
          <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
            No restrictions
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {declined.map((label) => (
              <li
                key={label}
                className="rounded-xl bg-white px-3 py-2 text-sm font-medium leading-relaxed text-slate-700 ring-1 ring-[#dbeeff]"
              >
                {label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {previous.length > 0 && (
        <div className="mt-4 border-t border-[#dbeeff] pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Previous submissions
          </p>
          <div className="mt-2 space-y-2">
            {previous.map((response) => (
              <div
                key={response.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-[#dbeeff]"
              >
                <span className="text-sm font-medium text-slate-700">
                  {formatDateTime(response.submittedAt)}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedResponse(response)}
                  className="text-xs font-semibold text-[#1a66cc]"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedResponse && (
        <DonorPreferencesDetailModal
          response={selectedResponse}
          onClose={() => setSelectedResponse(null)}
        />
      )}
    </div>
  );
}

function DonorPreferencesDetailModal({
  onClose,
  response,
}: {
  onClose: () => void;
  response: DeceasedDonorPreferencesResponse;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Deceased Donor Preferences
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Submitted {formatDateTime(response.submittedAt)} · Signature: {response.patientSignature}
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

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Maximum donor age
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {donorAgePreferenceLabel(response)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Patient
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {response.patientName} · {formatDob(response.patientDob)}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Donor type</th>
                  <th className="w-28 px-4 py-3 font-semibold">Answer</th>
                  <th className="w-40 px-4 py-3 font-semibold">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {DONOR_PREFERENCE_FIELDS.map((field) => {
                  const answer = response.donorTypePreferences[field.key];
                  return (
                    <tr key={field.key}>
                      <td className="px-4 py-3 leading-relaxed text-slate-700">
                        {field.label}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                            answer === 'yes'
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                              : 'bg-red-50 text-red-700 ring-1 ring-red-100'
                          )}
                        >
                          {answer === 'yes' ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(response.submittedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#1a66cc] px-4 py-2 text-sm font-semibold text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgressRow({
  complete,
  label,
  optional = false,
}: {
  complete: boolean;
  label: string;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {optional && <span className="ml-1 text-xs text-slate-400">(optional)</span>}
      </span>
      {complete ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Done
        </span>
      ) : (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
          Pending
        </span>
      )}
    </div>
  );
}

function ScreeningTab({ patient }: { patient: Patient }) {
  const responses = patient.screeningResponses;
  if (!responses) {
    return (
      <div className="space-y-5">
        <ClinicReferralSnapshotDetail patient={patient} />
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">
            Health questionnaire not submitted yet
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Once the patient completes the health questionnaire, staff can review the responses here.
          </p>
        </section>
      </div>
    );
  }

  const bmi = bmiFromResponses(responses);
  const flaggedCount = screeningRows(responses, bmi).filter((row) => row.severity).length;
  const screeningReviewNeeded = patient.stage === 'initial-screening';

  return (
    <div className="space-y-5">
      {screeningReviewNeeded && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700 ring-1 ring-indigo-200">
              <ClipboardCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-indigo-950">Review Required</h3>
              <p className="mt-1 text-sm leading-relaxed text-indigo-900">
                Review the patient&apos;s health questionnaire responses and flagged answers before
                deciding whether to advance this case to Financial Screening.
              </p>
            </div>
          </div>
        </section>
      )}
      <ClinicReferralSnapshotDetail patient={patient} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Screening Responses</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Submitted {formatDate(responses.completedAt)} · pulled from the patient health questionnaire.
            </p>
          </div>
          {flaggedCount > 0 ? (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
              <AlertTriangle className="h-3.5 w-3.5" />
              {flaggedCount} flagged
            </span>
          ) : (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
              <CheckCircle2 className="h-3.5 w-3.5" />
              No concerns flagged
            </span>
          )}
        </div>
      </section>

      <ScreeningSection
        rows={[
          {
            label: 'Currently on dialysis?',
            value: valueLabel(responses.onDialysis),
          },
          {
            label: 'Dialysis start',
            value: responses.dialysisStart ?? 'Not applicable',
          },
          {
            label: 'Most recent eGFR',
            value: responses.egfrUnknown ? "Patient doesn't know" : `${responses.egfr}`,
          },
          {
            label: 'Height',
            value: responses.heightUnknown
              ? "Patient doesn't know"
              : `${responses.heightFeet}' ${responses.heightInches}"`,
          },
          {
            label: 'Weight',
            value: responses.weightUnknown ? "Patient doesn't know" : `${responses.weightPounds} lbs`,
          },
          {
            label: 'Calculated BMI',
            value: bmi ? bmi.toFixed(1) : 'Not available',
            severity: bmi && bmi > 42 ? 'critical' : null,
            note: bmi && bmi > 42 ? 'BMI is above the screening threshold used in this demo.' : undefined,
          },
          {
            label: 'U.S. citizen or legal resident?',
            value: valueLabel(responses.isCitizenOrResident),
            severity: responses.isCitizenOrResident === 'no' ? 'warning' : null,
          },
        ]}
        title="Basic Information"
      />

      <ScreeningSection rows={screeningRows(responses, bmi).slice(7)} title="Medical Screening" />

      {responses.otherConcerns && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Additional Health Information</h3>
          <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {responses.otherConcerns}
          </p>
        </section>
      )}
    </div>
  );
}

function ClinicReferralSnapshotDetail({ patient }: { patient: Patient }) {
  const snapshot = patient.referralClinicalSnapshot;
  if (!hasReferralSnapshot(snapshot)) return null;

  const generalRows = REFERRAL_SNAPSHOT_GENERAL_FIELDS.map((field) => ({
    label: field.label,
    value: snapshot?.[field.key],
  }));
  const labRows = REFERRAL_SNAPSHOT_LAB_FIELDS.map((field) => ({
    label: field.label,
    value: snapshot?.labs?.[field.key],
  }));
  const comments = snapshot?.comments?.trim();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Clinic-Provided Referral Snapshot
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Source: {patient.referringClinic ?? 'Dialysis clinic'}
            {patient.duswName ? ` · ${patient.duswName}` : ''}
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-100">
          Clinic-provided
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ReferralSnapshotRows title="Referral Context" rows={generalRows} />
        <ReferralSnapshotRows title="Labs" rows={labRows} />
      </div>

      {comments && (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Comments
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {comments}
          </p>
        </div>
      )}
    </section>
  );
}

function ReferralSnapshotRows({
  rows,
  title,
}: {
  rows: Array<{ label: string; value?: 'concern' | 'no-concern' }>;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h4>
      <dl className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <dt className="text-slate-600">{row.label}</dt>
            <dd>
              <ReferralSnapshotValue value={row.value} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ReferralSnapshotValue({ value }: { value?: 'concern' | 'no-concern' }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
        value === 'concern' && 'bg-amber-50 text-amber-800 ring-amber-200',
        value === 'no-concern' && 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        !value && 'bg-slate-100 text-slate-500 ring-slate-200'
      )}
    >
      {referralSnapshotValueLabel(value)}
    </span>
  );
}

type ScreeningSeverity = 'warning' | 'critical' | null;

function screeningRows(responses: ScreeningResponses, bmi: number | null) {
  return [
    {
      label: 'Currently on dialysis?',
      value: valueLabel(responses.onDialysis),
      severity: null,
    },
    { label: 'Dialysis start', value: responses.dialysisStart ?? 'Not applicable', severity: null },
    {
      label: 'Most recent eGFR',
      value: responses.egfrUnknown ? "Patient doesn't know" : `${responses.egfr}`,
      severity: null,
    },
    {
      label: 'Height',
      value: responses.heightUnknown ? "Patient doesn't know" : `${responses.heightFeet}' ${responses.heightInches}"`,
      severity: null,
    },
    {
      label: 'Weight',
      value: responses.weightUnknown ? "Patient doesn't know" : `${responses.weightPounds} lbs`,
      severity: null,
    },
    {
      label: 'Calculated BMI',
      value: bmi ? bmi.toFixed(1) : 'Not available',
      severity: bmi && bmi > 42 ? 'critical' : null,
      note: bmi && bmi > 42 ? 'BMI is above the screening threshold used in this demo.' : undefined,
    },
    {
      label: 'U.S. citizen or legal resident?',
      value: valueLabel(responses.isCitizenOrResident),
      severity: responses.isCitizenOrResident === 'no' ? 'warning' : null,
    },
    {
      label: 'Needs transplant for another organ?',
      value: valueLabel(responses.needsMultiOrganTransplant),
      severity: responses.needsMultiOrganTransplant === 'yes' ? 'critical' : null,
    },
    {
      label: 'Uses supplemental oxygen?',
      value: valueLabel(responses.usesSupplementalOxygen),
      severity: responses.usesSupplementalOxygen === 'yes' ? 'critical' : null,
    },
    {
      label: 'Heart surgery in the last 6 months?',
      value: valueLabel(responses.cardiacSurgeryLast6Months),
      severity:
        responses.cardiacSurgeryLast6Months === 'yes' ||
        responses.cardiacSurgeryLast6Months === 'notSure'
          ? 'warning'
          : null,
    },
    {
      label: 'Currently receiving cancer treatment?',
      value: valueLabel(responses.activeCancer),
      severity: responses.activeCancer === 'yes' ? 'critical' : null,
    },
    {
      label: 'Active substance use concern?',
      value: valueLabel(responses.activeSubstanceUse),
      severity:
        responses.activeSubstanceUse === 'yes'
          ? 'critical'
          : responses.activeSubstanceUse === 'preferNotToAnswer'
            ? 'warning'
            : null,
    },
    {
      label: 'Open wounds that are not healing?',
      value: valueLabel(responses.hasOpenWounds),
      severity: responses.hasOpenWounds === 'yes' ? 'critical' : null,
    },
  ] as Array<{ label: string; value: string; severity: ScreeningSeverity; note?: string }>;
}

function ScreeningSection({
  rows,
  title,
}: {
  rows: Array<{ label: string; value: string; severity?: ScreeningSeverity; note?: string }>;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className={clsx(
              'rounded-xl border p-3',
              row.severity === 'critical'
                ? 'border-red-200 bg-red-50'
                : row.severity === 'warning'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-slate-100 bg-slate-50/70'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {row.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{row.value}</p>
              </div>
              {row.severity && (
                <AlertTriangle
                  className={clsx(
                    'h-4 w-4 shrink-0',
                    row.severity === 'critical' ? 'text-red-600' : 'text-amber-600'
                  )}
                />
              )}
            </div>
            {row.note && <p className="mt-2 text-xs text-slate-600">{row.note}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

const DOCUMENT_CATEGORY_LABEL: Record<DocumentRecord['uploadedBy'], string> = {
  patient: 'Patient-Provided Documents',
  clinic: 'Dialysis Clinic-Provided Documents',
  staff: 'Transplant Center-Provided Documents',
};

const DOCUMENT_CATEGORY_EMPTY: Record<DocumentRecord['uploadedBy'], string> = {
  patient: 'No patient documents have been provided yet.',
  clinic: 'No documents uploaded yet.',
  staff: 'No documents attached yet.',
};

const DONOR_PREFERENCES_DOCUMENT_NAME = 'Deceased Donor Preferences Form';

function displayDocumentName(name: string): string {
  return name
    .replace(/\s+—\s+front/i, ' (Front)')
    .replace(/\s+—\s+back/i, ' (Back)');
}

function documentSortRank(name: string): number {
  const normalized = displayDocumentName(name).toLowerCase();
  if (normalized.includes('government id')) return 10;
  if (normalized.includes('insurance card (front)')) return 20;
  if (normalized.includes('insurance card (back)')) return 30;
  if (normalized.includes('services roi')) return 50;
  if (normalized.includes('medical records roi')) return 60;
  if (normalized.includes('deceased donor preferences')) return 70;
  return 100;
}

function documentNameMatches(a: string, b: string): boolean {
  return displayDocumentName(a).toLowerCase() === displayDocumentName(b).toLowerCase();
}

function todoCompletedAt(patient: Patient, type: Todo['type']): string | undefined {
  return patient.todos.find((todo) => todo.type === type && todo.status === 'completed')?.completedAt;
}

function appendVirtualDocument(
  documents: DocumentRecord[],
  patientId: string,
  slug: string,
  name: string,
  uploadedAt?: string
): DocumentRecord[] {
  if (!uploadedAt || documents.some((document) => documentNameMatches(document.name, name))) {
    return documents;
  }
  return [
    ...documents,
    {
      id: `virtual-${patientId}-${slug}`,
      name,
      uploadedAt,
      uploadedBy: 'patient',
    },
  ];
}

function donorPreferencesDocumentSlug(response: DeceasedDonorPreferencesResponse): string {
  return `deceased-donor-preferences-${response.id}`;
}

function donorPreferencesResponseForDocument(
  document: DocumentRecord,
  patient: Patient
): DeceasedDonorPreferencesResponse | undefined {
  if (!document.id.startsWith(`virtual-${patient.id}-deceased-donor-preferences-`)) {
    return undefined;
  }
  const responseId = document.id.replace(`virtual-${patient.id}-deceased-donor-preferences-`, '');
  return patient.deceasedDonorPreferencesResponses?.find((response) => response.id === responseId);
}

function sortedDonorPreferenceResponses(patient: Patient): DeceasedDonorPreferencesResponse[] {
  return (
    patient.deceasedDonorPreferencesResponses
      ?.slice()
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()) ?? []
  );
}

function documentsForDisplay(patient: Patient): DocumentRecord[] {
  const roiServicesAt = todoCompletedAt(patient, 'sign-roi-services');
  const roiMedicalAt = todoCompletedAt(patient, 'sign-roi-medical');
  const hasBothRois = Boolean(roiServicesAt && roiMedicalAt);
  const latestDonorPreferences = latestDeceasedDonorPreferences(patient);
  let documents = patient.documents;

  if (hasBothRois) {
    documents = appendVirtualDocument(
      documents,
      patient.id,
      'roi-services',
      'Services ROI',
      roiServicesAt
    );
    documents = appendVirtualDocument(
      documents,
      patient.id,
      'roi-medical',
      'Medical Records ROI',
      roiMedicalAt
    );
  }

  if (latestDonorPreferences) {
    documents = appendVirtualDocument(
      documents,
      patient.id,
      donorPreferencesDocumentSlug(latestDonorPreferences),
      DONOR_PREFERENCES_DOCUMENT_NAME,
      latestDonorPreferences.submittedAt
    );
  }

  return documents.filter(
    (document) => !displayDocumentName(document.name).toLowerCase().includes('health questionnaire')
  );
}

function documentPreviewLines(document: DocumentRecord, patient: Patient): string[] {
  const name = displayDocumentName(document.name).toLowerCase();
  const patientName = `${patient.firstName} ${patient.lastName}`;
  if (name.includes('government id')) {
    return [
      'STATE OF DELAWARE',
      'DRIVER LICENSE',
      '--------------------------------',
      `Name: ${patientName}`,
      `DOB: ${formatDob(patient.dob)}`,
      'License: DEMO-1234567',
      'Class: D',
      'Expiration: 12/2028',
      '--------------------------------',
      '[Photo placeholder]',
      '[Signature placeholder]',
    ];
  }
  if (name.includes('insurance card (front)')) {
    return [
      'BLUE CROSS BLUE SHIELD',
      'Member Card',
      '--------------------------------',
      `Member: ${patientName}`,
      'Member ID: DEMO-123456',
      'Group: 987654',
      'Plan: PPO',
      'Specialist: $50',
      '--------------------------------',
      'Present this card at time of service.',
    ];
  }
  if (name.includes('insurance card (back)')) {
    return [
      'INSURANCE CARD - BACK',
      '--------------------------------',
      'Member Services: 1-800-DEMO-100',
      'Prior Authorization: 1-800-DEMO-200',
      'Claims Address:',
      'PO Box 12345',
      'Wilmington, DE 19801',
      '--------------------------------',
      'For demo viewing only.',
    ];
  }
  if (name.includes('roi')) {
    return [
      displayDocumentName(document.name).toUpperCase(),
      '--------------------------------',
      `Patient: ${patientName}`,
      `Signed: ${formatDate(document.uploadedAt)}`,
      'ChristianaCare Transplant Referrals',
      '',
      'The patient authorized this demo referral workflow to continue.',
      'The signed authorization is stored here for staff review.',
      '',
      'Signature: [captured electronically]',
    ];
  }
  return [
    displayDocumentName(document.name).toUpperCase(),
    '--------------------------------',
    `Patient: ${patientName}`,
    `Submitted: ${formatDate(document.uploadedAt)}`,
    `Source: ${DOCUMENT_CATEGORY_LABEL[document.uploadedBy]}`,
    '',
    '[Simulated document preview]',
  ];
}

function DocumentsTab({
  documents,
  onUpload,
  patient,
}: {
  documents: DocumentRecord[];
  onUpload: (name: string) => void;
  patient: Patient;
}) {
  const [documentName, setDocumentName] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);
  const groups: DocumentRecord['uploadedBy'][] = ['patient', 'clinic', 'staff'];
  const displayDocuments = documentsForDisplay(patient);
  const sortedDocuments = [...displayDocuments].sort((a, b) => {
    const rankDelta = documentSortRank(a.name) - documentSortRank(b.name);
    if (rankDelta !== 0) return rankDelta;
    return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
  });

  function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = documentName.trim();
    if (!trimmed) return;
    onUpload(trimmed);
    setDocumentName('');
  }

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h3 className="text-base font-semibold text-slate-900">Documents</h3>
          <span className="text-xs text-slate-500">
            {displayDocuments.length} file{displayDocuments.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mt-4 space-y-5">
          {groups.map((source) => {
            const docs = sortedDocuments.filter((document) => document.uploadedBy === source);
            return (
              <DocumentCategorySection
                key={source}
                documents={docs}
                emptyText={DOCUMENT_CATEGORY_EMPTY[source]}
                title={DOCUMENT_CATEGORY_LABEL[source]}
                onView={setSelectedDocument}
              />
            );
          })}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Attach Transplant Center Document
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Simulate adding a document to the staff cockpit.
            </p>
          </div>
        </div>
        <form onSubmit={handleUpload} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="block space-y-1.5 sm:space-y-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Document name
            </span>
            <input
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="e.g. Coordinator call note"
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff] sm:mt-1.5"
            />
          </label>
          <button
            type="submit"
            disabled={!documentName.trim()}
            className="inline-flex h-11 items-center justify-center gap-1.5 self-end rounded-xl bg-[#1a66cc] px-4 text-sm font-semibold text-white transition hover:bg-[#1558ad] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Upload className="h-4 w-4" />
            Attach Document
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

function DocumentCategorySection({
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
            <DocumentRow
              key={document.id}
              document={document}
              onView={() => onView(document)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DocumentRow({
  document,
  onView,
}: {
  document: DocumentRecord;
  onView: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 bg-white px-4 py-3 transition hover:bg-[#f5faff] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eef6ff] text-[#1a66cc] ring-1 ring-[#dbeeff]">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {displayDocumentName(document.name)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
        <span className="text-xs text-slate-500">{formatDate(document.uploadedAt)}</span>
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[#3399e6] hover:text-[#1a66cc]"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>
      </div>
    </li>
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
  const title = displayDocumentName(document.name);
  const sourceLabel = DOCUMENT_CATEGORY_LABEL[document.uploadedBy];
  const lines = documentPreviewLines(document, patient);
  const donorPreferencesResponse = donorPreferencesResponseForDocument(document, patient);
  const donorPreferenceResponses = sortedDonorPreferenceResponses(patient);
  const [selectedDonorResponseId, setSelectedDonorResponseId] = useState(
    donorPreferencesResponse?.id ?? null
  );
  const selectedDonorResponse = donorPreferencesResponse
    ? donorPreferenceResponses.find((response) => response.id === selectedDonorResponseId) ??
      donorPreferencesResponse
    : undefined;

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
              {title}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Source: {sourceLabel} · Submitted {relativeTime(document.uploadedAt)}
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
          {selectedDonorResponse ? (
            <DonorPreferencesDocumentPreview
              onSelectResponse={setSelectedDonorResponseId}
              response={selectedDonorResponse}
              responses={donorPreferenceResponses}
            />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <pre className="min-h-[320px] whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700">
                {lines.join('\n')}
              </pre>
            </div>
          )}
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

function DonorPreferencesDocumentPreview({
  onSelectResponse,
  response,
  responses,
}: {
  onSelectResponse: (responseId: string) => void;
  response: DeceasedDonorPreferencesResponse;
  responses: DeceasedDonorPreferencesResponse[];
}) {
  const declined = declinedDonorPreferenceLabels(response);
  const previous = responses.filter((candidate) => candidate.id !== response.id);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#dbeeff] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              Deceased Donor Preferences
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Submitted {formatDateTime(response.submittedAt)}
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-semibold text-[#1a66cc] ring-1 ring-[#dbeeff]">
            Structured patient form
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-[#f8fbff] p-3 ring-1 ring-[#dbeeff]">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Maximum donor age
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {donorAgePreferenceLabel(response)}
            </p>
          </div>
          <div className="rounded-xl bg-[#f8fbff] p-3 ring-1 ring-[#dbeeff]">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Patient signature
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {response.patientSignature}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Donor types declined
          </p>
          {declined.length === 0 ? (
            <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
              No restrictions
            </div>
          ) : (
            <ul className="mt-2 space-y-2">
              {declined.map((label) => (
                <li
                  key={label}
                  className="rounded-xl bg-white px-3 py-2 text-sm font-medium leading-relaxed text-slate-700 ring-1 ring-[#dbeeff]"
                >
                  {label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">
            Full responses
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-white text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Donor type</th>
                <th className="w-28 px-4 py-3 font-semibold">Answer</th>
                <th className="w-40 px-4 py-3 font-semibold">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {DONOR_PREFERENCE_FIELDS.map((field) => {
                const answer = response.donorTypePreferences[field.key];
                return (
                  <tr key={field.key}>
                    <td className="px-4 py-3 leading-relaxed text-slate-700">{field.label}</td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                          answer === 'yes'
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                            : 'bg-red-50 text-red-700 ring-1 ring-red-100'
                        )}
                      >
                        {answer === 'yes' ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(response.submittedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {previous.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Other submissions
          </p>
          <div className="mt-2 space-y-2">
            {previous.map((previousResponse) => (
              <div
                key={previousResponse.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100"
              >
                <span className="text-sm font-medium text-slate-700">
                  {formatDateTime(previousResponse.submittedAt)}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectResponse(previousResponse.id)}
                  className="text-xs font-semibold text-[#1a66cc]"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MessagesTab({
  activeMsgTab,
  activeThread,
  clinicThreadAvailable,
  clinicUnread,
  onAttach,
  onChangeMsgTab,
  onChangeReply,
  onRemoveAttachment,
  onSubmit,
  patient,
  patientUnread,
  quickReply,
  quickReplyAttachments,
  scrollRef,
}: {
  activeMsgTab: MsgTab;
  activeThread: Patient['messages'];
  clinicThreadAvailable: boolean;
  clinicUnread: boolean;
  onAttach: (attachments: Attachment[]) => void;
  onChangeMsgTab: (tab: MsgTab) => void;
  onChangeReply: (value: string) => void;
  onRemoveAttachment: (id: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  patient: Patient;
  patientUnread: boolean;
  quickReply: string;
  quickReplyAttachments: Attachment[];
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Messages</h3>
          <p className="text-sm text-slate-500">Review patient and clinic conversations for this case.</p>
        </div>
        <Link
          href={`/staff/messages?patient=${patient.id}&thread=${activeMsgTab}`}
          className="inline-flex w-fit items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[#3399e6] hover:text-[#1a66cc]"
        >
          Open in Inbox
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="flex gap-1 border-b border-slate-100 bg-slate-50/60 px-3 pt-2">
        <MsgTabButton
          active={activeMsgTab === 'patient'}
          unread={patientUnread}
          onClick={() => onChangeMsgTab('patient')}
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          label="Patient"
        />
        {clinicThreadAvailable && (
          <MsgTabButton
            active={activeMsgTab === 'clinic'}
            unread={clinicUnread}
            onClick={() => onChangeMsgTab('clinic')}
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Dialysis Clinic"
          />
        )}
      </div>
      <div
        ref={scrollRef}
        className="h-[460px] space-y-2.5 overflow-y-auto bg-slate-50/40 px-4 py-4"
      >
        {activeThread.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <MessageSquare className="h-4 w-4" />
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {activeMsgTab === 'patient'
                ? 'No messages with the patient yet.'
                : `No messages with ${patient.referringClinic ?? 'the dialysis clinic'} yet.`}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {activeMsgTab === 'patient'
                ? 'Start the conversation below.'
                : 'Use this thread to ask the clinic about documents, referral details, or follow-up for this patient.'}
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
          onRemove={onRemoveAttachment}
          className="px-3"
        />
        <form onSubmit={onSubmit} className="flex items-end gap-2 px-3 py-3">
          <textarea
            value={quickReply}
            onChange={(e) => onChangeReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
              }
            }}
            rows={1}
            placeholder={
              activeMsgTab === 'patient'
                ? `Reply to ${patient.firstName}...`
                : `Message ${patient.referringClinic ?? 'the dialysis clinic'} about ${patient.firstName}...`
            }
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm leading-relaxed outline-none transition focus:border-[#3399e6] focus:bg-white focus:ring-2 focus:ring-[#dbeeff]"
          />
          <AttachButton size="sm" onAttach={onAttach} />
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
  );
}

function MsgTabButton({
  active,
  icon,
  label,
  onClick,
  unread,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  unread: boolean;
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

type DraftEvaluationSlot = Omit<InitialEvaluationSlot, 'id'> & { id: string };

function SchedulingTab({
  onSendSlots,
  patient,
}: {
  onSendSlots: (slots: Array<Omit<InitialEvaluationSlot, 'id'>>) => void;
  patient: Patient;
}) {
  const selected = selectedInitialEvaluationSlot(patient.initialEvaluationScheduling);
  const slotsSent = Boolean(patient.initialEvaluationScheduling?.sentAt);
  const readyForScheduling =
    patient.stage === 'scheduling' || patient.stage === 'evaluation-scheduled';
  const [editing, setEditing] = useState(false);
  const [draftSlots, setDraftSlots] = useState<DraftEvaluationSlot[]>([]);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setEditing(patient.stage === 'scheduling' && !slotsSent);
    setDraftSlots(
      patient.initialEvaluationScheduling?.slots.map((slot) => ({
        id: `draft-${slot.id}`,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })) ?? []
    );
    setDate('');
    setStartTime('');
    setEndTime('');
    setError('');
  }, [patient.id, patient.stage, patient.initialEvaluationScheduling?.sentAt, slotsSent]);

  if (!readyForScheduling) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Scheduling</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          This case is not ready for initial evaluation scheduling yet. The scheduling workspace
          becomes active when the case reaches the Scheduling stage.
        </p>
      </section>
    );
  }

  if (patient.stage === 'evaluation-scheduled') {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Initial Evaluation Scheduled
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {selected
                ? `${patient.firstName} selected ${formatSlotRange(selected)}.`
                : `${patient.firstName} has completed the scheduling step.`}
            </p>
            {patient.initialEvaluationScheduling?.selectedAt && (
              <p className="mt-2 text-xs font-medium text-slate-500">
                Selected {relativeTime(patient.initialEvaluationScheduling.selectedAt)}
              </p>
            )}
          </div>
        </div>
        <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-100">
          This completes the current Transplant Wizard referral workflow.
        </div>
      </section>
    );
  }

  function handleAddSlot() {
    const slot = { date, startTime, endTime };
    if (!isValidFutureSlot(slot)) {
      setError('Add a future date with an end time after the start time.');
      return;
    }
    setDraftSlots((previous) => [
      ...previous,
      { id: `draft-${Date.now()}-${previous.length}`, ...slot },
    ]);
    setDate('');
    setStartTime('');
    setEndTime('');
    setError('');
  }

  function handleSendSlots() {
    const validSlots = draftSlots.filter((slot) => isValidFutureSlot(slot));
    if (validSlots.length === 0) {
      setError('Add at least one future appointment time before sending.');
      return;
    }
    onSendSlots(
      validSlots.map((slot) => ({
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      }))
    );
    setEditing(false);
    setError('');
  }

  if (slotsSent && !editing) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Initial Evaluation Scheduling
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Waiting for {patient.firstName} to choose a time.
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Sent by {patient.initialEvaluationScheduling?.sentBy ?? 'Sarah Martinez'} ·{' '}
              {patient.initialEvaluationScheduling?.sentAt
                ? relativeTime(patient.initialEvaluationScheduling.sentAt)
                : 'recently'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#3399e6] hover:text-[#1a66cc]"
          >
            <CalendarDays className="h-4 w-4" />
            Replace available times
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {patient.initialEvaluationScheduling?.slots.map((slot) => (
            <div
              key={slot.id}
              className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
            >
              <p className="text-sm font-semibold text-slate-900">{formatSlotDate(slot)}</p>
              <p className="mt-1 text-sm text-slate-600">
                {formatSlotRange(slot).split(' · ')[1]}
              </p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Initial Evaluation Scheduling
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Add available times for the patient to choose from in the patient portal.
          </p>
        </div>
        {slotsSent && (
          <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
            Replacing previously sent times
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Start time
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            End time
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleAddSlot}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-[#1a66cc] ring-1 ring-[#cfe5fb] transition hover:bg-[#eef6ff] lg:w-auto"
          >
            <PlusCircle className="h-4 w-4" />
            Add slot
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
        <div className="grid grid-cols-[minmax(0,1fr)_140px] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>Available time</span>
          <span className="text-right">Action</span>
        </div>
        {draftSlots.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            No appointment times added yet.
          </div>
        ) : (
          draftSlots.map((slot) => (
            <div
              key={slot.id}
              className="grid grid-cols-[minmax(0,1fr)_140px] items-center border-t border-slate-100 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{formatSlotDate(slot)}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {formatSlotRange(slot).split(' · ')[1]}
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setDraftSlots((previous) =>
                      previous.filter((candidate) => candidate.id !== slot.id)
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {slotsSent && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSendSlots}
          disabled={draftSlots.length === 0}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1a66cc] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1558ad] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Send className="h-4 w-4" />
          Send to Patient
        </button>
      </div>
    </section>
  );
}

function EndReasonTab({
  onApprove,
  patient,
}: {
  onApprove: (payload: {
    reasonCode: string;
    reasonLabel: string;
    rationale: string;
    letterDraft: string;
  }) => void;
  patient: Patient;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  if (patient.endReferral) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Referral Ended</h3>
            <p className="mt-1 text-sm text-slate-600">
              Ended by {patient.endReferral.endedBy} on {formatDate(patient.endReferral.endedAt)}.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              End Referral
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {patient.endReferral.reasonLabel}
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Rationale
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {patient.endReferral.rationale}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Approved End Letter
            </p>
            <pre className="mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-xl bg-white p-4 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-100">
              {patient.endReferral.letterDraft}
            </pre>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="max-w-2xl">
          <h3 className="text-base font-semibold text-slate-900">End Referral</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Use this when the transplant center has reviewed the case and needs to end the referral.
            This saves the end reason in the staff cockpit and makes the approved letter visible
            in the patient portal.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
          >
            <XCircle className="h-4 w-4" />
            Start End Referral
          </button>
        </div>
      </section>
      {modalOpen && (
        <EndReferralModal
          patient={patient}
          onApprove={(payload) => {
            onApprove(payload);
            setModalOpen(false);
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

function EndReferralModal({
  onApprove,
  onClose,
  patient,
}: {
  onApprove: (payload: {
    reasonCode: string;
    reasonLabel: string;
    rationale: string;
    letterDraft: string;
  }) => void;
  onClose: () => void;
  patient: Patient;
}) {
  const [reasonCode, setReasonCode] = useState(END_REASON_OPTIONS[0].code);
  const [rationale, setRationale] = useState('');
  const selectedReason =
    END_REASON_OPTIONS.find((reason) => reason.code === reasonCode) ?? END_REASON_OPTIONS[0];
  const [letterDraft, setLetterDraft] = useState(() =>
    buildEndReferralLetter({
      patientLastName: patient.lastName,
      reasonLabel: selectedReason.label,
    })
  );

  useEffect(() => {
    setLetterDraft(
      buildEndReferralLetter({
        patientLastName: patient.lastName,
        reasonLabel: selectedReason.label,
      })
    );
  }, [patient.lastName, selectedReason.label]);

  const canApprove = rationale.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">End Referral</h3>
            <p className="mt-1 text-sm text-slate-500">
              Select a reason, document the rationale, and approve the letter draft.
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

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            This action records an ended referral and makes the approved letter visible in the
            patient portal.
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Step 1: Select End Reason *
            </p>
            <div className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-2">
              {END_REASON_OPTIONS.map((reason) => (
                <label key={reason.code} className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    className="mt-1 h-4 w-4 accent-[#1a66cc]"
                    checked={reasonCode === reason.code}
                    onChange={() => setReasonCode(reason.code)}
                  />
                  {reason.label}
                </label>
              ))}
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Step 2: Rationale (required) *
            </span>
            <textarea
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              rows={4}
              placeholder="Document why this referral is being ended."
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
            />
            {!canApprove && (
              <span className="text-xs text-slate-500">Rationale is required before approval.</span>
            )}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Step 3: Review & Approve Letter
            </span>
            <textarea
              value={letterDraft}
              onChange={(event) => setLetterDraft(event.target.value)}
              rows={10}
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed outline-none transition focus:border-[#3399e6] focus:bg-white focus:ring-2 focus:ring-[#dbeeff]"
            />
          </label>
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
            type="button"
            disabled={!canApprove}
            onClick={() =>
              onApprove({
                reasonCode: selectedReason.code,
                reasonLabel: selectedReason.label,
                rationale: rationale.trim(),
                letterDraft,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <XCircle className="h-4 w-4" />
            Approve Letter
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityTab({ activity }: { activity: ActivityEvent[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Activity</h3>
      <ActivityList activity={activity} />
    </section>
  );
}

function ActivityList({ activity }: { activity: ActivityEvent[] }) {
  if (activity.length === 0) {
    return (
      <p className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No activity yet.
      </p>
    );
  }
  return (
    <ol className="mt-4 space-y-3">
      {activity.map((event) => {
        const Icon = event.icon;
        return (
          <li key={event.id} className="flex items-start gap-3">
            <div
              className={clsx(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
                toneClasses(event.tone)
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">{event.label}</p>
                <span className="shrink-0 text-xs text-slate-400">
                  {relativeTime(event.at)}
                </span>
              </div>
              {event.detail && <p className="text-xs text-slate-500">{event.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

type DocRequestDraft = { key: string; title: string; description: string };
type AddTodoPayload =
  | { kind: 'deceased-donor-preferences' }
  | {
      kind: 'custom';
      title: string;
      description: string;
      documentRequests: { title: string; description?: string }[];
    };

function AddTodoModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (payload: AddTodoPayload) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [docRequests, setDocRequests] = useState<DocRequestDraft[]>([]);
  const [selectedTemplateKind, setSelectedTemplateKind] = useState<
    'custom' | 'deceased-donor-preferences' | null
  >(null);

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
  const donorPreferencesSelected = selectedTemplateKind === 'deceased-donor-preferences';
  const canSubmit = donorPreferencesSelected || (title.trim().length > 0 && allDocRowsValid);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    if (donorPreferencesSelected) {
      onSubmit({ kind: 'deceased-donor-preferences' });
      return;
    }
    onSubmit({
      kind: 'custom',
      title: title.trim(),
      description: description.trim(),
      documentRequests: cleanedRequests,
    });
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
                {TODO_TEMPLATES.map((template) => (
                  <button
                    key={template.title}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateKind(template.kind);
                      setTitle(template.title);
                      setDescription(template.kind === 'deceased-donor-preferences' ? template.description : '');
                      if (template.kind === 'deceased-donor-preferences') setDocRequests([]);
                    }}
                    className={clsx(
                      'rounded-full px-3 py-1 text-xs font-medium transition',
                      selectedTemplateKind === template.kind && title === template.title
                        ? 'bg-[#1a66cc] text-white'
                        : template.kind === 'deceased-donor-preferences'
                          ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100'
                        : 'bg-[#eef6ff] text-[#1a66cc] hover:bg-[#dbeeff]'
                    )}
                  >
                    {template.title}
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
                onChange={(e) => {
                  setTitle(e.target.value);
                  setSelectedTemplateKind('custom');
                }}
                placeholder="What does the patient need to do?"
                disabled={donorPreferencesSelected}
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
                onChange={(e) => {
                  setDescription(e.target.value);
                  setSelectedTemplateKind('custom');
                }}
                rows={3}
                placeholder="Add any helpful detail for the patient."
                disabled={donorPreferencesSelected}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
              />
            </label>

            {donorPreferencesSelected ? (
              <div className="rounded-xl border border-[#dbeeff] bg-[#eef6ff] px-3 py-3 text-xs leading-relaxed text-[#1a66cc]">
                This creates a structured donor preferences form in the patient portal. The patient&apos;s
                submitted answers will appear in this cockpit with response history.
              </div>
            ) : (
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
                  Leave empty for a simple to-do. Add a row for each photo or document the patient must upload.
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
                        placeholder="Document title"
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
            )}
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
