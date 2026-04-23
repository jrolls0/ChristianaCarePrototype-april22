'use client';

import { ShellHeader } from '@/components/ui/ShellHeader';
import { Card, CardContent, CardTitle } from '@/components/ui/Card';

export default function StaffDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <ShellHeader
        eyebrow="Front Desk · ChristianaCare"
        title="Sarah Martinez"
        subtitle="Front Desk Coordinator"
      />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <Card>
          <CardContent className="py-10 text-center">
            <CardTitle>Front Desk dashboard</CardTitle>
            <p className="mt-2 text-sm text-slate-600">
              Patient list, KPIs, and case detail arrive in Phase 4.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
