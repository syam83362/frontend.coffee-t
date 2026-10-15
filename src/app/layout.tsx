import type { Metadata } from 'next';
import { DM_Sans, DM_Serif_Display } from 'next/font/google';
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
  title: 'Coffee-T | Indian Coffee & Tea',
  description: 'Discover Indian coffee and tea from Coffee-T.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}