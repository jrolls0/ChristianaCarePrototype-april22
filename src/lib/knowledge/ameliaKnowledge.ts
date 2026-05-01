import type { AmeliaActionTarget } from '../types';

export type KnowledgeCategory =
  | 'logistics'
  | 'process'
  | 'insurance'
  | 'services'
  | 'post-transplant'
  | 'app-help'
  | 'demo-help';

export type KnowledgeArticle = {
  id: string;
  title: string;
  category: KnowledgeCategory;
  aliases: string[];
  summary: string;
  body: string[];
  relatedActionTargets?: AmeliaActionTarget[];
};

export const AMELIA_KNOWLEDGE: KnowledgeArticle[] = [
  {
    id: 'parking-location',
    title: 'Parking and Location',
    category: 'logistics',
    aliases: ['parking', 'park', 'address', 'directions', 'where', 'building'],
    summary:
      'ChristianaCare transplant visits are shown in this demo as Newark-campus visits. Patients should use their appointment instructions for exact parking and check-in details.',
    body: [
      'For the demo, Amelia can explain that patients should follow the appointment instructions from ChristianaCare and leave extra time for parking and check-in.',
      'If a patient is unsure where to go, the safest next step is to message ChristianaCare Front Desk from the patient portal.',
    ],
    relatedActionTargets: ['message-thread:tc-frontdesk'],
  },
  {
    id: 'evaluation-journey',
    title: 'Evaluation Journey',
    category: 'process',
    aliases: ['steps', 'stage', 'stages', 'process', 'workflow', 'what happens next', 'evaluation'],
    summary:
      'The prototype workflow is Onboarding, Initial To-Dos, Initial Screening, Financial Screening, Records & Clinical Review, Final Decision, Education, and Scheduling.',
    body: [
      'Patient-owned work happens mostly during Onboarding, Initial To-Dos, and Education.',
      'ChristianaCare-owned work begins in Initial Screening, when staff review questionnaire responses and decide whether to move the case forward.',
      'Records & Clinical Review represents work that may happen outside this app and may vary by patient.',
    ],
    relatedActionTargets: ['tab:home', 'tab:messages'],
  },
  {
    id: 'insurance-screening',
    title: 'Insurance and Financial Screening',
    category: 'insurance',
    aliases: ['insurance', 'financial', 'coverage', 'payer', 'medicare', 'medicaid', 'cost'],
    summary:
      'Financial Screening means the care team is reviewing insurance details. Amelia can explain the process, but cannot confirm coverage or costs.',
    body: [
      'Patients should keep insurance information current and respond quickly if ChristianaCare asks for updated card images or coverage details.',
      'Coverage and cost questions should be routed to the care team because the answer depends on the specific plan and patient situation.',
    ],
    relatedActionTargets: ['tab:profile', 'message-thread:tc-frontdesk'],
  },
  {
    id: 'roi-forms',
    title: 'ROI Forms',
    category: 'process',
    aliases: ['roi', 'release', 'authorization', 'consent', 'forms', 'signature'],
    summary:
      'The two ROI forms let the demo move from Onboarding into Initial To-Dos after they are completed.',
    body: [
      'The Services ROI and Medical Records ROI are required onboarding steps in this prototype.',
      'Amelia can explain what the forms are for, but she cannot sign them or change consent choices.',
    ],
    relatedActionTargets: ['tab:home'],
  },
  {
    id: 'health-questionnaire',
    title: 'Health Questionnaire',
    category: 'process',
    aliases: ['questionnaire', 'health form', 'screening questions', 'medical history'],
    summary:
      'The health questionnaire is one of the three required Initial To-Dos and helps staff prepare for screening review.',
    body: [
      'After the questionnaire, Government ID, and Insurance Card are complete, the case moves to Initial Screening.',
      'Amelia should not interpret questionnaire answers clinically. Patients should message the care team with clinical concerns.',
    ],
    relatedActionTargets: ['todo:health-questionnaire', 'message-thread:tc-frontdesk'],
  },
  {
    id: 'documents',
    title: 'Documents and Uploads',
    category: 'app-help',
    aliases: ['document', 'documents', 'upload', 'id', 'license', 'insurance card', 'file'],
    summary:
      'Patients can simulate uploading requested documents from the Home tab task workspace.',
    body: [
      'Government ID requires the front image in this prototype.',
      'Insurance Card requires front and back images.',
      'Custom document requests from staff also appear as upload tasks on Home.',
    ],
    relatedActionTargets: ['tab:home'],
  },
  {
    id: 'messages',
    title: 'Messages',
    category: 'app-help',
    aliases: ['message', 'reply', 'send', 'ask', 'contact', 'sarah', 'dialysis team'],
    summary:
      'Patients can message ChristianaCare Front Desk or the dialysis team from the Messages tab.',
    body: [
      'Amelia can draft a message, but the patient must review and send it.',
      'Unread care-team messages are shown on Home and in Messages.',
    ],
    relatedActionTargets: ['tab:messages', 'message-thread:tc-frontdesk'],
  },
  {
    id: 'living-donor-basics',
    title: 'Living Donor Basics',
    category: 'services',
    aliases: ['living donor', 'donor', 'paired donation', 'kidney donor'],
    summary:
      'Living donation can be part of kidney transplant education, but donor evaluation details are outside this prototype flow.',
    body: [
      'Patients can ask their care team for education resources if they have a possible living donor.',
      'Amelia should keep this general and route personal donor questions to ChristianaCare.',
    ],
    relatedActionTargets: ['message-thread:tc-frontdesk'],
  },
  {
    id: 'post-transplant-basics',
    title: 'Post-Transplant Basics',
    category: 'post-transplant',
    aliases: ['after transplant', 'recovery', 'hospital stay', 'medication', 'medicine'],
    summary:
      'After-transplant care generally involves hospital recovery, follow-up appointments, labs, and long-term medications.',
    body: [
      'Amelia can provide a general overview only. Exact recovery and medication plans depend on the clinical team.',
      'Patients should ask ChristianaCare for personalized post-transplant instructions.',
    ],
    relatedActionTargets: ['message-thread:tc-frontdesk'],
  },
  {
    id: 'demo-help',
    title: 'Demo Help',
    category: 'demo-help',
    aliases: ['demo', 'jack', 'reset', 'test', 'prototype'],
    summary:
      'This is a self-testable prototype. Jack Thompson is the default patient demo account, and Reset Demo clears local demo state.',
    body: [
      'If Jack has not been referred by the clinic, patient registration still works as a self-signup.',
      'If Jack is referred from Riverside first, registration attaches the account to that referral.',
    ],
  },
];

function articleScore(article: KnowledgeArticle, query: string): number {
  const normalized = query.toLowerCase();
  let score = 0;
  if (normalized.includes(article.title.toLowerCase())) score += 5;
  for (const alias of article.aliases) {
    if (normalized.includes(alias)) score += alias.length > 6 ? 3 : 2;
  }
  for (const word of normalized.split(/\W+/).filter((part) => part.length > 3)) {
    if (article.summary.toLowerCase().includes(word)) score += 1;
  }
  return score;
}

export function lookupKnowledge(query: string, limit = 3): KnowledgeArticle[] {
  return AMELIA_KNOWLEDGE
    .map((article) => ({ article, score: articleScore(article, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.article);
}
