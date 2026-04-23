import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import type { Message, Patient, ThreadKey } from '@/lib/types';

export type InboxTab = 'patient' | 'clinic';

export const TAB_THREAD: Record<InboxTab, ThreadKey> = {
  patient: 'tc-frontdesk',
  clinic: 'clinic-staff',
};

export interface ConversationSummary {
  patient: Patient;
  tab: InboxTab;
  threadKey: ThreadKey;
  messages: Message[];
  latest: Message;
  unreadCount: number;
}

export function conversationKey(patientId: string, tab: InboxTab): string {
  return `${patientId}:${tab}`;
}

export function buildConversations(
  patients: Patient[],
  tab: InboxTab
): ConversationSummary[] {
  const threadKey = TAB_THREAD[tab];
  const convos: ConversationSummary[] = [];
  for (const p of patients) {
    const msgs = p.messages
      .filter((m) => m.threadKey === threadKey)
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
    if (msgs.length === 0) continue;
    const unreadCount = msgs.filter(
      (m) => !m.readByStaff && m.fromRole !== 'staff'
    ).length;
    convos.push({
      patient: p,
      tab,
      threadKey,
      messages: msgs,
      latest: msgs[msgs.length - 1],
      unreadCount,
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

export function useInboxUnread() {
  const patients = useStore((s) => s.patients);
  return useMemo(() => {
    let patientUnread = 0;
    let clinicUnread = 0;
    for (const p of patients) {
      for (const m of p.messages) {
        if (m.readByStaff || m.fromRole === 'staff') continue;
        if (m.threadKey === 'tc-frontdesk') patientUnread += 1;
        else if (m.threadKey === 'clinic-staff') clinicUnread += 1;
      }
    }
    return {
      patientUnread,
      clinicUnread,
      total: patientUnread + clinicUnread,
    };
  }, [patients]);
}
