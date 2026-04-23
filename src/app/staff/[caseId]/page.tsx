'use client';

import { useParams } from 'next/navigation';
import { ShellHeader } from '@/components/ui/ShellHeader';
import { Card, CardContent, CardTitle } from '@/components/ui/Card';

export default function StaffCaseDetailPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params?.caseId ?? '';

  return (
    <div className="min-h-screen bg-slate-50">
      <ShellHeader
        eyebrow="Front Desk · Case"
        title={`Case ${caseId}`}
        subtitle="Case detail placeholder"
      />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <Card>
          <CardContent className="py-10 text-center">
            <CardTitle>Case detail</CardTitle>
            <p className="mt-2 text-sm text-slate-600">
              TODOs, documents, activity timeline, and messaging land in Phase 4.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
