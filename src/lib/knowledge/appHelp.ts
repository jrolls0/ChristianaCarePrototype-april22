import type { AmeliaActionTarget } from '../types';

export type AppHelpEntry = {
  id: string;
  title: string;
  aliases: string[];
  description: string;
  target: AmeliaActionTarget;
};

export const AMELIA_APP_HELP: AppHelpEntry[] = [
  {
    id: 'home',
    title: 'Home',
    aliases: ['home', 'to-do', 'todo', 'task', 'upload', 'questionnaire'],
    description:
      'Home shows current patient tasks, unread message prompts, and any simulated document upload buttons.',
    target: 'tab:home',
  },
  {
    id: 'messages',
    title: 'Messages',
    aliases: ['message', 'messages', 'reply', 'send', 'sarah', 'care team'],
    description:
      'Messages is where the patient talks with ChristianaCare Front Desk and the dialysis team.',
    target: 'tab:messages',
  },
  {
    id: 'profile',
    title: 'Profile',
    aliases: ['profile', 'email', 'phone', 'address', 'insurance', 'doctor', 'clinic'],
    description:
      'Profile contains the patient contact information, clinic details, doctors, insurance, and editable profile fields.',
    target: 'tab:profile',
  },
  {
    id: 'help',
    title: 'Help',
    aliases: ['help', 'support', 'call', 'contact'],
    description:
      'Help contains general support information for the prototype patient app.',
    target: 'tab:help',
  },
];

export function findAppHelp(query: string): AppHelpEntry | undefined {
  const normalized = query.toLowerCase();
  return AMELIA_APP_HELP.find((entry) =>
    entry.aliases.some((alias) => normalized.includes(alias))
  );
}
