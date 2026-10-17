'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowUpRight, Minus, Plus, Trash2 } from 'lucide-react';
import {
  AddressInput,
  Cart,
  CustomerOrder,
  DeliveryAddress,
  addCartItem,
  checkout,
  createAddress,
  getAddresses,
  getCart,
  getOrders,
  PaymentAttempt,
  resolveDevelopmentPayment,
  removeCartItem,
  setCartItem,
  startPayment,
} from '@/lib/order-api';
import { Account } from '@/lib/auth-api';
import { cancelReservation, getMyReservations, Reservation } from '@/lib/cafe-api';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

export function AccountDashboard({
  account,
  csrfToken,
  busy,
  onLogout,
}: {
  account: Account;
  csrfToken: string;
  busy: boolean;
  onLogout: () => void;
}) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [addingAddress, setAddingAddress] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paymentAttempts, setPaymentAttempts] = useState<Record<string, PaymentAttempt>>({});

  async function reload(): Promise<void> {
    setLoading(true);
    setError('');
    try {
      const [nextCart, nextAddresses, nextOrders, nextReservations] = await Promise.all([
        getCart(),
        getAddresses(),
        getOrders(),
        getMyReservations(),
      ]);
      setCart(nextCart);
      setAddresses(nextAddresses);
      setOrders(nextOrders);
      setReservations(nextReservations);
      setSelectedAddressId((current) => current || nextAddresses[0]?.id || '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Your account could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking(reservationId: string): Promise<void> {
    setSaving(true);
    setError('');
    try {
      const updated = await cancelReservation(reservationId, csrfToken);
      setReservations((current) => current.map((reservation) => reservation.id === updated.id ? updated : reservation));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The reservation could not be cancelled.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function changeQuantity(variantId: string, quantity: number): Promise<void> {
    if (!cart) return;
    setSaving(true);
    setError('');
    try {
      const nextCart = quantity <= 0
        ? (await removeCartItem(variantId, csrfToken), await getCart())
        : await setCartItem(variantId, quantity, csrfToken);
      setCart(nextCart);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The cart could not be updated.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAddress(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const input = Object.fromEntries(formData.entries()) as unknown as AddressInput;
    setSaving(true);
    setError('');
    try {
      const address = await createAddress(input, csrfToken);
      setAddresses((current) => [address, ...current]);
      setSelectedAddressId(address.id);
      setAddingAddress(false);
      form.reset();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The address could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function submitCheckout(): Promise<void> {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const order = await checkout(selectedAddressId, csrfToken);
      setNotice(`Order ${order.id.slice(0, 8).toUpperCase()} created and awaiting payment.`);
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Checkout could not be completed.');
    } finally {
      setSaving(false);
    }
  }

  async function beginPayment(orderId: string): Promise<void> {
    setSaving(true);
    setError('');
    try {
      const attempt = await startPayment(orderId, crypto.randomUUID(), csrfToken);
      setPaymentAttempts((current) => ({ ...current, [orderId]: attempt }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Payment could not be started.');
    } finally {
      setSaving(false);
    }
  }

  async function resolvePayment(orderId: string, outcome: 'success' | 'failure'): Promise<void> {
    const attempt = paymentAttempts[orderId];
    if (!attempt) return;
    setSaving(true);
    setError('');
    try {
      const result = await resolveDevelopmentPayment(orderId, attempt.id, outcome, csrfToken);
      setPaymentAttempts((current) => ({ ...current, [orderId]: result }));
      if (outcome === 'success') setNotice('Development payment simulated; the order is confirmed for testing only.');
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Payment simulation failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="mb-3 text-[11px] font-bold uppercase text-coral">Your account</p>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-[40px] leading-tight">Welcome back.</h2>
          <p className="mt-2 text-sm text-muted">{account.email}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold">
            <Link className="text-leaf hover:text-coral" href="/cafe">Café reservations</Link>
            {account.role === 'admin' && <Link className="text-leaf hover:text-coral" href="/admin">Administration</Link>}
            {['cafe_manager', 'waiter'].includes(account.role) && <Link className="text-leaf hover:text-coral" href="/cafe/staff">Café operations</Link>}
          </div>
        </div>
        <button
          className="min-h-10 border border-ink/20 px-3 text-xs font-bold hover:border-coral hover:text-coral disabled:opacity-60"
          disabled={busy}
          onClick={onLogout}
          type="button"
        >
          Sign out
        </button>
      </div>

      {error && <p className="mt-5 border-l-4 border-coral bg-white px-4 py-3 text-sm" role="alert">{error}</p>}
      {notice && <p className="mt-5 border-l-4 border-leaf bg-mint px-4 py-3 text-sm" role="status">{notice}</p>}
      {loading ? (
        <p className="mt-8 text-sm text-muted">Loading account details…</p>
      ) : (
        <div className="mt-8 grid gap-10">
          <section aria-labelledby="cart-heading">
            <div className="flex items-baseline justify-between border-b border-ink/15 pb-3">
              <h3 className="font-display text-2xl" id="cart-heading">Your basket</h3>
              <Link className="text-xs font-bold text-leaf hover:text-coral" href="/#collections">Shop coffee &amp; tea</Link>
            </div>
            {cart?.items.length ? (
              <div className="divide-y divide-ink/10">
                {cart.items.map((item) => (
                  <div className="grid grid-cols-[1fr_auto] gap-3 py-4" key={item.variantId}>
                    <div>
                      <p className="font-semibold">{item.productName}</p>
                      <p className="mt-1 text-xs text-muted">{item.variantName} · {money.format(item.unitPricePaise / 100)}</p>
                      {!item.available && <p className="mt-1 text-xs font-bold text-coral">Currently unavailable</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button aria-label={`Remove one ${item.productName}`} className="grid size-8 place-items-center border border-ink/20" disabled={saving} onClick={() => void changeQuantity(item.variantId, item.quantity - 1)} type="button">
                        <Minus size={14} aria-hidden="true" />
                      </button>
                      <span className="w-5 text-center text-sm tabular-nums">{item.quantity}</span>
                      <button aria-label={`Add one ${item.productName}`} className="grid size-8 place-items-center border border-ink/20" disabled={saving || !item.available} onClick={() => void changeQuantity(item.variantId, item.quantity + 1)} type="button">
                        <Plus size={14} aria-hidden="true" />
                      </button>
                      <button aria-label={`Remove ${item.productName} from basket`} className="ml-1 grid size-8 place-items-center text-muted hover:text-coral" disabled={saving} onClick={() => void changeQuantity(item.variantId, 0)} type="button">
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                    <p className="col-span-2 text-right text-xs font-bold">{money.format(item.lineTotalPaise / 100)}</p>
                  </div>
                ))}
                <div className="flex justify-between py-4 text-sm font-bold">
                  <span>Subtotal</span><span>{money.format(cart.totalPaise / 100)}</span>
                </div>
              </div>
            ) : (
              <p className="py-5 text-sm text-muted">Your basket is empty.</p>
            )}
          </section>

          <section aria-labelledby="delivery-heading">
            <div className="flex items-baseline justify-between border-b border-ink/15 pb-3">
              <h3 className="font-display text-2xl" id="delivery-heading">Delivery</h3>
              <button className="text-xs font-bold text-leaf hover:text-coral" onClick={() => setAddingAddress((value) => !value)} type="button">
                {addingAddress ? 'Cancel' : 'Add address'}
              </button>
            </div>
            {addingAddress && <AddressForm onSubmit={saveAddress} saving={saving} />}
            {addresses.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {addresses.map((address) => (
                  <label className={`flex cursor-pointer gap-3 border p-3 text-sm ${selectedAddressId === address.id ? 'border-leaf bg-mint/60' : 'border-ink/15'}`} key={address.id}>
                    <input checked={selectedAddressId === address.id} className="accent-leaf" name="delivery-address" onChange={() => setSelectedAddressId(address.id)} type="radio" />
                    <span><strong>{address.recipientName}</strong><br />{address.line1}{address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} {address.pincode}<br /><span className="text-xs text-muted">{address.phone}</span></span>
                  </label>
                ))}
              </div>
            ) : !addingAddress ? (
              <p className="py-5 text-sm text-muted">Add a delivery address to continue.</p>
            ) : null}
            <button
              className="mt-4 inline-flex min-h-12 w-full items-center justify-between bg-leaf px-5 text-sm font-bold text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:bg-muted"
              disabled={saving || !cart?.items.length || !selectedAddressId || cart.items.some((item) => !item.available)}
              onClick={() => void submitCheckout()}
              type="button"
            >
              Place order · awaiting payment <ArrowUpRight size={17} aria-hidden="true" />
            </button>
          </section>

          <section aria-labelledby="orders-heading">
            <div className="border-b border-ink/15 pb-3"><h3 className="font-display text-2xl" id="orders-heading">Order history</h3></div>
            {orders.length ? (
              <div className="divide-y divide-ink/10">
                {orders.map((order) => (
                  <OrderSummary
                    key={order.id}
                    order={order}
                    attempt={paymentAttempts[order.id]}
                    saving={saving}
                    onStart={() => void beginPayment(order.id)}
                    onResolve={(outcome) => void resolvePayment(order.id, outcome)}
                  />
                ))}
              </div>
            ) : (
              <p className="py-5 text-sm text-muted">No orders yet.</p>
            )}
          </section>

          <section aria-labelledby="reservations-heading">
            <div className="flex items-baseline justify-between border-b border-ink/15 pb-3">
              <h3 className="font-display text-2xl" id="reservations-heading">Table reservations</h3>
              <Link className="text-xs font-bold text-leaf" href="/cafe">Find a café</Link>
            </div>
            {reservations.length ? <div className="divide-y divide-ink/10">{reservations.map((reservation) => (
              <div className="flex flex-wrap items-center justify-between gap-3 py-4" key={reservation.id}>
                <div><p className="font-bold">{reservation.cafe.name} · Table {reservation.table.tableNumber}</p><p className="mt-1 text-xs text-muted">{new Date(reservation.startsAt).toLocaleString('en-IN', { timeZone: reservation.cafe.timezone })} · Party of {reservation.partySize}</p><p className="mt-1 text-[10px] font-bold uppercase text-coral">{reservation.status.replaceAll('_', ' ')}</p></div>
                {reservation.status === 'confirmed' && <button className="min-h-9 border border-ink/20 px-3 text-xs font-bold hover:border-coral hover:text-coral disabled:opacity-60" disabled={saving} onClick={() => void cancelBooking(reservation.id)} type="button">Cancel</button>}
              </div>
            ))}</div> : <p className="py-5 text-sm text-muted">No reservations yet.</p>}
          </section>
        </div>
      )}
    </div>
  );
}

function AddressForm({ onSubmit, saving }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  return (
    <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
      <Field label="Recipient name" name="recipientName" required />
      <Field label="Phone" name="phone" required />
      <Field className="sm:col-span-2" label="Address line 1" name="line1" required />
      <Field className="sm:col-span-2" label="Address line 2" name="line2" />
      <Field label="City" name="city" required />
      <Field label="State" name="state" required />
      <Field label="PIN code" name="pincode" required />
      <button className="min-h-11 bg-ink px-4 text-sm font-bold text-white disabled:opacity-60" disabled={saving} type="submit">
        Save address
      </button>
    </form>
  );
}

function Field({ label, name, required, className = '' }: { label: string; name: string; required?: boolean; className?: string }) {
  return (
    <label className={`grid gap-1.5 text-xs font-semibold ${className}`}>
      {label}
      <input className="min-h-11 min-w-0 border border-ink/20 bg-white px-3 text-sm outline-none focus:border-leaf" name={name} required={required} />
    </label>
  );
}

function OrderSummary({
  order,
  attempt,
  saving,
  onStart,
  onResolve,
}: {
  order: CustomerOrder;
  attempt?: PaymentAttempt;
  saving: boolean;
  onStart: () => void;
  onResolve: (outcome: 'success' | 'failure') => void;
}) {
  return (
    <details className="group py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
        <span className="font-bold">Order {order.id.slice(0, 8).toUpperCase()}</span>
        <span className="text-xs uppercase text-muted">{order.status.replaceAll('_', ' ')}</span>
        <span className="font-bold">{money.format(order.totalPaise / 100)}</span>
      </summary>
      <div className="mt-3 grid gap-2 border-l-2 border-mint pl-3 text-xs text-muted">
        {order.items.map((item) => <p key={item.id}>{item.quantity} × {item.productName} · {item.variantName}</p>)}
        <p>{new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
        {order.status === 'pending_payment' && !attempt && (
          <button className="mt-2 min-h-10 w-fit bg-ink px-3 text-xs font-bold text-white disabled:opacity-60" disabled={saving} onClick={onStart} type="button">
            Start development payment test
          </button>
        )}
        {attempt?.developmentSimulationAvailable && (
          <div className="mt-2 grid gap-2 border border-sun bg-paper p-3 text-ink">
            <p className="font-bold uppercase">Development payment simulation only</p>
            <p>This does not charge money and is disabled in production.</p>
            <div className="flex flex-wrap gap-2">
              <button className="min-h-9 bg-leaf px-3 font-bold text-white disabled:opacity-60" disabled={saving} onClick={() => onResolve('success')} type="button">Simulate success</button>
              <button className="min-h-9 border border-coral px-3 font-bold text-coral disabled:opacity-60" disabled={saving} onClick={() => onResolve('failure')} type="button">Simulate failure</button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}