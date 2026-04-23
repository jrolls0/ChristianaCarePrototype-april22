'use client';

import { ShellHeader } from '@/components/ui/ShellHeader';
import { Card, CardContent, CardTitle } from '@/components/ui/Card';

export default function ClinicNewReferralPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <ShellHeader
        accent="navy"
        eyebrow="Dialysis Clinic · New Referral"
        title="Submit New Referral"
        subtitle="Riverside Dialysis Center"
      />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Card>
          <CardContent className="py-10 text-center">
            <CardTitle>New referral form</CardTitle>
            <p className="mt-2 text-sm text-slate-600">
              Pre-filled referral form and submit flow arrive in Phase 5.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
