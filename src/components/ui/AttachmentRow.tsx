'use client';

import { Paperclip, X } from 'lucide-react';
import { type ChangeEvent, useId, useRef } from 'react';
import { attachmentsFromFileList, type Attachment } from '@/lib/attachments';

const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png,.doc,.docx';

/**
 * Compact icon-only paperclip button + hidden file input. Use inside a
 * thread-reply row alongside the textarea and Send button.
 */
export function AttachButton({
  onAttach,
  disabled,
  size = 'md',
}: {
  onAttach: (attachments: Attachment[]) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const sizeClass = size === 'sm' ? 'h-10 w-10' : 'h-11 w-11';
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    onAttach(attachmentsFromFileList(files));
    event.target.value = '';
  }

  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={ACCEPTED_FILE_TYPES}
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label="Attach document"
        title="Attach document"
        className={`flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-[#3399e6] hover:text-[#1a66cc] disabled:cursor-not-allowed disabled:opacity-50 ${sizeClass}`}
      >
        <Paperclip className={iconClass} />
      </button>
    </>
  );
}

/**
 * Horizontal scrollable strip of attachment chips with remove buttons.
 * Renders nothing when the list is empty, so the consumer doesn't need
 * to conditionally hide it.
 */
export function AttachmentChips({
  attachments,
  onRemove,
  className = '',
}: {
  attachments: Attachment[];
  onRemove: (id: string) => void;
  className?: string;
}) {
  if (attachments.length === 0) return null;

  return (
    <div
      className={`flex gap-2 overflow-x-auto px-4 pt-3 pb-1 ${className}`}
      role="list"
      aria-label="Attached documents"
    >
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          role="listitem"
          className="inline-flex shrink-0 max-w-[220px] items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 text-xs"
        >
          <Paperclip className="h-3 w-3 shrink-0 text-slate-500" />
          <span className="min-w-0 truncate font-medium text-slate-700" title={attachment.name}>
            {attachment.name}
          </span>
          <span className="shrink-0 text-[10px] text-slate-400">{attachment.sizeLabel}</span>
          <button
            type="button"
            onClick={() => onRemove(attachment.id)}
            aria-label={`Remove ${attachment.name}`}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
