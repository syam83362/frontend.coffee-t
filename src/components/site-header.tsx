'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Menu, ShoppingBag, Store, UserRound, X } from 'lucide-react';
import { useSession } from './session-provider';
import { cx } from './ui';

const links = [
  { href: '/#shop', label: 'Shop' },
  { href: '/cafe', label: 'Cafés & tables' },
  { href: '/account?tab=orders', label: 'Orders' },
];

export function Logo({ className }: { className?: string }) {
  return (
    <Link className={cx('inline-flex items-center gap-2.5', className)} href="/" aria-label="Coffee-T home">
      <span className="grid size-9 place-items-center rounded-xl bg-sun font-display text-lg text-ink">C</span>
      <span className="font-display text-2xl leading-none tracking-tight">coffee-t</span>
    </Link>
  );
}

export function SiteHeader() {
  const { user, status, cartCount } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const staffLink =
    user?.role === 'admin'
      ? { href: '/admin', label: 'Admin', icon: LayoutDashboard }
      : user?.role === 'cafe_manager' || user?.role === 'waiter'
        ? { href: '/cafe/staff', label: 'Staff', icon: Store }
        : null;

  return (
    <>
      <div className="bg-sun px-4 py-2 text-center text-xs font-semibold text-ink">
        Fresh from Indian estates · Roasted and blended in small batches
      </div>
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map((link) => (
              <Link
                className="rounded-full px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-cloud hover:text-ink"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
            {staffLink && (
              <Link
                className="rounded-full px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-cloud hover:text-ink"
                href={staffLink.href}
              >
                {staffLink.label}
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-1.5">
            <Link
              aria-label={`Basket${cartCount ? `, ${cartCount} items` : ''}`}
              className="relative grid size-11 place-items-center rounded-full transition-colors hover:bg-cloud"
              href="/account?tab=basket"
            >
              <ShoppingBag size={20} aria-hidden="true" />
              {cartCount > 0 && (
                <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-sun px-1 text-[11px] font-bold leading-5 text-ink ring-2 ring-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
            <Link
              className="hidden min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold transition-colors hover:border-ink sm:inline-flex"
              href="/account"
            >
              <UserRound size={17} aria-hidden="true" />
              {status === 'loading' ? 'Account' : user ? 'My account' : 'Sign in'}
            </Link>
            <button
              aria-expanded={open}
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="grid size-11 place-items-center rounded-full transition-colors hover:bg-cloud md:hidden"
              onClick={() => setOpen((value) => !value)}
              type="button"
            >
              {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-line bg-white px-4 pb-4 pt-2 md:hidden" aria-label="Mobile">
            {[...links, ...(staffLink ? [staffLink] : []), { href: '/account', label: user ? 'My account' : 'Sign in' }].map(
              (link) => (
                <Link
                  className="block rounded-xl px-3 py-3 text-base font-semibold hover:bg-cloud"
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        )}
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-6 text-muted">
            Coffee and tea grown close to home, roasted and blended in small batches.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Shop</p>
          <ul className="mt-3 grid gap-2 text-sm font-medium">
            <li><Link className="hover:text-sun-ink" href="/#shop">All products</Link></li>
            <li><Link className="hover:text-sun-ink" href="/account?tab=basket">Basket</Link></li>
            <li><Link className="hover:text-sun-ink" href="/account?tab=orders">Order history</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Visit</p>
          <ul className="mt-3 grid gap-2 text-sm font-medium">
            <li><Link className="hover:text-sun-ink" href="/cafe">Find a café</Link></li>
            <li><Link className="hover:text-sun-ink" href="/account?tab=reservations">My reservations</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Coffee-T. Good things grow close to home.
        </p>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
