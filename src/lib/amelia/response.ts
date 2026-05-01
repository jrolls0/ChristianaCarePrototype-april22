import type {
  AmeliaAction,
  AmeliaActionTarget,
  AmeliaChatMessage,
  ThreadKey,
  Todo,
} from '../types';
import type { AmeliaPatientContext } from './context';
import { threadLabel } from './context';
import { lookupKnowledge, type KnowledgeArticle } from '../knowledge/ameliaKnowledge';

export type AmeliaRequestPayload = {
  patientId: string;
  message: string;
  conversationMessages?: Pick<AmeliaChatMessage, 'role' | 'content'>[];
  patientContext: AmeliaPatientContext;
};

export type AmeliaRouteResponse = {
  id: string;
  content: string;
  actions: AmeliaAction[];
  source: 'cloudflare' | 'local-fallback';
};

type DraftTarget = Extract<ThreadKey, 'tc-frontdesk' | 'dusw'>;

const REQUIRED_INITIAL_TODOS: ReadonlySet<Todo['type']> = new Set([
  'upload-government-id',
  'upload-insurance-card',
  'complete-health-questionnaire',
]);
const STOP_WORDS = new Set([
  'a',
  'about',
  'and',
  'for',
  'from',
  'have',
  'into',
  'need',
  'please',
  'the',
  'this',
  'todo',
  'to-do',
  'upload',
  'with',
]);

function actionId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todoTarget(type: Todo['type']): AmeliaActionTarget {
  if (type === 'upload-government-id') return 'todo:government-id';
  if (type === 'upload-insurance-card') return 'todo:insurance-card';
  if (type === 'complete-health-questionnaire') return 'todo:health-questionnaire';
  if (type === 'add-emergency-contact') return 'todo:emergency-contact';
  if (type === 'watch-education-video') return 'todo:education';
  return 'todo:custom';
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(normalized: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(normalized));
}

function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0] ?? 0;
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      previous[j] = Math.min(
        above + 1,
        (previous[j - 1] ?? 0) + 1,
        diagonal + cost
      );
      diagonal = above;
    }
  }
  return previous[b.length] ?? 0;
}

function hasApproximateWord(normalized: string, target: string): boolean {
  const maxDistance = target.length >= 11 ? 3 : target.length >= 8 ? 2 : 1;
  return normalized
    .split(' ')
    .filter((word) => word.length >= 4)
    .some((word) => editDistance(word, target) <= maxDistance);
}

function pendingTodoOfType(
  context: AmeliaPatientContext,
  type: Todo['type']
): AmeliaPatientContext['todos'][number] | undefined {
  return pendingTodos(context).find((todo) => todo.type === type);
}

function actionForTodo(todo: AmeliaPatientContext['todos'][number], label?: string): AmeliaAction {
  const defaultLabels: Partial<Record<Todo['type'], string>> = {
    'upload-government-id': 'Open Government ID Upload',
    'upload-insurance-card': 'Open Insurance Card Upload',
    'complete-health-questionnaire': 'Open Health Questionnaire',
    'add-emergency-contact': 'Open Emergency Contact To-Do',
    'watch-education-video': 'Open Education To-Do',
  };
  return {
    id: actionId('todo'),
    kind: 'navigation',
    label: label ?? defaultLabels[todo.type] ?? `Open ${todo.title}`,
    target: todoTarget(todo.type),
    params: todo.type === 'custom' ? { todoId: todo.id } : undefined,
  };
}

function safeSnippet(value: string, limit = 180): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1)}...` : cleaned;
}

function formatList(values: string[]): string {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0] ?? '';
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

function pendingTodos(context: AmeliaPatientContext) {
  return context.todos.filter((todo) => todo.status !== 'completed');
}

function pendingRequiredTodos(context: AmeliaPatientContext) {
  return pendingTodos(context).filter((todo) => REQUIRED_INITIAL_TODOS.has(todo.type));
}

function highestPriorityTodo(context: AmeliaPatientContext) {
  const pending = pendingTodos(context);
  return (
    pending.find((todo) => todo.type === 'upload-government-id') ??
    pending.find((todo) => todo.type === 'upload-insurance-card') ??
    pending.find((todo) => todo.type === 'complete-health-questionnaire') ??
    pending[0]
  );
}

function wantsDraft(query: string): boolean {
  return (
    /\b(draft|write|send)\b/i.test(query) ||
    /\b(reply|respond)\s+(to|back)\b/i.test(query) ||
    /\bhelp me (reply|respond)\b/i.test(query) ||
    hasAppointmentConflictIntent(query) ||
    /\btell\s+(sarah|my|the|christianacare|christiana|dialysis|social worker|care team)\b/i.test(query) ||
    /\bask\s+(sarah|my care team|christianacare|christiana|dialysis|social worker|the care team)\b/i.test(query)
  );
}

function draftThread(query: string, context?: AmeliaPatientContext): DraftTarget {
  if (hasAppointmentConflictIntent(query)) return 'tc-frontdesk';
  const normalized = normalizeText(query);
  if (
    nameMentioned(normalized, context?.duswName) ||
    nameMentioned(normalized, context?.referringClinic) ||
    hasAny(normalized, [
      /\bdialysis\b/,
      /\bsocial worker\b/,
      /\bdusw\b/,
      /\bclinic\b/,
      /\bsarah johnson\b/,
      /\bangela brooks\b/,
      /\bryan morales\b/,
    ])
  ) {
    return 'dusw';
  }
  return 'tc-frontdesk';
}

function hasAppointmentConflictIntent(query: string): boolean {
  const normalized = query.toLowerCase();
  const mentionsAppointment = /\b(appointment|visit|schedule|scheduling|evaluation)\b/.test(normalized);
  const mentionsConflict =
    /\b(won'?t|will not|cant|can't|cannot|unable|not able|miss|missed|reschedule|cancel|conflict|attend|make it)\b/.test(
      normalized
    );
  const mentionsChristianaCare = /\b(christianacare|christiana care|christiana|transplant center)\b/.test(
    normalized
  );
  return mentionsAppointment && mentionsConflict && (mentionsChristianaCare || !/\b(dialysis|clinic)\b/.test(normalized));
}

function buildDraftBody(query: string, context: AmeliaPatientContext, threadKey: DraftTarget): string {
  const recipient = threadKey === 'dusw' ? context.duswName ?? 'Dialysis Team' : 'Sarah';
  if (hasAppointmentConflictIntent(query)) {
    return `Hi ${recipient}, I will not be able to attend my ChristianaCare scheduling appointment. Could you please help me understand the next step or let me know how to reschedule?`;
  }
  if (/\bupload/.test(query.toLowerCase())) {
    return `Hi ${recipient}, I wanted to let you know that I uploaded the requested document in my patient portal. Please let me know if anything else is needed.`;
  }
  if (/\bappointment|available|tuesday|wednesday|thursday|friday|monday|schedule/i.test(query)) {
    return `Hi ${recipient}, I wanted to share my availability for the next step. Please let me know what times are available.`;
  }
  return `Hi ${recipient}, I have a question about my transplant referral. Could you please review and let me know what I should do next?`;
}

function customTodoMatchesQuery(
  todo: AmeliaPatientContext['todos'][number],
  normalizedQuery: string
): boolean {
  const searchableValues = [
    todo.title,
    todo.description,
    ...(todo.documentRequests ?? []).flatMap((request) => [
      request.title,
      request.description ?? '',
    ]),
  ];
  return searchableValues.some((value) => {
    const normalizedValue = normalizeText(value);
    if (!normalizedValue) return false;
    if (normalizedQuery.includes(normalizedValue)) return true;

    const meaningfulWords = normalizedValue
      .split(' ')
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
    if (meaningfulWords.length === 0) return false;
    const matches = meaningfulWords.filter((word) => normalizedQuery.includes(word)).length;
    return matches >= Math.min(2, meaningfulWords.length);
  });
}

function customTodoAction(query: string, context: AmeliaPatientContext): AmeliaAction | null {
  const normalized = normalizeText(query);
  if (
    !hasAny(normalized, [
      /\bupload\b/,
      /\bopen\b/,
      /\bshow\b/,
      /\btodo\b/,
      /\bto do\b/,
      /\btask\b/,
      /\bcomplete\b/,
      /\bwhere\b/,
      /\bhow\b/,
      /\bneed\b/,
      /\btake me\b/,
    ])
  ) {
    return null;
  }
  const todo = pendingTodos(context).find(
    (candidate) => candidate.type === 'custom' && customTodoMatchesQuery(candidate, normalized)
  );
  return todo ? actionForTodo(todo) : null;
}

function explicitTodoAction(query: string, context: AmeliaPatientContext): AmeliaAction | null {
  const normalized = normalizeText(query);
  const custom = customTodoAction(query, context);
  if (custom) return custom;
  const mentionsUploadOrTask = hasAny(normalized, [
    /\bupload\b/,
    /\bopen\b/,
    /\bshow\b/,
    /\btake me\b/,
    /\bcomplete\b/,
    /\bhow\b/,
    /\bphoto\b/,
    /\bfront\b/,
    /\bback\b/,
    /\bpicture\b/,
    /\bimage\b/,
    /\btask\b/,
    /\btodo\b/,
    /\bto do\b/,
  ]);

  if (
    hasAny(normalized, [
      /\binsurance card\b/,
      /\bcoverage card\b/,
      /\bmedical card\b/,
      /\binsurance\b.*\b(upload|card|photo|front|back|picture|image)\b/,
      /\b(upload|card|photo|front|back|picture|image)\b.*\binsurance\b/,
    ]) ||
    (mentionsUploadOrTask && hasApproximateWord(normalized, 'insurance'))
  ) {
    const todo = pendingTodoOfType(context, 'upload-insurance-card');
    return todo ? actionForTodo(todo, 'Open Insurance Card Upload') : null;
  }

  if (
    hasAny(normalized, [
      /\bgovernment id\b/,
      /\bgov(?:ernment)? id\b/,
      /\bdrivers? license\b/,
      /\bpassport\b/,
      /\bphoto id\b/,
      /\bid upload\b/,
    ]) ||
    (mentionsUploadOrTask && hasApproximateWord(normalized, 'government') && /\bid\b/.test(normalized)) ||
    hasApproximateWord(normalized, 'license')
  ) {
    const todo = pendingTodoOfType(context, 'upload-government-id');
    return todo ? actionForTodo(todo, 'Open Government ID Upload') : null;
  }

  if (
    hasAny(normalized, [
      /\bhealth questionnaire\b/,
      /\bquestionnaire\b/,
      /\bhealth form\b/,
      /\bscreening questions?\b/,
    ]) ||
    hasApproximateWord(normalized, 'questionnaire') ||
    (/\bhealth\b/.test(normalized) && hasApproximateWord(normalized, 'questionnaire'))
  ) {
    const todo = pendingTodoOfType(context, 'complete-health-questionnaire');
    return todo ? actionForTodo(todo, 'Open Health Questionnaire') : null;
  }

  if (
    hasAny(normalized, [
      /\beducation\b/,
      /\beducation video\b/,
      /\bvideo\b/,
      /\bclass\b/,
    ]) ||
    hasApproximateWord(normalized, 'education')
  ) {
    const todo = pendingTodoOfType(context, 'watch-education-video');
    return todo ? actionForTodo(todo, 'Open Education To-Do') : null;
  }

  if (
    hasAny(normalized, [
      /\bemergency contact\b/,
      /\bcare partner\b/,
      /\bbackup contact\b/,
    ]) ||
    (hasApproximateWord(normalized, 'emergency') && /\bcontact\b/.test(normalized))
  ) {
    const todo = pendingTodoOfType(context, 'add-emergency-contact');
    return todo ? actionForTodo(todo, 'Open Emergency Contact To-Do') : null;
  }

  return null;
}

function isNextActionQuery(query: string): boolean {
  const normalized = normalizeText(query);
  if (
    hasAny(normalized, [
      /\bwhat happens after\b/,
      /\bafter this\b/,
      /\bafter this step\b/,
      /\bwho does it\b/,
      /\bwho handles\b/,
      /\bwho is responsible\b/,
      /\bprocess\b/,
      /\bjourney\b/,
    ])
  ) {
    return false;
  }
  return hasAny(normalized, [
    /\bwhat should i do next\b/,
    /\bwhat do i need to do\b/,
    /\bwhat should i do\b/,
    /\bwhats next\b/,
    /\bwhat is next\b/,
    /\bnext step\b/,
    /\bnext task\b/,
    /\bwhere should i start\b/,
    /\btake me to my next\b/,
    /\bopen my next\b/,
  ]);
}

function nextTodoAction(context: AmeliaPatientContext): AmeliaAction | null {
  const todo = highestPriorityTodo(context);
  return todo ? actionForTodo(todo) : null;
}

function nameMentioned(query: string, name?: string): boolean {
  if (!name) return false;
  const normalizedName = normalizeText(name);
  if (!normalizedName) return false;
  if (query.includes(normalizedName)) return true;
  const parts = normalizedName.split(' ').filter((part) => part.length > 2);
  return parts.length > 1 && parts.every((part) => query.includes(part));
}

function threadAction(query: string, context: AmeliaPatientContext): AmeliaAction | null {
  const normalized = normalizeText(query);
  const asksAboutConversation = hasAny(normalized, [
    /\bmessage\b/,
    /\bmessages\b/,
    /\bconversation\b/,
    /\bthread\b/,
    /\bchat\b/,
    /\binbox\b/,
    /\breply\b/,
    /\btalk\b/,
    /\btold\b/,
    /\bsaid\b/,
    /\bsay\b/,
  ]);
  if (!asksAboutConversation) return null;

  if (
    nameMentioned(normalized, context.duswName) ||
    nameMentioned(normalized, context.referringClinic) ||
    hasAny(normalized, [
      /\bdialysis team\b/,
      /\bdialysis clinic\b/,
      /\bsocial worker\b/,
      /\bdusw\b/,
      /\bsarah johnson\b/,
      /\bangela brooks\b/,
      /\bryan morales\b/,
    ])
  ) {
    return {
      id: actionId('thread'),
      kind: 'navigation',
      label: 'Open Dialysis Team Thread',
      target: 'message-thread:dusw',
    };
  }

  if (
    hasAny(normalized, [
      /\bchristianacare\b/,
      /\bchristiana care\b/,
      /\bchristiana\b/,
      /\btransplant center\b/,
      /\bfront desk\b/,
      /\bsarah martinez\b/,
    ])
  ) {
    return {
      id: actionId('thread'),
      kind: 'navigation',
      label: 'Open ChristianaCare Thread',
      target: 'message-thread:tc-frontdesk',
    };
  }

  return null;
}

function messagesAction(query: string): AmeliaAction | null {
  const normalized = normalizeText(query);
  if (
    !hasAny(normalized, [
      /\bmessage\b/,
      /\bmessages\b/,
      /\binbox\b/,
      /\bconversation\b/,
      /\bthread\b/,
      /\breply\b/,
      /\bopen messages\b/,
      /\bshow messages\b/,
    ])
  ) {
    return null;
  }
  return {
    id: actionId('messages'),
    kind: 'navigation',
    label: 'Open Messages',
    target: 'tab:messages',
  };
}

function profileAction(query: string): AmeliaAction | null {
  const normalized = normalizeText(query);
  if (
    !hasAny(normalized, [
      /\bprofile\b/,
      /\bmy profile\b/,
      /\bedit profile\b/,
      /\bchange my (email|phone|address|doctor|clinic)\b/,
      /\bupdate my (email|phone|address|doctor|clinic)\b/,
    ])
  ) {
    return null;
  }
  return {
    id: actionId('profile'),
    kind: 'navigation',
    label: 'Open Profile',
    target: 'tab:profile',
  };
}

function messageSummary(context: AmeliaPatientContext): string {
  if (context.messages.length === 0) {
    return 'I do not see any patient-visible messages yet.';
  }
  const unread = context.unreadMessages;
  const source = unread.length > 0 ? unread : context.messages.slice(0, 3);
  const lines = source.map((message) => {
    const channel = threadLabel(message.threadKey);
    const prefix = message.fromRole === 'patient' ? 'You wrote' : `${message.fromName} wrote`;
    return `- ${prefix} in ${channel}: "${safeSnippet(message.body, 120)}"`;
  });
  return `${unread.length > 0 ? 'Here are the unread messages I see:' : 'Here are the most recent messages I see:'}\n${lines.join('\n')}`;
}

function documentsSummary(context: AmeliaPatientContext): string {
  if (context.documents.length === 0) {
    return 'I do not see any uploaded documents yet. Requested uploads will appear from your Home tab tasks.';
  }
  const groups = context.documents.reduce<Record<string, string[]>>((acc, document) => {
    const label =
      document.uploadedBy === 'patient'
        ? 'patient-provided'
        : document.uploadedBy === 'clinic'
          ? 'dialysis clinic-provided'
          : 'transplant center-provided';
    acc[label] = [...(acc[label] ?? []), document.name];
    return acc;
  }, {});
  return Object.entries(groups)
    .map(([label, names]) => `${label}: ${formatList(names)}`)
    .join('\n');
}

function careTeamSummary(context: AmeliaPatientContext): string {
  const primary = context.careTeam.slice(0, 4).map((member) => {
    const helps = member.helpsWith.slice(0, 2).join(' and ');
    return `- ${member.name}, ${member.role} (${member.organization}) helps with ${helps}.`;
  });
  return primary.join('\n');
}

function nextStepResponse(context: AmeliaPatientContext): string {
  const pendingRequired = pendingRequiredTodos(context);
  if (context.stage === 'onboarding' && !context.roiSigned) {
    return 'Your next step is to finish onboarding: sign the two ROI forms and choose your communication preferences. After that, the app moves you into Initial To-Dos.';
  }
  if (pendingRequired.length > 0) {
    const titles = pendingRequired.map((todo) => todo.title);
    return `Your next step is to finish ${formatList(titles)}. Once Government ID, Insurance Card, and the Health Questionnaire are complete, your case moves to Initial Screening for ChristianaCare review.`;
  }
  if (context.stage === 'initial-screening') {
    return 'Your required intake tasks are complete. ChristianaCare is now reviewing your health questionnaire responses in Initial Screening. Watch Messages for any questions from the care team.';
  }
  return `${context.stageGuidance.patientSummary} ${context.stageGuidance.patientCanDo[0] ?? 'Watch for updates from your care team.'}`;
}

function safetyResponse(query: string): string | null {
  if (/\b(chest pain|trouble breathing|can't breathe|stroke|severe pain|emergency|suicidal)\b/i.test(query)) {
    return 'If this might be an emergency, call 911 or seek urgent medical care now. I can help draft a non-urgent message to your care team, but I should not be used for urgent symptoms.';
  }
  if (/\b(am i eligible|will i be approved|diagnose|what does my result mean|contraindication)\b/i.test(query)) {
    return 'I cannot decide eligibility, diagnose, or interpret clinical results. I can help you write a clear message to ChristianaCare so the care team can answer that safely.';
  }
  return null;
}

export function deriveAmeliaActions(
  query: string,
  context: AmeliaPatientContext,
  _articles: KnowledgeArticle[] = []
): AmeliaAction[] {
  void _articles;
  if (safetyResponse(query)) return [];
  const lower = query.toLowerCase();
  const shouldDraft = wantsDraft(query);

  if (shouldDraft) {
    const threadKey = draftThread(lower, context);
    const body = buildDraftBody(lower, context, threadKey);
    return [{
      id: actionId('draft'),
      kind: 'message-draft',
      label: 'Review drafted message',
      target: `message-thread:${threadKey}`,
      draft: {
        threadKey,
        body,
      },
    }];
  }

  const explicitTodo = explicitTodoAction(query, context);
  if (explicitTodo) return [explicitTodo];

  const specificThread = threadAction(query, context);
  if (specificThread) return [specificThread];

  const generalMessages = messagesAction(query);
  if (generalMessages) return [generalMessages];

  const explicitProfile = profileAction(query);
  if (explicitProfile) return [explicitProfile];

  if (isNextActionQuery(query)) {
    const nextAction = nextTodoAction(context);
    return nextAction ? [nextAction] : [];
  }

  return [];
}

export function generateLocalAmeliaResponse(payload: AmeliaRequestPayload): AmeliaRouteResponse {
  const query = payload.message.trim();
  const context = payload.patientContext;
  const articles = lookupKnowledge(query);
  const safety = safetyResponse(query);
  let content: string;

  if (safety) {
    content = safety;
  } else if (/\b(message|messages|said|say|reply|inbox)\b/i.test(query) && !wantsDraft(query)) {
    content = messageSummary(context);
  } else if (/\b(document|documents|upload|uploaded|id|insurance card|roi)\b/i.test(query)) {
    content = documentsSummary(context);
  } else if (/\b(who|care team|coordinator|social worker|nephrologist|financial)\b/i.test(query)) {
    content = careTeamSummary(context);
  } else if (/\b(next|now|done|status|waiting|stage|todo|to-do|task)\b/i.test(query)) {
    content = nextStepResponse(context);
  } else if (wantsDraft(query)) {
    const threadKey = draftThread(query, context);
    content = `I can draft that for ${threadLabel(threadKey)}. Please review it before sending.`;
  } else if (articles.length > 0) {
    const article = articles[0];
    content = `${article.summary}\n\n${article.body.join('\n')}`;
  } else {
    content =
      'I can help with your next steps, to-dos, documents, messages, care team, and general transplant referral questions. For anything clinical or urgent, please contact your care team directly.';
  }

  return {
    id: actionId('amelia'),
    content,
    actions: deriveAmeliaActions(query, context, articles),
    source: 'local-fallback',
  };
}

export function buildAmeliaSystemPrompt(
  payload: AmeliaRequestPayload,
  articles: KnowledgeArticle[]
): string {
  const compactContext = {
    patient: {
      name: payload.patientContext.name,
      firstName: payload.patientContext.firstName,
      stage: payload.patientContext.stageLabel,
      daysInStage: payload.patientContext.daysInStage,
      isStuck: payload.patientContext.isStuck,
      referralSource: payload.patientContext.referralSource,
      clinic: payload.patientContext.referringClinic,
      dusw: payload.patientContext.duswName,
      nephrologist: payload.patientContext.nephrologistName,
      roiSigned: payload.patientContext.roiSigned,
      consents: payload.patientContext.communicationConsents,
    },
    todos: payload.patientContext.todos,
    documents: payload.patientContext.documents,
    unreadMessages: payload.patientContext.unreadMessages,
    recentMessages: payload.patientContext.messages.slice(0, 5),
    stageGuidance: payload.patientContext.stageGuidance,
    careTeam: payload.patientContext.careTeam.slice(0, 6),
    relevantKnowledge: articles.map((article) => ({
      title: article.title,
      summary: article.summary,
      body: article.body,
    })),
  };

  return [
    'You are Amelia, a patient-facing ChristianaCare transplant referral guide inside a leadership demo prototype.',
    'Answer warmly and practically in plain language. Keep answers concise: usually 2-4 short paragraphs or bullets.',
    'Use only the provided current-patient context. Never discuss other patients.',
    'You may explain next steps, to-dos, documents, messages, app navigation, care team roles, and general transplant process information.',
    'Do not give medical advice, diagnose, interpret clinical answers, predict transplant eligibility, confirm insurance coverage, or make scheduling promises.',
    'Do not say you completed tasks, uploaded documents, changed profile data, signed forms, or sent messages. The patient must take all actions.',
    'If the patient asks to message someone, draft only the message body and tell them to review and send it from the correct message thread.',
    'Do not invent button labels, links, or navigation destinations. The app may add a separate action button when there is a clear supported destination.',
    'If the patient asks to open, go to, or be taken to a supported task, thread, Messages, or Profile, do not say you cannot take them there. Answer briefly and mention that they can use the action button below if one appears.',
    'Do not send patients back to ROI forms after they are signed.',
    'If the user mentions urgent symptoms or emergency language, tell them to call 911 or seek urgent care now.',
    `Current patient context JSON:\n${JSON.stringify(compactContext)}`,
  ].join('\n\n');
}
