'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleHelp,
  Clock3,
  Cross,
  Eye,
  EyeOff,
  FileText,
  Heart,
  HeartPulse,
  House,
  ListChecks,
  Lock,
  Mail,
  MapPin,
  Paperclip,
  PenSquare,
  Phone,
  PlayCircle,
  Search,
  SendHorizontal,
  UserRound,
  Users,
} from 'lucide-react';
import { useStore } from '../../lib/store';
import { CLINIC_NAMES, findClinic } from '../../lib/clinicDirectory';
import type {
  DocumentRequest as StoreDocumentRequest,
  EmergencyContact as StoreEmergencyContact,
  Patient as StorePatient,
  PatientRegistrationResult,
  ScreeningResponses,
  Todo as StoreTodo,
} from '../../lib/types';
import {
  type Attachment,
  appendAttachmentSummary,
} from '../../lib/attachments';
import { AttachButton, AttachmentChips } from '../../components/ui/AttachmentRow';

type OnboardingStep =
  | 'entry'
  | 'servicesConsent'
  | 'medicalRecordsConsent'
  | 'communicationConsent'
  | 'carePartnerPrompt'
  | 'app';
type EntryAuthTab = 'register' | 'login';
type AppTab = 'home' | 'amelia' | 'messages' | 'profile' | 'help';
type MessagesIntent = 'openFirstUnread' | null;
type TodoStatus = 'pending' | 'completed';

type MockTodo = {
  id: string;
  title: string;
  description: string;
  status: TodoStatus;
  priority: 'high' | 'medium' | 'low';
  type:
    | 'governmentIdUpload'
    | 'insuranceCardUpload'
    | 'healthQuestionnaire'
    | 'carePartnerInvite'
    | 'educationVideo'
    | 'customStaffTodo';
  addedByStaff?: string;
  documentRequests?: StoreDocumentRequest[];
};

type QuestionnaireStep = 1 | 2;
type BinaryChoice = '' | 'yes' | 'no';
type TernaryChoice = '' | 'yes' | 'no' | 'notSure';
type SubstanceChoice = '' | 'yes' | 'no' | 'preferNotToAnswer';

type AssistantRole = 'assistant' | 'user' | 'system';
type StaffRole = 'patient' | 'dusw' | 'tc_employee';

type AssistantMessage = {
  id: string;
  role: AssistantRole;
  content: string;
  timestampLabel: string;
  navigationLabel?: string;
};

type CareThreadMessage = {
  id: string;
  senderName: string;
  senderRole: StaffRole;
  body: string;
  timestampLabel: string;
  isRead: boolean;
};

type CareThread = {
  id: string;
  subject: string;
  participantName: string;
  participantRole: Exclude<StaffRole, 'patient'>;
  participantOrganization: string;
  previewText: string;
  relativeTimeLabel: string;
  unreadCount: number;
  messages: CareThreadMessage[];
};

type ComposeAttachment = Attachment;

type QuickHelpChipData = {
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
};

type RegistrationPayload = {
  displayName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dob?: string;
  preferredLanguage?: 'English' | 'Spanish';
  referringClinic?: string;
  duswName?: string;
  duswEmail?: string;
  nephrologistName?: string;
  nephrologistEmail?: string;
};

type CarePartnerInvitePayload = {
  name: string;
  relationship: string;
  email: string;
  phone: string;
  consentGiven: boolean;
};

type CommunicationConsentPayload = {
  emailConsent: boolean;
  smsConsent: boolean;
  phoneConsent: boolean;
};

type RegistrationErrors = Partial<Record<
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'dialysisClinic'
  | 'socialWorker'
  | 'nephrologist',
  string
>>;

type SocialWorker = {
  id: string;
  fullName: string;
};

type ConsentSectionData = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  numbered?: Array<{ label: string; text: string }>;
  checkItems?: string[];
};

const PRIMARY = '#3399e6';
const PRIMARY_DARK = '#1a66cc';
const SAVED_USERNAME_KEY = 'mobile_prototype_saved_username';
const DEMO_PATIENT_EMAIL = 'jack.thompson@email.com';
const DEMO_PATIENT_NAME = 'Jack Thompson';
const MOCK_TODOS: MockTodo[] = [
  {
    id: 'todo-1',
    title: 'Upload Government ID',
    description: 'Upload a clear photo of the front side only.',
    status: 'pending',
    priority: 'high',
    type: 'governmentIdUpload',
  },
  {
    id: 'todo-2',
    title: 'Upload Insurance Card',
    description: 'Upload clear photos of both front and back.',
    status: 'pending',
    priority: 'medium',
    type: 'insuranceCardUpload',
  },
  {
    id: 'todo-3',
    title: 'Complete Health Questionnaire',
    description: 'Answer a few questions to help us prepare for your evaluation.',
    status: 'pending',
    priority: 'low',
    type: 'healthQuestionnaire',
  },
];

const HOME_VISIBLE_STORE_TYPES: ReadonlySet<StoreTodo['type']> = new Set([
  'upload-government-id',
  'upload-insurance-card',
  'complete-health-questionnaire',
  'add-emergency-contact',
  'watch-education-video',
  'custom',
]);

function mapStoreTodoToUi(todo: StoreTodo): MockTodo {
  const uiType: MockTodo['type'] =
    todo.type === 'upload-government-id'
      ? 'governmentIdUpload'
      : todo.type === 'upload-insurance-card'
        ? 'insuranceCardUpload'
        : todo.type === 'complete-health-questionnaire'
          ? 'healthQuestionnaire'
          : todo.type === 'add-emergency-contact'
            ? 'carePartnerInvite'
            : todo.type === 'watch-education-video'
              ? 'educationVideo'
              : 'customStaffTodo';
  const priority: MockTodo['priority'] =
    todo.type === 'upload-government-id'
      ? 'high'
      : todo.type === 'upload-insurance-card'
        ? 'medium'
        : todo.type === 'add-emergency-contact'
          ? 'low'
          : todo.type === 'watch-education-video'
            ? 'low'
            : todo.type === 'custom'
              ? 'medium'
              : 'low';
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    status: todo.status === 'completed' ? 'completed' : 'pending',
    priority,
    type: uiType,
    addedByStaff: todo.addedByStaff,
    documentRequests: todo.documentRequests,
  };
}

function storeTodosToUiList(todos: StoreTodo[]): MockTodo[] {
  return todos
    .filter((t) => HOME_VISIBLE_STORE_TYPES.has(t.type))
    .map(mapStoreTodoToUi);
}

const QUESTIONNAIRE_MONTH_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const QUESTIONNAIRE_YEAR_OPTIONS = Array.from({ length: 60 }, (_, index) => `${new Date().getFullYear() - index}`);
const QUESTIONNAIRE_HEIGHT_FEET_OPTIONS = ['3', '4', '5', '6', '7'];
const QUESTIONNAIRE_HEIGHT_INCH_OPTIONS = Array.from({ length: 12 }, (_, index) => `${index}`);

const QUICK_HELP_CHIPS: QuickHelpChipData[] = [
  { id: 'parking', title: 'Parking', icon: MapPin },
  { id: 'insurance', title: 'Insurance', icon: FileText },
  { id: 'wait-times', title: 'Wait times', icon: Clock3 },
  { id: 'evaluation-steps', title: 'Evaluation steps', icon: ListChecks },
];

type AmeliaAnswer = {
  id: string;
  keywords: string[];
  answer: string;
};

const AMELIA_ANSWERS: AmeliaAnswer[] = [
  {
    id: 'parking',
    keywords: ['parking', 'park', 'drive', 'directions', 'address', 'where'],
    answer:
      "The Transplant Center is at 4755 Ogletown-Stanton Rd, Newark, DE 19718. Free patient parking is in the Garage B deck just south of the main entrance — it's about a 3-minute walk to our office on the 2nd floor. Bring your appointment letter to show the attendant on your first visit.",
  },
  {
    id: 'insurance',
    keywords: ['insurance', 'accept', 'coverage', 'plan', 'payer', 'medicare', 'medicaid'],
    answer:
      "We accept most major plans including Medicare, Medicaid, Blue Cross Blue Shield, Aetna, UnitedHealthcare, and Highmark. Your coordinator will verify your specific plan before scheduling your first evaluation visit, so there are no billing surprises.",
  },
  {
    id: 'wait-times',
    keywords: ['how long', 'wait', 'time', 'listing', 'referral', 'listed'],
    answer:
      "On average, it takes 3–6 months from referral to being listed, assuming labs and records arrive promptly. Every case is different — some move faster, others take longer depending on specialist findings and donor matching.",
  },
  {
    id: 'self-referral',
    keywords: ['self', 'refer myself', 'self-referral', 'refer me', 'refer my'],
    answer:
      "Yes — ChristianaCare accepts self-referrals. You can call our Transplant Referral line at (302) 733-1240 and our team will walk you through next steps. You don't need a dialysis clinic to start the process for you.",
  },
  {
    id: 'recovery',
    keywords: ['recovery', 'post-transplant', 'after surgery', 'recover', 'hospital stay'],
    answer:
      "Typical hospital stay after transplant is 4–6 days. Most patients take it easy for 4–6 weeks before resuming normal activity, and return to work within 8–12 weeks. You'll be on immunosuppressive medications for life, with regular follow-up labs and clinic visits.",
  },
  {
    id: 'care-team',
    keywords: ['who is', 'contact', 'coordinator', 'transplant team', 'care team', 'reach'],
    answer:
      "Your senior transplant coordinator is Dr. Patricia Reeves, and your Front Desk contact is Sarah Martinez. You can message either of them directly from this app's Message Center, or call the front desk at (302) 733-1240 during business hours.",
  },
  {
    id: 'evaluation-steps',
    keywords: ['steps', 'evaluation', 'process', 'what happens', 'stages', 'workflow'],
    answer:
      "Your referral moves through onboarding, initial to-dos, initial screening, financial screening, records and clinical review, final decision, education, and scheduling. Your portal will show what you need to do next, and your care team will message you when a staff-owned step is moving forward.",
  },
];

const AMELIA_FALLBACK =
  "I can help with questions about parking, insurance, wait times, the evaluation process, recovery, and more. For anything specific to your case, please message your care team.";

const INITIAL_ASSISTANT_MESSAGES: AssistantMessage[] = [
  {
    id: 'assistant-1',
    role: 'assistant',
    content:
      "Hi, I'm **Amelia**, your ChristianaCare transplant guide! I'm here to answer your questions and walk you through every step of the kidney transplant process.\n\n**Your first step:** tap **Go to To-Do List** below. You have 4 tasks to complete before your evaluation — things like uploading your insurance card and completing a short health questionnaire. You can do them in any order, at your own pace.",
    timestampLabel: '9:14 AM',
    navigationLabel: 'Go to To-Do List',
  },
];

const INITIAL_CARE_THREADS: CareThread[] = [
  {
    id: 'thread-sw',
    subject: 'Lab Panel Follow-up',
    participantName: 'Sarah Johnson',
    participantRole: 'dusw',
    participantOrganization: 'Riverside Dialysis Unit',
    previewText: 'I can confirm which labs are still needed and share locations today.',
    relativeTimeLabel: '12m',
    unreadCount: 1,
    messages: [
      {
        id: 'sw-1',
        senderName: 'Sarah Johnson',
        senderRole: 'dusw',
        body: 'Hi Jeremy, I reviewed your chart this morning.',
        timestampLabel: '8:41 AM',
        isRead: true,
      },
      {
        id: 'sw-2',
        senderName: 'You',
        senderRole: 'patient',
        body: 'Thanks. Can you confirm what labs are still outstanding for transplant workup?',
        timestampLabel: '8:45 AM',
        isRead: true,
      },
      {
        id: 'sw-3',
        senderName: 'Sarah Johnson',
        senderRole: 'dusw',
        body:
          'Yes. You still need repeat HLA and updated hepatitis panel. I can send two nearby lab options and available hours.',
        timestampLabel: '8:49 AM',
        isRead: false,
      },
    ],
  },
  {
    id: 'thread-penn',
    subject: 'Cardiology Consult Scheduling',
    participantName: 'Jamie Chen',
    participantRole: 'tc_employee',
    participantOrganization: 'Penn Medicine Transplant Center',
    previewText: 'Monday at 10:30 AM is open. Would you like me to reserve it?',
    relativeTimeLabel: '1h',
    unreadCount: 2,
    messages: [
      {
        id: 'penn-1',
        senderName: 'Jamie Chen',
        senderRole: 'tc_employee',
        body: 'Your cardiology consult order has been received.',
        timestampLabel: '7:55 AM',
        isRead: true,
      },
      {
        id: 'penn-2',
        senderName: 'You',
        senderRole: 'patient',
        body: 'Great. What is your soonest available slot next week?',
        timestampLabel: '8:02 AM',
        isRead: true,
      },
      {
        id: 'penn-3',
        senderName: 'Jamie Chen',
        senderRole: 'tc_employee',
        body: 'Monday at 10:30 AM is open. Would you like me to reserve it?',
        timestampLabel: '8:07 AM',
        isRead: false,
      },
      {
        id: 'penn-4',
        senderName: 'Jamie Chen',
        senderRole: 'tc_employee',
        body: 'Please also bring your current medication list and insurance card.',
        timestampLabel: '8:08 AM',
        isRead: false,
      },
    ],
  },
  {
    id: 'thread-hopkins',
    subject: 'CT Scan Result Upload',
    participantName: 'Luis Martinez',
    participantRole: 'tc_employee',
    participantOrganization: 'Johns Hopkins Transplant Program',
    previewText: 'Uploaded file received. We will post your review notes by tomorrow.',
    relativeTimeLabel: '1d',
    unreadCount: 0,
    messages: [
      {
        id: 'hopkins-1',
        senderName: 'You',
        senderRole: 'patient',
        body: 'I uploaded my CT scan report to Documents. Can you confirm receipt?',
        timestampLabel: 'Yesterday, 2:12 PM',
        isRead: true,
      },
      {
        id: 'hopkins-2',
        senderName: 'Luis Martinez',
        senderRole: 'tc_employee',
        body: 'Received. Thank you. We will share your review notes by tomorrow afternoon.',
        timestampLabel: 'Yesterday, 2:36 PM',
        isRead: true,
      },
    ],
  },
];

const TITLE_OPTIONS = ['', 'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'];
const DIALYSIS_CLINICS: string[] = ['', ...CLINIC_NAMES];

const SERVICES_CONSENT_SECTIONS: ConsentSectionData[] = [
  {
    heading: 'INTRODUCTION',
    paragraphs: [
      'This document constitutes an agreement between you (the "Patient") and Transplant Wizard, LLC ("Transplant Wizard," "we," "us," or "our") regarding the use of our transplant coordination and referral services.',
    ],
  },
  {
    heading: 'DESCRIPTION OF SERVICES',
    paragraphs: [
      'Transplant Wizard provides a digital platform designed to assist patients in navigating the kidney transplant referral process. Our services include:',
    ],
    bullets: [
      'Facilitating communication between patients, dialysis social workers, and transplant centers',
      'Secure document collection and transmission',
      'Transplant center selection assistance',
      'Care coordination and progress tracking',
      'Educational resources about the transplant process',
    ],
  },
  {
    heading: 'IMPORTANT DISCLAIMERS',
    paragraphs: ['By using Transplant Wizard services, you acknowledge and understand that:'],
    numbered: [
      {
        label: '1.',
        text: 'Transplant Wizard does NOT provide medical advice, diagnosis, or treatment. We are a coordination service only.',
      },
      {
        label: '2.',
        text: 'All medical decisions regarding your transplant care should be made in consultation with your healthcare providers.',
      },
      {
        label: '3.',
        text: 'Use of our services does not guarantee acceptance by any transplant center or placement on a transplant waiting list.',
      },
      {
        label: '4.',
        text: 'You remain responsible for attending appointments and complying with transplant center requirements.',
      },
    ],
  },
  {
    heading: 'DATA SECURITY',
    paragraphs: [
      'We are committed to protecting your personal health information in accordance with the Health Insurance Portability and Accountability Act (HIPAA) and applicable state laws. Your information is encrypted, securely stored, and only shared with authorized parties as specified in the Medical Records Consent Form.',
    ],
  },
  {
    heading: 'VOLUNTARY PARTICIPATION',
    paragraphs: [
      'Your participation in Transplant Wizard services is entirely voluntary. You may withdraw your consent and discontinue use of our services at any time by contacting us at support@transplantwizard.com. Withdrawal will not affect your eligibility for transplant evaluation through other means.',
    ],
  },
  {
    heading: 'CONSENT ACKNOWLEDGMENT',
    paragraphs: ['By signing below, I acknowledge that:'],
    checkItems: [
      'I have read and understand this consent form',
      'I voluntarily agree to use Transplant Wizard services',
      'I understand that Transplant Wizard does not provide medical advice',
      'I agree to the terms and conditions outlined above',
    ],
  },
];

const MEDICAL_CONSENT_SECTIONS: ConsentSectionData[] = [
  {
    heading: 'PURPOSE OF AUTHORIZATION',
    paragraphs: [
      'I hereby authorize the use and/or disclosure of my individually identifiable health information as described below. This authorization is made in compliance with the Health Insurance Portability and Accountability Act of 1996 (HIPAA) Privacy Rule.',
    ],
  },
  {
    heading: 'INFORMATION TO BE DISCLOSED',
    paragraphs: ['I authorize the release of the following protected health information (PHI):'],
    bullets: [
      'Medical records related to kidney disease, dialysis treatment, and transplant evaluation',
      'Laboratory results including blood tests, urinalysis, and tissue typing',
      'Diagnostic imaging reports and results',
      'Medication lists and pharmacy records',
      'Clinical notes and physician summaries',
      'Social work assessments and psychosocial evaluations',
      'Insurance and financial clearance documentation',
      'Immunization records',
    ],
  },
  {
    heading: 'AUTHORIZED PARTIES',
    paragraphs: ['I authorize disclosure of my PHI to and from the following parties:'],
    numbered: [
      {
        label: '1.',
        text: 'Transplant Centers: Selected transplant programs for evaluation and listing purposes',
      },
      {
        label: '2.',
        text: 'Dialysis Unit Social Workers (DUSW): For care coordination and document management',
      },
      {
        label: '3.',
        text: 'Healthcare Providers: Physicians, specialists, and care teams involved in my transplant evaluation',
      },
      {
        label: '4.',
        text: 'Transplant Wizard: For secure transmission and coordination of medical information',
      },
    ],
  },
  {
    heading: 'DURATION OF AUTHORIZATION',
    paragraphs: [
      'This authorization shall remain in effect for a period of twenty-four (24) months from the date of signature, unless revoked earlier in writing by the patient or patient\'s legal representative.',
    ],
  },
  {
    heading: 'RIGHT TO REVOKE',
    paragraphs: [
      'I understand that I have the right to revoke this authorization at any time by submitting a written request to Transplant Wizard at support@transplantwizard.com. I understand that revocation will not affect any actions taken in reliance on this authorization prior to receipt of my written revocation.',
    ],
  },
  {
    heading: 'REDISCLOSURE NOTICE',
    paragraphs: [
      'I understand that once my health information is disclosed pursuant to this authorization, it may no longer be protected by federal privacy regulations and could potentially be redisclosed by the recipient.',
    ],
  },
  {
    heading: 'VOLUNTARY AUTHORIZATION',
    paragraphs: ['I understand that:'],
    checkItems: [
      'This authorization is voluntary',
      'I may refuse to sign this authorization',
      'My treatment will not be conditioned on signing this authorization',
      'I am entitled to receive a copy of this signed authorization',
    ],
  },
  {
    heading: 'ACKNOWLEDGMENT',
    paragraphs: [
      'By signing below, I certify that I have read and understand this Authorization for Release of Protected Health Information, and I voluntarily consent to the disclosure of my health information as described herein.',
    ],
  },
];

const SIMULATED_SIGNATURE_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="90" viewBox="0 0 320 90">
     <rect width="320" height="90" fill="#f8fafc"/>
     <path d="M22 64 C45 18, 80 86, 116 34 C133 12, 168 74, 205 30 C228 5, 267 78, 298 26" stroke="#111827" stroke-width="2.4" fill="none" stroke-linecap="round"/>
     <text x="24" y="83" font-size="11" fill="#64748b" font-family="Arial, sans-serif">/s/ Jeremy Rolls</text>
   </svg>`
)}`;

const APP_TABS: Array<{
  id: AppTab;
  title: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: 'home', title: 'Home', icon: House },
  { id: 'amelia', title: 'Assistant', icon: Brain },
  { id: 'messages', title: 'Messages', icon: Mail },
  { id: 'profile', title: 'Profile', icon: UserRound },
  { id: 'help', title: 'Help', icon: CircleHelp },
];

function useHasHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    if (useStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

export default function MobilePrototypePage() {
  const hasHydrated = useHasHydrated();
  const currentPatientId = useStore((s) => s.currentPatientId);
  const patients = useStore((s) => s.patients);
  const completeTodoAction = useStore((s) => s.completeTodo);
  const uploadDocumentAction = useStore((s) => s.uploadDocument);
  const addEmergencyContactTodoAction = useStore((s) => s.addEmergencyContactTodo);
  const addEducationTodoAction = useStore((s) => s.addEducationTodo);
  const ensureInitialTodosAction = useStore((s) => s.ensureInitialTodos);
  const setCurrentPatientAction = useStore((s) => s.setCurrentPatient);
  const registerSelfAction = useStore((s) => s.registerSelf);
  const authenticatePatientAction = useStore((s) => s.authenticatePatient);
  const saveCommunicationConsentsAction = useStore((s) => s.saveCommunicationConsents);
  const saveEmergencyContactAction = useStore((s) => s.saveEmergencyContact);
  const markOnboardingCompleteAction = useStore((s) => s.markOnboardingComplete);
  const setLastPatientTabAction = useStore((s) => s.setLastPatientTab);
  const saveScreeningResponsesAction = useStore((s) => s.saveScreeningResponses);

  const currentPatient: StorePatient | null =
    currentPatientId ? patients.find((p) => p.id === currentPatientId) ?? null : null;
  const demoPatient = patients.find((p) => p.id === 'patient-jack') ?? null;
  const patientId = currentPatient?.id ?? '';

  const seededEmail = demoPatient?.email ?? DEMO_PATIENT_EMAIL;
  const seededDisplayName = demoPatient
    ? `${demoPatient.firstName} ${demoPatient.lastName}`
    : DEMO_PATIENT_NAME;

  const [rememberedUsername] = useState(() =>
    typeof window === 'undefined' ? '' : (window.localStorage.getItem(SAVED_USERNAME_KEY) ?? '')
  );
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('entry');
  const [entryAuthTab, setEntryAuthTab] = useState<EntryAuthTab>('register');
  const [username, setUsername] = useState(seededEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registeredDisplayName, setRegisteredDisplayName] = useState(seededDisplayName);
  const [registeredEmail, setRegisteredEmail] = useState(seededEmail);
  const [justRegistered, setJustRegistered] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState<AppTab>(
    () => useStore.getState().lastPatientTab ?? 'home'
  );
  const [messagesIntent, setMessagesIntent] = useState<MessagesIntent>(null);
  const [displayName, setDisplayName] = useState(seededDisplayName);
  const [showCoordinatorIntro, setShowCoordinatorIntro] = useState(false);

  // Once persistence finishes hydrating, restore a signed-in patient session
  // only when that patient has a registered portal account. Otherwise keep the
  // tester on the register-first entry screen.
  useEffect(() => {
    if (!hasHydrated) return;
    const state = useStore.getState();
    const signedInPatient = state.currentPatientId
      ? state.patients.find((p) => p.id === state.currentPatientId && p.portalAccount)
      : undefined;
    if (signedInPatient) {
      const signedInName = `${signedInPatient.firstName} ${signedInPatient.lastName}`.trim();
      setDisplayName(signedInName || deriveDisplayName(signedInPatient.email));
      setRegisteredDisplayName(signedInName || deriveDisplayName(signedInPatient.email));
      setRegisteredEmail(signedInPatient.portalAccount?.username ?? signedInPatient.email);
      setUsername(signedInPatient.portalAccount?.username ?? signedInPatient.email);
      setOnboardingStep(signedInPatient.hasCompletedOnboarding ? 'app' : 'servicesConsent');
      setShowCoordinatorIntro(!signedInPatient.hasCompletedOnboarding);
      if (state.lastPatientTab) {
        setActiveTab(state.lastPatientTab);
      }
      return;
    }

    const rememberedPatient = rememberedUsername
      ? state.patients.find(
          (p) => p.portalAccount?.username === rememberedUsername.trim().toLowerCase()
        )
      : undefined;
    if (rememberedPatient?.portalAccount) {
      setUsername(rememberedPatient.portalAccount.username);
      setRegisteredEmail(rememberedPatient.portalAccount.username);
      setRememberMe(true);
      setEntryAuthTab('login');
    } else {
      setUsername(seededEmail);
      setRegisteredEmail(seededEmail);
      setRememberMe(false);
      setEntryAuthTab('register');
      if (rememberedUsername) {
        window.localStorage.removeItem(SAVED_USERNAME_KEY);
      }
    }
    setOnboardingStep('entry');
    setShowCoordinatorIntro(false);
    if (state.currentPatientId) {
      setCurrentPatientAction(null);
    }
    if (state.lastPatientTab) {
      setActiveTab(state.lastPatientTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated]);

  // Persist the active tab whenever it changes so a refresh lands the user
  // back on the same tab they were viewing.
  useEffect(() => {
    if (!hasHydrated) return;
    if (onboardingStep !== 'app') return;
    setLastPatientTabAction(activeTab);
  }, [activeTab, hasHydrated, onboardingStep, setLastPatientTabAction]);

  const todos = useMemo<MockTodo[]>(
    () => (currentPatient ? storeTodosToUiList(currentPatient.todos) : []),
    [currentPatient]
  );

  const topBarTitleByTab: Record<AppTab, string> = {
    home: 'Home',
    amelia: 'Assistant',
    messages: 'Messages',
    profile: 'Profile',
    help: 'Help',
  };

  const canSubmitLogin = username.trim().length > 0 && password.trim().length > 0;
  const pendingTodos = useMemo(() => todos.filter((todo) => todo.status === 'pending'), [todos]);
  const completedTodos = useMemo(() => todos.filter((todo) => todo.status === 'completed'), [todos]);

  // Education is a later workflow stage. Initial intake tasks move the case
  // forward for staff review; the education video only appears once staff has
  // advanced the patient to Education.
  useEffect(() => {
    if (!hasHydrated) return;
    if (onboardingStep !== 'app') return;
    if (!currentPatient) return;
    if (currentPatient.stage !== 'education') return;
    const hasEducation = currentPatient.todos.some((t) => t.type === 'watch-education-video');
    if (hasEducation) return;
    addEducationTodoAction(currentPatient.id);
  }, [hasHydrated, onboardingStep, currentPatient, addEducationTodoAction]);

  function deriveDisplayName(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return 'Jeremy Rolls';
    const candidate = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
    return candidate
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmitLogin) return;

    const authResult = authenticatePatientAction(username, password);
    if (!authResult.ok) {
      setLoginError(
        authResult.reason === 'missing-account'
          ? 'Register first to create a demo account for this email, then sign in with that password.'
          : 'That password does not match this demo account.'
      );
      setPassword('');
      setJustRegistered(false);
      return;
    }

    if (rememberMe) {
      window.localStorage.setItem(SAVED_USERNAME_KEY, username.trim());
    } else {
      window.localStorage.removeItem(SAVED_USERNAME_KEY);
    }

    const signedInPatient = useStore.getState().patients.find((p) => p.id === authResult.patientId);
    const signedInName = signedInPatient
      ? `${signedInPatient.firstName} ${signedInPatient.lastName}`.trim()
      : '';
    setDisplayName(signedInName || registeredDisplayName || deriveDisplayName(username));
    setRegisteredDisplayName(signedInName || registeredDisplayName || deriveDisplayName(username));
    setRegisteredEmail(signedInPatient?.portalAccount?.username ?? username.trim());
    setActiveTab('home');
    if (signedInPatient?.hasCompletedOnboarding) {
      setOnboardingStep('app');
      setShowCoordinatorIntro(false);
    } else {
      setOnboardingStep('servicesConsent');
      setShowCoordinatorIntro(true);
    }
    setPassword('');
    setJustRegistered(false);
    setLoginError('');
  }

  function handleRegistrationComplete(payload: RegistrationPayload): PatientRegistrationResult {
    const result = registerSelfAction({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      password: payload.password,
      phone: payload.phone,
      dob: payload.dob,
      preferredLanguage: payload.preferredLanguage,
      referringClinic: payload.referringClinic,
      duswName: payload.duswName,
      duswEmail: payload.duswEmail,
      nephrologistName: payload.nephrologistName,
      nephrologistEmail: payload.nephrologistEmail,
    });
    if (!result.ok) return result;

    setRegisteredDisplayName(payload.displayName);
    setRegisteredEmail(payload.email);
    setUsername(payload.email);
    setPassword('');
    setShowPassword(false);
    setEntryAuthTab('login');
    setOnboardingStep('entry');
    setJustRegistered(true);
    setLoginError('');
    return result;
  }

  function handleSignOut() {
    setCurrentPatientAction(null);
    setOnboardingStep('entry');
    setEntryAuthTab('login');
    setUsername(registeredEmail);
    setPassword('');
    setLoginError('');
    setActiveTab('home');
    setMessagesIntent(null);
    setShowCoordinatorIntro(false);
  }

  function saveEmergencyContactFromPayload(payload: CarePartnerInvitePayload) {
    const contact: StoreEmergencyContact = {
      name: payload.name,
      relationship: payload.relationship,
      email: payload.email,
      phone: payload.phone,
      consented: payload.consentGiven,
    };
    saveEmergencyContactAction(patientId, contact);
  }

  function handleTodoComplete(
    todoId: string,
    screeningResponses?: ScreeningResponses,
    emergencyContact?: CarePartnerInvitePayload
  ) {
    const todo = currentPatient?.todos.find((t) => t.id === todoId);
    if (!todo) return;
    if (todo.type === 'complete-health-questionnaire' && screeningResponses) {
      saveScreeningResponsesAction(patientId, screeningResponses);
    }
    if (todo.type === 'add-emergency-contact' && emergencyContact) {
      saveEmergencyContactFromPayload(emergencyContact);
    }
    completeTodoAction(patientId, todoId);
  }

  function handleTodoDocumentUpload(documentName: string) {
    if (!patientId) return;
    uploadDocumentAction(patientId, documentName, 'patient');
  }

  function handleOpenUnreadMessage() {
    setActiveTab('messages');
    setMessagesIntent('openFirstUnread');
  }

  function handleEnterApp() {
    if (!currentPatient) return;
    ensureInitialTodosAction(patientId);
    markOnboardingCompleteAction(patientId);
    setOnboardingStep('app');
  }

  function handleCommunicationConsentComplete(consents: CommunicationConsentPayload) {
    if (!currentPatient) return;
    saveCommunicationConsentsAction(patientId, consents);
    setOnboardingStep('carePartnerPrompt');
  }

  return (
    <div className="relative min-h-[100dvh] bg-[#f0f5fb] sm:p-6">
      <Link
        href="/"
        className="absolute right-4 top-4 z-20 hidden items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 sm:right-6 sm:top-6 sm:inline-flex"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Demo home
      </Link>
      <div className="mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#f4f7fb] sm:h-[880px] sm:rounded-[34px] sm:shadow-[0_28px_60px_rgba(15,23,42,0.24)]">
        {!hasHydrated ? (
          <div className="flex-1" aria-hidden />
        ) : onboardingStep !== 'app' ? (
          <>
            {onboardingStep === 'entry' && (
              <EntryAuthScreen
                authTab={entryAuthTab}
                canSubmit={canSubmitLogin}
                justRegistered={justRegistered}
                loginError={loginError}
                onAuthTabChange={setEntryAuthTab}
                onCreateAccount={handleRegistrationComplete}
                onSignIn={handleSignIn}
                password={password}
                prefilledEmail={registeredEmail}
                rememberMe={rememberMe}
                setPassword={(value) => {
                  setPassword(value);
                  setLoginError('');
                }}
                setRememberMe={setRememberMe}
                setShowPassword={setShowPassword}
                setUsername={(value) => {
                  setUsername(value);
                  setLoginError('');
                }}
                showPassword={showPassword}
                username={username}
              />
            )}
            {onboardingStep === 'servicesConsent' && (
              <ServicesConsentScreen onComplete={() => setOnboardingStep('medicalRecordsConsent')} />
            )}
            {onboardingStep === 'medicalRecordsConsent' && (
              <MedicalRecordsConsentScreen onComplete={() => setOnboardingStep('communicationConsent')} />
            )}
            {onboardingStep === 'communicationConsent' && (
              <CommunicationConsentScreen
                email={currentPatient?.email ?? username}
                phone={currentPatient?.phone ?? ''}
                onComplete={handleCommunicationConsentComplete}
              />
            )}
            {onboardingStep === 'carePartnerPrompt' && (
              <CarePartnerPromptScreen
                onInvite={(payload) => {
                  saveEmergencyContactFromPayload(payload);
                  handleEnterApp();
                }}
                onSkip={() => {
                  if (!currentPatient) return;
                  ensureInitialTodosAction(patientId);
                  addEmergencyContactTodoAction(patientId);
                  markOnboardingCompleteAction(patientId);
                  setOnboardingStep('app');
                }}
              />
            )}
          </>
        ) : (
          <div className="relative flex min-h-0 flex-1 flex-col bg-[#f4f7fb]">
            <header className="flex items-center justify-between border-b border-[#e3ebf5] bg-white px-4 py-4">
              <button
                type="button"
                className="relative rounded-full border border-[#dde7f2] p-2 text-slate-700"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 rounded-full bg-[#ef4444] px-1.5 text-[10px] font-bold text-white">
                  3
                </span>
              </button>

              <h1 className="text-base font-semibold text-slate-900">{topBarTitleByTab[activeTab]}</h1>

              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-full border border-[#dde7f2] px-3 py-1 text-xs font-semibold text-slate-600"
              >
                Sign Out
              </button>
            </header>

            <div
              className={
                activeTab === 'amelia'
                  ? 'flex min-h-0 flex-1 flex-col'
                  : 'min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-5'
              }
            >
              {activeTab === 'home' && (
                <HomeTab
                  completedTodos={completedTodos}
                  displayName={displayName}
                  onCompleteTodo={handleTodoComplete}
                  onDocumentUpload={handleTodoDocumentUpload}
                  onOpenUnreadMessage={handleOpenUnreadMessage}
                  pendingTodos={pendingTodos}
                  patient={currentPatient}
                />
              )}
              {activeTab === 'amelia' && (
                <VirtualAssistantTab
                  onGoToTodoList={() => {
                    setActiveTab('home');
                  }}
                />
              )}
              {activeTab === 'messages' && (
                <MessagesTab
                  intent={messagesIntent}
                  patient={currentPatient}
                />
              )}
              {activeTab === 'profile' && <ProfileTab displayName={displayName} username={username} />}
              {activeTab === 'help' && <HelpTab />}
            </div>

            <nav className="absolute bottom-0 left-0 right-0 border-t border-[#dce7f2] bg-white px-1.5 py-2">
              <ul className="grid grid-cols-5 gap-0.5">
                {APP_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = tab.id === activeTab;

                  return (
                    <li key={tab.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab(tab.id);
                          if (tab.id !== 'messages') setMessagesIntent(null);
                        }}
                        className={`flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 ${
                          isActive ? 'bg-[#eaf4fc] text-[#1a66cc]' : 'text-slate-500'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-[10px] font-semibold leading-none">{tab.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {showCoordinatorIntro && (
              <CoordinatorIntroOverlay
                displayName={displayName}
                onContinue={() => {
                  setShowCoordinatorIntro(false);
                  setActiveTab('amelia');
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type EntryAuthScreenProps = {
  authTab: EntryAuthTab;
  canSubmit: boolean;
  justRegistered: boolean;
  loginError: string;
  onAuthTabChange: (tab: EntryAuthTab) => void;
  onCreateAccount: (payload: RegistrationPayload) => PatientRegistrationResult;
  onSignIn: (event: FormEvent<HTMLFormElement>) => void;
  password: string;
  prefilledEmail: string;
  rememberMe: boolean;
  setPassword: (value: string) => void;
  setRememberMe: (value: boolean) => void;
  setShowPassword: (value: boolean | ((prev: boolean) => boolean)) => void;
  setUsername: (value: string) => void;
  showPassword: boolean;
  username: string;
};

function EntryAuthScreen({
  authTab,
  canSubmit,
  justRegistered,
  loginError,
  onAuthTabChange,
  onCreateAccount,
  onSignIn,
  password,
  prefilledEmail,
  rememberMe,
  setPassword,
  setRememberMe,
  setShowPassword,
  setUsername,
  showPassword,
  username,
}: EntryAuthScreenProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-br from-[#f2f7ff] via-[#ecf3ff] to-[#e2edf8] px-5 pb-6 pt-10">
      <div className="mb-7 mt-3 flex flex-col items-center gap-3 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#3399e6] shadow-[0_10px_24px_rgba(51,153,230,0.35)]">
          <Heart className="h-10 w-10 fill-white text-white" />
        </div>
        <div>
          <h1 className="text-[31px] font-bold tracking-tight text-slate-900">Patient Portal</h1>
          <p className="mt-1 text-sm text-slate-500">Your journey to a new beginning</p>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-[#cfe4fb] bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm">
        <p className="font-semibold text-slate-900">Demo patient: Jack Thompson</p>
        <p className="mt-1 text-xs leading-relaxed">
          Register first with {DEMO_PATIENT_EMAIL}, create any password that meets the rules,
          then sign in with those same credentials.
        </p>
      </div>

      <div className="mb-4 rounded-full bg-white p-1 shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => onAuthTabChange('login')}
            className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
              authTab === 'login' ? 'bg-[#3399e6] text-white' : 'text-slate-500'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => onAuthTabChange('register')}
            className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
              authTab === 'register' ? 'bg-[#3399e6] text-white' : 'text-slate-500'
            }`}
          >
            Register
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[24px] bg-white/95 p-4 shadow-[0_20px_40px_rgba(15,23,42,0.11)]">
        {authTab === 'login' ? (
          <LoginScreen
            canSubmit={canSubmit}
            justRegistered={justRegistered}
            errorMessage={loginError}
            onSignIn={onSignIn}
            password={password}
            prefilledEmail={prefilledEmail}
            rememberMe={rememberMe}
            setPassword={setPassword}
            setRememberMe={setRememberMe}
            setShowPassword={setShowPassword}
            setUsername={setUsername}
            showPassword={showPassword}
            username={username}
          />
        ) : (
          <RegistrationScreen onCreateAccount={onCreateAccount} prefilledEmail={prefilledEmail} />
        )}
      </div>
    </div>
  );
}

type LoginScreenProps = {
  canSubmit: boolean;
  errorMessage: string;
  justRegistered: boolean;
  onSignIn: (event: FormEvent<HTMLFormElement>) => void;
  password: string;
  prefilledEmail: string;
  rememberMe: boolean;
  setPassword: (value: string) => void;
  setRememberMe: (value: boolean) => void;
  setShowPassword: (value: boolean | ((prev: boolean) => boolean)) => void;
  setUsername: (value: string) => void;
  showPassword: boolean;
  username: string;
};

function LoginScreen({
  canSubmit,
  errorMessage,
  justRegistered,
  onSignIn,
  password,
  prefilledEmail,
  rememberMe,
  setPassword,
  setRememberMe,
  setShowPassword,
  setUsername,
  showPassword,
  username,
}: LoginScreenProps) {
  return (
    <div className="h-full overflow-y-auto pr-1">
      {justRegistered && (
        <div className="mb-4 rounded-xl bg-[#edf5ff] px-3 py-2 text-xs text-[#2a6ead]">
          Account created. Sign in using the email and password you just registered.
        </div>
      )}
      {!justRegistered && prefilledEmail && (
        <div className="mb-4 rounded-xl bg-[#edf5ff] px-3 py-2 text-xs text-[#2a6ead]">
          Already registered? Sign in with your email and password. First time here? Use Register first.
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      <form className="space-y-4" onSubmit={onSignIn}>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email Address</span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your email"
                className="h-11 w-full rounded-xl border border-[#d8e4f1] pl-10 pr-3 text-sm text-slate-900 outline-none ring-offset-2 transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
              />
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="h-11 w-full rounded-xl border border-[#d8e4f1] pl-10 pr-11 text-sm text-slate-900 outline-none ring-offset-2 transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setRememberMe(!rememberMe)}
              className="inline-flex items-center gap-2 text-slate-600"
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border ${
                  rememberMe ? 'border-[#3399e6] bg-[#3399e6] text-white' : 'border-slate-300 text-transparent'
                }`}
              >
                ✓
              </span>
              Remember me
            </button>
            <button type="button" className="font-medium text-[#1a66cc]">
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className={`mt-2 inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition ${
              canSubmit ? 'bg-[#3399e6] shadow-[0_10px_24px_rgba(51,153,230,0.35)]' : 'bg-slate-300'
            }`}
          >
            Sign In
          </button>
      </form>
    </div>
  );
}

function RegistrationScreen({
  onCreateAccount,
  prefilledEmail,
}: {
  onCreateAccount: (payload: RegistrationPayload) => PatientRegistrationResult;
  prefilledEmail: string;
}) {
  const findPatientByEmail = useStore((s) => s.findPatientByEmail);
  const [selectedTitleIndex, setSelectedTitleIndex] = useState(0);
  const [firstName, setFirstName] = useState('Jack');
  const [lastName, setLastName] = useState('Thompson');
  const [email, setEmail] = useState(prefilledEmail);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [primaryCarePhysician, setPrimaryCarePhysician] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [selectedDialysisClinic, setSelectedDialysisClinic] = useState(0);
  const [selectedSocialWorker, setSelectedSocialWorker] = useState(0);
  const [selectedNephrologist, setSelectedNephrologist] = useState(0);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RegistrationErrors>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [matchedReferral, setMatchedReferral] = useState<StorePatient | null>(null);

  const selectedClinicName = DIALYSIS_CLINICS[selectedDialysisClinic] ?? '';
  const selectedClinicEntry = findClinic(selectedClinicName);
  const availableWorkers = selectedClinicEntry?.socialWorkers ?? [];
  const availableNephrologists = selectedClinicEntry?.nephrologists ?? [];

  function isValidEmailLocal(value: string) {
    return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value);
  }

  // Detect existing clinic referral by email and prefill associated fields.
  useEffect(() => {
    const trimmed = email.trim();
    if (!isValidEmailLocal(trimmed)) {
      setMatchedReferral(null);
      return;
    }
    const handle = window.setTimeout(() => {
      const found = findPatientByEmail(trimmed);
      if (found && found.referralSource === 'clinic' && !found.portalAccount) {
        setMatchedReferral(found);
      } else {
        setMatchedReferral(null);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [email, findPatientByEmail]);

  useEffect(() => {
    if (!matchedReferral) return;
    if ((!firstName.trim() || firstName === 'Jack') && matchedReferral.firstName) {
      setFirstName(matchedReferral.firstName);
    }
    if ((!lastName.trim() || lastName === 'Thompson') && matchedReferral.lastName) {
      setLastName(matchedReferral.lastName);
    }
    if (matchedReferral.referringClinic) {
      const idx = DIALYSIS_CLINICS.indexOf(matchedReferral.referringClinic);
      if (idx > 0) setSelectedDialysisClinic(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedReferral]);

  const passwordChecks = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };

  function validateForm() {
    const errors: RegistrationErrors = {};

    if (!firstName.trim()) errors.firstName = 'First name is required';
    if (!lastName.trim()) errors.lastName = 'Last name is required';
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!isValidEmailLocal(email.trim())) {
      errors.email = 'Please enter a valid email address';
    } else if (findPatientByEmail(email.trim())?.portalAccount) {
      errors.email = 'An account already exists for this email. Use Sign In with the password you created.';
    }
    const requiresClinicAssignments = !matchedReferral && selectedDialysisClinic > 0;
    if (requiresClinicAssignments && selectedSocialWorker === 0) {
      errors.socialWorker = 'Select your assigned social worker';
    }
    if (requiresClinicAssignments && selectedNephrologist === 0) {
      errors.nephrologist = 'Select your nephrologist';
    }
    if (!password) {
      errors.password = 'Password is required';
    } else if (!Object.values(passwordChecks).every(Boolean)) {
      errors.password = 'Password must meet all requirements';
    }
    if (confirmPassword !== password) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setErrorMessage('Please correct the errors below');
      return false;
    }

    setErrorMessage('');
    return true;
  }

  function handleCreateAccount() {
    if (!validateForm()) return;

    setIsLoading(true);
    window.setTimeout(() => {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      setIsLoading(false);

      // Resolve clinic-related selections (or use the matched referral's data).
      let clinicName: string | undefined;
      let duswName: string | undefined;
      let duswEmail: string | undefined;
      let nephName: string | undefined;
      let nephEmail: string | undefined;

      if (matchedReferral) {
        clinicName = matchedReferral.referringClinic;
        duswName = matchedReferral.duswName;
        duswEmail = matchedReferral.duswEmail;
        nephName = matchedReferral.nephrologistName;
        nephEmail = matchedReferral.nephrologistEmail;
      } else if (selectedClinicEntry) {
        clinicName = selectedClinicEntry.name;
        const sw = availableWorkers[selectedSocialWorker - 1];
        if (sw) {
          duswName = sw.name;
          duswEmail = sw.email;
        }
        const neph = availableNephrologists[selectedNephrologist - 1];
        if (neph) {
          nephName = neph.name;
          nephEmail = neph.email;
        }
      }

      const result = onCreateAccount({
        displayName: fullName || 'Jeremy Rolls',
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phoneNumber.trim() || undefined,
        dob: dateOfBirth || undefined,
        preferredLanguage: 'English',
        referringClinic: clinicName,
        duswName,
        duswEmail,
        nephrologistName: nephName,
        nephrologistEmail: nephEmail,
      });
      if (!result.ok) {
        setFieldErrors({
          email: 'An account already exists for this email. Use Sign In with the password you created.',
        });
        setErrorMessage('This email already has a demo account.');
      }
    }, 700);
  }

  return (
    <div className="h-full overflow-y-auto pr-1">
      <div className="space-y-5 pb-2">
        <div className="space-y-1 text-center">
          <h2 className="text-2xl font-bold text-slate-900">Create Your Account</h2>
          <p className="text-sm text-slate-500">Register once, then sign in with this email and password.</p>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <RegistrationSection icon={UserRound} title="Personal Information">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Title</span>
            <select
              value={selectedTitleIndex}
              onChange={(event) => setSelectedTitleIndex(Number(event.target.value))}
              className="h-11 w-full rounded-lg bg-[#f0f3f7] px-3 text-sm text-slate-800 outline-none ring-offset-2 focus:ring-2 focus:ring-[#cfe7fd]"
            >
              {TITLE_OPTIONS.map((title, index) => (
                <option key={`${title}-${index}`} value={index}>
                  {title || 'Select title'}
                </option>
              ))}
            </select>
          </label>

          <RegistrationInput
            label="First Name *"
            value={firstName}
            onChange={setFirstName}
            placeholder="Enter your first name"
            error={fieldErrors.firstName}
          />
          <RegistrationInput
            label="Last Name *"
            value={lastName}
            onChange={setLastName}
            placeholder="Enter your last name"
            error={fieldErrors.lastName}
          />

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Date of Birth</span>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="h-11 w-full rounded-lg bg-[#f0f3f7] pl-10 pr-3 text-sm text-slate-800 outline-none ring-offset-2 focus:ring-2 focus:ring-[#cfe7fd]"
              />
            </div>
          </label>
        </RegistrationSection>

          <RegistrationSection icon={Phone} title="Contact Information">
            <RegistrationInput
              label="Email Address *"
              value={email}
              onChange={setEmail}
              placeholder="Enter your email address"
              error={fieldErrors.email}
            />
            <RegistrationInput
              label="Phone Number"
              value={phoneNumber}
              onChange={setPhoneNumber}
              placeholder="+1 (555) 123-4567"
            />
            <RegistrationTextArea
              label="Address"
              value={address}
              onChange={setAddress}
              placeholder="Enter your home address"
            />
          </RegistrationSection>

          <RegistrationSection icon={HeartPulse} title="Medical Information (Optional)">
            <RegistrationInput
              label="Primary Care Physician"
              value={primaryCarePhysician}
              onChange={setPrimaryCarePhysician}
              placeholder="Dr. John Smith"
            />
            <RegistrationInput
              label="Insurance Provider"
              value={insuranceProvider}
              onChange={setInsuranceProvider}
              placeholder="Blue Cross Blue Shield"
            />
            {matchedReferral ? (
              <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div className="text-xs text-emerald-900">
                    <p className="font-semibold">
                      We found a referral from {matchedReferral.referringClinic ?? 'your clinic'}.
                    </p>
                    <p className="mt-0.5 text-emerald-800">
                      We&apos;ll attach your account to that referral.
                    </p>
                  </div>
                </div>
                <dl className="space-y-1 rounded-lg bg-white/70 px-3 py-2 text-xs text-emerald-900">
                  {matchedReferral.referringClinic && (
                    <div className="flex justify-between gap-3">
                      <dt className="font-medium text-emerald-800">Clinic</dt>
                      <dd className="text-right">{matchedReferral.referringClinic}</dd>
                    </div>
                  )}
                  {matchedReferral.duswName && (
                    <div className="flex justify-between gap-3">
                      <dt className="font-medium text-emerald-800">Social Worker</dt>
                      <dd className="text-right">{matchedReferral.duswName}</dd>
                    </div>
                  )}
                  {matchedReferral.nephrologistName && (
                    <div className="flex justify-between gap-3">
                      <dt className="font-medium text-emerald-800">Nephrologist</dt>
                      <dd className="text-right">{matchedReferral.nephrologistName}</dd>
                    </div>
                  )}
                </dl>
              </div>
            ) : (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Dialysis Clinic *</span>
                  <select
                    value={selectedDialysisClinic}
                    onChange={(event) => {
                      setSelectedDialysisClinic(Number(event.target.value));
                      setSelectedSocialWorker(0);
                      setSelectedNephrologist(0);
                    }}
                    className="h-11 w-full rounded-lg bg-[#f0f3f7] px-3 text-sm text-slate-800 outline-none ring-offset-2 focus:ring-2 focus:ring-[#cfe7fd]"
                  >
                    {DIALYSIS_CLINICS.map((clinic, index) => (
                      <option key={`${clinic}-${index}`} value={index}>
                        {clinic || 'Not currently on dialysis'}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Choose your dialysis clinic, or select Not currently on dialysis.
                  </p>
                </label>

                {selectedDialysisClinic > 0 && (
                  <>
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-slate-700">Assigned Social Worker *</span>
                      <select
                        value={selectedSocialWorker}
                        onChange={(event) => setSelectedSocialWorker(Number(event.target.value))}
                        className="h-11 w-full rounded-lg bg-[#f0f3f7] px-3 text-sm text-slate-800 outline-none ring-offset-2 focus:ring-2 focus:ring-[#cfe7fd]"
                      >
                        <option value={0}>Select your social worker</option>
                        {availableWorkers.map((worker, index) => (
                          <option key={worker.id} value={index + 1}>
                            {worker.name}
                          </option>
                        ))}
                      </select>
                      <FieldError message={fieldErrors.socialWorker} />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-slate-700">Nephrologist *</span>
                      <select
                        value={selectedNephrologist}
                        onChange={(event) => setSelectedNephrologist(Number(event.target.value))}
                        className="h-11 w-full rounded-lg bg-[#f0f3f7] px-3 text-sm text-slate-800 outline-none ring-offset-2 focus:ring-2 focus:ring-[#cfe7fd]"
                      >
                        <option value={0}>Select your nephrologist</option>
                        {availableNephrologists.map((neph, index) => (
                          <option key={neph.id} value={index + 1}>
                            {neph.name}
                          </option>
                        ))}
                      </select>
                      <FieldError message={fieldErrors.nephrologist} />
                    </label>
                  </>
                )}
              </>
            )}
          </RegistrationSection>

          <RegistrationSection icon={Lock} title="Account Security">
            <RegistrationSecureInput
              label="Password *"
              value={password}
              onChange={setPassword}
              placeholder="Create a password"
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              error={fieldErrors.password}
            />
            <RegistrationSecureInput
              label="Confirm Password *"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Confirm your password"
              showPassword={showConfirmPassword}
              setShowPassword={setShowConfirmPassword}
              error={fieldErrors.confirmPassword}
            />

            <div className="space-y-1 pt-1">
              <p className="text-xs font-semibold text-slate-500">Password Requirements:</p>
              <PasswordRequirement met={passwordChecks.minLength} text="At least 8 characters" />
              <PasswordRequirement met={passwordChecks.uppercase} text="Uppercase letter" />
              <PasswordRequirement met={passwordChecks.lowercase} text="Lowercase letter" />
              <PasswordRequirement met={passwordChecks.number} text="Number" />
              <PasswordRequirement met={passwordChecks.symbol} text="Special character (!@#$%^&*)" />
            </div>
          </RegistrationSection>

          <button
            type="button"
            onClick={handleCreateAccount}
            disabled={isLoading}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#3399e6] to-[#1f83d2] text-sm font-semibold text-white shadow-[0_8px_18px_rgba(51,153,230,0.32)] disabled:opacity-60"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>

        <div className="pb-1 text-center">
          <p className="text-[11px] text-slate-500">By creating an account, you agree to our Terms of Service and Privacy Policy.</p>
          <p className="mt-2 text-[11px] text-emerald-600">Demo account details are stored in this browser only.</p>
        </div>
      </div>
    </div>
  );
}

function RegistrationSection({
  children,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.08)]">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#3399e6]" />
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function RegistrationInput({
  error,
  label,
  onChange,
  placeholder,
  value,
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg bg-[#f0f3f7] px-3 text-sm text-slate-800 outline-none ring-offset-2 focus:ring-2 focus:ring-[#cfe7fd]"
      />
      <FieldError message={error} />
    </label>
  );
}

function RegistrationTextArea({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-lg bg-[#f0f3f7] px-3 py-2 text-sm text-slate-800 outline-none ring-offset-2 focus:ring-2 focus:ring-[#cfe7fd]"
      />
    </label>
  );
}

function RegistrationSecureInput({
  error,
  label,
  onChange,
  placeholder,
  setShowPassword,
  showPassword,
  value,
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  setShowPassword: (value: boolean | ((previous: boolean) => boolean)) => void;
  showPassword: boolean;
  value: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg bg-[#f0f3f7] px-3 pr-10 text-sm text-slate-800 outline-none ring-offset-2 focus:ring-2 focus:ring-[#cfe7fd]"
        />
        <button
          type="button"
          onClick={() => setShowPassword((previous) => !previous)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <FieldError message={error} />
    </label>
  );
}

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {met ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5 text-slate-400" />}
      <span className={met ? 'text-emerald-600' : 'text-slate-500'}>{text}</span>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-600">{message}</p>;
}

function ServicesConsentScreen({ onComplete }: { onComplete: () => void }) {
  return (
    <ConsentDocumentScreen
      navigationTitle="Services Consent"
      headerIcon={Cross}
      documentTitleLines={['CONSENT FOR TRANSPLANT WIZARD SERVICES']}
      documentTitleRuleWidth={200}
      sections={SERVICES_CONSENT_SECTIONS}
      agreementText="I have read, understand, and agree to the terms of this Consent for Transplant Wizard Services."
      submitLabel="I Agree & Continue"
      onComplete={onComplete}
    />
  );
}

function MedicalRecordsConsentScreen({ onComplete }: { onComplete: () => void }) {
  return (
    <ConsentDocumentScreen
      navigationTitle="Medical Records Authorization"
      headerIcon={FileText}
      documentTitleLines={['AUTHORIZATION FOR RELEASE', 'OF PROTECTED HEALTH INFORMATION']}
      documentTitleRuleWidth={280}
      documentSubtitle="HIPAA COMPLIANT • 45 CFR § 164.508"
      sections={MEDICAL_CONSENT_SECTIONS}
      agreementText="I authorize the release of my protected health information as described above and understand my rights regarding this authorization."
      submitLabel="I Authorize & Continue"
      footerNote="This form complies with HIPAA regulations (45 CFR Parts 160 and 164) and applicable state privacy laws."
      onComplete={onComplete}
    />
  );
}

function CommunicationConsentScreen({
  email,
  onComplete,
  phone,
}: {
  email: string;
  onComplete: (payload: CommunicationConsentPayload) => void;
  phone: string;
}) {
  const contactPhone = phone.trim() || 'your phone number on file';
  const [emailConsent, setEmailConsent] = useState(true);
  const [smsConsent, setSmsConsent] = useState(true);
  const [phoneConsent, setPhoneConsent] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const hasContactMethod = emailConsent || smsConsent || phoneConsent;

  function submitPreferences() {
    if (!hasContactMethod) {
      setErrorMessage('Select at least one contact method to continue.');
      return;
    }
    setErrorMessage('');
    onComplete({ emailConsent, smsConsent, phoneConsent });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-br from-[#f2f7ff] via-[#ecf3ff] to-[#e2edf8] px-5 pb-6 pt-10">
      <div className="mb-6 mt-2 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#3399e6] shadow-[0_8px_20px_rgba(51,153,230,0.3)]">
          <Bell className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Communication Preferences</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          How can ChristianaCare contact you about your transplant referral?
        </p>
      </div>

      <div className="rounded-[24px] bg-white/95 p-4 shadow-[0_20px_40px_rgba(15,23,42,0.11)]">
        <div className="space-y-3">
          <CommunicationConsentOption
            checked={emailConsent}
            detail={`Send updates and reminders to ${email}`}
            icon={Mail}
            label="Email"
            onToggle={() => setEmailConsent((previous) => !previous)}
          />
          <CommunicationConsentOption
            checked={smsConsent}
            detail={`Send short reminders and care-team notifications to ${contactPhone}`}
            icon={SendHorizontal}
            label="Text messages / SMS"
            onToggle={() => setSmsConsent((previous) => !previous)}
          />
          <CommunicationConsentOption
            checked={phoneConsent}
            detail={`Call ${contactPhone} if the care team needs to reach you`}
            icon={Phone}
            label="Phone calls"
            onToggle={() => setPhoneConsent((previous) => !previous)}
          />

          <div className="rounded-xl bg-[#f8fbff] px-3 py-2.5 text-xs leading-relaxed text-slate-600 ring-1 ring-[#d8e4f1]">
            Portal messages will still appear inside this demo. These choices control simulated
            email, text, and phone contact.
          </div>

          {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}

          <button
            type="button"
            onClick={submitPreferences}
            disabled={!hasContactMethod}
            className={`inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-white ${
              hasContactMethod
                ? 'bg-[#3399e6] shadow-[0_10px_24px_rgba(51,153,230,0.35)]'
                : 'bg-slate-300'
            }`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function CommunicationConsentOption({
  checked,
  detail,
  disabled = false,
  icon: Icon,
  label,
  onToggle,
}: {
  checked: boolean;
  detail: string;
  disabled?: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
        disabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'
          : checked
            ? 'border-[#b8dcfb] bg-[#eef6ff]'
            : 'border-[#d8e4f1] bg-white'
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
          checked ? 'border-[#3399e6] bg-[#3399e6]' : 'border-slate-300 bg-white'
        }`}
      >
        {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3.5} />}
      </span>
      <Icon className={checked ? 'mt-0.5 h-4 w-4 shrink-0 text-[#1a66cc]' : 'mt-0.5 h-4 w-4 shrink-0 text-slate-400'} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{detail}</span>
      </span>
    </button>
  );
}

function CarePartnerPromptScreen({
  onInvite,
  onSkip,
}: {
  onInvite: (payload: CarePartnerInvitePayload) => void;
  onSkip: () => void;
}) {
  const [carePartnerName, setCarePartnerName] = useState('');
  const [carePartnerRelationship, setCarePartnerRelationship] = useState('');
  const [carePartnerEmail, setCarePartnerEmail] = useState('');
  const [carePartnerPhone, setCarePartnerPhone] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(carePartnerEmail.trim());
  const canInvite =
    carePartnerName.trim().length > 0 &&
    carePartnerRelationship.trim().length > 0 &&
    carePartnerPhone.trim().length > 0 &&
    emailIsValid &&
    consentGiven &&
    !isSubmitting;

  function handleInvite() {
    if (!canInvite) {
      setErrorMessage('Please complete all fields and consent before sending the invitation.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    window.setTimeout(() => {
      setIsSubmitting(false);
      onInvite({
        name: carePartnerName.trim(),
        relationship: carePartnerRelationship.trim(),
        email: carePartnerEmail.trim(),
        phone: carePartnerPhone.trim(),
        consentGiven: true,
      });
    }, 600);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-br from-[#f2f7ff] via-[#ecf3ff] to-[#e2edf8] px-5 pb-6 pt-10">
      <div className="mb-6 mt-2 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#3399e6] shadow-[0_8px_20px_rgba(51,153,230,0.3)]">
          <Users className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Add an Emergency Contact (Optional)</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Invite someone you trust to stay informed during your transplant journey.
        </p>
      </div>

      <div className="rounded-[24px] bg-white/95 p-4 shadow-[0_20px_40px_rgba(15,23,42,0.11)]">
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Emergency Contact Name</span>
            <input
              value={carePartnerName}
              onChange={(event) => setCarePartnerName(event.target.value)}
              placeholder="Enter full name"
              className="h-11 w-full rounded-xl border border-[#d8e4f1] bg-white px-3 text-sm text-slate-900 outline-none ring-offset-2 transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Relationship</span>
            <input
              value={carePartnerRelationship}
              onChange={(event) => setCarePartnerRelationship(event.target.value)}
              placeholder="e.g. Spouse, daughter, brother"
              className="h-11 w-full rounded-xl border border-[#d8e4f1] bg-white px-3 text-sm text-slate-900 outline-none ring-offset-2 transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Emergency Contact Email</span>
            <input
              type="email"
              value={carePartnerEmail}
              onChange={(event) => setCarePartnerEmail(event.target.value)}
              placeholder="name@example.com"
              className="h-11 w-full rounded-xl border border-[#d8e4f1] bg-white px-3 text-sm text-slate-900 outline-none ring-offset-2 transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Emergency Contact Phone</span>
            <input
              type="tel"
              value={carePartnerPhone}
              onChange={(event) => setCarePartnerPhone(event.target.value)}
              placeholder="(555) 123-4567"
              className="h-11 w-full rounded-xl border border-[#d8e4f1] bg-white px-3 text-sm text-slate-900 outline-none ring-offset-2 transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
            />
          </label>

          <button
            type="button"
            onClick={() => setConsentGiven((previous) => !previous)}
            className="flex w-full items-start gap-2 rounded-xl border border-[#d8e4f1] bg-[#f8fbff] px-3 py-2.5 text-left"
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                consentGiven ? 'border-[#3399e6] bg-[#3399e6]' : 'border-slate-300 bg-white'
              }`}
            >
              {consentGiven && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
            </span>
            <span className="text-xs leading-relaxed text-slate-600">
              I consent to this emergency contact receiving notifications and viewing limited case status.
            </span>
          </button>

          {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}

          <button
            type="button"
            onClick={handleInvite}
            disabled={!canInvite}
            className={`inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-white ${
              canInvite ? 'bg-[#3399e6] shadow-[0_10px_24px_rgba(51,153,230,0.35)]' : 'bg-slate-300'
            }`}
          >
            {isSubmitting ? 'Sending Invite...' : 'Invite Emergency Contact'}
          </button>

          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#d8e4f1] bg-white text-sm font-semibold text-slate-600"
          >
            Skip For Now
          </button>
        </div>
      </div>
    </div>
  );
}

type ConsentDocumentScreenProps = {
  agreementText: string;
  documentSubtitle?: string;
  documentTitleLines: string[];
  documentTitleRuleWidth: number;
  footerNote?: string;
  headerIcon: ComponentType<{ className?: string }>;
  navigationTitle: string;
  onComplete: () => void;
  sections: ConsentSectionData[];
  submitLabel: string;
};

function ConsentDocumentScreen({
  agreementText,
  documentSubtitle,
  documentTitleLines,
  documentTitleRuleWidth,
  footerNote,
  headerIcon: HeaderIcon,
  navigationTitle,
  onComplete,
  sections,
  submitLabel,
}: ConsentDocumentScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [acknowledgeConsent, setAcknowledgeConsent] = useState(false);

  const isFormValid = acknowledgeConsent;
  const formattedDate = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  function submitConsent() {
    if (!isFormValid) {
      setErrorMessage('Please acknowledge the consent terms to continue.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);
    window.setTimeout(() => {
      setIsLoading(false);
      onComplete();
    }, 700);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#edf1f6]">
      <div className="border-b border-[#dfe6ef] bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700">
        {navigationTitle}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 pb-6 pt-4">
          <div className="space-y-3 text-center">
            <HeaderIcon className="mx-auto h-12 w-12 text-[#3380cc]" />
            <p className="text-xs font-bold tracking-[0.24em] text-[#3380cc]">TRANSPLANT WIZARD</p>
          </div>

          <div className="mx-4 rounded-xl bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.12)]">
            <div className="mb-5 text-center">
              {documentTitleLines.map((line) => (
                <p key={line} className="text-sm font-bold text-slate-900">
                  {line}
                </p>
              ))}
              <div className="mx-auto mt-2 h-0.5 bg-[#3380cc]" style={{ width: `${documentTitleRuleWidth}px`, maxWidth: '80%' }} />
              {documentSubtitle && <p className="mt-2 text-[10px] font-medium text-slate-500">{documentSubtitle}</p>}
            </div>

            <div className="space-y-3">
              {sections.map((section) => (
                <ConsentSection key={section.heading} section={section} />
              ))}
            </div>

            <div className="mt-4 border-t border-[#d7dde8] pt-5">
              <h4 className="text-sm font-bold text-slate-900">PATIENT SIGNATURE</h4>

              <div className="mt-3 flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => setAcknowledgeConsent((previous) => !previous)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    acknowledgeConsent ? 'border-[#1f6eb3] bg-[#dbeeff]' : 'border-slate-400 bg-white'
                  }`}
                  aria-label="Acknowledge consent terms"
                >
                  {acknowledgeConsent && <Check className="h-3.5 w-3.5 text-[#1f6eb3]" strokeWidth={3.5} />}
                </button>
                <p className="text-xs leading-relaxed text-slate-700">{agreementText}</p>
              </div>

              <div className="mt-4">
                <p className="mb-1 text-[11px] font-semibold text-slate-500">Signature (simulated)</p>
                <div className="flex h-[100px] w-full items-center justify-center rounded-lg bg-[#f2f4f7] text-slate-500">
                  <Image
                    src={SIMULATED_SIGNATURE_DATA_URL}
                    alt="Simulated patient signature"
                    width={320}
                    height={90}
                    unoptimized
                    className="h-[90px] w-auto object-contain"
                  />
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-500">Date:</span> {formattedDate}
              </div>
              {footerNote && <p className="mt-3 text-[10px] italic text-slate-500">{footerNote}</p>}
            </div>
          </div>

          {errorMessage && <p className="px-4 text-xs text-red-600">{errorMessage}</p>}

          <div className="flex justify-center px-4">
            <button
              type="button"
              onClick={submitConsent}
              disabled={!isFormValid || isLoading}
              className={`mx-auto flex h-12 w-full max-w-[420px] items-center justify-center rounded-xl text-center text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-100 ${
                isFormValid
                  ? 'bg-gradient-to-r from-[#3380cc] to-[#2a6ea9] text-white shadow-[0_8px_16px_rgba(51,128,204,0.35)]'
                  : 'border border-[#526b82] bg-[#647f99] text-white'
              }`}
            >
              {isLoading ? 'Submitting...' : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConsentSection({ section }: { section: ConsentSectionData }) {
  return (
    <section>
      <h5 className="mb-1 text-xs font-bold text-[#3380cc]">{section.heading}</h5>

      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph} className="mb-2 text-[13px] leading-relaxed text-slate-700">
          {paragraph}
        </p>
      ))}

      {section.bullets?.map((item) => (
        <div key={item} className="mb-1.5 flex items-start gap-2 pl-2">
          <span className="text-[13px] leading-5 text-slate-700">•</span>
          <p className="text-[13px] leading-relaxed text-slate-700">{item}</p>
        </div>
      ))}

      {section.numbered?.map((item) => (
        <div key={`${item.label}-${item.text}`} className="mb-1.5 flex items-start gap-2 pl-2">
          <span className="w-5 text-[13px] font-semibold leading-5 text-slate-700">{item.label}</span>
          <p className="text-[13px] leading-relaxed text-slate-700">{item.text}</p>
        </div>
      ))}

      {section.checkItems?.map((item) => (
        <div key={item} className="mb-1.5 flex items-start gap-2 pl-2">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <p className="text-[13px] leading-relaxed text-slate-700">{item}</p>
        </div>
      ))}
    </section>
  );
}

type HomeTabProps = {
  completedTodos: MockTodo[];
  displayName: string;
  onCompleteTodo: (
    todoId: string,
    screeningResponses?: ScreeningResponses,
    emergencyContact?: CarePartnerInvitePayload
  ) => void;
  onDocumentUpload: (documentName: string) => void;
  onOpenUnreadMessage: () => void;
  pendingTodos: MockTodo[];
  patient: StorePatient | null;
};

function HomeTab({
  completedTodos,
  displayName,
  onCompleteTodo,
  onDocumentUpload,
  onOpenUnreadMessage,
  pendingTodos,
  patient,
}: HomeTabProps) {
  const [activeTodoId, setActiveTodoId] = useState<string | null>(null);
  const activeTodo = pendingTodos.find((todo) => todo.id === activeTodoId) ?? null;

  const unreadCareMessages = useMemo(
    () =>
      patient
        ? patient.messages.filter((m) => !m.readByPatient && m.fromRole !== 'patient').length
        : 0,
    [patient]
  );

  let welcomeSubtext: ReactNode;
  if (pendingTodos.length > 0) {
    welcomeSubtext = (
      <>
        You have <span className="font-semibold text-white">{pendingTodos.length}</span>{' '}
        {pendingTodos.length === 1 ? 'task' : 'tasks'} to complete. Let&apos;s keep moving.
      </>
    );
  } else if (unreadCareMessages > 0) {
    welcomeSubtext = (
      <>You&apos;re caught up on tasks — your care team sent you a message.</>
    );
  } else {
    welcomeSubtext = (
      <>You&apos;re all caught up. We&apos;ll let you know when something needs you.</>
    );
  }

  if (activeTodo) {
    return (
      <div className="space-y-4">
        <TodoTaskWorkspace
          documents={patient?.documents ?? []}
          onClose={() => setActiveTodoId(null)}
          onComplete={(screeningResponses, emergencyContact) => {
            onCompleteTodo(activeTodo.id, screeningResponses, emergencyContact);
            setActiveTodoId(null);
          }}
          onDocumentUpload={onDocumentUpload}
          todo={activeTodo}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-gradient-to-r from-[#3380cc] to-[#2a6ea9] p-4 shadow-[0_12px_24px_rgba(42,110,169,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Welcome Back</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{displayName}</h2>
        <p className="mt-2 text-sm leading-relaxed text-blue-100">{welcomeSubtext}</p>
      </section>

      <MessagesRow unreadCount={unreadCareMessages} onOpenUnread={onOpenUnreadMessage} />

      <section className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#3399e6]" />
          <h3 className="text-base font-semibold text-slate-900">To-Do List</h3>
          <span className="ml-auto rounded-md bg-[#eef3f8] px-2 py-1 text-[11px] font-medium text-slate-500">
            {pendingTodos.length} pending
          </span>
        </div>

        <div className="space-y-2">
          {pendingTodos.map((todo) => (
            <TodoRow
              key={todo.id}
              completed={false}
              onSelectTodo={setActiveTodoId}
              todo={todo}
            />
          ))}

          {pendingTodos.length === 0 && (
            <div className="rounded-xl bg-[#eef8f2] p-3 text-sm font-medium text-emerald-700">All required tasks are completed.</div>
          )}

          {completedTodos.length > 0 && (
            <>
              <div className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Completed</div>
              {completedTodos.map((todo) => (
                <TodoRow key={todo.id} todo={todo} completed />
              ))}
            </>
          )}
        </div>
      </section>

    </div>
  );
}

function MessagesRow({
  unreadCount,
  onOpenUnread,
}: {
  unreadCount: number;
  onOpenUnread: () => void;
}) {
  if (unreadCount > 0) {
    return (
      <button
        type="button"
        onClick={onOpenUnread}
        aria-label={`Open ${unreadCount} unread care-team message${unreadCount === 1 ? '' : 's'}`}
        className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-[0_8px_24px_rgba(15,23,42,0.07)] transition hover:bg-[#f8fbff] focus:outline-none focus:ring-2 focus:ring-[#b8dcfb]"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eaf4fc] text-[#1a66cc]">
          <Mail className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {unreadCount} unread{' '}
            {unreadCount === 1 ? 'message' : 'messages'}
          </p>
          <p className="text-xs text-slate-500">From your care team</p>
        </div>
        <ChevronRight className="h-4 w-4 text-[#1a66cc]" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500">
        <Mail className="h-5 w-5" />
      </div>
      <p className="flex-1 text-sm font-medium text-slate-600">No new messages</p>
    </div>
  );
}

function TodoRow({
  completed,
  isActive = false,
  onSelectTodo,
  todo,
}: {
  completed: boolean;
  isActive?: boolean;
  onSelectTodo?: (todoId: string) => void;
  todo: MockTodo;
}) {
  const statusColor =
    todo.priority === 'high' ? 'bg-red-500' : todo.priority === 'medium' ? 'bg-orange-500' : 'bg-emerald-500';

  const baseClassName = `flex w-full items-center gap-3 rounded-xl p-3 text-left ${
    completed ? 'bg-[#f8fafc]' : isActive ? 'bg-[#eaf4fc] ring-1 ring-[#b9dbf7]' : 'bg-[#f4f7fb]'
  }`;

  if (!completed && onSelectTodo) {
    return (
      <button type="button" onClick={() => onSelectTodo(todo.id)} className={baseClassName}>
        <span className={`h-2 w-2 rounded-full ${statusColor}`} />
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-900">{todo.title}</p>
          <p className="text-xs text-slate-500">{todo.description}</p>
        </div>
        <ChevronRight className={`h-4 w-4 ${isActive ? 'text-[#1a66cc]' : 'text-slate-400'}`} />
      </button>
    );
  }

  return (
    <div className={baseClassName}>
      {completed ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : (
        <span className={`h-2 w-2 rounded-full ${statusColor}`} />
      )}
      <div className="flex-1">
        <p className={`text-sm font-medium ${completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
          {todo.title}
        </p>
        <p className="text-xs text-slate-500">{todo.description}</p>
      </div>
      {!completed && <ChevronRight className="h-4 w-4 text-slate-400" />}
    </div>
  );
}

function TodoTaskWorkspace({
  documents,
  onClose,
  onComplete,
  onDocumentUpload,
  todo,
}: {
  documents: StorePatient['documents'];
  onClose: () => void;
  onComplete: (
    screeningResponses?: ScreeningResponses,
    emergencyContact?: CarePartnerInvitePayload
  ) => void;
  onDocumentUpload: (documentName: string) => void;
  todo: MockTodo;
}) {
  if (todo.type === 'governmentIdUpload') {
    return (
      <GovernmentIdTaskCard
        documents={documents}
        onClose={onClose}
        onComplete={onComplete}
        onDocumentUpload={onDocumentUpload}
      />
    );
  }
  if (todo.type === 'insuranceCardUpload') {
    return (
      <InsuranceCardTaskCard
        documents={documents}
        onClose={onClose}
        onComplete={onComplete}
        onDocumentUpload={onDocumentUpload}
      />
    );
  }
  if (todo.type === 'carePartnerInvite') {
    return <CarePartnerInviteTaskCard onClose={onClose} onComplete={onComplete} />;
  }
  if (todo.type === 'educationVideo') {
    return <EducationTaskCard onClose={onClose} onComplete={onComplete} />;
  }
  if (todo.type === 'customStaffTodo') {
    return (
      <CustomStaffTaskCard
        documents={documents}
        onClose={onClose}
        onComplete={onComplete}
        onDocumentUpload={onDocumentUpload}
        todo={todo}
      />
    );
  }
  return <HealthQuestionnaireTaskCard onClose={onClose} onComplete={onComplete} />;
}

function hasPatientUploadedDocument(
  documents: StorePatient['documents'],
  documentName: string
) {
  const lookup = documentName.trim().toLowerCase();
  return documents.some((document) => document.name.trim().toLowerCase() === lookup);
}

function CustomStaffTaskCard({
  documents,
  onClose,
  onComplete,
  onDocumentUpload,
  todo,
}: {
  documents: StorePatient['documents'];
  onClose: () => void;
  onComplete: () => void;
  onDocumentUpload: (documentName: string) => void;
  todo: MockTodo;
}) {
  const docRequests = todo.documentRequests ?? [];
  const [uploadedIds, setUploadedIds] = useState<Set<string>>(
    () =>
      new Set(
        docRequests
          .filter((req) => hasPatientUploadedDocument(documents, req.title))
          .map((req) => req.id)
      )
  );
  const allUploaded =
    docRequests.length === 0 ||
    docRequests.every((req) => uploadedIds.has(req.id));

  return (
    <TodoWorkspaceShell
      onClose={onClose}
      title={todo.title}
      subtitle={
        todo.addedByStaff
          ? `Added by ${todo.addedByStaff}, ChristianaCare Front Desk.`
          : 'Added by your ChristianaCare care team.'
      }
    >
      {todo.description ? (
        <div className="rounded-xl border border-[#d7e4f1] bg-[#f8fbff] p-3 text-sm leading-relaxed text-slate-700">
          {todo.description}
        </div>
      ) : docRequests.length === 0 ? (
        <div className="rounded-xl border border-[#d7e4f1] bg-[#f8fbff] p-3 text-sm leading-relaxed text-slate-700">
          Please complete this task so your care team can keep your evaluation on track.
        </div>
      ) : null}

      {docRequests.map((req) => (
        <SimulatedUploadCard
          key={req.id}
          title={req.title}
          helperText={req.description || 'Tap below to simulate uploading this document.'}
          buttonLabel="Simulate Upload"
          isUploaded={uploadedIds.has(req.id)}
          onSimulateUpload={() => {
            onDocumentUpload(req.title);
            setUploadedIds((prev) => {
              const next = new Set(prev);
              next.add(req.id);
              return next;
            });
          }}
        />
      ))}

      <button
        type="button"
        onClick={onComplete}
        disabled={!allUploaded}
        className={`inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition ${
          allUploaded ? 'bg-[#3399e6] shadow-[0_10px_20px_rgba(51,153,230,0.32)]' : 'bg-slate-300'
        }`}
      >
        Mark As Completed
      </button>
    </TodoWorkspaceShell>
  );
}

function EducationTaskCard({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [watched, setWatched] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const start = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / 3000) * 100);
      setProgress(pct);
      if (pct >= 100) {
        window.clearInterval(interval);
        setPlaying(false);
        setWatched(true);
      }
    }, 50);
    return () => window.clearInterval(interval);
  }, [playing]);

  const canComplete = watched && confirmed;

  return (
    <TodoWorkspaceShell
      onClose={onClose}
      title="Transplant Education"
      subtitle="Watch this short video with your support person, then confirm to complete."
    >
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1a66cc] to-[#6b4be8]">
        <div className="flex aspect-video items-center justify-center">
          {!playing && !watched && (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-[#1a66cc] shadow-[0_10px_24px_rgba(15,23,42,0.3)]"
              aria-label="Play education video"
            >
              <PlayCircle className="h-10 w-10" />
            </button>
          )}
          {playing && (
            <div className="flex flex-col items-center gap-2 text-white">
              <BookOpen className="h-10 w-10" />
              <p className="text-xs font-semibold uppercase tracking-wide">Now playing</p>
            </div>
          )}
          {watched && (
            <div className="flex flex-col items-center gap-2 text-white">
              <CheckCircle2 className="h-10 w-10" />
              <p className="text-xs font-semibold uppercase tracking-wide">Video complete</p>
            </div>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/25">
          <div
            className="h-full bg-white transition-[width] duration-100 ease-linear"
            style={{ width: `${watched ? 100 : progress}%` }}
          />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-slate-600">
        This orientation covers the transplant evaluation journey, what to expect at your first
        visit, and how your care team stays in touch from screening through scheduling.
      </p>

      <button
        type="button"
        onClick={() => setConfirmed((previous) => !previous)}
        disabled={!watched}
        className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
          watched
            ? 'border-[#d8e4f1] bg-[#f8fbff]'
            : 'cursor-not-allowed border-slate-200 bg-slate-50'
        }`}
      >
        <span
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
            confirmed ? 'border-[#3399e6] bg-[#3399e6]' : 'border-slate-300 bg-white'
          }`}
        >
          {confirmed && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
        </span>
        <span className={`text-xs leading-relaxed ${watched ? 'text-slate-600' : 'text-slate-400'}`}>
          I confirm I watched the video with my support person.
        </span>
      </button>

      <button
        type="button"
        onClick={onComplete}
        disabled={!canComplete}
        className={`inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition ${
          canComplete ? 'bg-[#3399e6] shadow-[0_10px_20px_rgba(51,153,230,0.32)]' : 'bg-slate-300'
        }`}
      >
        Mark Education Complete
      </button>
    </TodoWorkspaceShell>
  );
}

function TodoWorkspaceShell({
  children,
  onClose,
  subtitle,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-[#d7e4f1] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.08)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex-1">
          <h4 className="text-base font-semibold text-slate-900">{title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d7e4f1] text-slate-500"
          aria-label="Close task panel"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SimulatedUploadCard({
  buttonLabel,
  helperText,
  isUploaded,
  title,
  onSimulateUpload,
}: {
  buttonLabel: string;
  helperText: string;
  isUploaded: boolean;
  title: string;
  onSimulateUpload: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#c7d8ea] bg-[#f8fbff] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        </div>
        {isUploaded && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
            <Check className="h-3 w-3" />
            Uploaded
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onSimulateUpload}
        disabled={isUploaded}
        className={`mt-3 inline-flex h-10 items-center justify-center rounded-lg px-3 text-xs font-semibold transition ${
          isUploaded ? 'bg-slate-200 text-slate-500' : 'bg-[#3399e6] text-white shadow-[0_6px_16px_rgba(51,153,230,0.32)]'
        }`}
      >
        {isUploaded ? 'Upload Complete' : buttonLabel}
      </button>
    </div>
  );
}

function GovernmentIdTaskCard({
  documents,
  onClose,
  onComplete,
  onDocumentUpload,
}: {
  documents: StorePatient['documents'];
  onClose: () => void;
  onComplete: () => void;
  onDocumentUpload: (documentName: string) => void;
}) {
  const [frontUploaded, setFrontUploaded] = useState(() =>
    hasPatientUploadedDocument(documents, 'Government ID (Front)')
  );

  return (
    <TodoWorkspaceShell
      onClose={onClose}
      title="Upload Government ID"
      subtitle="Provide a clear image of your government-issued ID. Only the front side is required."
    >
      <SimulatedUploadCard
        title="Government ID (Front)"
        helperText="Accepted formats: JPG, PNG, PDF."
        buttonLabel="Simulate Front Upload"
        isUploaded={frontUploaded}
        onSimulateUpload={() => {
          onDocumentUpload('Government ID (Front)');
          setFrontUploaded(true);
        }}
      />

      <button
        type="button"
        onClick={onComplete}
        disabled={!frontUploaded}
        className={`inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition ${
          frontUploaded ? 'bg-[#3399e6] shadow-[0_10px_20px_rgba(51,153,230,0.32)]' : 'bg-slate-300'
        }`}
      >
        Mark As Completed
      </button>
    </TodoWorkspaceShell>
  );
}

function InsuranceCardTaskCard({
  documents,
  onClose,
  onComplete,
  onDocumentUpload,
}: {
  documents: StorePatient['documents'];
  onClose: () => void;
  onComplete: () => void;
  onDocumentUpload: (documentName: string) => void;
}) {
  const [frontUploaded, setFrontUploaded] = useState(() =>
    hasPatientUploadedDocument(documents, 'Insurance Card (Front)')
  );
  const [backUploaded, setBackUploaded] = useState(() =>
    hasPatientUploadedDocument(documents, 'Insurance Card (Back)')
  );
  const canComplete = frontUploaded && backUploaded;

  return (
    <TodoWorkspaceShell
      onClose={onClose}
      title="Upload Insurance Card"
      subtitle="Upload both front and back images so your coverage can be verified."
    >
      <SimulatedUploadCard
        title="Insurance Card (Front)"
        helperText="Capture policy number and member name clearly."
        buttonLabel="Simulate Front Upload"
        isUploaded={frontUploaded}
        onSimulateUpload={() => {
          onDocumentUpload('Insurance Card (Front)');
          setFrontUploaded(true);
        }}
      />
      <SimulatedUploadCard
        title="Insurance Card (Back)"
        helperText="Include claim/billing and support phone details."
        buttonLabel="Simulate Back Upload"
        isUploaded={backUploaded}
        onSimulateUpload={() => {
          onDocumentUpload('Insurance Card (Back)');
          setBackUploaded(true);
        }}
      />

      <button
        type="button"
        onClick={onComplete}
        disabled={!canComplete}
        className={`inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition ${
          canComplete ? 'bg-[#3399e6] shadow-[0_10px_20px_rgba(51,153,230,0.32)]' : 'bg-slate-300'
        }`}
      >
        Mark As Completed
      </button>
    </TodoWorkspaceShell>
  );
}

function CarePartnerInviteTaskCard({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: (
    screeningResponses?: ScreeningResponses,
    emergencyContact?: CarePartnerInvitePayload
  ) => void;
}) {
  const [carePartnerName, setCarePartnerName] = useState('');
  const [carePartnerRelationship, setCarePartnerRelationship] = useState('');
  const [carePartnerEmail, setCarePartnerEmail] = useState('');
  const [carePartnerPhone, setCarePartnerPhone] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(carePartnerEmail.trim());
  const canComplete =
    carePartnerName.trim().length > 0 &&
    carePartnerRelationship.trim().length > 0 &&
    carePartnerPhone.trim().length > 0 &&
    emailIsValid &&
    consentGiven;

  function handleCompleteCarePartnerTask() {
    if (!canComplete) {
      setErrorMessage('Please complete all fields and provide consent before sending the invite.');
      return;
    }
    setErrorMessage('');
    onComplete(undefined, {
      name: carePartnerName.trim(),
      relationship: carePartnerRelationship.trim(),
      email: carePartnerEmail.trim(),
      phone: carePartnerPhone.trim(),
      consentGiven: true,
    });
  }

  return (
    <TodoWorkspaceShell
      onClose={onClose}
      title="Add Emergency Contact"
      subtitle="Invite an emergency contact to receive notifications and view limited case status updates."
    >
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Emergency Contact Name</span>
        <input
          value={carePartnerName}
          onChange={(event) => setCarePartnerName(event.target.value)}
          placeholder="Enter full name"
          className="h-11 w-full rounded-xl border border-[#d8e4f1] bg-white px-3 text-sm text-slate-900 outline-none ring-offset-2 transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Relationship</span>
        <input
          value={carePartnerRelationship}
          onChange={(event) => setCarePartnerRelationship(event.target.value)}
          placeholder="e.g. Spouse, daughter, brother"
          className="h-11 w-full rounded-xl border border-[#d8e4f1] bg-white px-3 text-sm text-slate-900 outline-none ring-offset-2 transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Emergency Contact Email</span>
        <input
          type="email"
          value={carePartnerEmail}
          onChange={(event) => setCarePartnerEmail(event.target.value)}
          placeholder="name@example.com"
          className="h-11 w-full rounded-xl border border-[#d8e4f1] bg-white px-3 text-sm text-slate-900 outline-none ring-offset-2 transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Emergency Contact Phone</span>
        <input
          type="tel"
          value={carePartnerPhone}
          onChange={(event) => setCarePartnerPhone(event.target.value)}
          placeholder="(555) 123-4567"
          className="h-11 w-full rounded-xl border border-[#d8e4f1] bg-white px-3 text-sm text-slate-900 outline-none ring-offset-2 transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
        />
      </label>

      <button
        type="button"
        onClick={() => setConsentGiven((previous) => !previous)}
        className="flex w-full items-start gap-2 rounded-xl border border-[#d8e4f1] bg-[#f8fbff] px-3 py-2.5 text-left"
      >
        <span
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
            consentGiven ? 'border-[#3399e6] bg-[#3399e6]' : 'border-slate-300 bg-white'
          }`}
        >
          {consentGiven && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
        </span>
        <span className="text-xs leading-relaxed text-slate-600">
          I consent to this emergency contact receiving notifications and viewing limited case status.
        </span>
      </button>

      {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}

      <button
        type="button"
        onClick={handleCompleteCarePartnerTask}
        disabled={!canComplete}
        className={`inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition ${
          canComplete ? 'bg-[#3399e6] shadow-[0_10px_20px_rgba(51,153,230,0.32)]' : 'bg-slate-300'
        }`}
      >
        Send Invite & Mark As Completed
      </button>
    </TodoWorkspaceShell>
  );
}

function QuestionnaireInlineChoiceGroup({
  hasError = false,
  name,
  onValueChange,
  options,
  value,
}: {
  hasError?: boolean;
  name: string;
  onValueChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${hasError ? 'border-red-400 bg-red-50/30' : 'border-[#d8e4f1] bg-white'}`}>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => (
          <label key={`${name}-${option.value}`} className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={(event) => onValueChange(event.target.value)}
              className="h-4 w-4 accent-[#3380cc]"
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function QuestionnaireRadioCard({
  hasError = false,
  helperText,
  name,
  options,
  question,
  required = false,
  value,
  onValueChange,
}: {
  hasError?: boolean;
  helperText?: string;
  name: string;
  options: Array<{ label: string; value: string }>;
  question: ReactNode;
  required?: boolean;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className={`rounded-xl border p-3 ${hasError ? 'border-red-400 bg-red-50/30' : 'border-[#d8e4f1] bg-[#f8fbff]'}`}>
      <p className="text-sm font-medium leading-relaxed text-slate-800">
        {question}{required && <span className="ml-0.5 text-red-500">*</span>}
      </p>
      {helperText && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-[#2a6ead]">
          <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{helperText}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => (
          <label key={`${name}-${option.value}`} className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={(event) => onValueChange(event.target.value)}
              className="h-4 w-4 accent-[#3380cc]"
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function HealthQuestionnaireTaskCard({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: (screeningResponses: ScreeningResponses) => void;
}) {
  const [currentStep, setCurrentStep] = useState<QuestionnaireStep>(1);

  const [onDialysis, setOnDialysis] = useState<TernaryChoice>('');
  const [dialysisStartMonth, setDialysisStartMonth] = useState('');
  const [dialysisStartYear, setDialysisStartYear] = useState('');
  const [eGFR, setEGFR] = useState('');
  const [dontKnowEgfr, setDontKnowEgfr] = useState(false);
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [dontKnowHeight, setDontKnowHeight] = useState(false);
  const [weightPounds, setWeightPounds] = useState('');
  const [dontKnowWeight, setDontKnowWeight] = useState(false);
  const [isCitizenOrResident, setIsCitizenOrResident] = useState<TernaryChoice>('');

  const [needsMultiOrganTransplant, setNeedsMultiOrganTransplant] = useState<TernaryChoice>('');
  const [usesSupplementalOxygen, setUsesSupplementalOxygen] = useState<TernaryChoice>('');
  const [cardiacSurgeryLast6Months, setCardiacSurgeryLast6Months] = useState<TernaryChoice>('');
  const [activeCancer, setActiveCancer] = useState<TernaryChoice>('');
  const [activeSubstanceUse, setActiveSubstanceUse] = useState<SubstanceChoice>('');
  const [hasOpenWounds, setHasOpenWounds] = useState<TernaryChoice>('');
  const [otherConcerns, setOtherConcerns] = useState('');

  const [showStep1Validation, setShowStep1Validation] = useState(false);
  const [showStep2Validation, setShowStep2Validation] = useState(false);

  const needsDialysisStart = onDialysis === 'yes';
  const isValidNumber = (v: string) => v.trim() !== '' && !isNaN(Number(v)) && Number(v) > 0;

  const eGFRFormatError = !dontKnowEgfr && eGFR.trim() !== '' && !isValidNumber(eGFR);
  const weightFormatError = !dontKnowWeight && weightPounds.trim() !== '' && !isValidNumber(weightPounds);

  const step1Valid =
    onDialysis !== '' &&
    (!needsDialysisStart || (dialysisStartMonth !== '' && dialysisStartYear !== '')) &&
    (dontKnowEgfr || (eGFR.trim() !== '' && isValidNumber(eGFR))) &&
    (dontKnowHeight || (heightFeet !== '' && heightInches !== '')) &&
    (dontKnowWeight || (weightPounds.trim() !== '' && isValidNumber(weightPounds))) &&
    isCitizenOrResident !== '';

  const step2Valid =
    needsMultiOrganTransplant !== '' &&
    usesSupplementalOxygen !== '' &&
    cardiacSurgeryLast6Months !== '' &&
    activeCancer !== '' &&
    activeSubstanceUse !== '' &&
    hasOpenWounds !== '';

  const err1 = {
    dialysis: showStep1Validation && onDialysis === '',
    dialysisStart: showStep1Validation && needsDialysisStart && (dialysisStartMonth === '' || dialysisStartYear === ''),
    egfr: showStep1Validation && !dontKnowEgfr && eGFR.trim() === '',
    egfrFormat: eGFRFormatError,
    height: showStep1Validation && !dontKnowHeight && (heightFeet === '' || heightInches === ''),
    weight: showStep1Validation && !dontKnowWeight && weightPounds.trim() === '',
    weightFormat: weightFormatError,
    citizenship: showStep1Validation && isCitizenOrResident === '',
  };
  const err2 = {
    multiOrgan: showStep2Validation && needsMultiOrganTransplant === '',
    oxygen: showStep2Validation && usesSupplementalOxygen === '',
    cardiac: showStep2Validation && cardiacSurgeryLast6Months === '',
    cancer: showStep2Validation && activeCancer === '',
    substance: showStep2Validation && activeSubstanceUse === '',
    wounds: showStep2Validation && hasOpenWounds === '',
  };

  function handleContinue() {
    if (!step1Valid || eGFRFormatError || weightFormatError) {
      setShowStep1Validation(true);
      return;
    }
    setShowStep1Validation(false);
    setCurrentStep(2);
  }

  function handleSubmit() {
    if (!step2Valid) {
      setShowStep2Validation(true);
      return;
    }
    setShowStep2Validation(false);
    onComplete({
      onDialysis: onDialysis as ScreeningResponses['onDialysis'],
      dialysisStart: needsDialysisStart ? `${dialysisStartMonth} ${dialysisStartYear}` : undefined,
      egfr: dontKnowEgfr ? undefined : Number(eGFR),
      egfrUnknown: dontKnowEgfr,
      heightFeet: dontKnowHeight ? undefined : Number(heightFeet),
      heightInches: dontKnowHeight ? undefined : Number(heightInches),
      heightUnknown: dontKnowHeight,
      weightPounds: dontKnowWeight ? undefined : Number(weightPounds),
      weightUnknown: dontKnowWeight,
      isCitizenOrResident: isCitizenOrResident as ScreeningResponses['isCitizenOrResident'],
      needsMultiOrganTransplant:
        needsMultiOrganTransplant as ScreeningResponses['needsMultiOrganTransplant'],
      usesSupplementalOxygen:
        usesSupplementalOxygen as ScreeningResponses['usesSupplementalOxygen'],
      cardiacSurgeryLast6Months:
        cardiacSurgeryLast6Months as ScreeningResponses['cardiacSurgeryLast6Months'],
      activeCancer: activeCancer as ScreeningResponses['activeCancer'],
      activeSubstanceUse: activeSubstanceUse as ScreeningResponses['activeSubstanceUse'],
      hasOpenWounds: hasOpenWounds as ScreeningResponses['hasOpenWounds'],
      otherConcerns: otherConcerns.trim() || undefined,
      completedAt: new Date().toISOString(),
    });
  }

  const baseFieldClassName =
    'h-11 w-full rounded-xl border bg-white px-3 text-sm text-slate-900 outline-none ring-offset-2 transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]';
  const fieldClassName = (hasError: boolean, disabled = false) =>
    `${baseFieldClassName} ${hasError ? 'border-red-400 ring-1 ring-red-100' : 'border-[#d8e4f1]'} ${
      disabled ? 'bg-slate-100 text-slate-400' : ''
    }`;
  const progressPercent = currentStep === 1 ? 50 : 100;

  return (
    <TodoWorkspaceShell
      onClose={onClose}
      title="Health Questionnaire"
      subtitle="Please answer these questions to the best of your ability."
    >
      <div className="rounded-xl border border-[#d8e4f1] bg-white p-3">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-semibold text-slate-900">Health Questionnaire</h5>
          <span className="text-xs font-medium text-slate-500">Step {currentStep} of 2</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-[#e4edf7]">
          <div className="h-full rounded-full bg-[#3380cc] transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {currentStep === 1 ? (
        <>
          <div className="rounded-xl bg-[#edf5ff] px-3 py-2 text-xs text-[#2a6ead]">
            Please answer these questions to the best of your ability. If you&apos;re unsure about something, that&apos;s
            okay. Give your best estimate or select &quot;I&apos;m not sure.&quot;
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Are you currently on dialysis?<span className="ml-0.5 text-red-500">*</span></p>
              <QuestionnaireInlineChoiceGroup
                name="dialysis-status"
                options={[
                  { label: 'Yes', value: 'yes' },
                  { label: 'No', value: 'no' },
                  { label: "I'm not sure", value: 'notSure' },
                ]}
                value={onDialysis}
                hasError={err1.dialysis}
                onValueChange={(value) => setOnDialysis(value as TernaryChoice)}
              />
            </div>

            {needsDialysisStart && (
              <>
                <div className="h-px bg-[#e3ebf5]" />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">When did you start dialysis?<span className="ml-0.5 text-red-500">*</span></p>
                    <CircleHelp className="h-3.5 w-3.5 text-[#3380cc]" />
                  </div>
                  <p className="text-xs text-slate-500">(Approximate month and year is fine)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={dialysisStartMonth}
                      onChange={(event) => setDialysisStartMonth(event.target.value)}
                      className={fieldClassName(err1.dialysisStart)}
                    >
                      <option value="">Month</option>
                      {QUESTIONNAIRE_MONTH_OPTIONS.map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                    <select
                      value={dialysisStartYear}
                      onChange={(event) => setDialysisStartYear(event.target.value)}
                      className={fieldClassName(err1.dialysisStart)}
                    >
                      <option value="">Year</option>
                      {QUESTIONNAIRE_YEAR_OPTIONS.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            <div className="h-px bg-[#e3ebf5]" />

            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                What is your most recent eGFR (kidney function number)?<span className="ml-0.5 text-red-500">*</span>
              </p>
              <p className="flex items-start gap-1.5 text-xs text-[#2a6ead]">
                <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>This is usually on your lab results. If you don&apos;t know it, that&apos;s okay - we can get it from your clinic.</span>
              </p>
              <input
                type="text"
                inputMode="decimal"
                value={eGFR}
                onChange={(event) => setEGFR(event.target.value)}
                disabled={dontKnowEgfr}
                className={fieldClassName(err1.egfr || err1.egfrFormat, dontKnowEgfr)}
              />
              {err1.egfr && <p className="text-xs font-medium text-red-600">Please enter your eGFR or check "I don't know."</p>}
              {err1.egfrFormat && <p className="text-xs font-medium text-red-600">Please enter a valid number.</p>}
              <button
                type="button"
                onClick={() =>
                  setDontKnowEgfr((previous) => {
                    if (!previous) setEGFR('');
                    return !previous;
                  })
                }
                className="inline-flex items-center gap-2 text-sm text-slate-700"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    dontKnowEgfr ? 'border-[#3399e6] bg-[#3399e6]' : 'border-slate-300 bg-white'
                  }`}
                >
                  {dontKnowEgfr && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
                </span>
                I don&apos;t know my eGFR
              </button>
            </div>

            <div className="h-px bg-[#e3ebf5]" />

            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What is your height?<span className="ml-0.5 text-red-500">*</span></p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <select value={heightFeet} onChange={(event) => setHeightFeet(event.target.value)} disabled={dontKnowHeight} className={fieldClassName(err1.height, dontKnowHeight)}>
                    <option value="">Feet</option>
                    {QUESTIONNAIRE_HEIGHT_FEET_OPTIONS.map((feet) => (
                      <option key={feet} value={feet}>
                        {feet}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">ft</p>
                </div>
                <div className="space-y-1">
                  <select
                    value={heightInches}
                    onChange={(event) => setHeightInches(event.target.value)}
                    disabled={dontKnowHeight}
                    className={fieldClassName(err1.height, dontKnowHeight)}
                  >
                    <option value="">Inches</option>
                    {QUESTIONNAIRE_HEIGHT_INCH_OPTIONS.map((inches) => (
                      <option key={inches} value={inches}>
                        {inches}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">in</p>
                </div>
              </div>
              {err1.height && <p className="text-xs font-medium text-red-600">Please select your height or check "I don't know."</p>}
              <button
                type="button"
                onClick={() => setDontKnowHeight((prev) => { if (!prev) { setHeightFeet(''); setHeightInches(''); } return !prev; })}
                className="inline-flex items-center gap-2 text-sm text-slate-700"
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded border ${dontKnowHeight ? 'border-[#3399e6] bg-[#3399e6]' : 'border-slate-300 bg-white'}`}>
                  {dontKnowHeight && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
                </span>
                I don&apos;t know my height
              </button>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What is your weight (in pounds)?<span className="ml-0.5 text-red-500">*</span></p>
              <input
                type="text"
                inputMode="decimal"
                value={weightPounds}
                onChange={(event) => setWeightPounds(event.target.value)}
                disabled={dontKnowWeight}
                className={fieldClassName(err1.weight || err1.weightFormat, dontKnowWeight)}
              />
              {err1.weight && <p className="text-xs font-medium text-red-600">Please enter your weight or check "I don't know."</p>}
              {err1.weightFormat && <p className="text-xs font-medium text-red-600">Please enter a valid weight.</p>}
              <button
                type="button"
                onClick={() => setDontKnowWeight((prev) => { if (!prev) setWeightPounds(''); return !prev; })}
                className="inline-flex items-center gap-2 text-sm text-slate-700"
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded border ${dontKnowWeight ? 'border-[#3399e6] bg-[#3399e6]' : 'border-slate-300 bg-white'}`}>
                  {dontKnowWeight && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
                </span>
                I don&apos;t know my weight
              </button>
            </div>

            <div className="h-px bg-[#e3ebf5]" />

            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Are you a U.S. citizen or legal resident?<span className="ml-0.5 text-red-500">*</span></p>
              <QuestionnaireInlineChoiceGroup
                name="citizenship-status"
                options={[
                  { label: 'Yes', value: 'yes' },
                  { label: 'No', value: 'no' },
                  { label: "I'm not sure", value: 'notSure' },
                ]}
                value={isCitizenOrResident}
                hasError={err1.citizenship}
                onValueChange={(value) => setIsCitizenOrResident(value as TernaryChoice)}
              />
            </div>
          </div>

          {showStep1Validation && !step1Valid && (
            <p className="text-xs font-medium text-red-600">Please complete all required fields to continue.</p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#3399e6] px-4 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(51,153,230,0.32)]"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <h5 className="text-sm font-semibold text-slate-900">Additional Health Information</h5>
            <p className="text-xs leading-relaxed text-slate-600">
              These questions help us understand your current health. Please answer honestly - checking &quot;yes&quot;
              does NOT automatically disqualify you. Our team reviews each case individually.
            </p>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Do any of the following apply to you currently?</p>

          <div className="space-y-2">
            <QuestionnaireRadioCard
              name="multi-organ"
              question="Do you need a transplant for organs other than your kidney (like heart, liver, or lung)?"
              options={[
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' },
                { label: "I'm not sure", value: 'notSure' },
              ]}
              required
              value={needsMultiOrganTransplant}
              hasError={err2.multiOrgan}
              onValueChange={(value) => setNeedsMultiOrganTransplant(value as TernaryChoice)}
            />

            <QuestionnaireRadioCard
              name="supplemental-oxygen"
              question="Do you currently use supplemental oxygen?"
              options={[
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' },
                { label: "I'm not sure", value: 'notSure' },
              ]}
              required
              value={usesSupplementalOxygen}
              hasError={err2.oxygen}
              onValueChange={(value) => setUsesSupplementalOxygen(value as TernaryChoice)}
            />

            <QuestionnaireRadioCard
              name="cardiac-surgery"
              question="Have you had heart surgery in the last 6 months?"
              options={[
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' },
                { label: "I'm not sure", value: 'notSure' },
              ]}
              required
              value={cardiacSurgeryLast6Months}
              hasError={err2.cardiac}
              onValueChange={(value) => setCardiacSurgeryLast6Months(value as TernaryChoice)}
            />

            <QuestionnaireRadioCard
              name="active-cancer"
              question={
                <>
                  Are you currently receiving cancer treatment?
                  <br />
                  (Not including treatment for skin cancer)
                </>
              }
              options={[
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' },
                { label: "I'm not sure", value: 'notSure' },
              ]}
              required
              value={activeCancer}
              hasError={err2.cancer}
              onValueChange={(value) => setActiveCancer(value as TernaryChoice)}
            />

            <QuestionnaireRadioCard
              name="substance-use"
              question="Do you currently use recreational drugs or have an active substance use concern?"
              helperText="Answering yes won't disqualify you - we'll work with you to address this if needed."
              options={[
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' },
                { label: 'Prefer not to answer', value: 'preferNotToAnswer' },
              ]}
              required
              value={activeSubstanceUse}
              hasError={err2.substance}
              onValueChange={(value) => setActiveSubstanceUse(value as SubstanceChoice)}
            />

            <QuestionnaireRadioCard
              name="open-wounds"
              question="Do you currently have any open wounds that are not healing?"
              options={[
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' },
                { label: "I'm not sure", value: 'notSure' },
              ]}
              required
              value={hasOpenWounds}
              hasError={err2.wounds}
              onValueChange={(value) => setHasOpenWounds(value as TernaryChoice)}
            />
          </div>

          <div className="h-px bg-[#e3ebf5]" />

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Is there anything else about your health you&apos;d like us to know? (Optional)
            </span>
            <textarea
              value={otherConcerns}
              onChange={(event) => setOtherConcerns(event.target.value)}
              rows={4}
              className="w-full rounded-xl border border-[#d8e4f1] bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-offset-2 transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
            />
          </label>

          {showStep2Validation && !step2Valid && (
            <p className="text-xs font-medium text-red-600">Please answer all questions before submitting.</p>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex h-11 items-center rounded-xl border border-[#d8e4f1] bg-white px-4 text-sm font-semibold text-slate-700"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex h-11 items-center rounded-xl bg-[#3399e6] px-4 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(51,153,230,0.32)]"
            >
              Submit Form
            </button>
          </div>
        </>
      )}
    </TodoWorkspaceShell>
  );
}

const THREAD_META: Record<
  'dusw' | 'tc-frontdesk',
  { subject: string; participantRole: 'dusw' | 'tc_employee' }
> = {
  dusw: { subject: 'Dialysis Team', participantRole: 'dusw' },
  'tc-frontdesk': { subject: 'ChristianaCare Front Desk', participantRole: 'tc_employee' },
};

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  if (diff < 60_000) return 'now';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}h`;
  if (diff < 7 * 24 * 60 * 60_000) return `${Math.floor(diff / (24 * 60 * 60_000))}d`;
  return new Date(iso).toLocaleDateString();
}

function formatTimestampLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function deriveThreadsFromPatient(patient: StorePatient | null): CareThread[] {
  if (!patient) return [];
  const keys: Array<keyof typeof THREAD_META> = ['tc-frontdesk', 'dusw'];
  const threads: CareThread[] = keys.map((key) => {
    const meta = THREAD_META[key];
    const messages = patient.messages
      .filter((m) => m.threadKey === key)
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
    const participantName =
      key === 'dusw'
        ? patient.duswName ?? 'Dialysis Social Worker'
        : patient.messages.find((m) => m.threadKey === 'tc-frontdesk' && m.fromRole === 'staff')
            ?.fromName ?? 'Sarah Martinez';
    const participantOrganization =
      key === 'dusw'
        ? patient.referringClinic ?? 'Dialysis Clinic'
        : 'ChristianaCare Transplant Center';
    const lastMessage = messages[messages.length - 1];
    const unreadCount = messages.filter(
      (m) => !m.readByPatient && m.fromRole !== 'patient'
    ).length;
    const mapped: CareThreadMessage[] = messages.map((m) => ({
      id: m.id,
      senderName: m.fromRole === 'patient' ? 'You' : m.fromName,
      senderRole:
        m.fromRole === 'patient' ? 'patient' : m.fromRole === 'clinic' ? 'dusw' : 'tc_employee',
      body: m.body,
      timestampLabel: formatTimestampLabel(m.sentAt),
      isRead: m.readByPatient,
    }));
    return {
      id: `thread-${patient.id}-${key}`,
      subject: meta.subject,
      participantName,
      participantRole: meta.participantRole,
      participantOrganization,
      previewText: lastMessage?.body ?? 'No messages yet.',
      relativeTimeLabel: lastMessage ? formatRelativeTime(lastMessage.sentAt) : '—',
      unreadCount,
      messages: mapped,
    };
  });
  return threads;
}

function threadIdToKey(threadId: string): 'dusw' | 'tc-frontdesk' | null {
  if (threadId.endsWith('-dusw')) return 'dusw';
  if (threadId.endsWith('-tc-frontdesk')) return 'tc-frontdesk';
  return null;
}

function ameliaReplyFor(input: string): string {
  const normalized = input.toLowerCase();
  for (const entry of AMELIA_ANSWERS) {
    if (entry.keywords.some((k) => normalized.includes(k))) {
      return entry.answer;
    }
  }
  return AMELIA_FALLBACK;
}

function VirtualAssistantTab({
  onGoToTodoList,
}: {
  onGoToTodoList?: () => void;
}) {
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>(INITIAL_ASSISTANT_MESSAGES);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantTyping, setAssistantTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  // Track whether the user is currently pinned to the bottom of the scroll
  // area. If they've scrolled up to read older messages, we don't yank them
  // back when a new message arrives.
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 40;
  }

  // Auto-scroll to bottom when new messages or the typing indicator appear,
  // unless the user has scrolled up to read history.
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [assistantMessages.length, assistantTyping]);

  function sendAssistantMessage(overrideInput?: string) {
    const message = (overrideInput ?? assistantInput).trim();
    if (!message || assistantTyping) return;

    // Sending a new message always pulls the user back to the latest exchange.
    stickToBottomRef.current = true;

    setAssistantInput('');
    setAssistantMessages((previous) => [
      ...previous,
      {
        id: `assistant-user-${Date.now()}`,
        role: 'user',
        content: message,
        timestampLabel: 'Now',
      },
    ]);
    setAssistantTyping(true);

    window.setTimeout(() => {
      setAssistantMessages((previous) => [
        ...previous,
        {
          id: `assistant-reply-${Date.now()}`,
          role: 'assistant',
          content: ameliaReplyFor(message),
          timestampLabel: 'Now',
        },
      ]);
      setAssistantTyping(false);
    }, 800);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f2f2f7]">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4"
      >
        {assistantMessages.map((message) =>
          message.role === 'user' ? (
            <VirtualAssistantUserBubble key={message.id} message={message} />
          ) : (
            <VirtualAssistantAmeliaBubble key={message.id} message={message} onGoToTodoList={onGoToTodoList} />
          )
        )}

        {assistantTyping && <VirtualAssistantTypingBubble />}
      </div>

      {/* mb-[68px] keeps the bottom dock above the absolutely-positioned nav */}
      <div className="mb-[68px] border-t border-[#d9e1ec] bg-[#f2f2f7] px-3 pb-3 pt-2">
        <div className="-mx-3 mb-2 flex gap-2 overflow-x-auto px-3 pb-1">
          {QUICK_HELP_CHIPS.map((chip) => {
            const Icon = chip.icon;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => sendAssistantMessage(chip.title)}
                disabled={assistantTyping}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-2 text-xs text-slate-700 shadow-[0_2px_6px_rgba(15,23,42,0.08)] disabled:opacity-60"
              >
                <Icon className="h-3.5 w-3.5 text-[#3399e6]" />
                {chip.title}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={assistantInput}
            onChange={(event) => setAssistantInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendAssistantMessage();
              }
            }}
            placeholder="Ask Amelia anything..."
            className="h-11 flex-1 rounded-full border border-[#d9e1ec] bg-white px-4 text-sm text-slate-800 outline-none focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
          />
          <button
            type="button"
            onClick={() => sendAssistantMessage()}
            disabled={assistantInput.trim().length === 0 || assistantTyping}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${
              assistantInput.trim().length > 0 && !assistantTyping
                ? 'bg-gradient-to-br from-[#3399e6] to-[#5469e8]'
                : 'bg-slate-300'
            }`}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessagesTab({
  intent,
  patient,
}: {
  intent?: MessagesIntent;
  patient: StorePatient | null;
}) {
  const sendMessageAction = useStore((s) => s.sendMessage);
  const markThreadReadAction = useStore((s) => s.markThreadRead);
  const markMessagesReadAction = useStore((s) => s.markMessagesRead);

  const threads = useMemo(() => deriveThreadsFromPatient(patient), [patient]);

  const initialUnreadThreadId = useMemo(() => {
    if (intent !== 'openFirstUnread') return null;
    return threads.find((t) => t.unreadCount > 0)?.id ?? null;
  }, [intent, threads]);

  const didApplyIntent = useRef(false);
  useEffect(() => {
    if (intent !== 'openFirstUnread' || didApplyIntent.current) return;
    if (!patient) return;
    const firstUnread = threads.find((t) => t.unreadCount > 0);
    if (firstUnread) {
      const key = threadIdToKey(firstUnread.id);
      if (key) markThreadReadAction(patient.id, key, 'patient');
    }
    didApplyIntent.current = true;
  }, [intent, threads, patient, markThreadReadAction]);

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(initialUnreadThreadId);
  const [threadReply, setThreadReply] = useState('');
  const [threadReplyAttachments, setThreadReplyAttachments] = useState<Attachment[]>([]);
  const [threadSearch, setThreadSearch] = useState('');
  const [threadFilter, setThreadFilter] = useState<'all' | 'unread'>('all');

  const [showComposer, setShowComposer] = useState(false);
  const [composeRecipientIdState, setComposeRecipientId] = useState(
    () => threads[0]?.id ?? ''
  );
  const composeRecipientId =
    composeRecipientIdState && threads.some((t) => t.id === composeRecipientIdState)
      ? composeRecipientIdState
      : (threads[0]?.id ?? '');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeAttachments, setComposeAttachments] = useState<ComposeAttachment[]>([]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId]
  );
  const filteredThreads = useMemo(() => {
    const query = threadSearch.trim().toLowerCase();
    return threads.filter((thread) => {
      if (threadFilter === 'unread' && thread.unreadCount === 0) return false;
      if (!query) return true;
      const haystack = [
        thread.participantName,
        thread.subject,
        thread.previewText,
        thread.participantOrganization,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [threadFilter, threadSearch, threads]);
  const hasUnreadThreads = useMemo(() => threads.some((thread) => thread.unreadCount > 0), [threads]);

  function openThread(threadId: string) {
    if (patient) {
      const key = threadIdToKey(threadId);
      if (key) markThreadReadAction(patient.id, key, 'patient');
    }
    setSelectedThreadId(threadId);
    setThreadReply('');
    setThreadReplyAttachments([]);
  }

  function sendThreadReply() {
    const message = threadReply.trim();
    if (!selectedThread || !patient) return;
    if (message.length === 0 && threadReplyAttachments.length === 0) return;
    const key = threadIdToKey(selectedThread.id);
    if (!key) return;
    const body = appendAttachmentSummary(message, threadReplyAttachments);
    sendMessageAction(patient.id, 'patient', body, key);
    setThreadReply('');
    setThreadReplyAttachments([]);
  }

  function sendComposedMessage() {
    const message = composeBody.trim();
    const subject = composeSubject.trim();
    if (!composeRecipientId || !message || !subject || !patient) return;

    const bodyWithSubject = `${subject}\n\n${message}`;
    const messageWithAttachments = appendAttachmentSummary(bodyWithSubject, composeAttachments);

    const key = threadIdToKey(composeRecipientId);
    if (!key) return;
    sendMessageAction(patient.id, 'patient', messageWithAttachments, key);
    setComposeSubject('');
    setComposeBody('');
    setComposeAttachments([]);
    setShowComposer(false);
    setSelectedThreadId(composeRecipientId);
  }

  function markAllThreadsReadLocal() {
    if (!patient) return;
    markMessagesReadAction(patient.id, 'patient');
  }

  function handleComposeAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setComposeAttachments((previous) => [
      ...previous,
      ...Array.from(files).map((file, index) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${index}`,
        name: file.name,
        sizeLabel:
          file.size >= 1024 * 1024
            ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
            : file.size >= 1024
              ? `${Math.round(file.size / 1024)} KB`
              : `${file.size} B`,
      })),
    ]);
    event.target.value = '';
  }

  function removeComposeAttachment(attachmentId: string) {
    setComposeAttachments((previous) => previous.filter((attachment) => attachment.id !== attachmentId));
  }

  function removeThreadReplyAttachment(attachmentId: string) {
    setThreadReplyAttachments((previous) => previous.filter((attachment) => attachment.id !== attachmentId));
  }

  const canSendComposedMessage =
    composeRecipientId.trim().length > 0 && composeSubject.trim().length > 0 && composeBody.trim().length > 0;

  return (
    <div className="space-y-3">
      <section className="relative overflow-hidden rounded-2xl border border-[#e0e7f2] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
          {selectedThread ? (
            <div className="flex min-h-[560px] flex-col">
              <div className="flex items-center gap-3 border-b border-[#e3eaf4] px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSelectedThreadId(null)}
                  className="rounded-full border border-[#dce4f0] p-1.5 text-slate-600"
                  aria-label="Back to message inbox"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{selectedThread.subject}</p>
                  <p className="text-[11px] text-slate-500">
                    {selectedThread.participantName} •{' '}
                    {selectedThread.participantRole === 'dusw' ? 'Social Worker' : 'Transplant Center'}
                  </p>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#f7f9fc] p-4">
                {selectedThread.messages.map((message) => (
                  <CareThreadBubble key={message.id} message={message} />
                ))}
              </div>

              <div className="border-t border-[#e3eaf4] bg-white">
                <AttachmentChips
                  attachments={threadReplyAttachments}
                  onRemove={removeThreadReplyAttachment}
                />
                <div className="flex items-end gap-2 p-3">
                  <textarea
                    value={threadReply}
                    onChange={(event) => setThreadReply(event.target.value)}
                    placeholder="Write a reply..."
                    rows={1}
                    className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl border border-[#dce4f0] bg-[#f4f7fb] px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
                  />
                  <AttachButton
                    size="sm"
                    onAttach={(next) =>
                      setThreadReplyAttachments((previous) => [...previous, ...next])
                    }
                  />
                  <button
                    type="button"
                    onClick={sendThreadReply}
                    disabled={threadReply.trim().length === 0 && threadReplyAttachments.length === 0}
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      threadReply.trim().length > 0 || threadReplyAttachments.length > 0
                        ? 'bg-[#3399e6] text-white'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    <SendHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative min-h-[560px]">
              <div className="space-y-3 border-b border-[#e3eaf4] px-4 py-3">
                <p className="text-xs leading-relaxed text-slate-500">
                  Secure messages with your dialysis team and transplant center staff.
                </p>

                <div className="flex items-center gap-2 rounded-xl border border-[#dce4f0] bg-[#f6f9fd] px-3 py-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    type="search"
                    value={threadSearch}
                    onChange={(event) => setThreadSearch(event.target.value)}
                    placeholder="Search threads"
                    className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setThreadFilter('all')}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        threadFilter === 'all'
                          ? 'bg-[#3399e6] text-white shadow-[0_4px_10px_rgba(51,153,230,0.3)]'
                          : 'bg-[#eef2f7] text-slate-600'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setThreadFilter('unread')}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        threadFilter === 'unread'
                          ? 'bg-[#3399e6] text-white shadow-[0_4px_10px_rgba(51,153,230,0.3)]'
                          : 'bg-[#eef2f7] text-slate-600'
                      }`}
                    >
                      Unread
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={markAllThreadsReadLocal}
                    disabled={!hasUnreadThreads}
                    className={`text-xs font-semibold ${
                      hasUnreadThreads ? 'text-[#1a66cc]' : 'cursor-not-allowed text-slate-400'
                    }`}
                  >
                    Mark all read
                  </button>
                </div>
              </div>

              <div className="max-h-[510px] divide-y divide-[#eef2f7] overflow-y-auto">
                {filteredThreads.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <p className="text-sm font-medium text-slate-600">No threads match your search.</p>
                    <p className="mt-1 text-xs text-slate-400">Try changing the filter or search text.</p>
                  </div>
                ) : (
                  filteredThreads.map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => openThread(thread.id)}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-[#f8fbff]"
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          thread.unreadCount > 0 ? 'bg-[#3399e6]' : 'bg-transparent'
                        }`}
                      />
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#dcebfa] text-xs font-bold text-[#2d80c9]">
                        {initialsFor(thread.participantName)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`truncate text-sm ${
                              thread.unreadCount > 0 ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'
                            }`}
                          >
                            {thread.participantName}
                          </p>
                          <p className="shrink-0 text-[11px] text-slate-400">{thread.relativeTimeLabel}</p>
                        </div>
                        <p className="truncate text-xs font-medium text-slate-700">{thread.subject}</p>
                        <p className="truncate text-xs text-slate-500">{thread.previewText}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{thread.participantOrganization}</p>
                      </div>

                      {thread.unreadCount > 0 && (
                        <span className="rounded-full bg-[#3399e6] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {thread.unreadCount}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </button>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowComposer(true)}
                className="absolute bottom-4 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#3399e6] text-white shadow-[0_10px_22px_rgba(51,153,230,0.45)]"
                aria-label="Compose a new message"
              >
                <PenSquare className="h-5 w-5" />
              </button>
            </div>
          )}

          {showComposer && (
            <div className="absolute inset-0 z-20 flex items-end bg-black/35">
              <div className="w-full rounded-t-[28px] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">New Message</h3>
                  <button
                    type="button"
                    onClick={() => setShowComposer(false)}
                    className="text-xs font-semibold text-slate-500"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Recipient
                    </span>
                    <select
                      value={composeRecipientId}
                      onChange={(event) => setComposeRecipientId(event.target.value)}
                      className="h-11 w-full rounded-xl border border-[#dce4f0] bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
                    >
                      {threads.map((thread) => (
                        <option key={thread.id} value={thread.id}>
                          {thread.participantName} ({thread.participantRole === 'dusw' ? 'Dialysis' : 'Transplant Center'})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Subject
                    </span>
                    <input
                      value={composeSubject}
                      onChange={(event) => setComposeSubject(event.target.value)}
                      placeholder="Enter message subject"
                      className="h-11 w-full rounded-xl border border-[#dce4f0] bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Message
                    </span>
                    <textarea
                      value={composeBody}
                      onChange={(event) => setComposeBody(event.target.value)}
                      rows={4}
                      placeholder="Type your secure message..."
                      className="w-full rounded-xl border border-[#dce4f0] bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Attach Documents (Optional)
                    </span>
                    <div className="rounded-xl border border-dashed border-[#c9daee] bg-[#f7fbff] p-3">
                      <label
                        htmlFor="compose-attachments"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#dce4f0] bg-white px-3 py-2 text-xs font-semibold text-[#1a66cc]"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        Attach Document
                      </label>
                      <input
                        id="compose-attachments"
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={handleComposeAttachmentChange}
                        className="hidden"
                      />
                      <p className="mt-2 text-[11px] text-slate-500">
                        Simulated upload for prototype messaging.
                      </p>

                      {composeAttachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {composeAttachments.map((attachment) => (
                            <div
                              key={attachment.id}
                              className="flex items-center justify-between rounded-lg border border-[#dce4f0] bg-white px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-slate-700">{attachment.name}</p>
                                <p className="text-[11px] text-slate-500">{attachment.sizeLabel}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeComposeAttachment(attachment.id)}
                                className="ml-3 text-[11px] font-semibold text-slate-500"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>

                  <button
                    type="button"
                    onClick={sendComposedMessage}
                    disabled={!canSendComposedMessage}
                    className={`inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white ${
                      canSendComposedMessage ? 'bg-[#3399e6]' : 'bg-slate-300'
                    }`}
                  >
                    Send Message
                  </button>
                </div>
              </div>
            </div>
          )}
      </section>
    </div>
  );
}

function VirtualAssistantAmeliaBubble({
  message,
  onGoToTodoList,
}: {
  message: AssistantMessage;
  onGoToTodoList?: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="max-w-[85%]">
        <div className="rounded-[18px] rounded-bl-[6px] bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
          {message.content.split('\n\n').map((para, i) => (
            <p key={i} className={i > 0 ? 'mt-2' : ''}>
              {para.split(/(\*\*[^*]+\*\*)/).map((chunk, j) =>
                chunk.startsWith('**') && chunk.endsWith('**')
                  ? <strong key={j} className="font-semibold text-slate-900">{chunk.slice(2, -2)}</strong>
                  : chunk
              )}
            </p>
          ))}
        </div>
        {message.navigationLabel && (
          <button
            type="button"
            onClick={onGoToTodoList}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#3399e6] to-[#6b4be8] px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:opacity-90 active:scale-95"
          >
            <ListChecks className="h-3.5 w-3.5" />
            {message.navigationLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
        <p className="mt-1 px-1 text-[10px] text-slate-400">{message.timestampLabel}</p>
      </div>
    </div>
  );
}

function VirtualAssistantUserBubble({ message }: { message: AssistantMessage }) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[86%] rounded-[18px] rounded-br-[6px] px-3 py-2 text-sm text-white"
        style={{ background: 'linear-gradient(135deg, #3399e6, #4c86e8)' }}
      >
        {message.content}
        <p className="mt-1 text-right text-[10px] text-white/80">{message.timestampLabel}</p>
      </div>
    </div>
  );
}

function VirtualAssistantTypingBubble() {
  return (
    <div className="flex items-start gap-2">
      <div
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'linear-gradient(135deg, #3399e6, #6b4be8)' }}
      >
        <Brain className="h-4.5 w-4.5 text-white" />
      </div>
      <div className="inline-flex items-center gap-1 rounded-[18px] rounded-bl-[6px] bg-white px-3 py-2 shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#3399e6] [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#3399e6] [animation-delay:120ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#3399e6] [animation-delay:240ms]" />
      </div>
    </div>
  );
}

function CareThreadBubble({ message }: { message: CareThreadMessage }) {
  const isPatient = message.senderRole === 'patient';
  return (
    <div className={isPatient ? 'flex justify-end' : 'flex justify-start'}>
      <div className={isPatient ? 'max-w-[84%]' : 'max-w-[86%]'}>
        {!isPatient && (
          <p className="mb-1 px-1 text-[11px] font-medium text-slate-500">
            {message.senderName} • {message.senderRole === 'dusw' ? 'Social Worker' : 'Transplant Center'}
          </p>
        )}
        <div
          className={`rounded-[16px] px-3 py-2 text-sm leading-relaxed ${
            isPatient
              ? 'rounded-br-[6px] text-white'
              : 'rounded-bl-[6px] bg-[#eef2f7] text-slate-800 shadow-[0_1px_4px_rgba(15,23,42,0.06)]'
          }`}
          style={isPatient ? { background: 'linear-gradient(135deg, #3399e6, #4c86e8)' } : undefined}
        >
          {message.body}
        </div>
        <p className={`mt-1 text-[10px] text-slate-400 ${isPatient ? 'text-right' : 'text-left'}`}>
          {message.timestampLabel}
        </p>
      </div>
    </div>
  );
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function ProfileTab({ displayName, username }: { displayName: string; username: string }) {
  type ProfilePhysician = {
    id: string;
    name: string;
    specialty: string;
  };

  type ProfileData = {
    fullName: string;
    dateOfBirth: string;
    address: string;
    email: string;
    phone: string;
    emergencyContactName: string;
    emergencyContactRelationship: string;
    emergencyContactPhone: string;
    height: string;
    weight: string;
    nephrologistName: string;
    pcpName: string;
    otherPhysicians: ProfilePhysician[];
    onDialysis: boolean;
    dialysisType: string;
    dialysisStartDate: string;
    lastGfr: string;
    diagnosedConditions: string;
    pastSurgeries: string;
    socialWorkerName: string;
    socialWorkerEmail: string;
    socialWorkerPhone: string;
    dialysisClinicName: string;
    dialysisClinicAddress: string;
  };

  const seedProfile: ProfileData = {
    fullName: displayName,
    dateOfBirth: '1976-04-22',
    address: '1287 Harbor Ridge Dr, Wilmington, DE 19808',
    email: username || 'jeremy.rolls@portal.test',
    phone: '(302) 555-0198',
    emergencyContactName: 'Maya Rolls',
    emergencyContactRelationship: 'Spouse',
    emergencyContactPhone: '(302) 555-0134',
    height: "5' 8\"",
    weight: '168',
    nephrologistName: 'Dr. Priya Menon',
    pcpName: 'Dr. Steven Patel',
    otherPhysicians: [
      { id: 'phys-1', name: 'Dr. Rachel Kim', specialty: 'Cardiology' },
      { id: 'phys-2', name: 'Dr. Luis Martinez', specialty: 'Endocrinology' },
    ],
    onDialysis: true,
    dialysisType: 'Hemodialysis',
    dialysisStartDate: 'March 2024',
    lastGfr: '14',
    diagnosedConditions: 'Chronic kidney disease, stage 5; hypertension',
    pastSurgeries: 'AV fistula placement (2024)',
    socialWorkerName: 'Jordan Lee, LCSW',
    socialWorkerEmail: 'jordan.lee@riverdialysis.org',
    socialWorkerPhone: '(302) 555-0172',
    dialysisClinicName: 'River Dialysis Center',
    dialysisClinicAddress: '925 North Market St, Wilmington, DE 19801',
  };

  const [profile, setProfile] = useState<ProfileData>(seedProfile);
  const [draftProfile, setDraftProfile] = useState<ProfileData>(seedProfile);
  const [isEditing, setIsEditing] = useState(false);

  function beginEditing() {
    setDraftProfile(profile);
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftProfile(profile);
    setIsEditing(false);
  }

  function saveProfile() {
    setProfile(draftProfile);
    setIsEditing(false);
  }

  function profileValue<K extends keyof ProfileData>(key: K) {
    return isEditing ? draftProfile[key] : profile[key];
  }

  function updateDraft<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setDraftProfile((previous) => ({ ...previous, [key]: value }));
  }

  const fullName = profileValue('fullName');
  const email = profileValue('email');

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Profile</h2>
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-full border border-[#dce4f0] px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={isEditing ? saveProfile : beginEditing}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                isEditing
                  ? 'bg-[#3399e6] text-white shadow-[0_8px_14px_rgba(51,153,230,0.28)]'
                  : 'border border-[#dce4f0] bg-white text-[#1a66cc]'
              }`}
            >
              {isEditing ? 'Save' : 'Edit'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-[#f4f7fb] p-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-white"
            style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})` }}
          >
            <span className="text-lg font-bold">{initialsFor(fullName || displayName)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-slate-900">{fullName || displayName}</p>
            <p className="truncate text-xs text-slate-500">{email || username || 'jeremy.rolls@portal.test'}</p>
            <p className="mt-1 text-[11px] font-medium text-[#1a66cc]">Profile synced</p>
          </div>
        </div>
      </section>

      <ProfileSectionCard icon={UserRound} title="Personal Information">
        <EditableProfileField
          label="Full Name"
          value={profileValue('fullName')}
          isEditing={isEditing}
          onChange={(value) => updateDraft('fullName', value)}
        />
        <EditableProfileField
          label="Date of Birth"
          type="date"
          value={profileValue('dateOfBirth')}
          isEditing={isEditing}
          onChange={(value) => updateDraft('dateOfBirth', value)}
        />
        <EditableProfileField
          label="Address"
          value={profileValue('address')}
          isEditing={isEditing}
          multiline
          onChange={(value) => updateDraft('address', value)}
        />
      </ProfileSectionCard>

      <ProfileSectionCard icon={Phone} title="Contact Information">
        <EditableProfileField
          label="Email"
          type="email"
          value={profileValue('email')}
          isEditing={isEditing}
          onChange={(value) => updateDraft('email', value)}
        />
        <EditableProfileField
          label="Phone"
          type="tel"
          value={profileValue('phone')}
          isEditing={isEditing}
          onChange={(value) => updateDraft('phone', value)}
        />
      </ProfileSectionCard>

      <ProfileSectionCard icon={CircleHelp} title="Emergency Contact">
        <EditableProfileField
          label="Name"
          value={profileValue('emergencyContactName')}
          isEditing={isEditing}
          onChange={(value) => updateDraft('emergencyContactName', value)}
        />
        <EditableProfileField
          label="Relationship"
          value={profileValue('emergencyContactRelationship')}
          isEditing={isEditing}
          onChange={(value) => updateDraft('emergencyContactRelationship', value)}
        />
        <EditableProfileField
          label="Phone"
          type="tel"
          value={profileValue('emergencyContactPhone')}
          isEditing={isEditing}
          onChange={(value) => updateDraft('emergencyContactPhone', value)}
        />
      </ProfileSectionCard>

      <ProfileSectionCard icon={HeartPulse} title="Physical Information">
        <div className="grid grid-cols-2 gap-2">
          <EditableProfileField
            label="Height"
            value={profileValue('height')}
            isEditing={isEditing}
            onChange={(value) => updateDraft('height', value)}
          />
          <EditableProfileField
            label="Weight (lbs)"
            value={profileValue('weight')}
            isEditing={isEditing}
            onChange={(value) => updateDraft('weight', value)}
          />
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard icon={Users} title="Medical Providers">
        <EditableProfileField
          label="Nephrologist"
          value={profileValue('nephrologistName')}
          isEditing={isEditing}
          onChange={(value) => updateDraft('nephrologistName', value)}
        />
        <EditableProfileField
          label="Primary Care Physician"
          value={profileValue('pcpName')}
          isEditing={isEditing}
          onChange={(value) => updateDraft('pcpName', value)}
        />
        <div className="rounded-xl bg-[#f4f7fb] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Other Physicians</p>
          <div className="mt-2 space-y-2">
            {(profileValue('otherPhysicians') as ProfilePhysician[]).map((physician) => (
              <div key={physician.id} className="rounded-lg border border-[#dbe6f2] bg-white px-3 py-2">
                <p className="text-sm font-semibold text-slate-800">{physician.name}</p>
                <p className="text-xs text-slate-500">{physician.specialty}</p>
              </div>
            ))}
          </div>
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard icon={FileText} title="Medical History">
        <div className="rounded-xl bg-[#f4f7fb] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dialysis Status</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {profileValue('onDialysis')
              ? `On Dialysis: ${String(profileValue('dialysisType'))}`
              : 'Not on dialysis'}
          </p>
          {profileValue('onDialysis') && (
            <p className="text-xs text-slate-500">Started: {String(profileValue('dialysisStartDate'))}</p>
          )}
        </div>
        <EditableProfileField
          label="Last GFR"
          value={profileValue('lastGfr')}
          isEditing={isEditing}
          onChange={(value) => updateDraft('lastGfr', value)}
        />
        <EditableProfileField
          label="Diagnosed Conditions"
          value={profileValue('diagnosedConditions')}
          isEditing={isEditing}
          multiline
          onChange={(value) => updateDraft('diagnosedConditions', value)}
        />
        <EditableProfileField
          label="Past Surgeries"
          value={profileValue('pastSurgeries')}
          isEditing={isEditing}
          multiline
          onChange={(value) => updateDraft('pastSurgeries', value)}
        />
      </ProfileSectionCard>

      <ProfileSectionCard icon={Users} title="Care Team">
        <div className="space-y-2">
          <div className="rounded-xl bg-[#f4f7fb] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Assigned Social Worker</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{profileValue('socialWorkerName')}</p>
            <div className="mt-1 space-y-1 text-xs text-slate-500">
              <p className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                {profileValue('socialWorkerEmail')}
              </p>
              <p className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                {profileValue('socialWorkerPhone')}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#f4f7fb] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dialysis Clinic</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{profileValue('dialysisClinicName')}</p>
            <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>{profileValue('dialysisClinicAddress')}</span>
            </p>
          </div>
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard icon={Lock} title="Account Settings">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-xl bg-[#f4f7fb] px-3 py-3 text-left"
        >
          <span className="text-sm font-semibold text-slate-800">Change Password</span>
          <span className="text-[11px] font-medium text-slate-500">Simulated</span>
        </button>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-xl bg-[#fff1f2] px-3 py-3 text-left"
        >
          <span className="text-sm font-semibold text-rose-700">Delete Account</span>
          <span className="text-[11px] font-medium text-rose-500">Simulated</span>
        </button>
      </ProfileSectionCard>
    </div>
  );
}

function ProfileSectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
      <div className="mb-3 flex items-center gap-2">
        <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#eaf4fc] text-[#1a66cc]">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function EditableProfileField({
  isEditing,
  label,
  multiline = false,
  onChange,
  type = 'text',
  value,
}: {
  isEditing: boolean;
  label: string;
  multiline?: boolean;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'tel' | 'date';
  value: string;
}) {
  if (isEditing) {
    return (
      <label className="block rounded-xl border border-[#dbe6f2] bg-[#f9fbfe] px-3 py-2">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        {multiline ? (
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={3}
            className="w-full resize-none border-0 bg-transparent p-0 text-sm text-slate-800 outline-none"
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full border-0 bg-transparent p-0 text-sm text-slate-800 outline-none"
          />
        )}
      </label>
    );
  }

  return (
    <div className="rounded-xl bg-[#f4f7fb] px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value || 'Not specified'}</p>
    </div>
  );
}

function HelpTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Help & Support</h2>
      <section className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
        <div className="space-y-2">
          <SupportRow title="Message Care Team" subtitle="Typical response in under 2 hours" />
          <SupportRow title="Call Transplant Coordinator" subtitle="Direct line: (302) 555-0142" />
          <SupportRow title="Technical Support" subtitle="Available 24/7 for app issues" />
        </div>
      </section>
    </div>
  );
}

function SupportRow({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-xl bg-[#f4f7fb] p-3 text-left transition hover:bg-[#edf3fa]"
    >
      <CircleHelp className="h-4 w-4 text-[#3399e6]" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-400" />
    </button>
  );
}

function CoordinatorIntroOverlay({
  displayName,
  onContinue,
}: {
  displayName: string;
  onContinue: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 px-5">
      <div className="w-full rounded-[30px] bg-white/10 p-6 text-center backdrop-blur-xl">
        <div
          className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${PRIMARY}, #6c3ce9)`,
            boxShadow: '0 0 38px rgba(51, 153, 230, 0.6)',
          }}
        >
          <Brain className="h-11 w-11 text-white" />
        </div>
        <p className="text-xl font-semibold text-white/90">Meet Your Personal</p>
        <h3 className="text-3xl font-bold text-white">Transplant Guide</h3>
        <p className="mt-3 text-sm leading-relaxed text-white/85">
          Hi {displayName}! I can help you navigate your transplant journey, understand next steps, and stay ready
          for your appointments.
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white"
          style={{
            background: `linear-gradient(90deg, ${PRIMARY}, #6c3ce9)`,
            boxShadow: '0 14px 28px rgba(51, 153, 230, 0.4)',
          }}
        >
          Let&apos;s Get Started
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
