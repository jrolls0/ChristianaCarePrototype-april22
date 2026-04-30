import type {
  ClinicUser,
  DocumentRecord,
  Message,
  Patient,
  ScreeningResponses,
  ThreadKey,
  Todo,
} from './types';

const hoursAgoIso = (h: number): string =>
  new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
const daysAgoIso = (d: number): string => hoursAgoIso(d * 24);

const STAFF_NAME = 'Sarah Martinez';
const STAFF_TITLE = 'Front Desk Coordinator';

const RIVERSIDE = 'Riverside Dialysis Center';
const WILMINGTON = 'Wilmington Renal Care';
const BRANDYWINE = 'Brandywine Kidney Clinic';

const RIVERSIDE_DUSW = {
  name: 'Sarah Johnson',
  email: 'sarah.johnson@riversidedialysis.org',
};
const WILMINGTON_DUSW = {
  name: 'Angela Brooks',
  email: 'a.brooks@wilmingtonrenal.org',
};
const BRANDYWINE_DUSW = {
  name: 'Ryan Morales',
  email: 'rmorales@brandywinekidney.org',
};

const RIVERSIDE_NEPH = {
  name: 'Dr. Priya Menon',
  email: 'p.menon@riversidedialysis.org',
};
const WILMINGTON_NEPH = {
  name: 'Dr. Marcus Lee',
  email: 'mlee@wilmingtonrenal.org',
};
const BRANDYWINE_NEPH = {
  name: 'Dr. Sarah Abramowitz',
  email: 'sabramowitz@brandywinekidney.org',
};

const todoId = (patientId: string, key: string) => `todo-${patientId}-${key}`;
const msgId = (patientId: string, key: string) => `msg-${patientId}-${key}`;
const docId = (patientId: string, key: string) => `doc-${patientId}-${key}`;
const threadIdFor = (patientId: string, key: ThreadKey) => `${patientId}-${key}`;

const completedAtFor = (patient: Patient, type: Todo['type']): string | undefined =>
  patient.todos.find((todo) => todo.type === type && todo.status === 'completed')?.completedAt;

const SERVICES_ROI_DOCUMENT = 'Services ROI';
const MEDICAL_ROI_DOCUMENT = 'Medical Records ROI';

const buildSeedDocAt = (
  patientId: string,
  slug: string,
  name: string,
  uploadedAt: string,
  uploadedBy: DocumentRecord['uploadedBy'] = 'patient'
): DocumentRecord => ({
  id: docId(patientId, slug),
  name,
  uploadedAt,
  uploadedBy,
});

const workflowDocumentsFor = (patient: Patient): DocumentRecord[] => {
  const documents: DocumentRecord[] = [];
  const servicesRoiAt = completedAtFor(patient, 'sign-roi-services');
  const medicalRoiAt = completedAtFor(patient, 'sign-roi-medical');
  const govIdAt = completedAtFor(patient, 'upload-government-id');
  const insuranceAt = completedAtFor(patient, 'upload-insurance-card');

  if (govIdAt) {
    documents.push(buildSeedDocAt(patient.id, 'gov-id-front', 'Government ID (Front)', govIdAt));
  }
  if (insuranceAt) {
    documents.push(buildSeedDocAt(patient.id, 'insurance-front', 'Insurance Card (Front)', insuranceAt));
    documents.push(buildSeedDocAt(patient.id, 'insurance-back', 'Insurance Card (Back)', insuranceAt));
  }
  if (servicesRoiAt && medicalRoiAt) {
    documents.push(buildSeedDocAt(patient.id, 'roi-services-document', SERVICES_ROI_DOCUMENT, servicesRoiAt));
    documents.push(buildSeedDocAt(patient.id, 'roi-medical-document', MEDICAL_ROI_DOCUMENT, medicalRoiAt));
  }

  return [
    ...documents,
    ...patient.documents.filter((document) => document.uploadedBy !== 'patient'),
  ];
};

const withDemoConsents = (patient: Patient): Patient => {
  const roiSigned = Boolean(
    completedAtFor(patient, 'sign-roi-services') && completedAtFor(patient, 'sign-roi-medical')
  );
  return {
    ...patient,
    roiSigned,
    roiSignedAt:
      patient.roiSignedAt ??
      completedAtFor(patient, 'sign-roi-medical') ??
      completedAtFor(patient, 'sign-roi-services'),
    smsConsent: patient.smsConsent ?? roiSigned,
    emailConsent: patient.emailConsent ?? roiSigned,
    phoneConsent: patient.phoneConsent ?? roiSigned,
    emergencyContactConsent:
      patient.emergencyContactConsent ??
      Boolean(patient.emergencyContact?.consented || completedAtFor(patient, 'add-emergency-contact')),
  };
};

const screeningResponses = (
  patient: Patient,
  overrides: Partial<ScreeningResponses> = {}
): ScreeningResponses | undefined => {
  const completedAt = completedAtFor(patient, 'complete-health-questionnaire');
  if (!completedAt) return undefined;
  return {
    onDialysis: 'yes',
    dialysisStart: 'May 2024',
    egfr: 11,
    heightFeet: 5,
    heightInches: 8,
    weightPounds: 182,
    isCitizenOrResident: 'yes',
    needsMultiOrganTransplant: 'no',
    usesSupplementalOxygen: 'no',
    cardiacSurgeryLast6Months: 'no',
    activeCancer: 'no',
    activeSubstanceUse: 'no',
    hasOpenWounds: 'no',
    completedAt,
    ...overrides,
  };
};

const withDemoPatientState = (patient: Patient): Patient => {
  const screeningOverrides: Partial<ScreeningResponses> =
    patient.id === 'patient-robert'
      ? {
          usesSupplementalOxygen: 'yes',
          otherConcerns:
            'Patient reports intermittent oxygen use after dialysis. Staff should clarify before routing forward.',
        }
      : patient.id === 'patient-linda'
        ? {
            heightFeet: 5,
            heightInches: 3,
            weightPounds: 158,
          }
        : patient.id === 'patient-patricia'
          ? {
              egfr: 9,
              weightPounds: 174,
            }
          : patient.id === 'patient-david'
            ? {
                cardiacSurgeryLast6Months: 'notSure',
                otherConcerns: 'Patient is unsure whether a recent cardiac procedure counts as surgery.',
              }
            : {};
  const nextPatient = withDemoConsents({
    ...patient,
    screeningResponses:
      patient.screeningResponses ?? screeningResponses(patient, screeningOverrides),
  });
  return {
    ...nextPatient,
    documents: workflowDocumentsFor(nextPatient),
  };
};

interface BuildTodoInput {
  patientId: string;
  type: Todo['type'];
  slug: string;
  title: string;
  description: string;
  status?: Todo['status'];
  completedHoursAgo?: number;
}

const buildTodo = ({
  patientId,
  type,
  slug,
  title,
  description,
  status = 'pending',
  completedHoursAgo,
}: BuildTodoInput): Todo => ({
  id: todoId(patientId, slug),
  type,
  title,
  description,
  status,
  completedAt:
    status === 'completed' && completedHoursAgo !== undefined
      ? hoursAgoIso(completedHoursAgo)
      : undefined,
});

const ROI_SERVICES = (patientId: string, status: Todo['status'], hoursAgo?: number) =>
  buildTodo({
    patientId,
    type: 'sign-roi-services',
    slug: 'roi-services',
    title: 'Sign ROI — Services Consent',
    description: 'Authorize ChristianaCare to support your evaluation.',
    status,
    completedHoursAgo: hoursAgo,
  });

const ROI_MEDICAL = (patientId: string, status: Todo['status'], hoursAgo?: number) =>
  buildTodo({
    patientId,
    type: 'sign-roi-medical',
    slug: 'roi-medical',
    title: 'Sign ROI — Medical Records',
    description: 'Authorize ChristianaCare to request your medical records.',
    status,
    completedHoursAgo: hoursAgo,
  });

const GOV_ID = (patientId: string, status: Todo['status'], hoursAgo?: number) =>
  buildTodo({
    patientId,
    type: 'upload-government-id',
    slug: 'gov-id',
    title: 'Upload Government ID',
    description: "A clear photo of your driver's license or passport.",
    status,
    completedHoursAgo: hoursAgo,
  });

const INSURANCE = (patientId: string, status: Todo['status'], hoursAgo?: number) =>
  buildTodo({
    patientId,
    type: 'upload-insurance-card',
    slug: 'insurance',
    title: 'Upload Insurance Card',
    description: 'Front and back of your primary insurance card.',
    status,
    completedHoursAgo: hoursAgo,
  });

const HEALTH_Q = (patientId: string, status: Todo['status'], hoursAgo?: number) =>
  buildTodo({
    patientId,
    type: 'complete-health-questionnaire',
    slug: 'health',
    title: 'Complete Health Questionnaire',
    description: 'A short form about your current health and medical history.',
    status,
    completedHoursAgo: hoursAgo,
  });

const EMERGENCY = (patientId: string, status: Todo['status'], hoursAgo?: number) =>
  buildTodo({
    patientId,
    type: 'add-emergency-contact',
    slug: 'emergency',
    title: 'Add Emergency Contact',
    description: 'Add a trusted person we can reach in an emergency.',
    status,
    completedHoursAgo: hoursAgo,
  });

interface SeedMessageInput {
  patientId: string;
  slug: string;
  threadKey: ThreadKey;
  fromRole: Message['fromRole'];
  fromName: string;
  body: string;
  hoursAgo: number;
  readByPatient?: boolean;
  readByStaff?: boolean;
  readByClinic?: boolean;
}

const buildMessage = ({
  patientId,
  slug,
  threadKey,
  fromRole,
  fromName,
  body,
  hoursAgo,
  readByPatient,
  readByStaff,
  readByClinic,
}: SeedMessageInput): Message => ({
  id: msgId(patientId, slug),
  threadId: threadIdFor(patientId, threadKey),
  threadKey,
  fromRole,
  fromName,
  body,
  sentAt: hoursAgoIso(hoursAgo),
  readByPatient:
    readByPatient ?? (fromRole === 'patient' ? true : false),
  readByStaff: readByStaff ?? (fromRole === 'staff' ? true : false),
  readByClinic: readByClinic ?? (fromRole === 'clinic' ? true : false),
});

const buildDoc = (
  patientId: string,
  slug: string,
  name: string,
  hoursAgo: number,
  uploadedBy: DocumentRecord['uploadedBy'] = 'patient'
): DocumentRecord => ({
  id: docId(patientId, slug),
  name,
  uploadedAt: hoursAgoIso(hoursAgo),
  uploadedBy,
});

// ---------- Patients ----------

const buildMaria = (): Patient => {
  const id = 'patient-maria';
  return {
    id,
    firstName: 'Maria',
    lastName: 'Chen',
    email: 'maria.chen@email.com',
    phone: '(302) 555-0186',
    dob: '1967-03-22',
    preferredLanguage: 'English',
    referralSource: 'clinic',
    referringClinic: RIVERSIDE,
    referringClinician: RIVERSIDE_NEPH.name,
    duswName: RIVERSIDE_DUSW.name,
    duswEmail: RIVERSIDE_DUSW.email,
    nephrologistName: RIVERSIDE_NEPH.name,
    nephrologistEmail: RIVERSIDE_NEPH.email,
    referralDate: daysAgoIso(14),
    stage: 'initial-todos',
    daysInStage: 8,
    isStuck: true,
    todos: [
      ROI_SERVICES(id, 'completed', 13 * 24),
      ROI_MEDICAL(id, 'completed', 13 * 24),
      GOV_ID(id, 'completed', 11 * 24),
      INSURANCE(id, 'pending'),
      HEALTH_Q(id, 'completed', 10 * 24),
      EMERGENCY(id, 'completed', 12 * 24),
    ],
    messages: [
      buildMessage({
        patientId: id,
        slug: 'dusw-intro',
        threadKey: 'dusw',
        fromRole: 'clinic',
        fromName: RIVERSIDE_DUSW.name,
        body:
          "Hi Maria — I submitted your transplant referral to ChristianaCare this week. You'll hear from their team soon. I'm here if you run into anything.",
        hoursAgo: 13 * 24,
        readByPatient: true,
      }),
      buildMessage({
        patientId: id,
        slug: 'fd-welcome',
        threadKey: 'tc-frontdesk',
        fromRole: 'staff',
        fromName: STAFF_NAME,
        body:
          "Welcome to ChristianaCare, Maria. I'm Sarah, your Front Desk Coordinator. Please finish your initial tasks so we can begin your evaluation.",
        hoursAgo: 12 * 24,
        readByPatient: true,
      }),
      buildMessage({
        patientId: id,
        slug: 'fd-nudge-1',
        threadKey: 'tc-frontdesk',
        fromRole: 'staff',
        fromName: STAFF_NAME,
        body:
          "Hi Maria — just checking in. We still need a photo of your insurance card to continue your evaluation. Please upload it when you get a chance.",
        hoursAgo: 6 * 24,
        readByPatient: true,
      }),
      buildMessage({
        patientId: id,
        slug: 'fd-nudge-2',
        threadKey: 'tc-frontdesk',
        fromRole: 'staff',
        fromName: STAFF_NAME,
        body:
          "Following up again — the insurance card is the last thing we need before we can move you forward. Let me know if anything is blocking you.",
        hoursAgo: 2 * 24,
        readByPatient: false,
        readByStaff: true,
      }),
      buildMessage({
        patientId: id,
        slug: 'clinic-insurance-check',
        threadKey: 'clinic-staff',
        fromRole: 'staff',
        fromName: STAFF_NAME,
        body:
          'Hi Sarah — Maria is still missing her insurance card upload. If she brings it to dialysis, please remind her she can upload it in the patient portal.',
        hoursAgo: 20,
        readByStaff: true,
        readByClinic: false,
      }),
    ],
    documents: [
      buildDoc(id, 'gov-id', 'Government ID — front', 11 * 24),
    ],
    lastActivityAt: daysAgoIso(2),
    emergencyContact: {
      name: 'David Chen',
      relationship: 'Spouse',
      email: 'david.chen@email.com',
      phone: '(302) 555-0193',
      consented: true,
    },
  };
};

const buildRobert = (): Patient => {
  const id = 'patient-robert';
  return {
    id,
    firstName: 'Robert',
    lastName: 'Williams',
    email: 'robert.williams@email.com',
    phone: '(302) 555-0218',
    dob: '1961-11-05',
    preferredLanguage: 'English',
    referralSource: 'clinic',
    referringClinic: WILMINGTON,
    referringClinician: WILMINGTON_NEPH.name,
    duswName: WILMINGTON_DUSW.name,
    duswEmail: WILMINGTON_DUSW.email,
    nephrologistName: WILMINGTON_NEPH.name,
    nephrologistEmail: WILMINGTON_NEPH.email,
    referralDate: daysAgoIso(11),
    stage: 'initial-screening',
    daysInStage: 6,
    isStuck: true,
    todos: [
      ROI_SERVICES(id, 'completed', 10 * 24),
      ROI_MEDICAL(id, 'completed', 10 * 24),
      GOV_ID(id, 'completed', 9 * 24),
      INSURANCE(id, 'completed', 9 * 24),
      HEALTH_Q(id, 'completed', 7 * 24),
      EMERGENCY(id, 'completed', 8 * 24),
    ],
    messages: [
      buildMessage({
        patientId: id,
        slug: 'dusw-intro',
        threadKey: 'dusw',
        fromRole: 'clinic',
        fromName: WILMINGTON_DUSW.name,
        body:
          "Robert, your transplant referral went out last week. Reach out if you want help with the paperwork — I can walk through it with you.",
        hoursAgo: 10 * 24,
        readByPatient: true,
      }),
      buildMessage({
        patientId: id,
        slug: 'fd-welcome',
        threadKey: 'tc-frontdesk',
        fromRole: 'staff',
        fromName: STAFF_NAME,
        body:
          "Hi Robert — I'm Sarah from ChristianaCare. Your intake tasks are complete, and your responses are in initial screening.",
        hoursAgo: 8 * 24,
        readByPatient: true,
      }),
      buildMessage({
        patientId: id,
        slug: 'fd-nudge-1',
        threadKey: 'tc-frontdesk',
        fromRole: 'staff',
        fromName: STAFF_NAME,
        body:
          "Hi Robert, our team is taking a closer look at one screening response before we can route you to financial screening.",
        hoursAgo: 4 * 24,
        readByPatient: true,
      }),
      buildMessage({
        patientId: id,
        slug: 'fd-nudge-2',
        threadKey: 'tc-frontdesk',
        fromRole: 'staff',
        fromName: STAFF_NAME,
        body:
          "Following up one more time. If it's easier to clarify this over the phone, just reply here and I'll set up a call.",
        hoursAgo: 1 * 24,
        readByPatient: false,
        readByStaff: true,
      }),
    ],
    documents: [
      buildDoc(id, 'gov-id', 'Government ID — front', 9 * 24),
      buildDoc(id, 'insurance-front', 'Insurance Card — front', 9 * 24),
      buildDoc(id, 'insurance-back', 'Insurance Card — back', 9 * 24),
    ],
    lastActivityAt: daysAgoIso(1),
    emergencyContact: {
      name: 'Janet Williams',
      relationship: 'Sister',
      email: 'janet.williams@email.com',
      phone: '(302) 555-0244',
      consented: true,
    },
  };
};

const buildLinda = (): Patient => {
  const id = 'patient-linda';
  return {
    id,
    firstName: 'Linda',
    lastName: 'Rodriguez',
    email: 'linda.rodriguez@email.com',
    phone: '(302) 555-0301',
    dob: '1970-07-19',
    preferredLanguage: 'Spanish',
    referralSource: 'clinic',
    referringClinic: RIVERSIDE,
    referringClinician: RIVERSIDE_NEPH.name,
    duswName: RIVERSIDE_DUSW.name,
    duswEmail: RIVERSIDE_DUSW.email,
    nephrologistName: RIVERSIDE_NEPH.name,
    nephrologistEmail: RIVERSIDE_NEPH.email,
    referralDate: daysAgoIso(19),
    stage: 'records-clinical-review',
    daysInStage: 4,
    isStuck: false,
    todos: [
      ROI_SERVICES(id, 'completed', 18 * 24),
      ROI_MEDICAL(id, 'completed', 18 * 24),
      GOV_ID(id, 'completed', 17 * 24),
      INSURANCE(id, 'completed', 17 * 24),
      HEALTH_Q(id, 'completed', 14 * 24),
      EMERGENCY(id, 'completed', 17 * 24),
    ],
    messages: [
      buildMessage({
        patientId: id,
        slug: 'dusw-followup',
        threadKey: 'dusw',
        fromRole: 'clinic',
        fromName: RIVERSIDE_DUSW.name,
        body:
          "Linda, ChristianaCare asked us for your most recent dialysis summaries and the Medicare 2728. I'll pull them together this week.",
        hoursAgo: 3 * 24,
        readByPatient: true,
      }),
      buildMessage({
        patientId: id,
        slug: 'fd-records',
        threadKey: 'tc-frontdesk',
        fromRole: 'staff',
        fromName: STAFF_NAME,
        body:
          "Hi Linda — all your onboarding tasks are done, thank you. We're now waiting on a few records from Riverside Dialysis and will keep you posted.",
        hoursAgo: 4 * 24,
        readByPatient: true,
      }),
      buildMessage({
        patientId: id,
        slug: 'clinic-records-request',
        threadKey: 'clinic-staff',
        fromRole: 'staff',
        fromName: STAFF_NAME,
        body:
          'Hi Sarah — Linda is in records and clinical review. Please upload any dialysis records you have ready when convenient.',
        hoursAgo: 30,
        readByStaff: true,
        readByClinic: false,
      }),
    ],
    documents: [
      buildDoc(id, 'gov-id', 'Government ID — front', 17 * 24),
      buildDoc(id, 'insurance-front', 'Insurance Card — front', 17 * 24),
      buildDoc(id, 'insurance-back', 'Insurance Card — back', 17 * 24),
    ],
    lastActivityAt: daysAgoIso(3),
    emergencyContact: {
      name: 'Carlos Rodriguez',
      relationship: 'Brother',
      email: 'carlos.rodriguez@email.com',
      phone: '(302) 555-0317',
      consented: true,
    },
  };
};

const buildJames = (): Patient => {
  const id = 'patient-james';
  return {
    id,
    firstName: 'James',
    lastName: 'Patel',
    email: 'james.patel@email.com',
    phone: '(302) 555-0412',
    dob: '1979-02-08',
    preferredLanguage: 'English',
    referralSource: 'clinic',
    referringClinic: BRANDYWINE,
    referringClinician: BRANDYWINE_NEPH.name,
    duswName: BRANDYWINE_DUSW.name,
    duswEmail: BRANDYWINE_DUSW.email,
    nephrologistName: BRANDYWINE_NEPH.name,
    nephrologistEmail: BRANDYWINE_NEPH.email,
    referralDate: daysAgoIso(9),
    stage: 'education',
    daysInStage: 2,
    isStuck: false,
    todos: [
      ROI_SERVICES(id, 'completed', 8 * 24),
      ROI_MEDICAL(id, 'completed', 8 * 24),
      GOV_ID(id, 'completed', 7 * 24),
      INSURANCE(id, 'completed', 7 * 24),
      HEALTH_Q(id, 'completed', 5 * 24),
      EMERGENCY(id, 'completed', 7 * 24),
    ],
    messages: [
      buildMessage({
        patientId: id,
        slug: 'dusw-thanks',
        threadKey: 'dusw',
        fromRole: 'patient',
        fromName: 'James Patel',
        body:
          "Hi Ryan — thanks for walking me through the forms. I sent everything to ChristianaCare.",
        hoursAgo: 7 * 24,
        readByPatient: true,
      }),
      buildMessage({
        patientId: id,
        slug: 'fd-next',
        threadKey: 'tc-frontdesk',
        fromRole: 'staff',
        fromName: STAFF_NAME,
        body:
          "James, your case has been approved to continue. Your education tasks are ready in the patient portal, and I'll follow up with next steps once those are complete.",
        hoursAgo: 1 * 24,
        readByPatient: false,
        readByStaff: true,
      }),
    ],
    documents: [
      buildDoc(id, 'gov-id', 'Government ID — front', 7 * 24),
      buildDoc(id, 'insurance-front', 'Insurance Card — front', 7 * 24),
      buildDoc(id, 'insurance-back', 'Insurance Card — back', 7 * 24),
    ],
    lastActivityAt: hoursAgoIso(1 * 24),
    emergencyContact: {
      name: 'Anita Patel',
      relationship: 'Spouse',
      email: 'anita.patel@email.com',
      phone: '(302) 555-0428',
      consented: true,
    },
  };
};

const buildPatricia = (): Patient => {
  const id = 'patient-patricia';
  return {
    id,
    firstName: 'Patricia',
    lastName: 'Davis',
    email: 'patricia.davis@email.com',
    phone: '(302) 555-0509',
    dob: '1958-12-30',
    preferredLanguage: 'English',
    referralSource: 'clinic',
    referringClinic: RIVERSIDE,
    referringClinician: RIVERSIDE_NEPH.name,
    duswName: RIVERSIDE_DUSW.name,
    duswEmail: RIVERSIDE_DUSW.email,
    nephrologistName: RIVERSIDE_NEPH.name,
    nephrologistEmail: RIVERSIDE_NEPH.email,
    referralDate: daysAgoIso(3),
    stage: 'financial-screening',
    daysInStage: 1,
    isStuck: false,
    todos: [
      ROI_SERVICES(id, 'completed', 20),
      ROI_MEDICAL(id, 'completed', 20),
      GOV_ID(id, 'completed', 22),
      INSURANCE(id, 'completed', 22),
      HEALTH_Q(id, 'completed', 21),
      EMERGENCY(id, 'pending'),
    ],
    messages: [
      buildMessage({
        patientId: id,
        slug: 'dusw-welcome',
        threadKey: 'dusw',
        fromRole: 'clinic',
        fromName: RIVERSIDE_DUSW.name,
        body:
          "Patricia, your referral is in. ChristianaCare's team will guide you from here — let me know if you need help at any point.",
        hoursAgo: 2 * 24,
        readByPatient: true,
      }),
      buildMessage({
        patientId: id,
        slug: 'fd-welcome',
        threadKey: 'tc-frontdesk',
        fromRole: 'staff',
        fromName: STAFF_NAME,
        body:
          "Welcome, Patricia! Thanks for completing your intake tasks. Our financial team is reviewing your insurance before we move into clinical review.",
        hoursAgo: 18,
        readByPatient: true,
      }),
    ],
    documents: [
      buildDoc(id, 'gov-id', 'Government ID — front', 22),
      buildDoc(id, 'insurance-front', 'Insurance Card — front', 22),
      buildDoc(id, 'insurance-back', 'Insurance Card — back', 22),
    ],
    lastActivityAt: hoursAgoIso(18),
  };
};

const buildDavid = (): Patient => {
  const id = 'patient-david';
  return {
    id,
    firstName: 'David',
    lastName: 'Kim',
    email: 'david.kim@email.com',
    phone: '(302) 555-0631',
    dob: '1956-04-17',
    preferredLanguage: 'English',
    referralSource: 'clinic',
    referringClinic: RIVERSIDE,
    referringClinician: RIVERSIDE_NEPH.name,
    duswName: RIVERSIDE_DUSW.name,
    duswEmail: RIVERSIDE_DUSW.email,
    nephrologistName: RIVERSIDE_NEPH.name,
    nephrologistEmail: RIVERSIDE_NEPH.email,
    referralDate: daysAgoIso(26),
    stage: 'final-decision',
    daysInStage: 3,
    isStuck: false,
    todos: [
      ROI_SERVICES(id, 'completed', 25 * 24),
      ROI_MEDICAL(id, 'completed', 25 * 24),
      GOV_ID(id, 'completed', 24 * 24),
      INSURANCE(id, 'completed', 24 * 24),
      HEALTH_Q(id, 'completed', 20 * 24),
      EMERGENCY(id, 'completed', 23 * 24),
    ],
    messages: [
      buildMessage({
        patientId: id,
        slug: 'fd-update',
        threadKey: 'tc-frontdesk',
        fromRole: 'staff',
        fromName: STAFF_NAME,
        body:
          "Hi David — your records and clinical review are complete. Your case is with the senior coordinator for final decision review.",
        hoursAgo: 2 * 24,
        readByPatient: true,
      }),
      buildMessage({
        patientId: id,
        slug: 'patient-ack',
        threadKey: 'tc-frontdesk',
        fromRole: 'patient',
        fromName: 'David Kim',
        body: 'Thanks Sarah, appreciate the update.',
        hoursAgo: 2 * 24 - 4,
        readByPatient: true,
        readByStaff: true,
      }),
    ],
    documents: [
      buildDoc(id, 'gov-id', 'Government ID — front', 24 * 24),
      buildDoc(id, 'insurance-front', 'Insurance Card — front', 24 * 24),
      buildDoc(id, 'insurance-back', 'Insurance Card — back', 24 * 24),
    ],
    lastActivityAt: hoursAgoIso(2 * 24 - 4),
    emergencyContact: {
      name: 'Grace Kim',
      relationship: 'Daughter',
      email: 'grace.kim@email.com',
      phone: '(302) 555-0649',
      consented: true,
    },
  };
};

const buildElaine = (): Patient => {
  const id = 'patient-elaine';
  return {
    id,
    firstName: 'Elaine',
    lastName: 'Barnes',
    email: 'elaine.barnes@email.com',
    phone: '(302) 555-0742',
    dob: '1964-09-12',
    preferredLanguage: 'English',
    referralSource: 'clinic',
    referringClinic: WILMINGTON,
    referringClinician: WILMINGTON_NEPH.name,
    duswName: WILMINGTON_DUSW.name,
    duswEmail: WILMINGTON_DUSW.email,
    nephrologistName: WILMINGTON_NEPH.name,
    nephrologistEmail: WILMINGTON_NEPH.email,
    referralDate: daysAgoIso(31),
    stage: 'scheduling',
    daysInStage: 2,
    isStuck: false,
    todos: [
      ROI_SERVICES(id, 'completed', 30 * 24),
      ROI_MEDICAL(id, 'completed', 30 * 24),
      GOV_ID(id, 'completed', 29 * 24),
      INSURANCE(id, 'completed', 29 * 24),
      HEALTH_Q(id, 'completed', 26 * 24),
      EMERGENCY(id, 'completed', 25 * 24),
      buildTodo({
        patientId: id,
        type: 'watch-education-video',
        slug: 'education-video',
        title: 'Watch Transplant Education Video',
        description: 'Complete the required transplant education before scheduling.',
        status: 'completed',
        completedHoursAgo: 4 * 24,
      }),
    ],
    messages: [
      buildMessage({
        patientId: id,
        slug: 'fd-scheduling',
        threadKey: 'tc-frontdesk',
        fromRole: 'staff',
        fromName: STAFF_NAME,
        body:
          "Elaine, your education step is complete. Our front desk is coordinating appointment windows for your evaluation visit.",
        hoursAgo: 2 * 24,
        readByPatient: true,
      }),
      buildMessage({
        patientId: id,
        slug: 'patient-window',
        threadKey: 'tc-frontdesk',
        fromRole: 'patient',
        fromName: 'Elaine Barnes',
        body: 'Tuesday morning or Thursday afternoon would work best for me.',
        hoursAgo: 1 * 24,
        readByPatient: true,
        readByStaff: false,
      }),
    ],
    documents: [
      buildDoc(id, 'gov-id', 'Government ID — front', 29 * 24),
      buildDoc(id, 'insurance-front', 'Insurance Card — front', 29 * 24),
      buildDoc(id, 'insurance-back', 'Insurance Card — back', 29 * 24),
    ],
    lastActivityAt: daysAgoIso(1),
    emergencyContact: {
      name: 'Thomas Barnes',
      relationship: 'Son',
      email: 'thomas.barnes@email.com',
      phone: '(302) 555-0758',
      consented: true,
    },
  };
};

const buildRobertHayes = (): Patient => {
  const id = 'patient-robert-hayes';
  return {
    id,
    firstName: 'Robert',
    lastName: 'Hayes',
    email: 'robert.hayes@email.com',
    phone: '(302) 555-0317',
    dob: '1969-11-08',
    preferredLanguage: 'English',
    referralSource: 'self',
    referralDate: daysAgoIso(2),
    stage: 'onboarding',
    daysInStage: 2,
    isStuck: false,
    todos: [
      GOV_ID(id, 'pending'),
      INSURANCE(id, 'pending'),
      HEALTH_Q(id, 'pending'),
    ],
    messages: [
      buildMessage({
        patientId: id,
        slug: 'self-register',
        threadKey: 'tc-frontdesk',
        fromRole: 'staff',
        fromName: 'ChristianaCare System',
        body: 'Self-registered through the patient portal — needs follow-up to capture clinical info.',
        hoursAgo: 2 * 24,
        readByPatient: true,
        readByStaff: false,
      }),
    ],
    documents: [],
    lastActivityAt: daysAgoIso(2),
  };
};

const INITIAL_CLINIC_USER: ClinicUser = {
  name: RIVERSIDE_DUSW.name,
  clinicName: RIVERSIDE,
};

export interface InitialState {
  patients: Patient[];
  currentPatientId: string | null;
  currentStaffName: string;
  currentClinicUser: ClinicUser;
  lastPatientTab: 'home' | 'amelia' | 'messages' | 'profile' | 'help';
}

export const createInitialState = (): InitialState => ({
  patients: [
    buildMaria(),
    buildRobert(),
    buildLinda(),
    buildJames(),
    buildPatricia(),
    buildDavid(),
    buildElaine(),
    buildRobertHayes(),
  ].map(withDemoPatientState),
  currentPatientId: null,
  currentStaffName: STAFF_NAME,
  currentClinicUser: INITIAL_CLINIC_USER,
  lastPatientTab: 'home',
});

export const STAFF_DISPLAY_TITLE = STAFF_TITLE;
