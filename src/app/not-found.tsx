import { Coffee } from 'lucide-react';
import { SiteShell } from '@/components/site-header';
import { ButtonLink, EmptyState } from '@/components/ui';

export default function NotFound() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-lg px-4 py-24">
        <EmptyState
          icon={<Coffee size={22} aria-hidden="true" />}
          title="This page has gone cold"
          action={<ButtonLink href="/">Back to the shop</ButtonLink>}
        >
          We couldn&apos;t find what you were looking for.
        </EmptyState>
      </div>
    </SiteShell>
  );
}
