import type { Metadata } from 'next';
import { CafeStaffDashboard } from '@/components/cafe-staff-dashboard';
import { SiteShell } from '@/components/site-header';

export const metadata: Metadata = {
  title: 'Staff workspace',
  robots: { index: false, follow: false },
};

export default function CafeStaffPage() {
  return (
    <SiteShell>
      <CafeStaffDashboard />
    </SiteShell>
  );
}
