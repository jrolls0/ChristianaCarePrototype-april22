export type PatientStage =
  | 'new-referral'
  | 'patient-onboarding'
  | 'initial-todos'
  | 'front-desk-review'
  | 'screening'
  | 'records-collection'
  | 'specialist-review'
  | 'scheduled';

export type TodoType =
  | 'sign-roi-services'
  | 'sign-roi-medical'
  | 'add-emergency-contact'
  | 'upload-government-id'
  | 'upload-insurance-card'
  | 'complete-health-questionnaire'
  | 'watch-education-video'
  | 'custom';

export type TodoStatus = 'pending' | 'completed';

export interface DocumentRequest {
  id: string;
  title: string;
  description?: string;
}

export interface Todo {
  id: string;
  type: TodoType;
  title: string;
  description: string;
  status: TodoStatus;
  completedAt?: string;
  isCustom?: boolean;
  addedByStaff?: string;
  addedAt?: string;
  documentRequests?: DocumentRequest[];
}

export type ThreadKey = 'dusw' | 'tc-frontdesk' | 'clinic-staff';

export type MessageRole = 'patient' | 'staff' | 'clinic';

export interface Message {
  id: string;
  threadId: string;
  threadKey: ThreadKey;
  fromRole: MessageRole;
  fromName: string;
  body: string;
  sentAt: string;
  readByPatient: boolean;
  readByStaff: boolean;
}

export interface DocumentRecord {
  id: string;
  name: string;
  uploadedAt: string;
  uploadedBy: 'patient' | 'clinic';
}

export interface EmergencyContact {
  name: string;
  email: string;
  phone: string;
  consented: boolean;
}

export type ReferralSource = 'clinic' | 'self';

export interface PortalAccount {
  username: string;
  password: string;
  createdAt: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  preferredLanguage: 'English' | 'Spanish';
  referralSource: ReferralSource;
  referringClinic?: string;
  referringClinician?: string;
  duswName?: string;
  duswEmail?: string;
  nephrologistName?: string;
  nephrologistEmail?: string;
  referralDate: string;
  stage: PatientStage;
  daysInStage: number;
  isStuck: boolean;
  todos: Todo[];
  messages: Message[];
  emergencyContact?: EmergencyContact;
  documents: DocumentRecord[];
  lastActivityAt: string;
  isCurrentPatient?: boolean;
  portalAccount?: PortalAccount;
  hasCompletedOnboarding?: boolean;
}

export interface ReferralSubmission {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  preferredLanguage: 'English' | 'Spanish';
  duswName: string;
  duswEmail: string;
  nephrologistName: string;
  nephrologistEmail: string;
  referringClinic: string;
}

export interface SelfRegistration {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  dob?: string;
  preferredLanguage?: 'English' | 'Spanish';
  referringClinic?: string;
  duswName?: string;
  duswEmail?: string;
  nephrologistName?: string;
  nephrologistEmail?: string;
}

export interface ClinicUser {
  name: string;
  clinicName: string;
}

export type PatientTab = 'home' | 'amelia' | 'messages' | 'profile' | 'help';

export type PatientRegistrationResult =
  | { ok: true; patientId: string }
  | { ok: false; reason: 'account-exists'; patientId?: string };

export type PatientAuthResult =
  | { ok: true; patientId: string }
  | { ok: false; reason: 'missing-account' | 'invalid-password' };

export interface DemoState {
  patients: Patient[];
  currentPatientId: string | null;
  currentStaffName: string;
  currentClinicUser: ClinicUser;
  lastPatientTab: PatientTab;

  submitReferral: (data: ReferralSubmission) => string;
  registerSelf: (data: SelfRegistration) => PatientRegistrationResult;
  authenticatePatient: (username: string, password: string) => PatientAuthResult;
  findPatientByEmail: (email: string) => Patient | undefined;
  markOnboardingComplete: (patientId: string) => void;
  setLastPatientTab: (tab: PatientTab) => void;
  completeTodo: (patientId: string, todoId: string) => void;
  addCustomTodo: (
    patientId: string,
    title: string,
    description: string,
    documentRequests?: { title: string; description?: string }[]
  ) => void;
  addEmergencyContactTodo: (patientId: string) => void;
  addEducationTodo: (patientId: string) => void;
  ensureInitialTodos: (patientId: string) => void;
  sendMessage: (
    patientId: string,
    fromRole: MessageRole,
    body: string,
    threadKey?: ThreadKey
  ) => void;
  markMessagesRead: (patientId: string, byRole: 'patient' | 'staff') => void;
  markThreadRead: (patientId: string, threadKey: ThreadKey, byRole: 'patient' | 'staff') => void;
  uploadDocument: (
    patientId: string,
    name: string,
    source: 'patient' | 'clinic'
  ) => void;
  setCurrentPatient: (patientId: string | null) => void;
  advancePatientStage: (patientId: string) => void;
  resetDemo: () => void;
}
