'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, ButtonLink, EmptyState } from '@/components/ui';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-24">
      <EmptyState
        icon={<AlertCircle size={22} aria-hidden="true" />}
        title="Something went wrong"
        action={
          <div className="flex gap-2">
            <Button onClick={reset}>Try again</Button>
            <ButtonLink href="/" variant="secondary">
              Go home
            </ButtonLink>
          </div>
        }
      >
        Please try again. If it keeps happening, refresh the page.
      </EmptyState>
    </div>
  );
}
