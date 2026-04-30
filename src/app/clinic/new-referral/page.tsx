'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Info,
  Languages,
  Mail,
  Phone,
  Stethoscope,
  UserRound,
  Users,
} from 'lucide-react';
import { ClinicShell } from '@/components/ui/ClinicShell';
import { useStore } from '@/lib/store';
import type { ReferralSubmission } from '@/lib/types';

const referralSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dob: z.string().min(1, 'Date of birth is required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().min(7, 'Enter a valid phone number'),
  preferredLanguage: z.enum(['English', 'Spanish']),
  duswName: z.string().min(1, 'DUSW name is required'),
  duswEmail: z.string().email('Enter a valid email'),
  nephrologistName: z.string().min(1, 'Nephrologist name is required'),
  nephrologistEmail: z.string().email('Enter a valid email'),
});

type FormValues = z.infer<typeof referralSchema>;

const JACK_PREFILL: FormValues = {
  firstName: 'Jack',
  lastName: 'Thompson',
  dob: '1973-09-14',
  email: 'jack.thompson@email.com',
  phone: '(302) 555-0142',
  preferredLanguage: 'English',
  duswName: 'Sarah Johnson',
  duswEmail: 'sarah.johnson@riversidedialysis.org',
  nephrologistName: 'Dr. Priya Menon',
  nephrologistEmail: 'p.menon@riversidedialysis.org',
};

function fieldErrorClass(hasError: boolean) {
  return hasError
    ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
    : 'border-slate-200 focus:border-[#0f3e80] focus:ring-[#0f3e80]/15';
}

function FieldLabel({
  children,
  htmlFor,
  icon: Icon,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  icon?: typeof UserRound;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
    >
      {Icon ? <Icon className="h-3.5 w-3.5 text-slate-400" /> : null}
      {children}
    </label>
  );
}

export default function ClinicNewReferralPage() {
  const router = useRouter();
  const clinicUser = useStore((s) => s.currentClinicUser);
  const submitReferral = useStore((s) => s.submitReferral);
  const prefilledRef = useRef(false);
  const [submitted, setSubmitted] = useState<{
    firstName: string;
    lastName: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(referralSchema),
    defaultValues: JACK_PREFILL,
  });

  useEffect(() => {
    if (prefilledRef.current) return;
    prefilledRef.current = true;
    reset(JACK_PREFILL);
  }, [reset]);

  const onSubmit = (values: FormValues) => {
    const payload: ReferralSubmission = {
      ...values,
      referringClinic: clinicUser.clinicName,
    };
    submitReferral(payload);
    setSubmitted({ firstName: values.firstName, lastName: values.lastName });
  };

  if (submitted) {
    return (
      <ClinicShell>
        <main className="mx-auto max-w-2xl px-6 py-16">
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-slate-900">
              Referral submitted!
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-slate-600">
              <span className="font-semibold text-slate-900">
                {submitted.firstName} {submitted.lastName}
              </span>{' '}
              will receive a secure link to begin onboarding with ChristianaCare.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#e4efff] px-4 py-1.5 text-xs font-medium text-[#0f3e80]">
              <Users className="h-3.5 w-3.5" />
              Sent to ChristianaCare Front Desk
            </div>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => router.push('/clinic')}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#0f3e80] to-[#0a2a5c] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg"
              >
                Return to dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </main>
      </ClinicShell>
    );
  }

  return (
    <ClinicShell>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/clinic"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-[#0f3e80]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to clinic dashboard
        </Link>

        <div className="mt-4">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Submit New Referral
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Send a dialysis patient referral from {clinicUser.clinicName} to ChristianaCare.
          </p>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#0f3e80]/15 bg-[#eef3fb] px-4 py-3 text-sm text-[#0f3e80]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            We&apos;ve pre-filled this referral with Jack Thompson&apos;s information from his dialysis chart — review the fields and submit.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-6 space-y-6"
          noValidate
        >
          {/* Section 1: Patient Information */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e4efff] text-[#0f3e80]">
                <UserRound className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Patient Information
                </h2>
                <p className="text-xs text-slate-500">
                  Basic identifiers and how to reach the patient.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel htmlFor="firstName">First name</FieldLabel>
                <input
                  id="firstName"
                  {...register('firstName')}
                  className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none transition focus:ring-2 ${fieldErrorClass(!!errors.firstName)}`}
                />
                {errors.firstName && (
                  <p className="text-xs text-red-600">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="lastName">Last name</FieldLabel>
                <input
                  id="lastName"
                  {...register('lastName')}
                  className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none transition focus:ring-2 ${fieldErrorClass(!!errors.lastName)}`}
                />
                {errors.lastName && (
                  <p className="text-xs text-red-600">{errors.lastName.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="dob">Date of birth</FieldLabel>
                <input
                  id="dob"
                  type="date"
                  {...register('dob')}
                  className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none transition focus:ring-2 ${fieldErrorClass(!!errors.dob)}`}
                />
                {errors.dob && (
                  <p className="text-xs text-red-600">{errors.dob.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="preferredLanguage" icon={Languages}>
                  Preferred language
                </FieldLabel>
                <select
                  id="preferredLanguage"
                  {...register('preferredLanguage')}
                  className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none transition focus:ring-2 ${fieldErrorClass(!!errors.preferredLanguage)}`}
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="email" icon={Mail}>
                  Email
                </FieldLabel>
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none transition focus:ring-2 ${fieldErrorClass(!!errors.email)}`}
                />
                {errors.email && (
                  <p className="text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="phone" icon={Phone}>
                  Phone
                </FieldLabel>
                <input
                  id="phone"
                  type="tel"
                  {...register('phone')}
                  className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none transition focus:ring-2 ${fieldErrorClass(!!errors.phone)}`}
                />
                {errors.phone && (
                  <p className="text-xs text-red-600">{errors.phone.message}</p>
                )}
              </div>
            </div>
          </section>

          {/* Section 2: Clinic Contacts */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e4efff] text-[#0f3e80]">
                <Stethoscope className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Clinic Contacts
                </h2>
                <p className="text-xs text-slate-500">
                  Who ChristianaCare should reach for coordination and records.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel htmlFor="duswName">DUSW name</FieldLabel>
                <input
                  id="duswName"
                  {...register('duswName')}
                  className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none transition focus:ring-2 ${fieldErrorClass(!!errors.duswName)}`}
                />
                {errors.duswName && (
                  <p className="text-xs text-red-600">{errors.duswName.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="duswEmail">DUSW email</FieldLabel>
                <input
                  id="duswEmail"
                  type="email"
                  {...register('duswEmail')}
                  className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none transition focus:ring-2 ${fieldErrorClass(!!errors.duswEmail)}`}
                />
                {errors.duswEmail && (
                  <p className="text-xs text-red-600">{errors.duswEmail.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="nephrologistName">Nephrologist name</FieldLabel>
                <input
                  id="nephrologistName"
                  {...register('nephrologistName')}
                  className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none transition focus:ring-2 ${fieldErrorClass(!!errors.nephrologistName)}`}
                />
                {errors.nephrologistName && (
                  <p className="text-xs text-red-600">
                    {errors.nephrologistName.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="nephrologistEmail">Nephrologist email</FieldLabel>
                <input
                  id="nephrologistEmail"
                  type="email"
                  {...register('nephrologistEmail')}
                  className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none transition focus:ring-2 ${fieldErrorClass(!!errors.nephrologistEmail)}`}
                />
                {errors.nephrologistEmail && (
                  <p className="text-xs text-red-600">
                    {errors.nephrologistEmail.message}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Submit */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs leading-relaxed text-slate-500">
              By submitting, you confirm the patient has been informed and consents to evaluation referral. The patient will receive a secure link via SMS to begin onboarding.
            </p>
            <div className="mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/clinic"
                className="inline-flex items-center justify-center gap-1 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#0f3e80] to-[#0a2a5c] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              >
                Submit Referral
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        </form>
      </main>
    </ClinicShell>
  );
}
