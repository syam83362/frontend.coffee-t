import type { Metadata, Viewport } from 'next';
import { DM_Sans, DM_Serif_Display } from 'next/font/google';
import { SessionProvider } from '@/components/session-provider';
import { ToastProvider } from '@/components/toast';
import './globals.css';

const sans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-brand-sans',
  display: 'swap',
});

const display = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-brand-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Coffee-T | Indian Coffee & Tea',
    template: '%s · Coffee-T',
  },
  description: 'Shop single-estate Indian coffee and tea, reserve a table, and order at Coffee-T cafés.',
};

export const viewport: Viewport = {
  themeColor: '#ffc914',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body className={`${sans.variable} ${display.variable} font-sans text-ink antialiased`}>
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
