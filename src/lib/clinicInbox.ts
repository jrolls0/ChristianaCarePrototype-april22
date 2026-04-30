import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import type { Message, Patient, ThreadKey } from '@/lib/types';

export const CLINIC_THREAD_KEY = 'clinic-staff' as const;
export const CLINIC_PATIENT_THREAD_KEY = 'dusw' as const;

export type ClinicInboxChannel = 'transplant-center' | 'patient';

export const CLINIC_INBOX_THREAD: Record<ClinicInboxChannel, ThreadKey> = {
  'transplant-center': CLINIC_THREAD_KEY,
  patient: CLINIC_PATIENT_THREAD_KEY,
};

export interface ClinicConversationSummary {
  patient: Patient;
  channel: ClinicInboxChannel;
  threadKey: ThreadKey;
  messages: Message[];
  latest: Message;
  unreadCount: number;
}

export function clinicConversationKey(
  patientId: string,
  channel: ClinicInboxChannel = 'transplant-center'
): string {
  return `${patientId}:${channel}`;
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
    for (const channel of Object.keys(CLINIC_INBOX_THREAD) as ClinicInboxChannel[]) {
      const threadKey = CLINIC_INBOX_THREAD[channel];
      const messages = patient.messages
        .filter((message) => message.threadKey === threadKey)
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

      if (messages.length === 0) continue;

      convos.push({
        patient,
        channel,
        threadKey,
        messages,
        latest: messages[messages.length - 1],
        unreadCount: clinicUnreadCount(messages),
      });
    }
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
    let transplantCenterUnread = 0;
    let patientUnread = 0;
    for (const patient of clinicScopedPatients(patients, clinicName)) {
      transplantCenterUnread += clinicUnreadCount(
        patient.messages.filter((message) => message.threadKey === CLINIC_THREAD_KEY)
      );
      patientUnread += clinicUnreadCount(
        patient.messages.filter((message) => message.threadKey === CLINIC_PATIENT_THREAD_KEY)
      );
    }
    return {
      transplantCenterUnread,
      patientUnread,
      total: transplantCenterUnread + patientUnread,
    };
  }, [patients, clinicName]);
}
