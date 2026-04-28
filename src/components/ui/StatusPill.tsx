import { clsx } from 'clsx';
import { PATIENT_STAGE_LABEL, PATIENT_STAGE_TONE, normalizePatientStage } from '@/lib/stages';
import type { PatientStage } from '@/lib/types';

interface StatusPillProps {
  stage: PatientStage;
  className?: string;
}

export function StatusPill({ stage, className }: StatusPillProps) {
  const normalizedStage = normalizePatientStage(stage);
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        PATIENT_STAGE_TONE[normalizedStage],
        className
      )}
    >
      {PATIENT_STAGE_LABEL[normalizedStage]}
    </span>
  );
}
