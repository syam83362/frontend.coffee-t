'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, BellRing } from 'lucide-react';
import { getCsrfToken, getCurrentUser } from '@/lib/auth-api';
import {
  CafeLocation,
  CafeOrder,
  CafeTable,
  createAssistedOrder,
  getAssignedCafes,
  getCafeMenu,
  getPendingCafeOrders,
  getStaffTables,
  getWaiterCalls,
  recordCashCollection,
  resolveWaiterCall,
  WaiterCall,
  updateCafeOrderStatus,
} from '@/lib/cafe-api';
import { CatalogueProduct } from '@/lib/catalogue-api';
import { Account } from '@/lib/auth-api';

export function CafeStaffDashboard() {
  const [account, setAccount] = useState<Account | null>(null);
  const [cafes, setCafes] = useState<CafeLocation[]>([]);
  const [cafeId, setCafeId] = useState('');
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [orders, setOrders] = useState<CafeOrder[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedTable, setSelectedTable] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getCurrentUser(), getCsrfToken(), getAssignedCafes()])
      .then(([user, token, locations]) => {
        if (!active) return;
        setAccount(user.user);
        setCsrfToken(token);
        setCafes(locations);
        setCafeId(locations[0]?.id ?? '');
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Staff access could not be loaded.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!cafeId) return;
    let active = true;
    Promise.all([
      getStaffTables(cafeId),
      getCafeMenu(cafeId),
      getWaiterCalls(cafeId),
      getPendingCafeOrders(cafeId),
    ])
      .then(([nextTables, menu, nextCalls, nextOrders]) => {
        if (!active) return;
        setTables(nextTables);
        setProducts(menu);
        setCalls(nextCalls);
        setOrders(nextOrders);
        setSelectedTable((current) => current || nextTables[0]?.id || '');
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Café operations could not be loaded.');
      });
    return () => { active = false; };
  }, [cafeId]);

  async function refresh(): Promise<void> {
    if (!cafeId) return;
    const [nextCalls, nextOrders] = await Promise.all([
      getWaiterCalls(cafeId),
      getPendingCafeOrders(cafeId),
    ]);
    setCalls(nextCalls);
    setOrders(nextOrders);
  }

  async function markCallResolved(callId: string): Promise<void> {
    setBusy(true);
    setError('');
    try {
      await resolveWaiterCall(callId, csrfToken);
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The waiter call could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  async function submitAssistedOrder(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const items = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([variantId, quantity]) => ({ variantId, quantity }));
    if (!selectedTable || !items.length) return;
    setBusy(true);
    setError('');
    try {
      await createAssistedOrder(cafeId, selectedTable, items, crypto.randomUUID(), csrfToken);
      setQuantities({});
      setNotice('Assisted order created. Record cash only after collecting it from the customer.');
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The assisted order could not be created.');
    } finally {
      setBusy(false);
    }
  }

  async function collectCash(orderId: string): Promise<void> {
    setBusy(true);
    setError('');
    try {
      await recordCashCollection(orderId, csrfToken);
      setNotice('Cash collection was recorded and the order was confirmed.');
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Cash collection could not be recorded.');
    } finally {
      setBusy(false);
    }
  }

  async function advance(orderId: string, status: 'preparing' | 'ready' | 'delivered'): Promise<void> {
    setBusy(true);
    setError('');
    try {
      await updateCafeOrderStatus(orderId, status, csrfToken);
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Order status could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  const isStaff = account && ['admin', 'cafe_manager', 'waiter'].includes(account.role);

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="border-b border-ink/15 bg-white px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase text-coral">Coffee-T · Café operations</p><h1 className="mt-1 font-display text-3xl">Staff workspace</h1></div>
          <Link className="inline-flex items-center gap-2 text-sm font-bold" href="/account">Account <ArrowUpRight size={15} /></Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8">
        {error && <p className="mb-5 border-l-4 border-coral bg-white px-4 py-3 text-sm" role="alert">{error}</p>}
        {notice && <p className="mb-5 border-l-4 border-leaf bg-mint px-4 py-3 text-sm" role="status">{notice}</p>}
        {!isStaff && account ? (
          <p className="border-y border-ink/15 py-5 text-sm">This account does not have café staff access.</p>
        ) : !cafes.length ? (
          <p className="border-y border-ink/15 py-5 text-sm">Sign in with an assigned café staff account.</p>
        ) : (
          <>
            <label className="mb-8 flex max-w-sm items-center gap-3 text-xs font-bold uppercase">
              Café
              <select className="min-h-11 min-w-0 flex-1 border border-ink/20 bg-white px-3 text-sm normal-case" onChange={(event) => { setCafeId(event.target.value); setSelectedTable(''); }} value={cafeId}>
                {cafes.map((cafe) => <option key={cafe.id} value={cafe.id}>{cafe.name} · {cafe.city}</option>)}
              </select>
            </label>
            <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
              <section aria-labelledby="calls-heading">
                <div className="flex items-baseline justify-between border-b-2 border-ink pb-3"><h2 className="font-display text-2xl" id="calls-heading">Waiter calls</h2><span className="text-xs font-bold tabular-nums">{calls.length}</span></div>
                {calls.length ? <div className="divide-y divide-ink/10">{calls.map((call) => (
                  <div className="flex items-center justify-between gap-4 py-4" key={call.id}>
                    <div className="flex items-center gap-3"><span className="grid size-10 place-items-center bg-sun"><BellRing size={17} /></span><div><p className="font-bold">Table {call.table.tableNumber}</p><p className="text-xs text-muted">{new Date(call.createdAt).toLocaleTimeString()}</p></div></div>
                    <button className="min-h-10 border border-ink px-3 text-xs font-bold" disabled={busy} onClick={() => void markCallResolved(call.id)} type="button">Resolve</button>
                  </div>
                ))}</div> : <p className="py-5 text-sm text-muted">No open calls.</p>}
              </section>
              <section aria-labelledby="assisted-heading">
                <div className="border-b-2 border-ink pb-3"><h2 className="font-display text-2xl" id="assisted-heading">Assisted order</h2></div>
                <form className="mt-4 grid gap-4" onSubmit={submitAssistedOrder}>
                  <label className="grid gap-2 text-xs font-bold uppercase">Table
                    <select className="min-h-11 border border-ink/20 bg-white px-3 text-sm normal-case" onChange={(event) => setSelectedTable(event.target.value)} required value={selectedTable}>
                      {tables.map((table) => <option key={table.id} value={table.id}>Table {table.tableNumber} · {table.capacity} seats</option>)}
                    </select>
                  </label>
                  <div className="divide-y divide-ink/10">
                    {products.map((product) => {
                      const variant = product.variants[0];
                      if (!variant) return null;
                      return <label className="flex items-center justify-between gap-4 py-3" key={variant.id}><span><strong className="text-sm">{product.name}</strong><span className="block text-xs text-muted">{variant.name}</span></span><input aria-label={`Quantity for ${product.name}`} className="min-h-10 w-20 border border-ink/20 px-2 text-center" max={20} min={0} onChange={(event) => setQuantities((current) => ({ ...current, [variant.id]: Number(event.target.value) }))} type="number" value={quantities[variant.id] ?? 0} /></label>;
                    })}
                  </div>
                  <button className="min-h-12 bg-leaf px-4 text-sm font-bold text-white disabled:opacity-60" disabled={busy || !tables.length || !products.length} type="submit">Create assisted order · cash after collection</button>
                </form>
              </section>
            </div>
            <section className="mt-12" aria-labelledby="pending-heading">
              <div className="border-b-2 border-ink pb-3"><h2 className="font-display text-2xl" id="pending-heading">Awaiting payment</h2></div>
              {orders.length ? <div className="divide-y divide-ink/10">{orders.map((order) => (
                <div className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center" key={order.id}>
                  <div><p className="font-bold">Order {order.orderNumber} · Table {order.cafeTable?.tableNumber ?? 'Unknown'}</p><p className="mt-1 text-xs text-muted">{order.items.map((item) => `${item.quantity} × ${item.productName}`).join(' · ')}</p></div>
                  {order.fulfillmentType === 'assisted_dine_in' ? <button className="min-h-11 bg-ink px-4 text-xs font-bold text-white" disabled={busy} onClick={() => void collectCash(order.id)} type="button">Record cash collected</button> : <span className="text-xs text-muted">Awaiting verified online payment</span>}
                </div>
              ))}</div> : <p className="py-5 text-sm text-muted">No pending café orders.</p>}
            </section>
            <section className="mt-12" aria-labelledby="active-heading">
              <div className="flex items-baseline justify-between border-b-2 border-ink pb-3"><h2 className="font-display text-2xl" id="active-heading">Preparation queue</h2><Link className="text-xs font-bold text-leaf" href={`/cafe/display/${cafeId}`} target="_blank">Open TV display <ArrowUpRight size={13} className="inline" /></Link></div>
              <div className="grid gap-4 py-5 sm:grid-cols-2 xl:grid-cols-3">
                {orders.filter((order) => ['confirmed', 'preparing', 'ready'].includes(order.status)).map((order) => {
                  const nextStatus = order.status === 'confirmed' ? 'preparing' : order.status === 'preparing' ? 'ready' : 'delivered';
                  return <article className="border-l-4 border-sun bg-white p-4" key={order.id}><p className="font-display text-2xl">#{order.orderNumber} · {order.cafeTable?.tableNumber}</p><p className="mt-1 text-[10px] font-bold uppercase text-coral">{order.status}</p><ul className="my-4 grid gap-1 text-sm">{order.items.map((item) => <li key={item.id}>{item.quantity} × {item.productName}</li>)}</ul><button className="min-h-10 border border-ink px-3 text-xs font-bold" disabled={busy} onClick={() => void advance(order.id, nextStatus)} type="button">Mark {nextStatus}</button></article>;
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}