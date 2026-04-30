'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  MessageSquare,
  Pencil,
  Search,
  Send,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { ClinicShell, CLINIC_CONTAINER } from '@/components/ui/ClinicShell';
import { StatusPill } from '@/components/ui/StatusPill';
import { ThreadMessage } from '@/components/ui/ThreadMessage';
import { AttachButton, AttachmentChips } from '@/components/ui/AttachmentRow';
import { appendAttachmentSummary, type Attachment } from '@/lib/attachments';
import {
  CLINIC_INBOX_THREAD,
  buildClinicConversations,
  clinicConversationKey,
  clinicScopedPatients,
  useClinicInboxUnread,
  type ClinicInboxChannel,
  type ClinicConversationSummary,
} from '@/lib/clinicInbox';
import { useStore } from '@/lib/store';
import type { Patient } from '@/lib/types';

type ListFilter = 'all' | ClinicInboxChannel;

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
  return trimmed.length > 120 ? `${trimmed.slice(0, 120)}...` : trimmed;
}

function patientName(patient: Patient): string {
  return `${patient.firstName} ${patient.lastName}`;
}

function initialsFor(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function transplantCenterContact(conversation: ClinicConversationSummary): string {
  return (
    conversation.messages.find((message) => message.fromRole === 'staff')?.fromName ??
    'Sarah Martinez'
  );
}

function clinicConversationTitle(conversation: ClinicConversationSummary): string {
  if (conversation.channel === 'transplant-center') return 'ChristianaCare Front Desk';
  return patientName(conversation.patient);
}

function clinicConversationContext(
  conversation: ClinicConversationSummary
): { patient: string; contactLabel: string; contact: string } | null {
  if (conversation.channel !== 'transplant-center') return null;
  return {
    patient: patientName(conversation.patient),
    contactLabel: 'TC contact',
    contact: transplantCenterContact(conversation),
  };
}

export default function ClinicMessagesPage() {
  const patients = useStore((state) => state.patients);
  const clinicUser = useStore((state) => state.currentClinicUser);
  const sendMessage = useStore((state) => state.sendMessage);
  const markThreadRead = useStore((state) => state.markThreadRead);
  const {
    patientUnread,
    total: totalUnread,
    transplantCenterUnread,
  } = useClinicInboxUnread();

  const [filter, setFilter] = useState<ListFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<Attachment[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const clinicPatients = useMemo(
    () => clinicScopedPatients(patients, clinicUser.clinicName),
    [patients, clinicUser.clinicName]
  );

  const conversations = useMemo(
    () => buildClinicConversations(patients, clinicUser.clinicName),
    [patients, clinicUser.clinicName]
  );
  const transplantCenterConversations = useMemo(
    () => conversations.filter((conversation) => conversation.channel === 'transplant-center'),
    [conversations]
  );
  const patientConversations = useMemo(
    () => conversations.filter((conversation) => conversation.channel === 'patient'),
    [conversations]
  );

  const filteredConversations = useMemo(() => {
    const source =
      filter === 'all'
        ? conversations
        : conversations.filter((conversation) => conversation.channel === filter);
    if (!query.trim()) return source;
    const q = query.trim().toLowerCase();
    return source.filter((conversation) => {
      const patientName =
        `${conversation.patient.firstName} ${conversation.patient.lastName}`.toLowerCase();
      if (patientName.includes(q)) return true;
      if (conversation.patient.nephrologistName?.toLowerCase().includes(q)) return true;
      return conversation.messages.some((message) => message.body.toLowerCase().includes(q));
    });
  }, [conversations, filter, query]);

  useEffect(() => {
    if (filteredConversations.length === 0) {
      setSelectedKey(null);
      return;
    }
    const selectedVisible = filteredConversations.some(
      (conversation) =>
        clinicConversationKey(conversation.patient.id, conversation.channel) === selectedKey
    );
    if (!selectedKey || !selectedVisible) {
      setSelectedKey(
        clinicConversationKey(
          filteredConversations[0].patient.id,
          filteredConversations[0].channel
        )
      );
    }
  }, [filteredConversations, selectedKey]);

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    return (
      conversations.find(
        (conversation) =>
          clinicConversationKey(conversation.patient.id, conversation.channel) === selectedKey
      ) ?? null
    );
  }, [conversations, selectedKey]);

  useEffect(() => {
    if (!selected) return;
    if (selected.unreadCount > 0) {
      markThreadRead(selected.patient.id, selected.threadKey, 'clinic');
    }
  }, [selected, markThreadRead]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [selected?.patient.id, selected?.channel, selected?.messages.length]);

  function handleSelect(conversation: ClinicConversationSummary) {
    setSelectedKey(clinicConversationKey(conversation.patient.id, conversation.channel));
    setReply('');
    setReplyAttachments([]);
  }

  function handleSendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const trimmed = reply.trim();
    if (trimmed.length === 0 && replyAttachments.length === 0) return;
    sendMessage(
      selected.patient.id,
      'clinic',
      appendAttachmentSummary(trimmed, replyAttachments),
      selected.threadKey
    );
    setReply('');
    setReplyAttachments([]);
  }

  function removeReplyAttachment(id: string) {
    setReplyAttachments((previous) => previous.filter((attachment) => attachment.id !== id));
  }

  return (
    <ClinicShell>
      <main
        className={clsx(
          'flex min-h-0 flex-col py-6 lg:h-[calc(100vh-65px)] lg:overflow-hidden',
          CLINIC_CONTAINER
        )}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Inbox</h2>
            <p className="text-sm text-slate-500">
              {totalUnread === 0
                ? 'Inbox is clear. Nothing waiting on you.'
                : `${totalUnread} unread ${totalUnread === 1 ? 'message' : 'messages'} across ChristianaCare and patient threads.`}
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
          <aside className="flex min-h-[420px] flex-col border-b border-slate-200 lg:min-h-0 lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-slate-100 px-4 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search patients or messages"
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
                  count={conversations.length}
                  label="All"
                  onClick={() => setFilter('all')}
                />
                <FilterPill
                  active={filter === 'transplant-center'}
                  count={transplantCenterConversations.length}
                  label="Transplant Center"
                  unread={filter !== 'transplant-center' && transplantCenterUnread > 0}
                  onClick={() => setFilter('transplant-center')}
                />
                <FilterPill
                  active={filter === 'patient'}
                  count={patientConversations.length}
                  label="Patient"
                  unread={filter !== 'patient' && patientUnread > 0}
                  onClick={() => setFilter('patient')}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
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
                      : 'ChristianaCare and patient conversations will show up here.'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filteredConversations.map((conversation) => {
                    const key = clinicConversationKey(
                      conversation.patient.id,
                      conversation.channel
                    );
                    const isSelected = selectedKey === key;
                    const title = clinicConversationTitle(conversation);
                    const context = clinicConversationContext(conversation);
                    const preview =
                      conversation.latest.fromRole === 'clinic'
                        ? `You: ${snippet(conversation.latest.body)}`
                        : `${conversation.latest.fromName.split(' ')[0]}: ${snippet(conversation.latest.body)}`;

                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => handleSelect(conversation)}
                          className={clsx(
                            'group flex w-full items-start gap-3 px-4 py-3.5 text-left transition',
                            isSelected
                              ? 'bg-[#eef6ff] ring-1 ring-inset ring-[#bfdeff]'
                              : 'hover:bg-slate-50'
                          )}
                        >
                          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3399e6] to-[#1a66cc] text-xs font-semibold text-white">
                            {initialsFor(title)}
                            {conversation.unreadCount > 0 && (
                              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-semibold text-white">
                                {conversation.unreadCount}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span
                                className={clsx(
                                  'min-w-0 truncate text-sm',
                                  conversation.unreadCount > 0
                                    ? 'font-semibold text-slate-900'
                                    : 'font-medium text-slate-800'
                                )}
                              >
                                {title}
                              </span>
                              <span className="shrink-0 text-[11px] text-slate-400">
                                {relativeTime(conversation.latest.sentAt)}
                              </span>
                            </div>
                            {context && (
                              <div className="mt-0.5 flex items-start gap-1.5 text-[11px] text-slate-500">
                                <Building2 className="mt-0.5 h-3 w-3 shrink-0 text-[#3399e6]" />
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
                                conversation.unreadCount > 0
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
                  const title = clinicConversationTitle(selected);
                  const context = clinicConversationContext(selected);
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
                        <ChannelBadge channel={selected.channel} />
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
                      href={`/clinic/${selected.patient.id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-[#3399e6] hover:text-[#1a66cc]"
                    >
                      Open referral
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
                  {selected.messages.map((message) => (
                    <ThreadMessage key={message.id} message={message} viewerRole="clinic" />
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
                      onChange={(event) => setReply(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                          (event.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                        }
                      }}
                      rows={1}
                      placeholder={
                        selected.channel === 'transplant-center'
                          ? 'Reply to ChristianaCare...'
                          : `Message ${selected.patient.firstName}...`
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
          patients={clinicPatients}
          onSend={(patientId, channel, body) => {
            sendMessage(patientId, 'clinic', body, CLINIC_INBOX_THREAD[channel]);
            setSelectedKey(clinicConversationKey(patientId, channel));
            setFilter(channel);
            setComposeOpen(false);
          }}
        />
      )}
    </ClinicShell>
  );
}

function FilterPill({
  active,
  count,
  label,
  unread = false,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  unread?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition',
        active ? 'bg-[#1a66cc] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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

function ChannelBadge({ channel }: { channel: ClinicInboxChannel }) {
  if (channel === 'patient') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-100">
        <MessageSquare className="h-3 w-3" />
        Patient
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#eef6ff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#1a66cc] ring-1 ring-[#dbeeff]">
      <Building2 className="h-3 w-3" />
      Transplant Center
    </span>
  );
}

function ComposeModal({
  onClose,
  onSend,
  patients,
}: {
  onClose: () => void;
  onSend: (patientId: string, channel: ClinicInboxChannel, body: string) => void;
  patients: Patient[];
}) {
  const [channel, setChannel] = useState<ClinicInboxChannel>('transplant-center');
  const [patientId, setPatientId] = useState<string>(patients[0]?.id ?? '');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const selected = patients.find((patient) => patient.id === patientId) ?? null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!patientId || (trimmed.length === 0 && attachments.length === 0)) return;
    onSend(patientId, channel, appendAttachmentSummary(trimmed, attachments));
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
        onClick={(event) => event.stopPropagation()}
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
                onClick={() => setChannel('transplant-center')}
                className={clsx(
                  'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition',
                  channel === 'transplant-center'
                    ? 'border-[#3399e6] bg-[#eef6ff] text-[#0f3e80] ring-2 ring-[#dbeeff]'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                )}
              >
                <Building2 className="h-4 w-4" />
                ChristianaCare
              </button>
              <button
                type="button"
                onClick={() => setChannel('patient')}
                className={clsx(
                  'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition',
                  channel === 'patient'
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-100'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Patient
              </button>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {channel === 'transplant-center' ? 'Regarding Patient' : 'Patient'}
            </span>
            <select
              value={patientId}
              onChange={(event) => setPatientId(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
            >
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.firstName} {patient.lastName}
                </option>
              ))}
            </select>
            {selected && channel === 'transplant-center' && (
              <p className="text-[11px] text-slate-500">
                This message goes to ChristianaCare about {selected.firstName}{' '}
                {selected.lastName}.
              </p>
            )}
            {selected && channel === 'patient' && (
              <p className="text-[11px] text-slate-500">
                This message goes directly to {selected.firstName} {selected.lastName}.
              </p>
            )}
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Message
            </span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              placeholder={
                channel === 'transplant-center'
                  ? 'Write your message to ChristianaCare...'
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
