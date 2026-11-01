'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DisplayOrder, subscribeToCafeDisplay } from '@/lib/cafe-api';
import { cx } from './ui';

type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'signed-out';

export function CafeDisplay({ cafeId }: { cafeId: string }) {
  const [orders, setOrders] = useState<DisplayOrder[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [clock, setClock] = useState('');

  useEffect(() => subscribeToCafeDisplay(cafeId, setOrders, setStatus), [cafeId]);

  useEffect(() => {
    const tick = () => setClock(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date()));
    tick();
    const timer = window.setInterval(tick, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const preparing = orders.filter((order) => order.status === 'confirmed' || order.status === 'preparing');
  const ready = orders.filter((order) => order.status === 'ready');

  if (status === 'signed-out') {
    return (
      <main className="grid min-h-dvh place-items-center bg-white p-8 text-center">
        <div>
          <p className="font-display text-5xl">Display signed out</p>
          <p className="mt-3 text-xl text-muted">Sign in on this screen with a staff account to resume.</p>
          <Link
            className="mt-8 inline-flex min-h-14 items-center rounded-full bg-sun px-8 text-lg font-semibold"
            href={`/account?next=${encodeURIComponent(`/cafe/display/${cafeId}`)}`}
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-white text-ink">
      <header className="flex items-center justify-between gap-6 bg-sun px-8 py-5">
        <p className="font-display text-4xl">coffee-t</p>
        <div className="flex items-center gap-6">
          <span
            className={cx(
              'inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold',
              status === 'live' ? 'text-success' : 'text-sun-ink',
            )}
          >
            <span className={cx('size-2.5 rounded-full', status === 'live' ? 'animate-pulse bg-success' : 'bg-sun-strong')} />
            {status === 'live' ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
          </span>
          <span className="text-3xl font-semibold tabular-nums">{clock}</span>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
        <section className="border-line p-8 lg:border-r" aria-label="Preparing">
          <h1 className="text-2xl font-semibold uppercase tracking-[0.14em] text-muted">Preparing</h1>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 2xl:grid-cols-3" aria-live="polite">
            {preparing.map((order) => (
              <article className="rounded-3xl border-2 border-line p-6" key={order.orderNumber}>
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-display text-6xl leading-none">{order.orderNumber}</p>
                  <p className="text-lg text-muted">Table {order.tableNumber}</p>
                </div>
                <ul className="mt-5 grid gap-2 text-xl">
                  {order.items.map((item, index) => (
                    <li className="flex justify-between gap-3" key={`${item.name}-${index}`}>
                      <span>{item.name}</span>
                      <strong className="tabular-nums">×{item.quantity}</strong>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
            {!preparing.length && <p className="text-2xl text-muted">No orders in progress.</p>}
          </div>
        </section>

        <section className="bg-sun-soft p-8" aria-label="Ready for pickup">
          <h2 className="text-2xl font-semibold uppercase tracking-[0.14em] text-sun-ink">Ready</h2>
          <div className="mt-6 grid grid-cols-2 gap-5 xl:grid-cols-3" aria-live="assertive">
            {ready.map((order) => (
              <article className="rounded-3xl bg-sun p-6 text-center shadow-card" key={order.orderNumber}>
                <p className="font-display text-7xl leading-none">{order.orderNumber}</p>
                <p className="mt-2 text-lg font-semibold">Table {order.tableNumber}</p>
              </article>
            ))}
          </div>
          {!ready.length && <p className="text-2xl text-sun-ink/70">Nothing ready yet.</p>}
        </section>
      </div>
    </main>
  );
}
