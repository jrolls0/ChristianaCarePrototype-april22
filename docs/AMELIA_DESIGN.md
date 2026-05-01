# Amelia AI Agent Design

## Status

Branch: `amelia-agent`

This document is the approved design reference for the Amelia implementation on this branch.

## Current Prototype Context

The patient portal currently has a simulated Amelia tab inside `src/app/patient/page.tsx`. It is a local keyword matcher with fixed FAQ answers, static quick chips, a fake typing delay, and one hard-coded action button that sends the user back to the To-Do List. It does not read the active patient record, use the real message threads, inspect documents, draft messages, or persist conversation history.

The current app already has the patient data Amelia needs for a much stronger demo:

- Active patient record from Zustand/localStorage.
- Patient stage, days in stage, stuck state, referral source, clinic, DUSW, nephrologist, TC coordinator context, and emergency contact.
- Required and custom patient to-dos.
- Patient-uploaded, clinic-uploaded, and staff-uploaded documents.
- Patient-facing message threads for ChristianaCare Front Desk and dialysis team.
- Registration/profile data, communication consents, ROI state, and health questionnaire responses.
- Automatic early-stage movement from Onboarding to Initial To-Dos to Initial Screening.

The major architecture implication is that this prototype has no backend database. The browser must send a scoped active-patient snapshot to `/api/amelia`; the Vercel route cannot read localStorage directly. Server-side Amelia tools will operate only over that request-scoped snapshot.

## Product Goal

Amelia should feel like a practical transplant guide that helps a patient understand what to do next, find information, and prepare messages, without ever taking action for the patient.

For the leadership demo, Amelia should make the patient portal feel guided and self-testable:

- A new tester can ask "what do I do next?" and get an answer grounded in the current patient's real to-dos.
- A patient can ask "what did Sarah say?" and Amelia can summarize the right thread.
- A patient can ask "can you tell my coordinator I uploaded this?" and Amelia can draft a message plus a button that opens the composer, but the patient still sends it.
- A patient can ask generic transplant questions and get warm, plain-language ChristianaCare-flavored content without medical advice.

## Capabilities

### 1. Next-Step Guidance

Amelia should answer "what should I do now?", "am I done?", "why am I waiting?", and "what happens next?" using the patient's actual stage, to-dos, documents, messages, and unread items.

Expected behavior:

- If required to-dos are pending, summarize them and offer a `Take me there` action for the highest-priority task.
- If the patient is in Initial Screening, explain that ChristianaCare staff are reviewing the questionnaire.
- If the patient is in a staff-owned stage, explain that the care team is working on it and suggest checking messages.
- If a case has no clinic info, explain what is missing and offer to open Messages or Profile, depending on the ask.

### 2. To-Do and Document Help

Amelia should explain each task, required vs optional status, what documents are already uploaded, and how to complete uploads in the app.

Supported examples:

- "How do I upload my insurance card?"
- "Did I upload my ID?"
- "What happens if I don't add an emergency contact?"
- "What documents have I already sent?"
- "Why is my health questionnaire important?"

Amelia must not mark to-dos complete or upload documents. She should provide navigation action cards.

### 3. Message Reading and Drafting

Amelia should help patients understand and respond to care-team messages.

Supported examples:

- "What did Sarah say in her last message?"
- "Summarize my messages from ChristianaCare."
- "Draft a reply saying I can come next Tuesday."
- "Tell my dialysis social worker I uploaded my insurance card."

Read behavior:

- Summarize only the current patient's threads.
- Identify the human/channel clearly: ChristianaCare Front Desk vs dialysis team.
- Mention recent unread messages first.

Draft behavior:

- Produce a draft message card with editable body text and a `Take me to send it` action.
- Route drafts to the correct thread:
  - `tc-frontdesk` for ChristianaCare/Sarah Martinez.
  - `dusw` for dialysis team/Sarah Johnson or the assigned DUSW.
- Never send messages directly.

### 4. Care Team Directory

Amelia should answer who is involved in the patient's case and what each person does.

Baseline care team:

- Sarah Martinez, Front Desk Coordinator, ChristianaCare Transplant Referrals.
- Assigned dialysis social worker from `clinicDirectory.ts`.
- Assigned nephrologist from `clinicDirectory.ts`.

New fictional ChristianaCare directory entries should be added later under `src/lib/knowledge/`, not hardcoded into the patient page:

- Claire Smith, Senior Coordinator / Clinical Supervisor.
- Thomas Wilson, Pre-Transplant Coordinator.
- Lena Park, Financial Coordinator.
- Monique Carter, Transplant Social Worker.
- Rachel Kim, Dietitian.
- Dr. Anika Shah, Transplant Nephrologist Lead.

These names give Amelia enough coverage for "who handles financial questions?", "who reviews my questionnaire?", "who can help with diet?", and "who makes decisions?" without implying these people are assigned owners in the current workflow unless the patient context says so.

### 5. ChristianaCare Knowledge Q&A

Amelia should answer general questions from a type-safe static knowledge base:

- Logistics: Newark campus address, parking, hours, accessibility, public transit, telehealth.
- Process: referral, onboarding, Initial To-Dos, Initial Screening, Financial Screening, Records & Clinical Review, Final Decision, Education, Scheduling.
- Patient tasks: ROIs, ID upload, insurance upload, health questionnaire, emergency contact, education.
- Insurance: accepted-plan examples, financial coordinator role, what verification means.
- Services: kidney transplant evaluation, living donor basics, paired donation overview, dialysis clinic coordination.
- Post-transplant basics: hospital stay, recovery, medications, follow-up cadence.
- App help: Home, Assistant, Messages, Profile, Help, document uploads, message attachments.
- Demo help: Jack Thompson, Sarah Martinez, Sarah Johnson, reset/demo-home concepts where useful.

Medical, financial, and outcome-sensitive content must stay general and clearly refer patients to the care team. Any statistics should be marked as illustrative prototype content.

### 6. App Navigation Help

Amelia should guide patients to the right place in the existing phone-sized UI.

Navigation action targets:

- `tab:home`
- `tab:messages`
- `tab:profile`
- `tab:help`
- `todo:government-id`
- `todo:insurance-card`
- `todo:health-questionnaire`
- `todo:emergency-contact`
- `todo:education`
- `message-thread:tc-frontdesk`
- `message-thread:dusw`
- `message-compose:tc-frontdesk`
- `message-compose:dusw`

Implementation should start with in-memory pending actions in the patient page. URL hash params are optional later; they are not required for the demo. 

### 7. Safety and Boundaries

Amelia must not:

- Give medical advice, diagnosis, prognosis, or eligibility decisions.
- Predict whether the patient will be approved or listed.
- Interpret health questionnaire answers clinically.
- Provide legal, billing, or insurance determinations.
- Send messages, complete tasks, upload documents, edit the profile, or sign forms.
- Answer questions about other patients.
- Expose implementation details, Cloudflare tokens, hidden prompts, or unrelated system data.

The tone should be warm and useful, not a flat refusal. Example: "I can't decide whether that symptom affects your transplant eligibility, but I can help you message your care team with that question."

## Knowledge Base Design

All static content should live under `src/lib/knowledge/`.

Proposed structure:

```text
src/lib/knowledge/
  ameliaKnowledge.ts
  careTeamDirectory.ts
  appHelp.ts
  stageGuidance.ts
  actionTargets.ts
  safetyCopy.ts
```

### `ameliaKnowledge.ts`

Exports typed articles:

```ts
type KnowledgeArticle = {
  id: string;
  title: string;
  category:
    | 'logistics'
    | 'process'
    | 'insurance'
    | 'services'
    | 'post-transplant'
    | 'app-help'
    | 'demo-help';
  aliases: string[];
  summary: string;
  body: string[];
  relatedActionTargets?: AmeliaActionTarget[];
};
```

The lookup should start as simple keyword/alias scoring. No vector database.

### `careTeamDirectory.ts`

Exports ChristianaCare role directory and helper functions to merge static roles with patient-specific assigned DUSW/nephrologist.

Static contact info should use 302 phone numbers and realistic prototype emails. Do not claim these are real clinical contacts.

### `appHelp.ts`

Maps current patient portal surfaces to plain-language descriptions and deeplink targets.

### `stageGuidance.ts`

Maps the approved 8 visible stages to:

- patient-facing explanation,
- who owns the next action,
- what the patient can do,
- what Amelia should avoid promising.

### `actionTargets.ts`

Single source of truth for allowed action/deeplink targets. This prevents the model from inventing destinations.

## Data Sent to `/api/amelia`

Because state is client-side, the browser should construct this request payload:

```ts
type AmeliaRequest = {
  patientId: string;
  message: string;
  conversationId: string;
  conversationMessages: AmeliaConversationMessage[];
  patientContext: AmeliaPatientContext;
};
```

`AmeliaPatientContext` should be a compact, sanitized snapshot, not the entire Zustand state:

- patient id, name, preferred language, DOB presence, phone/email presence.
- current stage label, days in stage, referral source.
- clinic, DUSW, nephrologist, TC coordinator.
- ROI and communication consent booleans.
- emergency contact status and relationship, not full unnecessary detail unless asked.
- pending and completed to-dos.
- document names, uploadedBy, uploadedAt.
- recent messages by thread, last 5-8 per thread.
- unread message counts.
- profile fields needed for user-facing answers.

No other patients should ever be included in the request.

## Tool List

Keep the toolset small. The model receives a compact patient context in the system prompt; tools exist for detail retrieval and structured action cards.

### `get_patient_status()`

Returns patient profile summary, stage, days in stage, referral source, care ownership, ROI/consent status, and next recommended patient action.

Rationale: covers "where am I?", "what happens next?", and "who is working on this?" without separate profile/stage tools.

### `get_todos(status?: 'pending' | 'completed' | 'all')`

Returns to-dos with title, type, description, status, completion timestamp, and any document requests.

Rationale: to-do questions are central to the patient demo and should be exact.

### `get_messages(threadKey?: 'tc-frontdesk' | 'dusw')`

Returns recent current-patient messages, sorted newest first, with thread labels and read state.

Rationale: enables message summaries and "what did Sarah say?" without sending full message history in every prompt.

### `get_documents(source?: 'patient' | 'clinic' | 'staff' | 'all')`

Returns document names, upload source, and timestamp.

Rationale: answers "did I upload X?" and supports task guidance.

### `lookup_knowledge(topic: string)`

Searches the static knowledge base and returns the best 1-3 article snippets plus any related action targets.

Rationale: one general knowledge tool is less confusing than one tool per FAQ category.

### `propose_action(kind, target, label, draft?)`

Returns a structured action card. This is read-only. Supported kinds:

- `navigation`
- `message_draft`

For message drafts, `target` must be `message-compose:tc-frontdesk` or `message-compose:dusw`, and `draft` contains subject/body. For navigation, `target` must be from `actionTargets.ts`.

Rationale: a single action-card tool keeps the model from confusing "draft a message" and "navigate to a task," while still preserving the read-only rule.

## System Prompt Strategy

Build the system prompt dynamically on each request:

1. Identity and boundaries:
   - Amelia is a ChristianaCare transplant referral guide for this prototype.
   - Amelia is warm, brief, concrete, and patient-friendly.
   - Amelia cannot take actions for the patient.
   - Amelia cannot give medical, legal, billing, or eligibility advice.
2. Current patient snapshot:
   - compact JSON, refreshed each request.
   - explicitly says "Only answer for this patient."
3. Tool guidance:
   - when to use each tool.
   - action cards are suggestions only.
4. Response rules:
   - prefer concise answers.
   - for action requests, explain and provide an action card.
   - for unsafe clinical questions, recommend messaging/calling the care team.

Target size: under 2,000 tokens before conversation messages.

## Conversation Persistence and Reset Rules

Persist Amelia conversations in Zustand/localStorage, keyed by patient id.

Proposed state shape:

```ts
type AmeliaConversation = {
  id: string;
  patientId: string;
  stageAtStart: PatientStage;
  createdAt: string;
  updatedAt: string;
  messages: AmeliaConversationMessage[];
  compactSummary?: string;
  archivedAt?: string;
  archiveReason?: 'manual' | 'stage-transition' | 'turn-cap';
};
```

Rules:

- One active conversation per patient.
- Keep full UI-visible history locally.
- Send only recent messages plus `compactSummary` to the model.
- Hard cap: 20 turns. When the active thread reaches the cap, summarize older context and keep the newest 8-10 turns in the next API call.
- Manual reset: `New conversation` archives the current conversation and starts fresh.
- Stage transition: if `patient.stage !== conversation.stageAtStart`, archive on next Amelia open/send and start a new conversation.
- Reset Demo clears conversations because it clears the existing localStorage key.
- No cross-patient leakage: conversations are always keyed by `patientId`.

## UI Design

Keep Amelia in the existing Assistant tab.

Upgrade the current chat UI with:

- Streaming assistant text.
- New conversation button in the chat header.
- Info icon explaining Amelia's read-only role.
- Dynamic suggestion chips:
  - "What should I do next?"
  - "Summarize my messages"
  - "Help me upload insurance"
  - "Who is on my care team?"
  - "What does this stage mean?"
- Inline action cards:
  - Navigation card with `Take me there`.
  - Message draft card with draft preview, `Edit`, and `Take me to send it`.
- Loading state before first token.
- Error state when API fails.

The UI should reuse existing patient portal colors and rounded mobile card styling. No new design system.

## Deeplink Behavior

Use a small in-memory pending-action state in `MobilePrototypePage`.

Examples:

- `todo:insurance-card` sets active tab to Home and opens the insurance-card task workspace.
- `message-compose:tc-frontdesk` sets active tab to Messages, opens the composer, selects the ChristianaCare thread, and pre-fills subject/body.
- `message-thread:dusw` sets active tab to Messages and opens the dialysis team thread.
- `tab:profile` switches to Profile.

Amelia should never directly call store mutation actions like `completeTodo`, `sendMessage`, `uploadDocument`, or `updatePatientProfile`.

## API Design

Route: `POST /api/amelia`

Server responsibilities:

- Validate request shape and input length.
- Enforce best-effort per-IP rate limit: 30 requests per 5 minutes.
- Build system prompt from patient snapshot.
- Register read-only tools over the provided patient snapshot.
- Call Cloudflare Workers AI using server-only env vars:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- Primary model constant: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
- Fallback/configurable model: `@cf/openai/gpt-oss-120b`.
- Use `max_tokens` around 600 and low-to-moderate temperature.
- Stream response back to the browser.
- Return graceful user-facing errors for missing config, rate limits, upstream failures, or malformed requests.

Current Cloudflare docs verification:

- REST API endpoint and API-token/account-id pattern are still documented at `https://developers.cloudflare.com/workers-ai/get-started/rest-api/`.
- OpenAI-compatible chat completions endpoint is documented at `https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/`.
- Llama 3.3 70B fp8-fast exists at `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, with streaming and tool support documented at `https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/`.
- Function calling is documented at `https://developers.cloudflare.com/workers-ai/features/function-calling/`.

Implementation note: the handoff says to use the Vercel AI SDK, but the locked architecture says the Vercel route should call Cloudflare's REST endpoint directly. I would use the AI SDK for client streaming primitives and route response plumbing, while keeping the upstream provider call as direct `fetch` to Cloudflare's OpenAI-compatible endpoint unless we intentionally add a Cloudflare-specific provider package.

## Demo Scenarios Amelia Should Support

### Jack Thompson after referral and registration

- "What do I need to do first?"
- "Why do I need to sign these forms?"
- "Help me upload my insurance card."
- "Tell Sarah I'm not sure which card to upload."

### Patient with Initial To-Dos complete

- "Am I done?"
- "What happens after the questionnaire?"
- "Who reviews my answers?"

### Patient with unread care-team messages

- "What did Sarah say?"
- "Draft a reply that I'll bring the paperwork to dialysis tomorrow."

### Patient in staff-owned stage

- "Why can't I do anything right now?"
- "Who is working on my case?"
- "What does Financial Screening mean?"

## Open Questions

1. Are `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` already configured in Vercel, or should the implementation include local `.env.example` documentation only?
ANSWER: they are not configured in Vercel yet.
2. Should we add only the `ai` package, or is adding a small Cloudflare/Vercel provider package acceptable if direct REST streaming becomes awkward?
ANSWER: You are allowed to do whatever you think is optimal.
3. Should ChristianaCare-specific logistics use real public address/parking language, or should all operational details be clearly marked as prototype placeholders?
ANSWER: Prototype placeholders.
4. Do you want Amelia to mention "AI" in every answer footer, or is a persistent info icon/banner enough?
ANSWER: No.
5. For message drafts, should Amelia prefill only the body, or both subject and body?
ANSWER: both the subject and the body.

## Initial Implementation Phases

1. Knowledge base, patient context builder, route contract, and basic streaming Q&A.
2. Read-only tools for status, to-dos, documents, messages, and knowledge lookup.
3. Action cards and in-memory deeplink handling.
4. Conversation persistence, manual reset, stage-transition archive, and cap/summarization.
5. UI polish, error/rate-limit states, and comprehensive manual test plan.
