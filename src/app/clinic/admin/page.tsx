'use client';

import { FileText, MessageSquare, Settings } from 'lucide-react';
import { ClinicShell, CLINIC_CONTAINER } from '@/components/ui/ClinicShell';
import { clsx } from 'clsx';

const PREVIEW_TILES = [
  {
    title: 'Referral defaults',
    description: 'Clinic staff, nephrologist, and referral form settings.',
    icon: FileText,
  },
  {
    title: 'Document sharing',
    description: 'Clinic document categories and upload permissions.',
    icon: MessageSquare,
  },
  {
    title: 'Clinic users',
    description: 'DUSW and clinic team access management.',
    icon: Settings,
  },
];

export default function ClinicAdminPage() {
  return (
    <ClinicShell>
      <main className={clsx('py-6', CLINIC_CONTAINER)}>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Admin Configuration
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This demo focuses on referral submission, status tracking, document sharing,
              and care-team messaging. Clinic admin settings are outside this demo flow.
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {PREVIEW_TILES.map(({ description, icon: Icon, title }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-slate-500"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 ring-1 ring-slate-200">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-700">{title}</h3>
                <p className="mt-1 text-xs leading-5">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </ClinicShell>
  );
}
