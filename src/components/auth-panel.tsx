'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { errorMessage } from '@/lib/api';
import { AccountDashboard } from './account-dashboard';
import { useSession } from './session-provider';
import { Alert, Button, Card, Skeleton, Tabs, TextField } from './ui';

type AuthMode = 'login' | 'register';

/** Only allow same-site relative redirects after sign-in. */
function safeNext(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

export function AccountView() {
  const { status } = useSession();
  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-6 h-72 rounded-3xl" />
      </div>
    );
  }
  return status === 'authenticated' ? <AccountDashboard /> : <AuthPanel />;
}

export function AuthPanel() {
  const { signIn, register } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await signIn(email.trim(), password);
      else await register(email.trim(), password);
      setPassword('');
      const next = safeNext(searchParams.get('next'));
      if (next) router.replace(next);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  const registering = mode === 'register';

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-20">
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-sun">
          <LogIn size={24} aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-display text-4xl">{registering ? 'Create your account' : 'Welcome back'}</h1>
        <p className="mt-2 text-sm text-muted">
          {registering
            ? 'Save addresses, track orders and book tables.'
            : 'Sign in to see your basket, orders and reservations.'}
        </p>
      </div>

      <Card className="mt-8 p-6 sm:p-8">
        <Tabs
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          label="Account access"
          onChange={(next) => {
            setMode(next);
            setError('');
          }}
          tabs={[
            { value: 'login', label: 'Sign in' },
            { value: 'register', label: 'Create account' },
          ]}
          value={mode}
        />

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <TextField
            autoComplete="email"
            label="Email address"
            maxLength={320}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <div className="relative">
            <TextField
              autoComplete={registering ? 'new-password' : 'current-password'}
              hint={registering ? 'At least 12 characters.' : undefined}
              label="Password"
              maxLength={128}
              minLength={registering ? 12 : 1}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type={showPassword ? 'text' : 'password'}
              value={password}
            />
            <button
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-[30px] grid size-8 place-items-center rounded-full text-muted hover:bg-cloud hover:text-ink"
              onClick={() => setShowPassword((value) => !value)}
              type="button"
            >
              {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
          </div>

          {error && <Alert tone="danger">{error}</Alert>}

          <Button block loading={busy} size="lg" type="submit">
            {registering ? 'Create account' : 'Sign in'}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-muted">
        {registering ? 'Already have an account? ' : 'New to Coffee-T? '}
        <button
          className="font-semibold text-ink underline decoration-sun decoration-2 underline-offset-4"
          onClick={() => {
            setMode(registering ? 'login' : 'register');
            setError('');
          }}
          type="button"
        >
          {registering ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </div>
  );
}
