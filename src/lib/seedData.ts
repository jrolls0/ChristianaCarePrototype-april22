import type {
  ClinicUser,
  DocumentRecord,
  Message,
  Patient,
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

const buildJack = (): Patient => {
  const id = 'patient-jack';
  return {
    id,
    firstName: 'Jack',
    lastName: 'Thompson',
    email: 'jack.thompson@email.com',
    phone: '(302) 555-0142',
    dob: '1973-09-14',
    preferredLanguage: 'English',
    referringClinic: RIVERSIDE,
    referringClinician: RIVERSIDE_NEPH.name,
    duswName: RIVERSIDE_DUSW.name,
    duswEmail: RIVERSIDE_DUSW.email,
    nephrologistName: RIVERSIDE_NEPH.name,
    nephrologistEmail: RIVERSIDE_NEPH.email,
    referralDate: hoursAgoIso(0.25),
    stage: 'new-referral',
    daysInStage: 0,
    isStuck: false,
    todos: [],
    messages: [],
    documents: [],
    lastActivityAt: hoursAgoIso(0.25),
  };
};

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
    ],
    documents: [
      buildDoc(id, 'gov-id', 'Government ID — front', 11 * 24),
    ],
    lastActivityAt: daysAgoIso(2),
    emergencyContact: {
      name: 'David Chen',
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
    referringClinic: WILMINGTON,
    referringClinician: WILMINGTON_NEPH.name,
    duswName: WILMINGTON_DUSW.name,
    duswEmail: WILMINGTON_DUSW.email,
    nephrologistName: WILMINGTON_NEPH.name,
    nephrologistEmail: WILMINGTON_NEPH.email,
    referralDate: daysAgoIso(11),
    stage: 'initial-todos',
    daysInStage: 6,
    isStuck: true,
    todos: [
      ROI_SERVICES(id, 'completed', 10 * 24),
      ROI_MEDICAL(id, 'completed', 10 * 24),
      GOV_ID(id, 'completed', 9 * 24),
      INSURANCE(id, 'completed', 9 * 24),
      HEALTH_Q(id, 'pending'),
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
          "Hi Robert — I'm Sarah from ChristianaCare. Thanks for starting your onboarding tasks. One more item on the list: the health questionnaire.",
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
          "Hi Robert, checking in on the health questionnaire. It takes about 10 minutes and helps our team prepare for your screening call.",
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
          "Following up one more time. If it's easier to do this over the phone, just reply here and I'll set up a call.",
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
    referringClinic: RIVERSIDE,
    referringClinician: RIVERSIDE_NEPH.name,
    duswName: RIVERSIDE_DUSW.name,
    duswEmail: RIVERSIDE_DUSW.email,
    nephrologistName: RIVERSIDE_NEPH.name,
    nephrologistEmail: RIVERSIDE_NEPH.email,
    referralDate: daysAgoIso(19),
    stage: 'records-collection',
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
    ],
    documents: [
      buildDoc(id, 'gov-id', 'Government ID — front', 17 * 24),
      buildDoc(id, 'insurance-front', 'Insurance Card — front', 17 * 24),
      buildDoc(id, 'insurance-back', 'Insurance Card — back', 17 * 24),
    ],
    lastActivityAt: daysAgoIso(3),
    emergencyContact: {
      name: 'Carlos Rodriguez',
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
    referringClinic: BRANDYWINE,
    referringClinician: BRANDYWINE_NEPH.name,
    duswName: BRANDYWINE_DUSW.name,
    duswEmail: BRANDYWINE_DUSW.email,
    nephrologistName: BRANDYWINE_NEPH.name,
    nephrologistEmail: BRANDYWINE_NEPH.email,
    referralDate: daysAgoIso(9),
    stage: 'screening',
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
          "James, our screening team is reviewing your responses now. I'll follow up this week with next steps.",
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
    referringClinic: RIVERSIDE,
    referringClinician: RIVERSIDE_NEPH.name,
    duswName: RIVERSIDE_DUSW.name,
    duswEmail: RIVERSIDE_DUSW.email,
    nephrologistName: RIVERSIDE_NEPH.name,
    nephrologistEmail: RIVERSIDE_NEPH.email,
    referralDate: daysAgoIso(3),
    stage: 'initial-todos',
    daysInStage: 1,
    isStuck: false,
    todos: [
      ROI_SERVICES(id, 'completed', 20),
      ROI_MEDICAL(id, 'completed', 20),
      GOV_ID(id, 'pending'),
      INSURANCE(id, 'pending'),
      HEALTH_Q(id, 'pending'),
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
          "Welcome, Patricia! Thanks for signing the consent forms. Your next tasks are ready in your to-do list.",
        hoursAgo: 18,
        readByPatient: true,
      }),
    ],
    documents: [],
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
    referringClinic: RIVERSIDE,
    referringClinician: RIVERSIDE_NEPH.name,
    duswName: RIVERSIDE_DUSW.name,
    duswEmail: RIVERSIDE_DUSW.email,
    nephrologistName: RIVERSIDE_NEPH.name,
    nephrologistEmail: RIVERSIDE_NEPH.email,
    referralDate: daysAgoIso(26),
    stage: 'specialist-review',
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
          "Hi David — your file is with our dietitian this week for a quick review. I'll reach out once that step is complete.",
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
      email: 'grace.kim@email.com',
      phone: '(302) 555-0649',
      consented: true,
    },
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
  hasCompletedOnboarding: boolean;
}

export const createInitialState = (): InitialState => ({
  patients: [
    buildMaria(),
    buildRobert(),
    buildLinda(),
    buildJames(),
    buildPatricia(),
    buildDavid(),
    buildJack(),
  ],
  currentPatientId: null,
  currentStaffName: STAFF_NAME,
  currentClinicUser: INITIAL_CLINIC_USER,
  hasCompletedOnboarding: false,
});

export const STAFF_DISPLAY_TITLE = STAFF_TITLE;
