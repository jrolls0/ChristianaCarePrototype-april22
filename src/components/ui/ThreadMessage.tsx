'use client';

import type { Message } from '@/lib/types';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface ThreadMessageProps {
  message: Message;
  viewerRole?: 'staff' | 'patient' | 'clinic';
}

export function ThreadMessage({ message, viewerRole = 'staff' }: ThreadMessageProps) {
  const mine = message.fromRole === viewerRole;
  const bubble = mine
    ? 'bg-[#3399e6] text-white'
    : message.fromRole === 'clinic'
      ? 'bg-violet-50 text-violet-900 ring-1 ring-violet-100'
      : message.fromRole === 'staff'
        ? 'bg-[#eef6ff] text-[#0f3e80] ring-1 ring-[#dbeeff]'
        : 'bg-slate-100 text-slate-800';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${bubble}`}>
        <div
          className={`text-[10px] font-semibold uppercase tracking-wider ${
            mine ? 'text-white/80' : 'text-slate-500'
          }`}
        >
          {message.fromName}
        </div>
        <p className="mt-1 whitespace-pre-wrap leading-relaxed">{message.body}</p>
        <div
          className={`mt-1 text-[10px] ${
            mine ? 'text-white/70' : 'text-slate-400'
          }`}
        >
          {formatDateTime(message.sentAt)}
        </div>
      </div>
    </div>
  );
}
