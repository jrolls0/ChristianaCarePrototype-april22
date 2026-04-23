import { clsx } from 'clsx';
import type { PatientStage } from '@/lib/types';

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

const STAGE_TONE: Record<PatientStage, string> = {
  'new-referral': 'bg-sky-50 text-sky-700 ring-sky-200',
  'patient-onboarding': 'bg-blue-50 text-blue-700 ring-blue-200',
  'initial-todos': 'bg-blue-50 text-blue-700 ring-blue-200',
  'front-desk-review': 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  screening: 'bg-amber-50 text-amber-700 ring-amber-200',
  'records-collection': 'bg-violet-50 text-violet-700 ring-violet-200',
  'specialist-review': 'bg-teal-50 text-teal-700 ring-teal-200',
  scheduled: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

interface StatusPillProps {
  stage: PatientStage;
  className?: string;
}

export function StatusPill({ stage, className }: StatusPillProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        STAGE_TONE[stage],
        className
      )}
    >
      {STAGE_LABEL[stage]}
    </span>
  );
}
