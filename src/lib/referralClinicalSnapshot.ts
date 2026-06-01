import type { ReferralClinicalSnapshot, ReferralConcernValue } from './types';

type GeneralSnapshotKey = Exclude<keyof ReferralClinicalSnapshot, 'labs' | 'comments'>;
type LabSnapshotKey = keyof NonNullable<ReferralClinicalSnapshot['labs']>;

export const REFERRAL_SNAPSHOT_GENERAL_FIELDS: Array<{
  key: GeneralSnapshotKey;
  label: string;
}> = [
  { key: 'weightBmi', label: 'Weight / BMI' },
  { key: 'medicationCompliance', label: 'Medication compliance' },
  { key: 'functionalStatusFrailty', label: 'Functional status / frailty' },
  { key: 'socialSupport', label: 'Social support' },
  { key: 'htnControl', label: 'HTN control' },
  { key: 'dmControl', label: 'DM control' },
];

export const REFERRAL_SNAPSHOT_LAB_FIELDS: Array<{
  key: LabSnapshotKey;
  label: string;
}> = [
  { key: 'potassium', label: 'K+' },
  { key: 'phosphorus', label: 'Phosphorus' },
  { key: 'hemoglobin', label: 'Hemoglobin' },
  { key: 'albumin', label: 'Albumin' },
  { key: 'ipth', label: 'iPTH' },
];

export interface ReferralSnapshotItem {
  key: string;
  label: string;
  value?: ReferralConcernValue;
  group: 'general' | 'labs';
}

export function referralSnapshotValueLabel(value?: ReferralConcernValue): string {
  if (value === 'concern') return 'Concern';
  if (value === 'no-concern') return 'No concern';
  return 'Not answered';
}

export function referralSnapshotItems(
  snapshot?: ReferralClinicalSnapshot
): ReferralSnapshotItem[] {
  return [
    ...REFERRAL_SNAPSHOT_GENERAL_FIELDS.map((field) => ({
      key: field.key,
      label: field.label,
      value: snapshot?.[field.key],
      group: 'general' as const,
    })),
    ...REFERRAL_SNAPSHOT_LAB_FIELDS.map((field) => ({
      key: `labs.${field.key}`,
      label: field.label,
      value: snapshot?.labs?.[field.key],
      group: 'labs' as const,
    })),
  ];
}

export function hasReferralSnapshot(snapshot?: ReferralClinicalSnapshot): boolean {
  return (
    referralSnapshotItems(snapshot).some((item) => Boolean(item.value)) ||
    Boolean(snapshot?.comments?.trim())
  );
}

export function referralSnapshotConcernLabels(
  snapshot?: ReferralClinicalSnapshot
): string[] {
  return referralSnapshotItems(snapshot)
    .filter((item) => item.value === 'concern')
    .map((item) => item.label);
}

export function referralSnapshotConcernCount(
  snapshot?: ReferralClinicalSnapshot
): number {
  return referralSnapshotConcernLabels(snapshot).length;
}

export function referralSnapshotLabConcernCount(
  snapshot?: ReferralClinicalSnapshot
): number {
  return referralSnapshotItems(snapshot).filter(
    (item) => item.group === 'labs' && item.value === 'concern'
  ).length;
}

export function referralSnapshotSearchText(snapshot?: ReferralClinicalSnapshot): string {
  if (!hasReferralSnapshot(snapshot)) return '';
  return [
    ...referralSnapshotItems(snapshot).flatMap((item) => [
      item.label,
      referralSnapshotValueLabel(item.value),
    ]),
    snapshot?.comments,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
