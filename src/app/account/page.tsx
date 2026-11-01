import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountView } from '@/components/auth-panel';
import { SiteShell } from '@/components/site-header';

export const metadata: Metadata = {
  title: 'Your account',
  robots: { index: false },
};

export default function AccountPage() {
  return (
    <SiteShell>
      <Suspense>
        <AccountView />
      </Suspense>
    </SiteShell>
  );
}
