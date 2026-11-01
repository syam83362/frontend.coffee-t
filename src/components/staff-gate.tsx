'use client';

import { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Role } from '@/lib/api';
import { useSession } from './session-provider';
import { ButtonLink, EmptyState, Skeleton } from './ui';

/** Renders children only for signed-in users with one of the given roles. The API enforces access; this is UX. */
export function StaffGate({ roles, next, children }: { roles: Role[]; next: string; children: ReactNode }) {
  const { status, user } = useSession();

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-80 rounded-3xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <EmptyState
          icon={<ShieldAlert size={22} aria-hidden="true" />}
          title="Staff sign-in required"
          action={<ButtonLink href={`/account?next=${encodeURIComponent(next)}`}>Sign in</ButtonLink>}
        >
          Sign in with your Coffee-T staff account to continue.
        </EmptyState>
      </div>
    );
  }

  if (!roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <EmptyState
          icon={<ShieldAlert size={22} aria-hidden="true" />}
          title="No access"
          action={<ButtonLink href="/" variant="secondary">Back to the shop</ButtonLink>}
        >
          {user.email} does not have permission to view this page.
        </EmptyState>
      </div>
    );
  }

  return <>{children}</>;
}
