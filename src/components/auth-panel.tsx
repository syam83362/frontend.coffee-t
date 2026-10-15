'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Coffee } from 'lucide-react';
import {
  Account,
  ApiError,
  getCsrfToken,
  getCurrentUser,
  login,
  logout,
  refreshSession,
  register,
} from '@/lib/auth-api';

type AuthMode = 'login' | 'register';
const accountImage =
  'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1500&q=85';

export function AuthPanel() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [account, setAccount] = useState<Account | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function restoreSession(): Promise<void> {
      try {
        const token = await getCsrfToken();
        if (!active) return;
        setCsrfToken(token);

        try {
          const result = await getCurrentUser();
          if (active) setAccount(result.user);
        } catch (requestError) {
          if (!(requestError instanceof ApiError) || requestError.status !== 401) {
            throw requestError;
          }
          const refreshed = await refreshSession(token);
          if (active) {
            setAccount(refreshed.user);
            setCsrfToken(refreshed.csrfToken);
          }
        }
      } catch (requestError) {
        if (active && !(requestError instanceof ApiError && requestError.status === 401)) {
          setError(messageFor(requestError));
        }
      } finally {
        if (active) setReady(true);
      }
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!csrfToken) return;

    setBusy(true);
    setError(null);
    try {
      const result =
        mode === 'login'
          ? await login(email, password, csrfToken)
          : await register(email, password, csrfToken);
      setAccount(result.user);
      setCsrfToken(result.csrfToken);
      setPassword('');
    } catch (requestError) {
      setError(messageFor(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout(): Promise<void> {
    if (!csrfToken) return;

    setBusy(true);
    setError(null);
    try {
      await logout(csrfToken);
      setAccount(null);
      setCsrfToken(await getCsrfToken());
    } catch (requestError) {
      setError(messageFor(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-paper text-ink lg:grid lg:grid-cols-[1.04fr_0.96fr]">
      <section className="relative isolate hidden min-h-dvh overflow-hidden bg-leaf lg:block" aria-labelledby="account-brand-title">
        <Image
          alt="Coffee being prepared at an independent cafe"
          className="object-cover"
          fill
          priority
          sizes="52vw"
          src={accountImage}
        />
        <div className="absolute inset-0 bg-ink/50" />
        <div className="relative flex min-h-dvh flex-col justify-between p-10 text-white xl:p-14">
          <Link className="flex w-fit items-center gap-3" href="/" aria-label="Coffee-T home">
            <span className="grid size-10 place-items-center bg-sun text-ink"><Coffee size={20} /></span>
            <span className="font-display text-[26px] leading-none">coffee-t</span>
          </Link>
          <div className="mb-8 max-w-[560px]">
            <p className="mb-5 text-[11px] font-bold uppercase text-sun">From Indian coffee country</p>
            <h1 id="account-brand-title" className="font-display text-[60px] leading-[1.02] xl:text-[72px]">
              A little closer to your next cup.
            </h1>
            <p className="mt-6 max-w-[400px] text-base leading-7 text-white/80">
              Good things grow close to home.
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase text-white/70">Coffee &amp; tea, rooted in India</span>
        </div>
      </section>

      <section className="flex min-h-dvh flex-col px-5 pb-8 pt-5 sm:px-10 lg:px-14 xl:px-20">
        <header className="flex items-center justify-between border-b border-ink/10 pb-5 lg:border-0 lg:pb-0">
          <Link className="flex items-center gap-2 font-display text-xl lg:hidden" href="/">
            <span className="grid size-8 place-items-center bg-leaf text-sm text-white">C</span>
            coffee-t
          </Link>
          <span className="hidden text-[10px] font-bold uppercase text-muted lg:block">Customer account</span>
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-coral" href="/">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to shop
          </Link>
        </header>

        <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center py-12">
          {account ? (
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase text-coral">Your account</p>
              <h2 className="font-display text-[44px] leading-tight">Welcome back.</h2>
              <p className="mt-5 text-base text-muted">{account.email}</p>
              <p className="mt-3 inline-flex bg-mint px-3 py-1.5 text-[10px] font-bold uppercase text-leaf">{account.role}</p>
              {error && <p className="mt-5 text-sm text-coral" role="alert">{error}</p>}
              <button
                className="mt-8 inline-flex min-h-12 items-center gap-3 bg-leaf px-6 text-sm font-bold text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleLogout}
                disabled={busy}
              >
                {busy ? 'Signing out…' : 'Sign out'}
                <ArrowUpRight size={17} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <p className="mb-3 text-[11px] font-bold uppercase text-coral">Your Coffee-T</p>
                <h2 id="account-title" className="font-display text-[43px] leading-[1.08] sm:text-[50px]">
                  {mode === 'login' ? 'Come on in.' : 'Make it yours.'}
                </h2>
                <p className="mt-4 max-w-[350px] text-sm leading-6 text-muted">
                  {mode === 'login' ? 'Sign in to pick up where your last cup left off.' : 'Create an account for your Coffee-T orders.'}
                </p>
              </div>

              <div className="grid grid-cols-2 border-b border-ink/15" role="tablist" aria-label="Account access">
                <button
                  className={`min-h-12 border-b-2 text-sm font-bold transition-colors ${mode === 'login' ? 'border-coral text-ink' : 'border-transparent text-muted hover:text-ink'}`}
                  type="button"
                  role="tab"
                  aria-selected={mode === 'login'}
                  onClick={() => { setMode('login'); setError(null); }}
                >
                  Sign in
                </button>
                <button
                  className={`min-h-12 border-b-2 text-sm font-bold transition-colors ${mode === 'register' ? 'border-coral text-ink' : 'border-transparent text-muted hover:text-ink'}`}
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  onClick={() => { setMode('register'); setError(null); }}
                >
                  Register
                </button>
              </div>

              <form className="mt-7 grid gap-5" onSubmit={handleSubmit}>
                <div className="grid gap-2">
                  <label className="text-xs font-bold" htmlFor="email">Email address</label>
                  <input
                    className="min-h-12 border border-ink/20 bg-white px-3 text-sm outline-none transition focus:border-leaf focus:ring-2 focus:ring-leaf/15"
                    autoComplete="email"
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    maxLength={320}
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-xs font-bold" htmlFor="password">Password</label>
                  <input
                    className="min-h-12 border border-ink/20 bg-white px-3 text-sm outline-none transition focus:border-leaf focus:ring-2 focus:ring-leaf/15"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={mode === 'register' ? 12 : 1}
                    maxLength={128}
                  />
                </div>

                {error && <p className="text-sm leading-6 text-coral" role="alert">{error}</p>}

                <button
                  className="mt-1 inline-flex min-h-12 items-center justify-between bg-leaf px-5 text-sm font-bold text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:bg-muted"
                  type="submit"
                  disabled={!ready || !csrfToken || busy}
                >
                  {!ready ? 'Loading account…' : busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </button>
              </form>
            </>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-ink/10 pt-4 text-[10px] font-bold uppercase text-muted">
          <span>COFFEE-T</span>
          <span>Customer access</span>
        </footer>
      </section>
    </main>
  );
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}