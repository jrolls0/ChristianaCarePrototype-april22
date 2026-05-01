import type { DocumentRecord, Message, Patient, PatientStage, ThreadKey, Todo } from '../types';
import { getNextPatientStage, PATIENT_STAGE_LABEL, normalizePatientStage } from '../stages';
import { buildPatientCareTeam, type CareTeamRole } from '../knowledge/careTeamDirectory';
import { getStageGuidance, type StageGuidance } from '../knowledge/stageGuidance';

export type AmeliaTodoContext = Pick<
  Todo,
  'id' | 'type' | 'title' | 'description' | 'status' | 'completedAt' | 'isCustom' | 'addedByStaff' | 'documentRequests'
>;

export type AmeliaMessageContext = Pick<
  Message,
  'id' | 'threadKey' | 'fromRole' | 'fromName' | 'body' | 'sentAt' | 'readByPatient'
>;

export type AmeliaDocumentContext = Pick<DocumentRecord, 'id' | 'name' | 'uploadedAt' | 'uploadedBy'>;

export type AmeliaPatientContext = {
  patientId: string;
  name: string;
  firstName: string;
  email: string;
  phone: string;
  preferredLanguage: Patient['preferredLanguage'];
  referralSource: Patient['referralSource'];
  referringClinic?: string;
  duswName?: string;
  nephrologistName?: string;
  stage: PatientStage;
  stageLabel: string;
  nextStage?: PatientStage;
  nextStageLabel?: string;
  daysInStage: number;
  isStuck: boolean;
  hasCompletedOnboarding: boolean;
  roiSigned: boolean;
  roiSignedAt?: string;
  communicationConsents: {
    email: boolean;
    sms: boolean;
    phone: boolean;
  };
  emergencyContactProvided: boolean;
  todos: AmeliaTodoContext[];
  documents: AmeliaDocumentContext[];
  messages: AmeliaMessageContext[];
  unreadMessages: AmeliaMessageContext[];
  screeningCompleted: boolean;
  stageGuidance: StageGuidance;
  careTeam: CareTeamRole[];
};

const HOME_VISIBLE_TYPES: ReadonlySet<Todo['type']> = new Set([
  'upload-government-id',
  'upload-insurance-card',
  'complete-health-questionnaire',
  'add-emergency-contact',
  'watch-education-video',
  'custom',
]);

function recentMessages(messages: Message[]): AmeliaMessageContext[] {
  return messages
    .slice()
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    .slice(0, 8)
    .map((message) => ({
      id: message.id,
      threadKey: message.threadKey,
      fromRole: message.fromRole,
      fromName: message.fromName,
      body: message.body,
      sentAt: message.sentAt,
      readByPatient: message.readByPatient,
    }));
}

export function buildAmeliaPatientContext(patient: Patient): AmeliaPatientContext {
  const stage = normalizePatientStage(patient.stage);
  const nextStage = getNextPatientStage(stage) ?? undefined;
  const messages = recentMessages(
    patient.messages.filter((message) => message.threadKey !== 'clinic-staff')
  );
  const todos = patient.todos
    .filter((todo) => HOME_VISIBLE_TYPES.has(todo.type))
    .map((todo) => ({
      id: todo.id,
      type: todo.type,
      title: todo.title,
      description: todo.description,
      status: todo.status,
      completedAt: todo.completedAt,
      isCustom: todo.isCustom,
      addedByStaff: todo.addedByStaff,
      documentRequests: todo.documentRequests,
    }));

  return {
    patientId: patient.id,
    name: `${patient.firstName} ${patient.lastName}`.trim(),
    firstName: patient.firstName,
    email: patient.email,
    phone: patient.phone,
    preferredLanguage: patient.preferredLanguage,
    referralSource: patient.referralSource,
    referringClinic: patient.referringClinic,
    duswName: patient.duswName,
    nephrologistName: patient.nephrologistName,
    stage,
    stageLabel: PATIENT_STAGE_LABEL[stage],
    nextStage,
    nextStageLabel: nextStage ? PATIENT_STAGE_LABEL[nextStage] : undefined,
    daysInStage: patient.daysInStage,
    isStuck: patient.isStuck,
    hasCompletedOnboarding: Boolean(patient.hasCompletedOnboarding),
    roiSigned: Boolean(patient.roiSigned),
    roiSignedAt: patient.roiSignedAt,
    communicationConsents: {
      email: Boolean(patient.emailConsent),
      sms: Boolean(patient.smsConsent),
      phone: Boolean(patient.phoneConsent),
    },
    emergencyContactProvided: Boolean(patient.emergencyContact),
    todos,
    documents: patient.documents.map((document) => ({
      id: document.id,
      name: document.name,
      uploadedAt: document.uploadedAt,
      uploadedBy: document.uploadedBy,
    })),
    messages,
    unreadMessages: messages.filter(
      (message) => !message.readByPatient && message.fromRole !== 'patient'
    ),
    screeningCompleted: Boolean(patient.screeningResponses),
    stageGuidance: getStageGuidance(stage),
    careTeam: buildPatientCareTeam(patient),
  };
}

export function threadLabel(threadKey: ThreadKey): string {
  if (threadKey === 'dusw') return 'Dialysis Team';
  if (threadKey === 'tc-frontdesk') return 'ChristianaCare Front Desk';
  return 'Dialysis Clinic';
}
