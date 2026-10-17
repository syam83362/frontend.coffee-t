'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { BellRing, Minus, Plus, ShoppingBasket } from 'lucide-react';
import { getCsrfToken } from '@/lib/auth-api';
import { CatalogueProduct } from '@/lib/catalogue-api';
import {
  callWaiter,
  createTableOrder,
  getCafeMenu,
  getTableContext,
  resolveTablePayment,
  startTablePayment,
  TableContext,
} from '@/lib/cafe-api';
import { PaymentAttempt } from '@/lib/order-api';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

export function TableOrdering({ tableCode }: { tableCode: string }) {
  const [token, setToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [context, setContext] = useState<TableContext | null>(null);
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [order, setOrder] = useState<{ id: string; orderNumber: number; status: string; totalPaise: number } | null>(null);
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setToken(sessionStorage.getItem(`coffee-t-table:${tableCode}`) ?? '');
  }, [tableCode]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    Promise.all([getTableContext(tableCode, token), getCsrfToken()])
      .then(async ([table, csrf]) => {
        const menu = await getCafeMenu(table.cafe.id);
        if (active) {
          setContext(table);
          setProducts(menu);
          setCsrfToken(csrf);
          setError('');
        }
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Could not open this table.');
      });
    return () => { active = false; };
  }, [tableCode, token]);

  const total = useMemo(() => products.reduce((sum, product) => {
    const variant = product.variants[0];
    return sum + (variant ? variant.pricePaise * (quantities[variant.id] ?? 0) : 0);
  }, 0), [products, quantities]);
  const itemCount = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);

  function connect(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    sessionStorage.setItem(`coffee-t-table:${tableCode}`, tokenInput);
    setToken(tokenInput);
  }

  function updateQuantity(variantId: string, delta: number): void {
    setQuantities((current) => {
      const next = Math.min(20, Math.max(0, (current[variantId] ?? 0) + delta));
      return { ...current, [variantId]: next };
    });
  }

  async function requestWaiter(): Promise<void> {
    setBusy(true);
    setError('');
    try {
      await callWaiter(tableCode, token, csrfToken);
      setMessage('A waiter has been notified for your table.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The waiter could not be notified.');
    } finally {
      setBusy(false);
    }
  }

  async function submitOrder(): Promise<void> {
    const items = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([variantId, quantity]) => ({ variantId, quantity }));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await createTableOrder(tableCode, token, items, crypto.randomUUID(), csrfToken);
      setOrder(result);
      setQuantities({});
      if (result.status === 'confirmed') setMessage(`Order ${result.orderNumber} is confirmed.`);
      else {
        const payment = await startTablePayment(tableCode, token, result.id, crypto.randomUUID(), csrfToken);
        setAttempt(payment);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The order could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  async function pay(outcome: 'success' | 'failure'): Promise<void> {
    if (!attempt) return;
    setBusy(true);
    setError('');
    try {
      const payment = await resolveTablePayment(tableCode, token, attempt.id, outcome, csrfToken);
      setAttempt(payment);
      setOrder((current) => current ? { ...current, status: outcome === 'success' ? 'confirmed' : 'pending_payment' } : current);
      setMessage(outcome === 'success' ? 'Development payment simulated. This order is confirmed for testing only.' : 'Development payment failed. The order is not confirmed.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Payment simulation failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!token || (!context && !error)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-5 text-ink">
        <form className="w-full max-w-md border-t-4 border-leaf bg-white p-6" onSubmit={connect}>
          <p className="text-[11px] font-bold uppercase text-coral">Coffee-T table {tableCode}</p>
          <h1 className="mt-3 font-display text-4xl">Open the menu.</h1>
          <label className="mt-6 grid gap-2 text-sm font-semibold">Table access token
            <input className="min-h-12 border border-ink/20 px-3 font-sans text-sm" onChange={(event) => setTokenInput(event.target.value)} required value={tokenInput} />
          </label>
          <button className="mt-4 min-h-12 w-full bg-leaf px-4 text-sm font-bold text-white" type="submit">Continue</button>
          {error && <p className="mt-4 text-sm text-coral" role="alert">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="bg-leaf px-5 py-6 text-white sm:px-8">
        <p className="text-[10px] font-bold uppercase text-sun">Coffee-T · {context?.cafe.city}</p>
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-4">
          <div><h1 className="mt-2 font-display text-4xl">{context?.cafe.name}</h1><p className="mt-2 text-sm text-white/80">Table {context?.table.number}</p></div>
          <button aria-label="Call a waiter" className="grid size-[68px] shrink-0 place-items-center bg-[#198343] text-white transition-colors hover:bg-[#126b35] disabled:opacity-60" disabled={busy} onClick={() => void requestWaiter()} title="Call a waiter" type="button">
            <BellRing size={25} aria-hidden="true" />
          </button>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        {error && <p className="mb-5 border-l-4 border-coral bg-white px-4 py-3 text-sm" role="alert">{error}</p>}
        {message && <p className="mb-5 border-l-4 border-leaf bg-mint px-4 py-3 text-sm" role="status">{message}</p>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const variant = product.variants[0];
            if (!variant) return null;
            return (
              <article className="border-b border-ink/15 pb-5" key={product.id}>
                <div className="relative aspect-[4/3] overflow-hidden bg-mint">
                  {product.imageUrl && <Image alt={product.name} className="object-cover" fill sizes="(max-width: 640px) 100vw, 50vw" src={product.imageUrl} unoptimized />}
                  <span className="absolute left-3 top-3 bg-paper px-2 py-1 text-[10px] font-bold uppercase">{product.category.name}</span>
                </div>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div><h2 className="font-display text-2xl">{product.name}</h2><p className="mt-1 text-xs text-muted">{variant.name}</p></div>
                  <span className="shrink-0 text-sm font-bold">{money.format(variant.pricePaise / 100)}</span>
                </div>
                <p className="mt-2 text-sm leading-5 text-muted">{product.description}</p>
                <div className="mt-4 flex items-center justify-end gap-3">
                  <button aria-label={`Remove one ${product.name}`} className="grid size-10 place-items-center border border-ink/20" disabled={!quantities[variant.id]} onClick={() => updateQuantity(variant.id, -1)} type="button"><Minus size={16} /></button>
                  <span className="w-6 text-center tabular-nums">{quantities[variant.id] ?? 0}</span>
                  <button aria-label={`Add one ${product.name}`} className="grid size-10 place-items-center bg-sun" onClick={() => updateQuantity(variant.id, 1)} type="button"><Plus size={17} /></button>
                </div>
              </article>
            );
          })}
        </div>
        {!!itemCount && !order && (
          <div className="sticky bottom-0 mt-8 flex flex-wrap items-center justify-between gap-4 border-t-2 border-ink bg-paper py-4">
            <p className="text-sm font-semibold">{itemCount} items · {money.format(total / 100)}</p>
            <button className="inline-flex min-h-12 items-center gap-3 bg-leaf px-5 text-sm font-bold text-white disabled:opacity-60" disabled={busy} onClick={() => void submitOrder()} type="button">Send order <ShoppingBasket size={17} /></button>
          </div>
        )}
        {order && (
          <section className="mt-8 border-t-2 border-leaf py-5" aria-live="polite">
            <p className="text-[10px] font-bold uppercase text-coral">Order {order.orderNumber}</p>
            <h2 className="mt-2 font-display text-3xl">{order.status.replaceAll('_', ' ')}</h2>
            <p className="mt-2 text-sm">{money.format(order.totalPaise / 100)}</p>
            {attempt?.developmentSimulationAvailable && (
              <div className="mt-5 border border-sun bg-white p-4">
                <p className="text-xs font-bold uppercase">Development payment simulation only</p>
                <p className="mt-1 text-xs text-muted">No money is charged. Production simulation is disabled.</p>
                <div className="mt-3 flex gap-2">
                  <button className="min-h-10 bg-leaf px-4 text-xs font-bold text-white" disabled={busy} onClick={() => void pay('success')} type="button">Simulate success</button>
                  <button className="min-h-10 border border-coral px-4 text-xs font-bold text-coral" disabled={busy} onClick={() => void pay('failure')} type="button">Simulate failure</button>
                </div>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}