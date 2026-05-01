import type { Patient } from '../types';

export type CareTeamRole = {
  id: string;
  name: string;
  role: string;
  organization: string;
  helpsWith: string[];
  phone?: string;
  email?: string;
};

export const CHRISTIANACARE_CARE_TEAM: CareTeamRole[] = [
  {
    id: 'sarah-martinez',
    name: 'Sarah Martinez',
    role: 'Front Desk Coordinator',
    organization: 'ChristianaCare Transplant Referrals',
    helpsWith: ['portal questions', 'messages', 'intake tasks', 'referral coordination'],
    phone: '(302) 555-1010',
    email: 'sarah.martinez@christianacare.example',
  },
  {
    id: 'claire-smith',
    name: 'Claire Smith',
    role: 'Senior Coordinator / Clinical Supervisor',
    organization: 'ChristianaCare Transplant Referrals',
    helpsWith: ['case review questions', 'workflow escalation', 'clinical coordination'],
  },
  {
    id: 'thomas-wilson',
    name: 'Thomas Wilson',
    role: 'Pre-Transplant Coordinator',
    organization: 'ChristianaCare Transplant Referrals',
    helpsWith: ['evaluation preparation', 'care-plan questions', 'follow-up coordination'],
  },
  {
    id: 'lena-park',
    name: 'Lena Park',
    role: 'Financial Coordinator',
    organization: 'ChristianaCare Transplant Referrals',
    helpsWith: ['insurance review', 'coverage questions', 'financial screening'],
  },
  {
    id: 'monique-carter',
    name: 'Monique Carter',
    role: 'Transplant Social Worker',
    organization: 'ChristianaCare Transplant Referrals',
    helpsWith: ['support planning', 'transportation concerns', 'social needs'],
  },
  {
    id: 'rachel-kim',
    name: 'Rachel Kim',
    role: 'Dietitian',
    organization: 'ChristianaCare Transplant Referrals',
    helpsWith: ['nutrition questions', 'kidney-friendly diet basics', 'education'],
  },
  {
    id: 'anika-shah',
    name: 'Dr. Anika Shah',
    role: 'Transplant Nephrologist Lead',
    organization: 'ChristianaCare Transplant Referrals',
    helpsWith: ['clinical review', 'transplant evaluation questions'],
  },
];

export function buildPatientCareTeam(patient: Pick<
  Patient,
  'duswName' | 'duswEmail' | 'nephrologistName' | 'nephrologistEmail' | 'referringClinic'
>): CareTeamRole[] {
  const patientSpecific: CareTeamRole[] = [];
  if (patient.duswName) {
    patientSpecific.push({
      id: 'assigned-dusw',
      name: patient.duswName,
      role: 'Dialysis Social Worker',
      organization: patient.referringClinic ?? 'Dialysis Clinic',
      helpsWith: ['dialysis clinic coordination', 'clinic document questions', 'patient support'],
      email: patient.duswEmail,
    });
  }
  if (patient.nephrologistName) {
    patientSpecific.push({
      id: 'assigned-nephrologist',
      name: patient.nephrologistName,
      role: 'Nephrologist',
      organization: patient.referringClinic ?? 'Dialysis Clinic',
      helpsWith: ['kidney care context', 'dialysis clinical history', 'referral support'],
      email: patient.nephrologistEmail,
    });
  }
  return [CHRISTIANACARE_CARE_TEAM[0], ...patientSpecific, ...CHRISTIANACARE_CARE_TEAM.slice(1)];
}
