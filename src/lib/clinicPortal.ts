import { PATIENT_STAGE_LABEL } from '@/lib/stages';
import type { DocumentRecord, Patient, PatientStage } from '@/lib/types';
import { CLINIC_PATIENT_THREAD_KEY, CLINIC_THREAD_KEY } from '@/lib/clinicInbox';

export const AWAITING_PATIENT_STAGES: PatientStage[] = ['onboarding', 'initial-todos'];
export const SERVICES_ROI_DOCUMENT = 'Services ROI';
export const MEDICAL_ROI_DOCUMENT = 'Medical Records ROI';

export function relativeTime(iso: string): string {
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

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function waitingOnLabel(stage: PatientStage): {
  label: string;
  tone: 'patient' | 'transplant-center';
} {
  if (AWAITING_PATIENT_STAGES.includes(stage)) {
    return { label: 'Patient', tone: 'patient' };
  }
  return { label: 'Transplant Center', tone: 'transplant-center' };
}

export function hasClinicUnread(patient: Patient): boolean {
  return patient.messages.some(
    (message) =>
      (message.threadKey === CLINIC_THREAD_KEY ||
        message.threadKey === CLINIC_PATIENT_THREAD_KEY) &&
      message.fromRole !== 'clinic' &&
      !message.readByClinic
  );
}

export function clinicDocuments(patient: Patient): DocumentRecord[] {
  return patient.documents.filter((document) => document.uploadedBy === 'clinic');
}

export function todoCompletedAt(patient: Patient, type: string): string | undefined {
  return patient.todos.find((todo) => todo.type === type && todo.completedAt)?.completedAt;
}

function documentNameMatches(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function roiDocument(patient: Patient, name: string, uploadedAt?: string): DocumentRecord | null {
  const existing = patient.documents.find((document) => documentNameMatches(document.name, name));
  if (existing) return existing;
  if (!uploadedAt) return null;
  return {
    id: `virtual-${patient.id}-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    uploadedAt,
    uploadedBy: 'patient',
  };
}

export function clinicRoiDocuments(patient: Patient): DocumentRecord[] {
  const servicesAt = todoCompletedAt(patient, 'sign-roi-services') ?? patient.roiSignedAt;
  const medicalAt = todoCompletedAt(patient, 'sign-roi-medical') ?? patient.roiSignedAt;
  return [
    roiDocument(patient, SERVICES_ROI_DOCUMENT, servicesAt),
    roiDocument(patient, MEDICAL_ROI_DOCUMENT, medicalAt),
  ].filter((document): document is DocumentRecord => Boolean(document));
}

export function clinicSearchText(patient: Patient): string {
  return [
    patient.firstName,
    patient.lastName,
    patient.email,
    patient.nephrologistName,
    patient.preferredLanguage,
    PATIENT_STAGE_LABEL[patient.stage],
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
