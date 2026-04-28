'use client';

import { FileText, Settings, ShieldCheck } from 'lucide-react';
import { StaffShell, STAFF_CONTAINER } from '@/components/ui/StaffShell';
import { clsx } from 'clsx';

const ADMIN_TILES = [
  {
    title: 'Workflow stages',
    body: 'Configure queue steps, stage names, and handoffs.',
    icon: Settings,
  },
  {
    title: 'Document templates',
    body: 'Manage reusable record requests and patient task templates.',
    icon: FileText,
  },
  {
    title: 'Staff roles',
    body: 'Review coordinator roles and permission groups.',
    icon: ShieldCheck,
  },
];

export default function StaffAdminPage() {
  return (
    <StaffShell>
      <main className={clsx('py-6', STAFF_CONTAINER)}>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Staff portal
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              Admin Configuration
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This leadership demo focuses on referral intake, case queue
              management, and inbox coordination. Admin configuration is outside
              this demo flow.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {ADMIN_TILES.map((tile) => {
              const Icon = tile.icon;
              return (
                <div
                  key={tile.title}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-500"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-slate-700">
                    {tile.title}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {tile.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </StaffShell>
  );
}
