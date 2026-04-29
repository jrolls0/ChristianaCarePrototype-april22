export interface EndReasonOption {
  code: string;
  label: string;
  category: 'financial' | 'clinical' | 'patient' | 'administrative';
}

export const END_REASON_OPTIONS: EndReasonOption[] = [
  {
    code: 'FIN-INS-NA',
    label: 'Financial - Insurance not accepted',
    category: 'financial',
  },
  {
    code: 'FIN-VERIFY',
    label: 'Financial - Unable to verify coverage',
    category: 'financial',
  },
  {
    code: 'CLN-INCLUSION',
    label: 'Clinical - Does not meet inclusion criteria',
    category: 'clinical',
  },
  {
    code: 'CLN-EXCLUSION',
    label: 'Clinical - Exclusion criteria present',
    category: 'clinical',
  },
  {
    code: 'CLN-CONTRA',
    label: 'Clinical - Medical contraindication',
    category: 'clinical',
  },
  {
    code: 'PAT-NORESP',
    label: 'No response after 3 attempts',
    category: 'patient',
  },
  {
    code: 'PAT-WITHDRAW',
    label: 'Patient withdrew interest',
    category: 'patient',
  },
  {
    code: 'ADM-INCOMPLETE',
    label: 'Incomplete packet - unable to proceed',
    category: 'administrative',
  },
  {
    code: 'OTHER',
    label: 'Other',
    category: 'administrative',
  },
];

export function buildEndReferralLetter({
  patientLastName,
  reasonLabel,
}: {
  patientLastName: string;
  reasonLabel: string;
}): string {
  return [
    `Dear ${patientLastName} family,`,
    '',
    'ChristianaCare Transplant has reviewed the kidney transplant referral currently on file.',
    `At this time, the referral is being ended for the following reason: ${reasonLabel}.`,
    '',
    'If circumstances change or new information becomes available, the patient or referring clinic may contact the transplant team to discuss next steps.',
    '',
    'Sincerely,',
    'ChristianaCare Transplant Referrals',
  ].join('\n');
}
