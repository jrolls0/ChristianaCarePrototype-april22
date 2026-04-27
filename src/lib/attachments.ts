'use client';

export type Attachment = {
  id: string;
  name: string;
  sizeLabel: string;
};

export function formatAttachmentSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

export function attachmentsFromFileList(files: FileList): Attachment[] {
  return Array.from(files).map((file, index) => ({
    id: `${file.name}-${file.size}-${Date.now()}-${index}`,
    name: file.name,
    sizeLabel: formatAttachmentSize(file.size),
  }));
}

/**
 * Append a bracketed summary describing simulated attachments to a message
 * body. Mirrors the patient-side compose-modal behavior, so threads stay
 * consistent when staff or patient sends with attached docs.
 */
export function appendAttachmentSummary(body: string, attachments: Attachment[]): string {
  if (attachments.length === 0) return body;
  const summary =
    attachments.length === 1
      ? `Attached 1 document: ${attachments[0]?.name}`
      : `Attached ${attachments.length} documents: ${attachments.map((a) => a.name).join(', ')}`;
  return `${body}\n\n[${summary}]`;
}
