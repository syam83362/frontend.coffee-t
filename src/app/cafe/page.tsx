import type { Metadata } from 'next';
import { CafeDiscovery } from '@/components/cafe-discovery';
import { SiteShell } from '@/components/site-header';

export const metadata: Metadata = {
  title: 'Cafés & reservations',
  description: 'Find a Coffee-T café near you and reserve a table.',
};

export default function CafeDiscoveryPage() {
  return (
    <SiteShell>
      <CafeDiscovery />
    </SiteShell>
  );
}
