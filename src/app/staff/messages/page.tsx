'use client';

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  MessageSquare,
  Pencil,
  Search,
  Send,
  X,
} from 'lucide-react';
import { StaffShell, STAFF_CONTAINER } from '@/components/ui/StaffShell';
import { StatusPill } from '@/components/ui/StatusPill';
import { ThreadMessage } from '@/components/ui/ThreadMessage';
import { AttachButton, AttachmentChips } from '@/components/ui/AttachmentRow';
import { appendAttachmentSummary, type Attachment } from '@/lib/attachments';
import { useStore } from '@/lib/store';
import {
  TAB_THREAD,
  buildConversations,
  conversationKey,
  useInboxUnread,
  type ConversationSummary,
  type InboxTab,
} from '@/lib/inbox';
import { clsx } from 'clsx';

type ListFilter = 'all' | InboxTab;

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
  return trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
}

function patientName(patient: ConversationSummary['patient']): string {
  return `${patient.firstName} ${patient.lastName}`;
}

function initialsFor(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function staffConversationTitle(conversation: ConversationSummary): string {
  if (conversation.tab === 'clinic') {
    return conversation.patient.referringClinic ?? 'Dialysis Clinic';
  }
  return patientName(conversation.patient);
}

function staffConversationContext(
  conversation: ConversationSummary
): { patient: string; contactLabel: string; contact: string } | null {
  if (conversation.tab !== 'clinic') return null;
  return {
    patient: patientName(conversation.patient),
    contactLabel: 'Clinic contact',
    contact: conversation.patient.duswName ?? 'Not assigned',
  };
}

export default function StaffMessagesPage() {
  return (
    <Suspense
      fallback={
        <StaffShell>
          <main className={clsx('py-6', STAFF_CONTAINER)}>
            <div className="h-[640px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
          </main>
        </StaffShell>
      }
    >
      <MessagesInner />
    </Suspense>
  );
}

function MessagesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qpPatient = searchParams?.get('patient') ?? null;
  const qpThread = (searchParams?.get('thread') as InboxTab | null) ?? null;

  const patients = useStore((s) => s.patients);
  const sendMessage = useStore((s) => s.sendMessage);
  const markThreadRead = useStore((s) => s.markThreadRead);

  const [filter, setFilter] = useState<ListFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<Attachment[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const activePatients = useMemo(
    () => patients.filter((p) => p.stage !== 'new-referral'),
    [patients]
  );

  const patientConvos = useMemo(
    () => buildConversations(activePatients, 'patient'),
    [activePatients]
  );
  const clinicConvos = useMemo(
    () => buildConversations(activePatients, 'clinic'),
    [activePatients]
  );

  const { patientUnread, clinicUnread, total: totalUnread } = useInboxUnread();

  const allConvos = useMemo(() => {
    const merged = [...patientConvos, ...clinicConvos];
    merged.sort((a, b) => {
      if ((a.unreadCount > 0) !== (b.unreadCount > 0)) {
        return a.unreadCount > 0 ? -1 : 1;
      }
      return new Date(b.latest.sentAt).getTime() - new Date(a.latest.sentAt).getTime();
    });
    return merged;
  }, [patientConvos, clinicConvos]);

  const filteredConvos = useMemo(() => {
    const source =
      filter === 'all' ? allConvos : filter === 'patient' ? patientConvos : clinicConvos;
    if (!query.trim()) return source;
    const q = query.trim().toLowerCase();
    return source.filter((c) => {
      const name = `${c.patient.firstName} ${c.patient.lastName}`.toLowerCase();
      if (name.includes(q)) return true;
      if (c.patient.referringClinic?.toLowerCase().includes(q)) return true;
      if (c.patient.duswName?.toLowerCase().includes(q)) return true;
      return c.messages.some((m) => m.body.toLowerCase().includes(q));
    });
  }, [filter, allConvos, patientConvos, clinicConvos, query]);

  // Resolve initial selection from URL or fall back to first filtered convo
  useEffect(() => {
    if (qpPatient && qpThread) {
      setSelectedKey(conversationKey(qpPatient, qpThread));
      setFilter(qpThread);
      return;
    }
    if (!selectedKey && filteredConvos.length > 0) {
      setSelectedKey(conversationKey(filteredConvos[0].patient.id, filteredConvos[0].tab));
    }
  }, [qpPatient, qpThread, filteredConvos, selectedKey]);

  const selected: ConversationSummary | null = useMemo(() => {
    if (!selectedKey) return null;
    return (
      allConvos.find((c) => conversationKey(c.patient.id, c.tab) === selectedKey) ?? null
    );
  }, [allConvos, selectedKey]);

  // Mark selected thread read for staff
  useEffect(() => {
    if (!selected) return;
    if (selected.unreadCount > 0) {
      markThreadRead(selected.patient.id, selected.threadKey, 'staff');
    }
  }, [selected, markThreadRead]);

  // Scroll to bottom on conversation change
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [selected?.patient.id, selected?.tab, selected?.messages.length]);

  function handleSelect(c: ConversationSummary) {
    setSelectedKey(conversationKey(c.patient.id, c.tab));
    setReply('');
    setReplyAttachments([]);
    // Drop URL params so they don't pin a stale selection
    if (qpPatient || qpThread) {
      router.replace('/staff/messages');
    }
  }

  function handleSendReply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const trimmed = reply.trim();
    if (trimmed.length === 0 && replyAttachments.length === 0) return;
    const body = appendAttachmentSummary(trimmed, replyAttachments);
    sendMessage(selected.patient.id, 'staff', body, selected.threadKey);
    setReply('');
    setReplyAttachments([]);
  }

  function removeReplyAttachment(id: string) {
    setReplyAttachments((previous) => previous.filter((a) => a.id !== id));
  }

  return (
    <StaffShell>
      <main
        className={clsx(
          'flex min-h-0 flex-col py-6 lg:h-[calc(100vh-65px)] lg:overflow-hidden',
          STAFF_CONTAINER
        )}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Inbox</h2>
            <p className="text-sm text-slate-500">
              {totalUnread === 0
                ? 'Inbox is clear. Nothing waiting on you.'
                : `${totalUnread} unread ${totalUnread === 1 ? 'message' : 'messages'} across patients and clinics.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#3399e6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a66cc]"
          >
            <Pencil className="h-4 w-4" />
            Compose
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
          {/* LEFT PANE — list */}
          <aside className="flex min-h-[420px] flex-col border-b border-slate-200 lg:min-h-0 lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-slate-100 px-4 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search patients, clinics, messages"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm outline-none transition focus:border-[#3399e6] focus:bg-white focus:ring-2 focus:ring-[#dbeeff]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-2.5 flex items-center gap-1.5">
                <FilterPill
                  active={filter === 'all'}
                  label="All"
                  count={allConvos.length}
                  onClick={() => setFilter('all')}
                />
                <FilterPill
                  active={filter === 'patient'}
                  label="Patients"
                  count={patientUnread || patientConvos.length}
                  unread={filter !== 'patient' && patientUnread > 0}
                  onClick={() => setFilter('patient')}
                />
                <FilterPill
                  active={filter === 'clinic'}
                  label="Clinics"
                  count={clinicUnread || clinicConvos.length}
                  unread={filter !== 'clinic' && clinicUnread > 0}
                  onClick={() => setFilter('clinic')}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredConvos.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-8 py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    {query ? 'No matches' : 'No conversations yet'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {query
                      ? 'Try a different search term.'
                      : 'Inbox conversations will show up here as patients and clinics reach out.'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filteredConvos.map((c) => {
                    const key = conversationKey(c.patient.id, c.tab);
                    const isSelected = selectedKey === key;
                    const title = staffConversationTitle(c);
                    const context = staffConversationContext(c);
                    const preview =
                      c.latest.fromRole === 'staff'
                        ? `You: ${snippet(c.latest.body)}`
                        : `${c.latest.fromName.split(' ')[0]}: ${snippet(c.latest.body)}`;
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => handleSelect(c)}
                          className={clsx(
                            'group flex w-full items-start gap-3 px-4 py-3.5 text-left transition',
                            isSelected
                              ? 'bg-[#eef6ff] ring-1 ring-inset ring-[#bfdeff]'
                              : 'hover:bg-slate-50'
                          )}
                        >
                          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3399e6] to-[#1a66cc] text-xs font-semibold text-white">
                            {initialsFor(title)}
                            {c.unreadCount > 0 && (
                              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-semibold text-white">
                                {c.unreadCount}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span
                                className={clsx(
                                  'min-w-0 truncate text-sm',
                                  c.unreadCount > 0
                                    ? 'font-semibold text-slate-900'
                                    : 'font-medium text-slate-800'
                                )}
                              >
                                {title}
                              </span>
                              <span className="shrink-0 text-[11px] text-slate-400">
                                {relativeTime(c.latest.sentAt)}
                              </span>
                            </div>
                            {context && (
                              <div className="mt-0.5 flex items-start gap-1.5 text-[11px] text-slate-500">
                                <Building2 className="mt-0.5 h-3 w-3 shrink-0 text-violet-500" />
                                <div className="min-w-0 space-y-0.5">
                                  <p className="truncate">
                                    <span className="font-semibold text-slate-600">Patient:</span>{' '}
                                    {context.patient}
                                  </p>
                                  <p className="truncate">
                                    <span className="font-semibold text-slate-600">
                                      {context.contactLabel}:
                                    </span>{' '}
                                    {context.contact}
                                  </p>
                                </div>
                              </div>
                            )}
                            <p
                              className={clsx(
                                'mt-1 line-clamp-2 text-[13px] leading-snug',
                                c.unreadCount > 0
                                  ? 'font-medium text-slate-800'
                                  : 'text-slate-500'
                              )}
                            >
                              {preview}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* RIGHT PANE — conversation */}
          <section className="flex min-h-[520px] flex-col lg:min-h-0">
            {!selected ? (
              <div className="flex h-full flex-col items-center justify-center px-8 py-24 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-700">
                  Select a conversation
                </p>
                <p className="mt-1 max-w-xs text-sm text-slate-500">
                  Pick a thread on the left to read and reply, or start a new message.
                </p>
              </div>
            ) : (
              <>
                {(() => {
                  const title = staffConversationTitle(selected);
                  const context = staffConversationContext(selected);
                  return (
                <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#3399e6] to-[#1a66cc] text-sm font-semibold text-white">
                      {initialsFor(title)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">
                          {title}
                        </h3>
                        <ChannelBadge tab={selected.tab} />
                      </div>
                      {context && (
                        <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                          <p>
                            <span className="font-semibold text-slate-600">Patient:</span>{' '}
                            {context.patient}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-600">
                              {context.contactLabel}:
                            </span>{' '}
                            {context.contact}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill stage={selected.patient.stage} />
                    <Link
                      href={`/staff/${selected.patient.id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-[#3399e6] hover:text-[#1a66cc]"
                    >
                      Open case
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </header>
                  );
                })()}

                <div
                  ref={scrollRef}
                  className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/40 px-6 py-5"
                >
                  {selected.messages.map((m) => (
                    <ThreadMessage key={m.id} message={m} viewerRole="staff" />
                  ))}
                </div>

                <div className="shrink-0 border-t border-slate-100 bg-white">
                  <AttachmentChips
                    attachments={replyAttachments}
                    onRemove={removeReplyAttachment}
                  />
                  <form
                    onSubmit={handleSendReply}
                    className="flex items-end gap-2 px-4 py-3"
                  >
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                        }
                      }}
                      rows={1}
                      placeholder={
                        selected.tab === 'patient'
                          ? `Reply to ${selected.patient.firstName}…`
                          : `Message ${selected.patient.referringClinic ?? 'the dialysis clinic'} about ${selected.patient.firstName}…`
                      }
                      className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm leading-relaxed outline-none transition focus:border-[#3399e6] focus:bg-white focus:ring-2 focus:ring-[#dbeeff]"
                    />
                    <AttachButton
                      onAttach={(next) =>
                        setReplyAttachments((previous) => [...previous, ...next])
                      }
                    />
                    <button
                      type="submit"
                      disabled={!reply.trim() && replyAttachments.length === 0}
                      className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#3399e6] px-4 text-sm font-semibold text-white transition hover:bg-[#1a66cc] disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Send className="h-4 w-4" />
                      Send
                    </button>
                  </form>
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {composeOpen && (
        <ComposeModal
          onClose={() => setComposeOpen(false)}
          patients={activePatients}
          onSend={(patientId, tab, body) => {
            sendMessage(patientId, 'staff', body, TAB_THREAD[tab]);
            setSelectedKey(conversationKey(patientId, tab));
            setFilter(tab);
            setComposeOpen(false);
          }}
        />
      )}
    </StaffShell>
  );
}

function FilterPill({
  active,
  label,
  count,
  unread = false,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  unread?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition',
        active
          ? 'bg-[#1a66cc] text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      )}
    >
      {label}
      <span
        className={clsx(
          'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] tabular-nums',
          active
            ? 'bg-white/20 text-white'
            : unread
              ? 'bg-red-500 text-white'
              : 'bg-white text-slate-500 ring-1 ring-slate-200'
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ChannelBadge({ tab }: { tab: InboxTab }) {
  if (tab === 'clinic') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700 ring-1 ring-violet-100">
        <Building2 className="h-3 w-3" />
        Dialysis Clinic
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#eef6ff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#1a66cc] ring-1 ring-[#dbeeff]">
      <MessageSquare className="h-3 w-3" />
      Patient
    </span>
  );
}

function ComposeModal({
  onClose,
  patients,
  onSend,
}: {
  onClose: () => void;
  patients: ReturnType<typeof useStore.getState>['patients'];
  onSend: (patientId: string, tab: InboxTab, body: string) => void;
}) {
  const [tab, setTab] = useState<InboxTab>('patient');
  const [patientId, setPatientId] = useState<string>(patients[0]?.id ?? '');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const clinicPatients = useMemo(
    () => patients.filter((patient) => Boolean(patient.referringClinic)),
    [patients]
  );
  const availablePatients = tab === 'clinic' ? clinicPatients : patients;
  const hasClinicPatients = clinicPatients.length > 0;

  useEffect(() => {
    if (tab === 'clinic' && !hasClinicPatients) {
      setTab('patient');
      return;
    }
    if (!availablePatients.some((patient) => patient.id === patientId)) {
      setPatientId(availablePatients[0]?.id ?? '');
    }
  }, [availablePatients, hasClinicPatients, patientId, tab]);

  const selected = availablePatients.find((p) => p.id === patientId) ?? null;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!patientId || (trimmed.length === 0 && attachments.length === 0)) return;
    onSend(patientId, tab, appendAttachmentSummary(trimmed, attachments));
  }

  function removeAttachment(id: string) {
    setAttachments((previous) => previous.filter((attachment) => attachment.id !== id));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">New Message</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Channel
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTab('patient')}
                className={clsx(
                  'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition',
                  tab === 'patient'
                    ? 'border-[#3399e6] bg-[#eef6ff] text-[#0f3e80] ring-2 ring-[#dbeeff]'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Patient
              </button>
              <button
                type="button"
                onClick={() => setTab('clinic')}
                disabled={!hasClinicPatients}
                className={clsx(
                  'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition',
                  tab === 'clinic'
                    ? 'border-violet-400 bg-violet-50 text-violet-900 ring-2 ring-violet-100'
                    : hasClinicPatients
                      ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
                )}
              >
                <Building2 className="h-4 w-4" />
                Dialysis Clinic
              </button>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Patient / Referral
            </span>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
            >
              {availablePatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                  {tab === 'clinic' ? ` · ${p.referringClinic ?? 'Self-registered'}` : ''}
                </option>
              ))}
            </select>
            {selected && tab === 'clinic' && (
              <p className="text-[11px] text-slate-500">
                Goes to the patient-specific clinic thread for {selected.firstName}{' '}
                {selected.lastName} at{' '}
                {selected.referringClinic ?? 'their clinic'}.
              </p>
            )}
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Message
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder={
                tab === 'clinic'
                  ? 'Write your message to the dialysis clinic...'
                  : 'Write your message to the patient...'
              }
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
              autoFocus
            />
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60">
            <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Documents
                </p>
                <p className="text-xs text-slate-500">
                  Attach PDFs, images, or Word documents to this message.
                </p>
              </div>
              <AttachButton
                onAttach={(next) => setAttachments((previous) => [...previous, ...next])}
              />
            </div>
            <AttachmentChips
              attachments={attachments}
              onRemove={removeAttachment}
              className="px-3 pb-3 pt-0"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={(!body.trim() && attachments.length === 0) || !patientId}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#3399e6] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a66cc] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
