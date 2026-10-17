'use client';

import { useEffect, useState } from 'react';
import { subscribeToCafeDisplay } from '@/lib/cafe-api';

type DisplayOrder = { orderNumber: number; tableNumber: string; status: string; items: Array<{ name: string; quantity: number }> };

export function CafeDisplay({ cafeId }: { cafeId: string }) {
  const [orders, setOrders] = useState<DisplayOrder[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => subscribeToCafeDisplay(
    cafeId,
    (nextOrders) => { setOrders(nextOrders); setConnected(true); },
    () => setConnected(false),
  ), [cafeId]);

  return (
    <main className="min-h-dvh bg-[#f1f4ed] px-5 py-7 text-ink sm:px-10">
      <header className="mx-auto flex max-w-[1600px] items-end justify-between gap-5 border-b-2 border-ink pb-5">
        <div><p className="text-xs font-bold uppercase text-coral">Coffee-T · Café orders</p><h1 className="mt-2 font-display text-4xl">Preparation display</h1></div>
        <span className={`text-xs font-bold uppercase ${connected ? 'text-leaf' : 'text-coral'}`}>{connected ? 'Live' : 'Reconnecting'}</span>
      </header>
      <section className="mx-auto grid max-w-[1600px] gap-5 py-7 sm:grid-cols-2 xl:grid-cols-3" aria-live="polite">
        {orders.map((order) => (
          <article className="border-t-8 border-leaf bg-white p-6" key={order.orderNumber}>
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase text-coral">Order</p><h2 className="font-display text-5xl">{order.orderNumber}</h2></div><div className="text-right"><p className="text-[10px] font-bold uppercase text-muted">Table</p><p className="font-display text-3xl">{order.tableNumber}</p></div></div>
            <p className="mt-4 border-y border-ink/10 py-2 text-xs font-bold uppercase">{order.status}</p>
            <ul className="mt-4 grid gap-3">{order.items.map((item, index) => <li className="flex justify-between gap-3 text-lg" key={`${item.name}-${index}`}><span>{item.name}</span><strong className="tabular-nums">× {item.quantity}</strong></li>)}</ul>
          </article>
        ))}
      </section>
    </main>
  );
}