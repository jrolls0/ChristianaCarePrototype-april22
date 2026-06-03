import type { InitialEvaluationScheduling, InitialEvaluationSlot, Todo } from './types';

export const SCHEDULE_INITIAL_EVALUATION_TODO_ID = 'todo-schedule-initial-evaluation';
export const SCHEDULE_INITIAL_EVALUATION_TODO_TYPE: Todo['type'] =
  'schedule-initial-evaluation';

export function schedulingTodoId(patientId: string): string {
  return `${SCHEDULE_INITIAL_EVALUATION_TODO_ID}-${patientId}`;
}

export function slotStartDate(slot: Pick<InitialEvaluationSlot, 'date' | 'startTime'>): Date {
  return new Date(`${slot.date}T${slot.startTime}:00`);
}

export function slotEndDate(slot: Pick<InitialEvaluationSlot, 'date' | 'endTime'>): Date {
  return new Date(`${slot.date}T${slot.endTime}:00`);
}

export function isValidFutureSlot(
  slot: Pick<InitialEvaluationSlot, 'date' | 'startTime' | 'endTime'>,
  now = new Date()
): boolean {
  if (!slot.date || !slot.startTime || !slot.endTime) return false;
  const startsAt = slotStartDate(slot);
  const endsAt = slotEndDate(slot);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return false;
  return startsAt.getTime() > now.getTime() && endsAt.getTime() > startsAt.getTime();
}

export function formatSlotDate(slot: Pick<InitialEvaluationSlot, 'date'>): string {
  const date = new Date(`${slot.date}T12:00:00`);
  if (Number.isNaN(date.getTime())) return slot.date;
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatSlotTime(time: string): string {
  const date = new Date(`2026-01-01T${time}:00`);
  if (Number.isNaN(date.getTime())) return time;
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatSlotRange(slot: Pick<InitialEvaluationSlot, 'date' | 'startTime' | 'endTime'>): string {
  return `${formatSlotDate(slot)} · ${formatSlotTime(slot.startTime)} - ${formatSlotTime(slot.endTime)}`;
}

export function selectedInitialEvaluationSlot(
  scheduling?: InitialEvaluationScheduling
): InitialEvaluationSlot | undefined {
  if (!scheduling?.selectedSlotId) return undefined;
  return scheduling.slots.find((slot) => slot.id === scheduling.selectedSlotId);
}

export function schedulingSearchText(scheduling?: InitialEvaluationScheduling): string {
  if (!scheduling) return '';
  const selected = selectedInitialEvaluationSlot(scheduling);
  return [
    scheduling.sentAt ? 'initial evaluation slots sent' : '',
    selected ? 'evaluation scheduled' : '',
    ...scheduling.slots.map(formatSlotRange),
  ]
    .filter(Boolean)
    .join(' ');
}
