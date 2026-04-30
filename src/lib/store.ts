'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  DemoState,
  DocumentRecord,
  Message,
  MessageRole,
  Patient,
  ReferralSubmission,
  ThreadKey,
  Todo,
} from './types';
import { createInitialState } from './seedData';
import { getNextPatientStage, normalizePatientStage } from './stages';

export const STORAGE_KEY = 'transplant-prototype-state-v1';

const nextIdSuffix = (() => {
  let counter = 0;
  return () => {
    counter += 1;
    return `${Date.now()}-${counter}`;
  };
})();

const patientsById = (patients: Patient[]) =>
  new Map(patients.map((p) => [p.id, p] as const));

const replacePatient = (patients: Patient[], updated: Patient): Patient[] =>
  patients.map((p) => (p.id === updated.id ? updated : p));

const normalizeUsername = (value: string) => value.trim().toLowerCase();

const SERVICES_ROI_DOCUMENT = 'Services ROI';
const MEDICAL_ROI_DOCUMENT = 'Medical Records ROI';

function normalizedDocumentName(name: string): string {
  return name.trim().toLowerCase();
}

function hasDocumentNamed(
  documents: DocumentRecord[],
  name: string,
  uploadedBy?: DocumentRecord['uploadedBy']
): boolean {
  const lookup = normalizedDocumentName(name);
  return documents.some(
    (document) =>
      normalizedDocumentName(document.name) === lookup &&
      (!uploadedBy || document.uploadedBy === uploadedBy)
  );
}

function appendDocumentIfMissing(
  documents: DocumentRecord[],
  patientId: string,
  name: string,
  uploadedAt: string,
  uploadedBy: DocumentRecord['uploadedBy'] = 'patient'
): DocumentRecord[] {
  if (hasDocumentNamed(documents, name, uploadedBy)) return documents;
  return [
    ...documents,
    {
      id: `doc-${patientId}-${nextIdSuffix()}`,
      name,
      uploadedAt,
      uploadedBy,
    },
  ];
}

function withRoiDocuments(patient: Patient, now: string): Patient {
  const roiServices = patient.todos.find((todo) => todo.type === 'sign-roi-services');
  const roiMedical = patient.todos.find((todo) => todo.type === 'sign-roi-medical');
  const roiComplete =
    patient.roiSigned ??
    (roiServices?.status === 'completed' && roiMedical?.status === 'completed');
  if (!roiComplete) return patient;

  let documents = appendDocumentIfMissing(
    patient.documents,
    patient.id,
    SERVICES_ROI_DOCUMENT,
    roiServices?.completedAt ?? patient.roiSignedAt ?? now
  );
  documents = appendDocumentIfMissing(
    documents,
    patient.id,
    MEDICAL_ROI_DOCUMENT,
    roiMedical?.completedAt ?? patient.roiSignedAt ?? now
  );
  return { ...patient, documents };
}

function latestIso(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

function withDerivedPatientFields(patient: Patient): Patient {
  const roiServices = patient.todos.find((todo) => todo.type === 'sign-roi-services');
  const roiMedical = patient.todos.find((todo) => todo.type === 'sign-roi-medical');
  const roiSignedFromTodos =
    roiServices?.status === 'completed' && roiMedical?.status === 'completed';
  const emergencyContactConsentFromTodo = patient.todos.some(
    (todo) => todo.type === 'add-emergency-contact' && todo.status === 'completed'
  );
  const roiSigned = patient.roiSigned ?? roiSignedFromTodos;
  const roiSignedAt =
    patient.roiSignedAt ?? latestIso([roiServices?.completedAt, roiMedical?.completedAt]);

  return {
    ...patient,
    messages: patient.messages.map((message) => ({
      ...message,
      readByClinic: message.readByClinic ?? message.fromRole === 'clinic',
    })),
    stage: normalizePatientStage(patient.stage),
    roiSigned,
    roiSignedAt,
    smsConsent: patient.smsConsent ?? roiSigned,
    emailConsent: patient.emailConsent ?? roiSigned,
    phoneConsent: patient.phoneConsent ?? roiSigned,
    emergencyContactConsent:
      patient.emergencyContactConsent ??
      Boolean(patient.emergencyContact?.consented || emergencyContactConsentFromTodo),
  };
}

const normalizePersistedPatients = (patients: Patient[] | undefined): Patient[] | undefined =>
  patients?.map(withDerivedPatientFields);

const migratePersistedState = (persistedState: unknown): Partial<DemoState> => {
  const state =
    persistedState && typeof persistedState === 'object'
      ? (persistedState as Partial<DemoState>)
      : {};
  return {
    ...state,
    patients: normalizePersistedPatients(state.patients),
  };
};

const REQUIRED_INITIAL_TODO_TYPES: Todo['type'][] = [
  'upload-government-id',
  'upload-insurance-card',
  'complete-health-questionnaire',
];

function buildInitialTodo(patientId: string, type: Todo['type']): Todo {
  switch (type) {
    case 'upload-government-id':
      return {
        id: `todo-${patientId}-gov-id`,
        type,
        title: 'Upload Government ID',
        description: "A clear photo of your driver's license or passport.",
        status: 'pending',
      };
    case 'upload-insurance-card':
      return {
        id: `todo-${patientId}-insurance`,
        type,
        title: 'Upload Insurance Card',
        description: 'Front and back of your primary insurance card.',
        status: 'pending',
      };
    case 'complete-health-questionnaire':
      return {
        id: `todo-${patientId}-health`,
        type,
        title: 'Complete Health Questionnaire',
        description: 'A short form about your current health and medical history.',
        status: 'pending',
      };
    default:
      throw new Error(`Unsupported initial todo type: ${type}`);
  }
}

function initialTodosComplete(todos: Todo[]): boolean {
  return REQUIRED_INITIAL_TODO_TYPES.every((type) =>
    todos.some((todo) => todo.type === type && todo.status === 'completed')
  );
}

function advanceAfterInitialTodos(patient: Patient, now: string): Patient {
  if (normalizePatientStage(patient.stage) !== 'initial-todos') return patient;
  if (!initialTodosComplete(patient.todos)) return patient;
  return {
    ...patient,
    stage: 'initial-screening',
    daysInStage: 0,
    isStuck: false,
    lastActivityAt: now,
  };
}

const newSafeStorage = () =>
  createJSONStorage(() => {
    if (typeof window === 'undefined') {
      const noop: Storage = {
        length: 0,
        clear: () => {},
        getItem: () => null,
        key: () => null,
        removeItem: () => {},
        setItem: () => {},
      };
      return noop;
    }
    return window.localStorage;
  });

export const useStore = create<DemoState>()(
  persist(
    (set, get) => ({
      ...createInitialState(),

      submitReferral: (data: ReferralSubmission) => {
        const state = get();
        const match = state.patients.find(
          (p) =>
            p.firstName.toLowerCase() === data.firstName.toLowerCase() &&
            p.lastName.toLowerCase() === data.lastName.toLowerCase() &&
            p.email.toLowerCase() === data.email.toLowerCase()
        );
        const now = new Date().toISOString();

        if (match) {
          const systemMsg: Message = {
            id: `msg-${match.id}-referral-${nextIdSuffix()}`,
            threadId: `${match.id}-tc-frontdesk`,
            threadKey: 'tc-frontdesk',
            fromRole: 'staff',
            fromName: 'ChristianaCare System',
            body: `Referral received from ${data.referringClinic}.`,
            sentAt: now,
            readByPatient: false,
            readByStaff: true,
            readByClinic: true,
          };
          const hasDuswWelcome = match.messages.some((m) => m.threadKey === 'dusw');
          const duswWelcomeMsg: Message | null = hasDuswWelcome
            ? null
            : {
                id: `msg-${match.id}-dusw-welcome-${nextIdSuffix()}`,
                threadId: `${match.id}-dusw`,
                threadKey: 'dusw',
                fromRole: 'clinic',
                fromName: data.duswName,
                body: `Hi ${data.firstName}, I'm ${data.duswName.split(' ')[0]} from ${data.referringClinic}. I sent your referral to ChristianaCare — they'll reach out soon. Let me know if you have questions.`,
                sentAt: now,
                readByPatient: false,
                readByStaff: true,
                readByClinic: true,
              };
          const seededInitialTodos: Todo[] =
            match.todos.length === 0
              ? [
                  {
                    id: `todo-${match.id}-gov-id`,
                    type: 'upload-government-id',
                    title: 'Upload Government ID',
                    description: "A clear photo of your driver's license or passport.",
                    status: 'pending',
                  },
                  {
                    id: `todo-${match.id}-insurance`,
                    type: 'upload-insurance-card',
                    title: 'Upload Insurance Card',
                    description: 'Front and back of your primary insurance card.',
                    status: 'pending',
                  },
                  {
                    id: `todo-${match.id}-health`,
                    type: 'complete-health-questionnaire',
                    title: 'Complete Health Questionnaire',
                    description: 'A short form about your current health and medical history.',
                    status: 'pending',
                  },
                ]
              : match.todos;
          const updated: Patient = {
            ...match,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            dob: data.dob,
            preferredLanguage: data.preferredLanguage,
            duswName: data.duswName,
            duswEmail: data.duswEmail,
            nephrologistName: data.nephrologistName,
            nephrologistEmail: data.nephrologistEmail,
            referringClinic: data.referringClinic,
            referringClinician: data.nephrologistName,
            referralSource: 'clinic',
            referralDate: now,
            stage: 'onboarding',
            daysInStage: 0,
            isStuck: false,
            lastActivityAt: now,
            todos: seededInitialTodos,
            messages: duswWelcomeMsg
              ? [...match.messages, systemMsg, duswWelcomeMsg]
              : [...match.messages, systemMsg],
          };
          set({ patients: replacePatient(state.patients, updated) });
          return match.id;
        }

        const newId = `patient-${nextIdSuffix()}`;
        const newPatient: Patient = {
          id: newId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          dob: data.dob,
          preferredLanguage: data.preferredLanguage,
          referralSource: 'clinic',
          referringClinic: data.referringClinic,
          referringClinician: data.nephrologistName,
          duswName: data.duswName,
          duswEmail: data.duswEmail,
          nephrologistName: data.nephrologistName,
          nephrologistEmail: data.nephrologistEmail,
          referralDate: now,
          stage: 'onboarding',
          daysInStage: 0,
          isStuck: false,
          todos: [],
          messages: [
            {
              id: `msg-${newId}-referral`,
              threadId: `${newId}-tc-frontdesk`,
              threadKey: 'tc-frontdesk',
              fromRole: 'staff',
              fromName: 'ChristianaCare System',
              body: `Referral received from ${data.referringClinic}.`,
              sentAt: now,
              readByPatient: false,
              readByStaff: true,
              readByClinic: true,
            },
          ],
          documents: [],
          lastActivityAt: now,
        };
        set({ patients: [...state.patients, newPatient] });
        return newId;
      },

      registerSelf: (data) => {
        const state = get();
        const lookupEmail = normalizeUsername(data.email);
        const existingAccount = state.patients.find(
          (p) => p.portalAccount?.username === lookupEmail
        );
        if (existingAccount) {
          return {
            ok: false,
            reason: 'account-exists',
            patientId: existingAccount.id,
          };
        }
        const match = state.patients.find(
          (p) => normalizeUsername(p.email) === lookupEmail
        );
        const now = new Date().toISOString();
        const portalAccount = {
          username: lookupEmail,
          password: data.password,
          createdAt: now,
        };

        const seededInitialTodos = (patientId: string): Todo[] => [
          {
            id: `todo-${patientId}-gov-id`,
            type: 'upload-government-id',
            title: 'Upload Government ID',
            description: "A clear photo of your driver's license or passport.",
            status: 'pending',
          },
          {
            id: `todo-${patientId}-insurance`,
            type: 'upload-insurance-card',
            title: 'Upload Insurance Card',
            description: 'Front and back of your primary insurance card.',
            status: 'pending',
          },
          {
            id: `todo-${patientId}-health`,
            type: 'complete-health-questionnaire',
            title: 'Complete Health Questionnaire',
            description: 'A short form about your current health and medical history.',
            status: 'pending',
          },
        ];

        if (match) {
          // Email matches an existing patient — claim that record.
          // If they were a 'new-referral' from a clinic, promote and keep the clinic info.
          const wasNewReferral = match.stage === 'new-referral';
          const updated: Patient = {
            ...match,
            firstName: data.firstName || match.firstName,
            lastName: data.lastName || match.lastName,
            email: data.email,
            phone: data.phone || match.phone,
            dob: data.dob || match.dob,
            address: data.address || match.address,
            preferredLanguage:
              data.preferredLanguage || match.preferredLanguage,
            primaryCarePhysician:
              data.primaryCarePhysician || match.primaryCarePhysician,
            insuranceProvider:
              data.insuranceProvider || match.insuranceProvider,
            portalAccount,
            hasCompletedOnboarding: match.hasCompletedOnboarding ?? false,
            stage: wasNewReferral ? 'onboarding' : normalizePatientStage(match.stage),
            daysInStage: wasNewReferral ? 0 : match.daysInStage,
            isStuck: wasNewReferral ? false : match.isStuck,
            lastActivityAt: now,
            todos:
              match.todos.length === 0 ? seededInitialTodos(match.id) : match.todos,
            messages: wasNewReferral
              ? [
                  ...match.messages,
                  {
                    id: `msg-${match.id}-self-register-${nextIdSuffix()}`,
                    threadId: `${match.id}-tc-frontdesk`,
                    threadKey: 'tc-frontdesk',
                    fromRole: 'staff',
                    fromName: 'ChristianaCare System',
                    body: `Patient registered through the portal — referral from ${match.referringClinic ?? 'clinic'} attached.`,
                    sentAt: now,
                    readByPatient: true,
                    readByStaff: false,
                    readByClinic: true,
                  },
                ]
              : match.messages,
          };
          set({ patients: replacePatient(state.patients, updated) });
          return { ok: true, patientId: match.id };
        }

        const newId = `patient-${nextIdSuffix()}`;
        const clinicSelected = !!data.referringClinic;
        const newPatient: Patient = {
          id: newId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone ?? '',
          dob: data.dob ?? '',
          address: data.address,
          preferredLanguage: data.preferredLanguage ?? 'English',
          referralSource: 'self',
          referringClinic: data.referringClinic,
          referringClinician: data.nephrologistName,
          duswName: data.duswName,
          duswEmail: data.duswEmail,
          nephrologistName: data.nephrologistName,
          nephrologistEmail: data.nephrologistEmail,
          primaryCarePhysician: data.primaryCarePhysician,
          insuranceProvider: data.insuranceProvider,
          referralDate: now,
          stage: 'onboarding',
          daysInStage: 0,
          isStuck: false,
          portalAccount,
          hasCompletedOnboarding: false,
          todos: seededInitialTodos(newId),
          messages: [
            {
              id: `msg-${newId}-self-register`,
              threadId: `${newId}-tc-frontdesk`,
              threadKey: 'tc-frontdesk',
              fromRole: 'staff',
              fromName: 'ChristianaCare System',
              body: clinicSelected
                ? `Self-registered through the patient portal. Patient indicated dialysis at ${data.referringClinic}.`
                : 'Self-registered through the patient portal — needs follow-up to capture clinical info.',
              sentAt: now,
              readByPatient: true,
              readByStaff: false,
              readByClinic: true,
            },
          ],
          documents: [],
          lastActivityAt: now,
        };
        set({ patients: [...state.patients, newPatient] });
        return { ok: true, patientId: newId };
      },

      authenticatePatient: (username, password) => {
        const lookup = normalizeUsername(username);
        const patient = get().patients.find(
          (p) => p.portalAccount?.username === lookup
        );
        if (!patient || !patient.portalAccount) {
          return { ok: false, reason: 'missing-account' };
        }
        if (patient.portalAccount.password !== password) {
          return { ok: false, reason: 'invalid-password' };
        }
        set({ currentPatientId: patient.id });
        return { ok: true, patientId: patient.id };
      },

      findPatientByEmail: (email) => {
        const lookup = normalizeUsername(email);
        if (!lookup) return undefined;
        return get().patients.find((p) => normalizeUsername(p.email) === lookup);
      },

      saveCommunicationConsents: (patientId, consents) => {
        const now = new Date().toISOString();
        set({
          patients: get().patients.map((p) =>
            p.id !== patientId
              ? p
              : {
                  ...p,
                  emailConsent: consents.emailConsent,
                  smsConsent: consents.smsConsent,
                  phoneConsent: consents.phoneConsent,
                  lastActivityAt: now,
                }
          ),
        });
      },

      saveEmergencyContact: (patientId, contact) => {
        const now = new Date().toISOString();
        set({
          patients: get().patients.map((p) =>
            p.id !== patientId
              ? p
              : {
                  ...p,
                  emergencyContact: contact,
                  emergencyContactConsent: contact.consented,
                  lastActivityAt: now,
                }
          ),
        });
      },

      completeTodo: (patientId, todoId) => {
        const now = new Date().toISOString();
        set({
          patients: get().patients.map((p) => {
            if (p.id !== patientId) return p;
            const todo = p.todos.find((t) => t.id === todoId);
            const updated: Patient = {
              ...p,
              lastActivityAt: now,
              emergencyContactConsent:
                todo?.type === 'add-emergency-contact' ? true : p.emergencyContactConsent,
              todos: p.todos.map((t) =>
                t.id === todoId
                  ? { ...t, status: 'completed', completedAt: now }
                  : t
              ),
            };
            return advanceAfterInitialTodos(updated, now);
          }),
        });
      },

      addCustomTodo: (patientId, title, description, documentRequests) => {
        const now = new Date().toISOString();
        const staffName = get().currentStaffName;
        const cleanedRequests = (documentRequests ?? [])
          .map((r) => ({
            title: r.title.trim(),
            description: r.description?.trim() ? r.description.trim() : undefined,
          }))
          .filter((r) => r.title.length > 0);
        const todo: Todo = {
          id: `todo-custom-${nextIdSuffix()}`,
          type: 'custom',
          title,
          description,
          status: 'pending',
          isCustom: true,
          addedByStaff: staffName,
          addedAt: now,
          documentRequests:
            cleanedRequests.length > 0
              ? cleanedRequests.map((r, idx) => ({
                  id: `docreq-${nextIdSuffix()}-${idx}`,
                  title: r.title,
                  description: r.description,
                }))
              : undefined,
        };
        set({
          patients: get().patients.map((p) =>
            p.id !== patientId
              ? p
              : {
                  ...p,
                  todos: [...p.todos, todo],
                  lastActivityAt: now,
                }
          ),
        });
      },

      ensureInitialTodos: (patientId) => {
        set({
          patients: get().patients.map((p) => {
            if (p.id !== patientId) return p;
            const missingTodos = REQUIRED_INITIAL_TODO_TYPES.filter(
              (type) => !p.todos.some((todo) => todo.type === type)
            ).map((type) => buildInitialTodo(p.id, type));
            if (missingTodos.length === 0) return p;
            return { ...p, todos: [...p.todos, ...missingTodos] };
          }),
        });
      },

      addEducationTodo: (patientId) => {
        const now = new Date().toISOString();
        set({
          patients: get().patients.map((p) => {
            if (p.id !== patientId) return p;
            if (p.todos.some((t) => t.type === 'watch-education-video')) return p;
            const todo: Todo = {
              id: `todo-${patientId}-education`,
              type: 'watch-education-video',
              title: 'Watch Transplant Education Video',
              description: 'A 6-minute orientation on evaluation, surgery, and recovery.',
              status: 'pending',
              addedAt: now,
            };
            return { ...p, todos: [...p.todos, todo], lastActivityAt: now };
          }),
        });
      },

      addEmergencyContactTodo: (patientId) => {
        const now = new Date().toISOString();
        set({
          patients: get().patients.map((p) => {
            if (p.id !== patientId) return p;
            if (p.todos.some((t) => t.type === 'add-emergency-contact')) {
              return p;
            }
            const todo: Todo = {
              id: `todo-${patientId}-emergency`,
              type: 'add-emergency-contact',
              title: 'Add Emergency Contact',
              description: 'Add a trusted person we can reach in an emergency.',
              status: 'pending',
              addedAt: now,
            };
            return { ...p, todos: [todo, ...p.todos], lastActivityAt: now };
          }),
        });
      },

      sendMessage: (
        patientId: string,
        fromRole: MessageRole,
        body: string,
        threadKey?: ThreadKey
      ) => {
        const state = get();
        const patient = patientsById(state.patients).get(patientId);
        if (!patient) return;
        const now = new Date().toISOString();
        const key: ThreadKey =
          threadKey ??
          (fromRole === 'clinic' ? 'clinic-staff' : 'tc-frontdesk');
        const fromName =
          fromRole === 'patient'
            ? `${patient.firstName} ${patient.lastName}`
            : fromRole === 'staff'
            ? state.currentStaffName
            : state.currentClinicUser.name;
        const message: Message = {
          id: `msg-${patientId}-${nextIdSuffix()}`,
          threadId: `${patientId}-${key}`,
          threadKey: key,
          fromRole,
          fromName,
          body,
          sentAt: now,
          readByPatient: fromRole === 'patient',
          readByStaff: fromRole === 'staff',
          readByClinic: fromRole === 'clinic',
        };
        set({
          patients: replacePatient(state.patients, {
            ...patient,
            messages: [...patient.messages, message],
            lastActivityAt: now,
          }),
        });
      },

      markThreadRead: (patientId, threadKey, byRole) => {
        set({
          patients: get().patients.map((p) =>
            p.id !== patientId
              ? p
              : {
                  ...p,
                  messages: p.messages.map((m) =>
                    m.threadKey !== threadKey
                      ? m
                      : byRole === 'patient'
                        ? { ...m, readByPatient: true }
                        : byRole === 'clinic'
                          ? { ...m, readByClinic: true }
                          : { ...m, readByStaff: true }
                  ),
                }
          ),
        });
      },

      markMessagesRead: (patientId, byRole) => {
        set({
          patients: get().patients.map((p) =>
            p.id !== patientId
              ? p
              : {
                  ...p,
                  messages: p.messages.map((m) =>
                    byRole === 'patient'
                      ? { ...m, readByPatient: true }
                      : { ...m, readByStaff: true }
                  ),
                }
          ),
        });
      },

      uploadDocument: (patientId, name, source) => {
        const now = new Date().toISOString();
        const trimmedName = name.trim();
        if (!trimmedName) return;
        set({
          patients: get().patients.map((p) =>
            p.id !== patientId
              ? p
              : {
                  ...p,
                  documents: appendDocumentIfMissing(
                    p.documents,
                    patientId,
                    trimmedName,
                    now,
                    source
                  ),
                  lastActivityAt: now,
                }
          ),
        });
      },

      saveScreeningResponses: (patientId, responses) => {
        const now = new Date().toISOString();
        set({
          patients: get().patients.map((p) =>
            p.id !== patientId
              ? p
              : {
                  ...p,
                  screeningResponses: responses,
                  lastActivityAt: responses.completedAt || now,
                }
          ),
        });
      },

      endReferral: (patientId, payload) => {
        const now = new Date().toISOString();
        const staffName = get().currentStaffName;
        set({
          patients: get().patients.map((p) =>
            p.id !== patientId
              ? p
              : {
                  ...p,
                  endReferral: {
                    ...payload,
                    endedAt: now,
                    endedBy: staffName,
                  },
                  isStuck: false,
                  lastActivityAt: now,
                }
          ),
        });
      },

      setCurrentPatient: (patientId) => {
        set({ currentPatientId: patientId });
      },

      markOnboardingComplete: (patientId) => {
        const now = new Date().toISOString();
        set({
          patients: get().patients.map((p) => {
            if (p.id !== patientId) return p;
            const normalizedStage = normalizePatientStage(p.stage);
            return withRoiDocuments({
              ...p,
              stage: normalizedStage === 'onboarding' ? 'initial-todos' : normalizedStage,
              daysInStage: normalizedStage === 'onboarding' ? 0 : p.daysInStage,
              isStuck: normalizedStage === 'onboarding' ? false : p.isStuck,
              lastActivityAt: now,
              hasCompletedOnboarding: true,
              roiSigned: true,
              roiSignedAt: p.roiSignedAt ?? now,
            }, now);
          }),
        });
      },

      setLastPatientTab: (tab) => {
        set({ lastPatientTab: tab });
      },

      advancePatientStage: (patientId) => {
        const now = new Date().toISOString();
        set({
          patients: get().patients.map((p) => {
            if (p.id !== patientId) return p;
            const currentStage = normalizePatientStage(p.stage);
            if (currentStage === 'onboarding' || currentStage === 'initial-todos') {
              return p;
            }
            const nextStage = getNextPatientStage(currentStage);
            if (!nextStage) return p;
            return {
              ...p,
              stage: nextStage,
              daysInStage: 0,
              isStuck: false,
              lastActivityAt: now,
            };
          }),
        });
      },

      resetDemo: () => {
        if (typeof window === 'undefined') return;
        window.localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
      },
    }),
    {
      name: STORAGE_KEY,
      version: 3,
      storage: newSafeStorage(),
      migrate: (persistedState) => migratePersistedState(persistedState),
      partialize: (state) => ({
        patients: state.patients,
        currentPatientId: state.currentPatientId,
        currentStaffName: state.currentStaffName,
        currentClinicUser: state.currentClinicUser,
        lastPatientTab: state.lastPatientTab,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.patients = state.patients.map((p) =>
          withDerivedPatientFields(
            p.referralSource
              ? {
                  ...p,
                  hasCompletedOnboarding: p.hasCompletedOnboarding ?? false,
                }
              : {
                  ...p,
                  referralSource: 'clinic' as const,
                  hasCompletedOnboarding: p.hasCompletedOnboarding ?? false,
                }
          )
        );
        const signedInPatient = state.currentPatientId
          ? state.patients.find((p) => p.id === state.currentPatientId)
          : undefined;
        if (!signedInPatient?.portalAccount) {
          state.currentPatientId = null;
        }
      },
    }
  )
);
