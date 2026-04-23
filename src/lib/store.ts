'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  DemoState,
  Message,
  MessageRole,
  Patient,
  ReferralSubmission,
  ThreadKey,
  Todo,
} from './types';
import { createInitialState } from './seedData';

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
          };
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
            referralDate: now,
            stage: 'patient-onboarding',
            daysInStage: 0,
            isStuck: false,
            lastActivityAt: now,
            messages: [...match.messages, systemMsg],
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
          referringClinic: data.referringClinic,
          referringClinician: data.nephrologistName,
          duswName: data.duswName,
          duswEmail: data.duswEmail,
          nephrologistName: data.nephrologistName,
          nephrologistEmail: data.nephrologistEmail,
          referralDate: now,
          stage: 'patient-onboarding',
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
            },
          ],
          documents: [],
          lastActivityAt: now,
        };
        set({ patients: [...state.patients, newPatient] });
        return newId;
      },

      completeTodo: (patientId, todoId) => {
        const now = new Date().toISOString();
        set({
          patients: get().patients.map((p) =>
            p.id !== patientId
              ? p
              : {
                  ...p,
                  lastActivityAt: now,
                  todos: p.todos.map((t) =>
                    t.id === todoId
                      ? { ...t, status: 'completed', completedAt: now }
                      : t
                  ),
                }
          ),
        });
      },

      addCustomTodo: (patientId, title, description) => {
        const now = new Date().toISOString();
        const staffName = get().currentStaffName;
        const todo: Todo = {
          id: `todo-custom-${nextIdSuffix()}`,
          type: 'custom',
          title,
          description,
          status: 'pending',
          isCustom: true,
          addedByStaff: staffName,
          addedAt: now,
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
        };
        set({
          patients: replacePatient(state.patients, {
            ...patient,
            messages: [...patient.messages, message],
            lastActivityAt: now,
          }),
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
        set({
          patients: get().patients.map((p) =>
            p.id !== patientId
              ? p
              : {
                  ...p,
                  documents: [
                    ...p.documents,
                    {
                      id: `doc-${patientId}-${nextIdSuffix()}`,
                      name,
                      uploadedAt: now,
                      uploadedBy: source,
                    },
                  ],
                  lastActivityAt: now,
                }
          ),
        });
      },

      setCurrentPatient: (patientId) => {
        set({ currentPatientId: patientId });
      },

      resetDemo: () => {
        if (typeof window === 'undefined') return;
        window.localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
      },
    }),
    {
      name: STORAGE_KEY,
      storage: newSafeStorage(),
      partialize: (state) => ({
        patients: state.patients,
        currentPatientId: state.currentPatientId,
        currentStaffName: state.currentStaffName,
        currentClinicUser: state.currentClinicUser,
      }),
    }
  )
);
