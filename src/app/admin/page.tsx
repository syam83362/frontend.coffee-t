import type { Metadata } from 'next';
import { AdminDashboard } from '@/components/admin-dashboard';
import { SiteShell } from '@/components/site-header';

export const metadata: Metadata = {
  title: 'Administration',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <SiteShell>
      <AdminDashboard />
    </SiteShell>
  );
}
