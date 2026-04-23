'use client';

import { ShellHeader } from '@/components/ui/ShellHeader';
import { Card, CardContent, CardTitle } from '@/components/ui/Card';

export default function ClinicDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <ShellHeader
        accent="navy"
        eyebrow="Dialysis Clinic · Riverside"
        title="Sarah Johnson"
        subtitle="DUSW · Riverside Dialysis Center"
      />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <Card>
          <CardContent className="py-10 text-center">
            <CardTitle>Clinic dashboard</CardTitle>
            <p className="mt-2 text-sm text-slate-600">
              Referral list, KPIs, and drawer view arrive in Phase 5.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
