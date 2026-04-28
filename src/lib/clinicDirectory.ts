export interface ClinicStaffMember {
  id: string;
  name: string;
  email: string;
}

export interface ClinicEntry {
  name: string;
  socialWorkers: ClinicStaffMember[];
  nephrologists: ClinicStaffMember[];
}

export const CLINIC_DIRECTORY: ClinicEntry[] = [
  {
    name: 'Riverside Dialysis Center',
    socialWorkers: [
      { id: 'sw-riverside-1', name: 'Sarah Johnson', email: 'sarah.johnson@riversidedialysis.org' },
    ],
    nephrologists: [
      { id: 'neph-riverside-1', name: 'Dr. Priya Menon', email: 'p.menon@riversidedialysis.org' },
    ],
  },
  {
    name: 'Wilmington Renal Care',
    socialWorkers: [
      { id: 'sw-wilmington-1', name: 'Angela Brooks', email: 'a.brooks@wilmingtonrenal.org' },
    ],
    nephrologists: [
      { id: 'neph-wilmington-1', name: 'Dr. Marcus Lee', email: 'mlee@wilmingtonrenal.org' },
    ],
  },
  {
    name: 'Brandywine Kidney Clinic',
    socialWorkers: [
      { id: 'sw-brandywine-1', name: 'Ryan Morales', email: 'rmorales@brandywinekidney.org' },
    ],
    nephrologists: [
      { id: 'neph-brandywine-1', name: 'Dr. Sarah Abramowitz', email: 'sabramowitz@brandywinekidney.org' },
    ],
  },
];

export const CLINIC_NAMES = CLINIC_DIRECTORY.map((c) => c.name);

export function findClinic(name: string | undefined | null): ClinicEntry | undefined {
  if (!name) return undefined;
  return CLINIC_DIRECTORY.find((c) => c.name === name);
}
