'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, Smartphone, Stethoscope } from 'lucide-react';
import { useStore, STORAGE_KEY } from '@/lib/store';

interface Tile {
  key: 'patient' | 'staff' | 'clinic';
  title: string;
  subtitle: string;
  description: string;
  icon: typeof Smartphone;
  accent: string;
  iconWrap: string;
  href: '/patient' | '/staff' | '/clinic';
}

const TILES: Tile[] = [
  {
    key: 'patient',
    title: 'Patient Portal',
    subtitle: 'Jack Thompson',
    description:
      'Mobile-first experience for patients completing their transplant evaluation tasks.',
    icon: Smartphone,
    accent: 'from-[#3399e6] to-[#1a66cc]',
    iconWrap: 'bg-gradient-to-br from-[#3399e6] to-[#1a66cc] text-white',
    href: '/patient',
  },
  {
    key: 'staff',
    title: 'Front Desk Dashboard',
    subtitle: 'Sarah Martinez · ChristianaCare',
    description:
      'Coordinate incoming referrals, track patient progress, and unblock stuck cases.',
    icon: Stethoscope,
    accent: 'from-[#1a66cc] to-[#0f3e80]',
    iconWrap: 'bg-gradient-to-br from-[#1a66cc] to-[#0f3e80] text-white',
    href: '/staff',
  },
  {
    key: 'clinic',
    title: 'Dialysis Clinic Portal',
    subtitle: 'Sarah Johnson · Riverside DUSW',
    description:
      'Submit transplant referrals and stay in sync with the ChristianaCare team.',
    icon: Building2,
    accent: 'from-[#0f3e80] to-[#0a2a5c]',
    iconWrap: 'bg-gradient-to-br from-[#0f3e80] to-[#0a2a5c] text-white',
    href: '/clinic',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const setCurrentPatient = useStore((s) => s.setCurrentPatient);
  const patients = useStore((s) => s.patients);

  const handleTile = (tile: Tile) => {
    if (tile.key === 'patient') {
      const jack = patients.find((p) => p.id === 'patient-jack');
      if (jack) setCurrentPatient(jack.id);
    }
    router.push(tile.href);
  };

  const handleReset = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-sky-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12 sm:py-16">
        <header className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 shadow-sm backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1a66cc]" />
            ChristianaCare · Leadership Demo
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Transplant Referral Platform
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            A connected view across the patient, our Front Desk team, and
            referring dialysis clinics — one source of truth from referral to
            evaluation.
          </p>
        </header>

        <main className="mt-12 grid flex-1 gap-6 md:grid-cols-3">
          {TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.key}
                onClick={() => handleTile(tile)}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 text-left shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a66cc] focus-visible:ring-offset-2"
              >
                <div
                  className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tile.accent}`}
                />
                <div
                  className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl shadow-md ${tile.iconWrap}`}
                >
                  <Icon className="h-7 w-7" aria-hidden="true" />
                </div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {tile.subtitle}
                </div>
                <div className="mb-3 text-xl font-semibold text-slate-900">
                  {tile.title}
                </div>
                <p className="flex-1 text-sm leading-relaxed text-slate-600">
                  {tile.description}
                </p>
                <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a66cc] transition group-hover:gap-2.5">
                  Open view
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </div>
              </button>
            );
          })}
        </main>

        <footer className="mt-12 flex flex-col items-center gap-3 text-center">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            Reset demo data
          </button>
          <p className="text-xs text-slate-500">
            Clears local demo state and reloads. Use between run-throughs.
          </p>
        </footer>
      </div>
    </div>
  );
}
