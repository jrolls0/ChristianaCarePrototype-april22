'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowRight,
  ChevronLeft,
  Inbox,
  MessageSquare,
  Send,
  X,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Message, Patient, ThreadKey } from '@/lib/types';
import { ThreadMessage } from '@/components/ui/ThreadMessage';

type TabKey = 'patient' | 'clinic';

const TAB_THREAD: Record<TabKey, ThreadKey> = {
  patient: 'tc-frontdesk',
  clinic: 'clinic-staff',
};

const TAB_LABEL: Record<TabKey, string> = {
  patient: 'Patient Conversations',
  clinic: 'Clinic Conversations',
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function snippet(body: string): string {
  const trimmed = body.trim().replace(/\s+/g, ' ');
  return trimmed.length > 90 ? `${trimmed.slice(0, 90)}…` : trimmed;
}

interface ConversationSummary {
  patient: Patient;
  messages: Message[];
  latest: Message;
  unreadCount: number;
}

function buildConversations(
  patients: Patient[],
  threadKey: ThreadKey
): ConversationSummary[] {
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
      messages: msgs,
      latest: msgs[msgs.length - 1],
      unreadCount,
    });
  }
  // Unread first, then most-recent-activity
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

interface InboxPillProps {
  onClick: () => void;
}

export function InboxPill({ onClick }: InboxPillProps) {
  const { total } = useInboxUnread();
  const active = total > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition ${
        active
          ? 'border-[#1a66cc] bg-[#1a66cc] text-white hover:bg-[#0f4fa8]'
          : 'border-slate-200 bg-white text-slate-700 hover:border-[#3399e6] hover:text-[#1a66cc]'
      }`}
    >
      <Inbox className="h-4 w-4" />
      Inbox
      {total > 0 && (
        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/20 px-1.5 text-xs font-semibold tabular-nums">
          {total}
        </span>
      )}
    </button>
  );
}

interface InboxDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: TabKey;
}

export function InboxDrawer({ open, onOpenChange, initialTab = 'patient' }: InboxDrawerProps) {
  const patients = useStore((s) => s.patients);
  const sendMessage = useStore((s) => s.sendMessage);
  const markThreadRead = useStore((s) => s.markThreadRead);

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  // When opening or switching tab: reset expansion + reply draft
  useEffect(() => {
    setExpandedId(null);
    setReply('');
  }, [tab, open]);

  const { patientUnread, clinicUnread } = useInboxUnread();

  const activePatients = useMemo(
    () => patients.filter((p) => p.stage !== 'new-referral'),
    [patients]
  );

  const conversations = useMemo(
    () => buildConversations(activePatients, TAB_THREAD[tab]),
    [activePatients, tab]
  );

  function handleRowClick(patientId: string) {
    const next = expandedId === patientId ? null : patientId;
    setExpandedId(next);
    setReply('');
    if (next) {
      // Mark this thread read for staff
      markThreadRead(patientId, TAB_THREAD[tab], 'staff');
    }
  }

  function handleSendReply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!expandedId) return;
    const body = reply.trim();
    if (!body) return;
    sendMessage(expandedId, 'staff', body, TAB_THREAD[tab]);
    setReply('');
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
        <Dialog.Content
          className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right"
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="border-b border-slate-200 bg-gradient-to-r from-[#3399e6] to-[#1a66cc] px-6 py-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-white/80">
                  Front Desk
                </div>
                <Dialog.Title className="mt-0.5 text-lg font-semibold">
                  Message Inbox
                </Dialog.Title>
                <p className="mt-0.5 text-sm text-white/85">
                  Triage patient and clinic conversations without leaving the dashboard.
                </p>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-full bg-white/10 p-1.5 text-white/90 transition hover:bg-white/20"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-4 py-2">
            {(['patient', 'clinic'] as TabKey[]).map((k) => {
              const unread = k === 'patient' ? patientUnread : clinicUnread;
              const isActive = tab === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-white text-[#1a66cc] shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-600 hover:bg-white/60'
                  }`}
                >
                  {TAB_LABEL[k]}
                  {unread > 0 && (
                    <span
                      className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${
                        isActive ? 'bg-[#eef6ff] text-[#1a66cc]' : 'bg-red-500 text-white'
                      }`}
                    >
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-8 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-700">
                  No {tab === 'patient' ? 'patient' : 'clinic'} conversations yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {tab === 'patient'
                    ? 'Messages between you and patients will appear here.'
                    : 'Messages between you and dialysis clinics will appear here.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {conversations.map((c) => {
                  const isExpanded = expandedId === c.patient.id;
                  return (
                    <li key={c.patient.id}>
                      <button
                        type="button"
                        onClick={() => handleRowClick(c.patient.id)}
                        className={`flex w-full items-start gap-3 px-5 py-4 text-left transition ${
                          isExpanded ? 'bg-[#f5faff]' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3399e6] to-[#1a66cc] text-xs font-semibold text-white">
                          {c.patient.firstName[0]}
                          {c.patient.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="min-w-0 truncate font-semibold text-slate-900">
                              {c.patient.firstName} {c.patient.lastName}
                              {c.unreadCount > 0 && (
                                <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 align-middle text-[11px] font-semibold text-white tabular-nums">
                                  {c.unreadCount}
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 text-xs text-slate-400">
                              {relativeTime(c.latest.sentAt)}
                            </span>
                          </div>
                          <div className="truncate text-xs text-slate-500">
                            {c.patient.referringClinic}
                          </div>
                          <p
                            className={`mt-1 line-clamp-2 text-sm ${
                              c.unreadCount > 0 ? 'font-medium text-slate-800' : 'text-slate-600'
                            }`}
                          >
                            <span className="text-slate-400">
                              {c.latest.fromRole === 'staff' ? 'You: ' : `${c.latest.fromName.split(' ')[0]}: `}
                            </span>
                            {snippet(c.latest.body)}
                          </p>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                          <div className="max-h-[320px] space-y-2.5 overflow-y-auto rounded-xl bg-white p-3 ring-1 ring-slate-100">
                            {c.messages.map((m) => (
                              <ThreadMessage key={m.id} message={m} viewerRole="staff" />
                            ))}
                          </div>

                          <form
                            onSubmit={handleSendReply}
                            className="mt-3 flex items-center gap-2"
                          >
                            <input
                              type="text"
                              value={reply}
                              onChange={(e) => setReply(e.target.value)}
                              placeholder={
                                tab === 'patient'
                                  ? `Reply to ${c.patient.firstName}…`
                                  : `Reply to ${c.patient.duswName.split(' ')[0]} at ${c.patient.referringClinic}…`
                              }
                              className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
                            />
                            <button
                              type="submit"
                              disabled={!reply.trim()}
                              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#3399e6] px-3 text-sm font-semibold text-white transition hover:bg-[#1a66cc] disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              <Send className="h-3.5 w-3.5" />
                              Send
                            </button>
                          </form>

                          <div className="mt-3 flex items-center justify-between text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedId(null);
                                setReply('');
                              }}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-slate-500 hover:text-slate-700"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                              Collapse
                            </button>
                            <Link
                              href={`/staff/${c.patient.id}`}
                              onClick={() => onOpenChange(false)}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 transition hover:border-[#3399e6] hover:text-[#1a66cc]"
                            >
                              Open full case
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
