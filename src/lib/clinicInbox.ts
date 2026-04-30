import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import type { Message, Patient } from '@/lib/types';

export const CLINIC_THREAD_KEY = 'clinic-staff' as const;

export interface ClinicConversationSummary {
  patient: Patient;
  messages: Message[];
  latest: Message;
  unreadCount: number;
}

export function clinicConversationKey(patientId: string): string {
  return `${patientId}:transplant-center`;
}

export function clinicScopedPatients(patients: Patient[], clinicName: string): Patient[] {
  return patients.filter(
    (patient) =>
      patient.referringClinic === clinicName && patient.stage !== 'new-referral'
  );
}

function clinicUnreadCount(messages: Message[]): number {
  return messages.filter(
    (message) => !message.readByClinic && message.fromRole !== 'clinic'
  ).length;
}

export function buildClinicConversations(
  patients: Patient[],
  clinicName: string
): ClinicConversationSummary[] {
  const convos: ClinicConversationSummary[] = [];

  for (const patient of clinicScopedPatients(patients, clinicName)) {
    const messages = patient.messages
      .filter((message) => message.threadKey === CLINIC_THREAD_KEY)
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

    if (messages.length === 0) continue;

    convos.push({
      patient,
      messages,
      latest: messages[messages.length - 1],
      unreadCount: clinicUnreadCount(messages),
    });
  }

  convos.sort((a, b) => {
    if ((a.unreadCount > 0) !== (b.unreadCount > 0)) {
      return a.unreadCount > 0 ? -1 : 1;
    }
    return new Date(b.latest.sentAt).getTime() - new Date(a.latest.sentAt).getTime();
  });

  return convos;
}

export function useClinicInboxUnread() {
  const patients = useStore((state) => state.patients);
  const clinicName = useStore((state) => state.currentClinicUser.clinicName);

  return useMemo(() => {
    let total = 0;
    for (const patient of clinicScopedPatients(patients, clinicName)) {
      total += clinicUnreadCount(
        patient.messages.filter((message) => message.threadKey === CLINIC_THREAD_KEY)
      );
    }
    return { total };
  }, [patients, clinicName]);
}
