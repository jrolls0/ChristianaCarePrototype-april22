import type { PatientStage } from './types';

export const INTERNAL_NEW_REFERRAL_STAGE = 'new-referral' as const;

export const VISIBLE_PATIENT_STAGES = [
  'onboarding',
  'initial-todos',
  'initial-screening',
  'financial-screening',
  'records-clinical-review',
  'final-decision',
  'education',
  'scheduling',
] as const satisfies readonly PatientStage[];

export const PATIENT_STAGE_ORDER = [
  INTERNAL_NEW_REFERRAL_STAGE,
  ...VISIBLE_PATIENT_STAGES,
] as const satisfies readonly PatientStage[];

export const PATIENT_STAGE_LABEL: Record<PatientStage, string> = {
  'new-referral': 'New Referral',
  onboarding: 'Onboarding',
  'initial-todos': 'Initial To-Dos',
  'initial-screening': 'Initial Screening',
  'financial-screening': 'Financial Screening',
  'records-clinical-review': 'Records & Clinical Review',
  'final-decision': 'Final Decision',
  education: 'Education',
  scheduling: 'Scheduling',
};

export const PATIENT_STAGE_SHORT_LABEL: Record<PatientStage, string> = {
  'new-referral': 'New',
  onboarding: 'Onboarding',
  'initial-todos': 'To-Dos',
  'initial-screening': 'Screening',
  'financial-screening': 'Financial',
  'records-clinical-review': 'Records',
  'final-decision': 'Decision',
  education: 'Education',
  scheduling: 'Scheduling',
};

export const PATIENT_STAGE_TONE: Record<PatientStage, string> = {
  'new-referral': 'bg-sky-50 text-sky-700 ring-sky-200',
  onboarding: 'bg-blue-50 text-blue-700 ring-blue-200',
  'initial-todos': 'bg-blue-50 text-blue-700 ring-blue-200',
  'initial-screening': 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  'financial-screening': 'bg-amber-50 text-amber-700 ring-amber-200',
  'records-clinical-review': 'bg-violet-50 text-violet-700 ring-violet-200',
  'final-decision': 'bg-teal-50 text-teal-700 ring-teal-200',
  education: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  scheduling: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

const LEGACY_STAGE_MAP: Record<string, PatientStage> = {
  'new-referral': 'new-referral',
  'patient-onboarding': 'onboarding',
  'initial-todos': 'initial-todos',
  'front-desk-review': 'initial-screening',
  screening: 'initial-screening',
  'records-collection': 'records-clinical-review',
  'specialist-review': 'records-clinical-review',
  scheduled: 'scheduling',
};

export function normalizePatientStage(stage: unknown): PatientStage {
  if (typeof stage !== 'string') return 'onboarding';
  if (stage in PATIENT_STAGE_LABEL) return stage as PatientStage;
  return LEGACY_STAGE_MAP[stage] ?? 'onboarding';
}

export function getNextPatientStage(stage: PatientStage): PatientStage | null {
  const normalized = normalizePatientStage(stage);
  const currentIndex = PATIENT_STAGE_ORDER.indexOf(normalized);
  if (currentIndex === -1 || currentIndex === PATIENT_STAGE_ORDER.length - 1) {
    return null;
  }
  return PATIENT_STAGE_ORDER[currentIndex + 1];
}
