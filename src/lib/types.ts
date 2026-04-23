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

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  preferredLanguage: 'English' | 'Spanish';
  referringClinic: string;
  referringClinician: string;
  duswName: string;
  duswEmail: string;
  nephrologistName: string;
  nephrologistEmail: string;
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

export interface ClinicUser {
  name: string;
  clinicName: string;
}

export interface DemoState {
  patients: Patient[];
  currentPatientId: string | null;
  currentStaffName: string;
  currentClinicUser: ClinicUser;

  submitReferral: (data: ReferralSubmission) => string;
  completeTodo: (patientId: string, todoId: string) => void;
  addCustomTodo: (patientId: string, title: string, description: string) => void;
  addEmergencyContactTodo: (patientId: string) => void;
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
  setCurrentPatient: (patientId: string) => void;
  resetDemo: () => void;
}
