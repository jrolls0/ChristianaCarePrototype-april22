'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { AlertCircle, CheckCircle2, MessageSquareText, Send, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '@/lib/store';
import { PATIENT_STAGE_LABEL } from '@/lib/stages';

type FeedbackPortal = 'Patient Portal' | 'Transplant Center Portal' | 'Dialysis Clinic Portal' | 'Demo Home';
type FeedbackType =
  | 'Something is confusing'
  | 'Something looks wrong'
  | 'Something did not work'
  | 'Missing feature or idea'
  | 'General comment';

const PORTAL_OPTIONS: FeedbackPortal[] = [
  'Patient Portal',
  'Transplant Center Portal',
  'Dialysis Clinic Portal',
  'Demo Home',
];

const FEEDBACK_TYPES: FeedbackType[] = [
  'Something is confusing',
  'Something looks wrong',
  'Something did not work',
  'Missing feature or idea',
  'General comment',
];

interface FeedbackButtonProps {
  activeTab?: string;
  className?: string;
  portal: FeedbackPortal;
}

interface FeedbackContext {
  activeTab?: string;
  appEnvironment: string;
  browserLanguage?: string;
  currentCaseId?: string;
  currentPatientId?: string;
  currentPatientName?: string;
  currentPatientStage?: string;
  currentPatientLifecycle?: string;
  demoClinicName?: string;
  demoClinicUser?: string;
  demoRole?: string;
  pageTitle?: string;
  pageUrl?: string;
  route: string;
  userAgent?: string;
  viewport?: string;
}

function inferLifecycle(patient: ReturnType<typeof useStore.getState>['patients'][number] | undefined) {
  if (!patient) return undefined;
  if (patient.endReferral) return 'Ended referral';
  if (patient.stage === 'evaluation-scheduled') return 'Completed';
  return 'In progress';
}

export function FeedbackButton({ activeTab, className, portal }: FeedbackButtonProps) {
  const pathname = usePathname() ?? '';
  const patients = useStore((state) => state.patients);
  const currentPatientId = useStore((state) => state.currentPatientId);
  const clinicUser = useStore((state) => state.currentClinicUser);
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedPortal, setSelectedPortal] = useState<FeedbackPortal>(portal);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('Something is confusing');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const routeCaseId = useMemo(() => {
    const match = pathname.match(/^\/(?:staff|clinic)\/([^/?#]+)/);
    if (!match) return undefined;
    const candidate = match[1];
    if (!candidate || ['messages', 'admin', 'new-referral'].includes(candidate)) return undefined;
    return decodeURIComponent(candidate);
  }, [pathname]);

  const contextPatient = useMemo(() => {
    if (portal === 'Patient Portal' && currentPatientId) {
      return patients.find((patient) => patient.id === currentPatientId);
    }
    if (routeCaseId) {
      return patients.find((patient) => patient.id === routeCaseId);
    }
    return undefined;
  }, [currentPatientId, patients, portal, routeCaseId]);

  function buildContext(): FeedbackContext {
    const patientName = contextPatient
      ? `${contextPatient.firstName} ${contextPatient.lastName}`.trim()
      : undefined;

    return {
      activeTab,
      appEnvironment: process.env.NODE_ENV ?? 'unknown',
      browserLanguage:
        typeof navigator === 'undefined' ? undefined : navigator.language,
      currentCaseId: routeCaseId,
      currentPatientId: contextPatient?.id,
      currentPatientName: patientName,
      currentPatientStage: contextPatient
        ? PATIENT_STAGE_LABEL[contextPatient.stage]
        : undefined,
      currentPatientLifecycle: inferLifecycle(contextPatient),
      demoClinicName: clinicUser?.clinicName,
      demoClinicUser: clinicUser?.name,
      demoRole: portal,
      pageTitle: typeof document === 'undefined' ? undefined : document.title,
      pageUrl: typeof window === 'undefined' ? undefined : window.location.href,
      route: pathname,
      userAgent: typeof navigator === 'undefined' ? undefined : navigator.userAgent,
      viewport:
        typeof window === 'undefined'
          ? undefined
          : `${window.innerWidth}x${window.innerHeight}`,
    };
  }

  function resetAndClose() {
    setOpen(false);
    setStatus('idle');
    setErrorMessage('');
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || status === 'submitting') return;

    setStatus('submitting');
    setErrorMessage('');

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          portal: selectedPortal,
          feedbackType,
          message: trimmedMessage,
          context: buildContext(),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Feedback could not be submitted.');
      }

      setStatus('success');
      setMessage('');
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Feedback could not be submitted.'
      );
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelectedPortal(portal);
          setOpen(true);
        }}
        className={clsx(
          'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900',
          className
        )}
      >
        <MessageSquareText className="h-3.5 w-3.5" />
        Submit feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6 backdrop-blur-sm">
          <div className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Submit Feedback</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Help us improve this prototype.
                </p>
              </div>
              <button
                type="button"
                onClick={resetAndClose}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close feedback form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {status === 'success' ? (
              <div className="px-5 py-6">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">
                        Feedback submitted
                      </p>
                      <p className="mt-1 text-sm text-emerald-800">
                        Thanks. Your feedback was sent to the prototype feedback sheet.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#1a66cc] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1558ad]"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={submitFeedback} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      First name <span className="font-normal text-slate-500">(optional)</span>
                    </span>
                    <input
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Last name <span className="font-normal text-slate-500">(optional)</span>
                    </span>
                    <input
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
                    />
                  </label>
                </div>

                <label className="mt-4 block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Portal
                  </span>
                  <select
                    value={selectedPortal}
                    onChange={(event) => setSelectedPortal(event.target.value as FeedbackPortal)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
                  >
                    {PORTAL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-4 block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Feedback type
                  </span>
                  <select
                    value={feedbackType}
                    onChange={(event) => setFeedbackType(event.target.value as FeedbackType)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
                  >
                    {FEEDBACK_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-4 block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Tell us what happened or what we can improve
                  </span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={5}
                    required
                    placeholder="Write your feedback here..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#3399e6] focus:ring-2 focus:ring-[#dbeeff]"
                  />
                </label>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
                  We&apos;ll automatically include page, browser, viewport, portal, and demo case context.
                </div>

                {status === 'error' && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={resetAndClose}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={message.trim().length === 0 || status === 'submitting'}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1a66cc] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1558ad] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Send className="h-4 w-4" />
                    {status === 'submitting' ? 'Submitting...' : 'Submit feedback'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
