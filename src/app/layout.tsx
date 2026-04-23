import type { Metadata } from 'next';
import '@/styles/globals.css';
import { CrossTabSync } from '@/components/CrossTabSync';

export const metadata: Metadata = {
  title: 'ChristianaCare Transplant Referral Prototype',
  description:
    'Demo prototype — patient, Front Desk, and dialysis clinic views of the transplant referral platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <CrossTabSync />
        {children}
      </body>
    </html>
  );
}
