'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, LogOut, MapPin, Package, ShoppingBag, Trash2 } from 'lucide-react';
import { apiRequest, errorMessage } from '@/lib/api';
import { cancelReservation, getMyReservations, Reservation } from '@/lib/cafe-api';
import { formatDate, formatDateTime, formatPaise } from '@/lib/format';
import {
  AddressInput,
  Cart,
  checkout,
  createAddress,
  CustomerOrder,
  DeliveryAddress,
  getAddresses,
  getCart,
  getOrders,
  PaymentAttempt,
  removeCartItem,
  resolveDevelopmentPayment,
  setCartItem,
  startPayment,
} from '@/lib/order-api';
import { useSession } from './session-provider';
import { useToast } from './toast';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  cx,
  EmptyState,
  QuantityStepper,
  Skeleton,
  StatusBadge,
  Tabs,
  TextField,
} from './ui';

type Tab = 'basket' | 'orders' | 'reservations' | 'addresses';
const TABS: Tab[] = ['basket', 'orders', 'reservations', 'addresses'];

export function AccountDashboard() {
  const { user, signOut, syncCart } = useSession();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get('tab') as Tab | null;
  const tab: Tab = requested && TABS.includes(requested) ? requested : 'basket';

  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [highlightOrderId, setHighlightOrderId] = useState('');

  const setTab = useCallback(
    (next: Tab) => router.replace(`${pathname}?tab=${next}`, { scroll: false }),
    [router, pathname],
  );

  const load = useCallback(async () => {
    setLoadError('');
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
      void syncCart(nextCart);
    } catch (requestError) {
      setLoadError(errorMessage(requestError, 'Your account could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [syncCart]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSignOut(): Promise<void> {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/account');
    } catch (requestError) {
      toast.show(errorMessage(requestError), 'danger');
    } finally {
      setSigningOut(false);
    }
  }

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const pendingOrders = orders.filter((order) => order.status === 'pending_payment').length;
  const upcomingReservations = reservations.filter(
    (reservation) => reservation.status === 'confirmed' && new Date(reservation.startsAt).getTime() > Date.now(),
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sun-ink">Your account</p>
          <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">Hello there.</h1>
          <p className="mt-1 truncate text-sm text-muted">{user?.email}</p>
        </div>
        <Button loading={signingOut} onClick={() => void handleSignOut()} variant="secondary">
          <LogOut size={16} aria-hidden="true" /> Sign out
        </Button>
      </div>

      <Tabs
        className="mt-8 w-fit"
        label="Account sections"
        onChange={setTab}
        tabs={[
          { value: 'basket', label: 'Basket', count: itemCount },
          { value: 'orders', label: 'Orders', count: pendingOrders },
          { value: 'reservations', label: 'Reservations', count: upcomingReservations },
          { value: 'addresses', label: 'Addresses' },
        ]}
        value={tab}
      />

      <div className="mt-8">
        {loadError ? (
          <Alert
            tone="danger"
            title="We couldn't load your account"
            action={
              <Button size="sm" variant="secondary" onClick={() => void load()}>
                Retry
              </Button>
            }
          >
            {loadError}
          </Alert>
        ) : loading ? (
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Skeleton className="h-72 rounded-3xl" />
            <Skeleton className="h-72 rounded-3xl" />
          </div>
        ) : tab === 'basket' ? (
          <BasketTab
            addresses={addresses}
            cart={cart}
            onAddressCreated={(address) => setAddresses((current) => [address, ...current])}
            onCartChange={(next) => {
              setCart(next);
              void syncCart(next);
            }}
            onOrderPlaced={async (order) => {
              setHighlightOrderId(order.id);
              await load();
              setTab('orders');
            }}
          />
        ) : tab === 'orders' ? (
          <OrdersTab highlightOrderId={highlightOrderId} onChanged={load} orders={orders} />
        ) : tab === 'reservations' ? (
          <ReservationsTab
            onChange={(updated) =>
              setReservations((current) => current.map((item) => (item.id === updated.id ? updated : item)))
            }
            reservations={reservations}
          />
        ) : (
          <AddressesTab
            addresses={addresses}
            onCreated={(address) => setAddresses((current) => [address, ...current])}
          />
        )}
      </div>
    </div>
  );
}

function BasketTab({
  cart,
  addresses,
  onCartChange,
  onAddressCreated,
  onOrderPlaced,
}: {
  cart: Cart | null;
  addresses: DeliveryAddress[];
  onCartChange: (cart: Cart) => void;
  onAddressCreated: (address: DeliveryAddress) => void;
  onOrderPlaced: (order: CustomerOrder) => Promise<void>;
}) {
  const toast = useToast();
  const [pendingVariant, setPendingVariant] = useState('');
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? '');
  const [addingAddress, setAddingAddress] = useState(addresses.length === 0);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!addressId && addresses[0]) setAddressId(addresses[0].id);
  }, [addresses, addressId]);

  async function changeQuantity(variantId: string, quantity: number): Promise<void> {
    setPendingVariant(variantId);
    setError('');
    try {
      if (quantity <= 0) {
        await removeCartItem(variantId);
        onCartChange(await getCart());
      } else {
        onCartChange(await setCartItem(variantId, quantity));
      }
    } catch (requestError) {
      setError(errorMessage(requestError, 'Your basket could not be updated.'));
    } finally {
      setPendingVariant('');
    }
  }

  async function placeOrder(): Promise<void> {
    setPlacing(true);
    setError('');
    try {
      const order = await checkout(addressId);
      onCartChange({ id: cart?.id ?? '', items: [], totalPaise: 0 });
      toast.show('Order placed. Complete payment to confirm it.');
      await onOrderPlaced(order);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Checkout could not be completed.'));
    } finally {
      setPlacing(false);
    }
  }

  if (!cart?.items.length) {
    return (
      <EmptyState
        icon={<ShoppingBag size={22} aria-hidden="true" />}
        title="Your basket is empty"
        action={<ButtonLink href="/#shop">Browse coffee &amp; tea</ButtonLink>}
      >
        Pick something you love and it will wait for you here.
      </EmptyState>
    );
  }

  const unavailable = cart.items.some((item) => !item.available);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
      <Card className="divide-y divide-line">
        {cart.items.map((item) => (
          <div className="flex flex-wrap items-center gap-4 p-5" key={item.variantId}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{item.productName}</p>
              <p className="mt-0.5 text-sm text-muted">
                {item.variantName} · {formatPaise(item.unitPricePaise)}
              </p>
              {!item.available && (
                <Badge className="mt-2" tone="danger">
                  Not available in this quantity
                </Badge>
              )}
            </div>
            <QuantityStepper
              disabled={pendingVariant === item.variantId}
              label={`${item.productName} quantity`}
              max={item.available ? 100 : item.quantity}
              min={1}
              onChange={(next) => void changeQuantity(item.variantId, next)}
              size="sm"
              value={item.quantity}
            />
            <p className="w-20 text-right font-semibold tabular-nums">{formatPaise(item.lineTotalPaise)}</p>
            <button
              aria-label={`Remove ${item.productName}`}
              className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-40"
              disabled={pendingVariant === item.variantId}
              onClick={() => void changeQuantity(item.variantId, 0)}
              type="button"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </Card>

      <Card className="p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-semibold">Checkout</h2>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Deliver to</p>
            {addresses.length > 0 && (
              <button className="text-xs font-semibold underline decoration-sun decoration-2 underline-offset-4" onClick={() => setAddingAddress((value) => !value)} type="button">
                {addingAddress ? 'Cancel' : 'Add new'}
              </button>
            )}
          </div>
          {addingAddress ? (
            <div className="mt-3">
              <AddressForm
                compact
                onSaved={(address) => {
                  onAddressCreated(address);
                  setAddressId(address.id);
                  setAddingAddress(false);
                }}
              />
            </div>
          ) : (
            <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Delivery address">
              {addresses.map((address) => (
                <label
                  className={cx(
                    'flex cursor-pointer gap-3 rounded-2xl border p-3 text-sm transition-colors',
                    addressId === address.id ? 'border-ink bg-sun-soft' : 'border-line hover:border-ink/40',
                  )}
                  key={address.id}
                >
                  <input
                    checked={addressId === address.id}
                    className="mt-1 accent-ink"
                    name="delivery-address"
                    onChange={() => setAddressId(address.id)}
                    type="radio"
                  />
                  <AddressText address={address} />
                </label>
              ))}
            </div>
          )}
        </div>

        <dl className="mt-6 grid gap-2 border-t border-line pt-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="font-semibold tabular-nums">{formatPaise(cart.totalPaise)}</dd>
          </div>
          <div className="flex justify-between text-base">
            <dt className="font-semibold">Total</dt>
            <dd className="font-bold tabular-nums">{formatPaise(cart.totalPaise)}</dd>
          </div>
        </dl>

        {error && (
          <Alert className="mt-4" tone="danger">
            {error}
          </Alert>
        )}
        {unavailable && (
          <Alert className="mt-4" tone="warning">
            Remove or reduce unavailable items to continue.
          </Alert>
        )}

        <Button
          block
          className="mt-5"
          disabled={!addressId || addingAddress || unavailable}
          loading={placing}
          onClick={() => void placeOrder()}
          size="lg"
        >
          Place order
        </Button>
        <p className="mt-3 text-center text-xs text-muted">You will be asked to pay on the next step.</p>
      </Card>
    </div>
  );
}

function OrdersTab({
  orders,
  highlightOrderId,
  onChanged,
}: {
  orders: CustomerOrder[];
  highlightOrderId: string;
  onChanged: () => Promise<void>;
}) {
  if (!orders.length) {
    return (
      <EmptyState
        icon={<Package size={22} aria-hidden="true" />}
        title="No orders yet"
        action={<ButtonLink href="/#shop">Start shopping</ButtonLink>}
      >
        Orders you place will appear here with their status.
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-4">
      {orders.map((order) => (
        <OrderCard key={order.id} onChanged={onChanged} order={order} startOpen={order.id === highlightOrderId} />
      ))}
    </div>
  );
}

function OrderCard({
  order,
  startOpen,
  onChanged,
}: {
  order: CustomerOrder;
  startOpen: boolean;
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const awaitingPayment = order.status === 'pending_payment';
  const reference = order.id.slice(0, 8).toUpperCase();

  async function beginPayment(): Promise<void> {
    setBusy(true);
    setError('');
    try {
      // Resume an attempt that is still open (e.g. after a page reload) instead of colliding with it.
      const attempts = await apiRequest<PaymentAttempt[]>(`/orders/${order.id}/payments`);
      const open = attempts.find((candidate) => candidate.status === 'pending');
      setAttempt(open ?? (await startPayment(order.id, crypto.randomUUID())));
    } catch (requestError) {
      setError(errorMessage(requestError, 'Payment could not be started.'));
    } finally {
      setBusy(false);
    }
  }

  async function resolve(outcome: 'success' | 'failure'): Promise<void> {
    if (!attempt) return;
    setBusy(true);
    setError('');
    try {
      const result = await resolveDevelopmentPayment(order.id, attempt.id, outcome);
      setAttempt(result);
      toast.show(outcome === 'success' ? 'Payment received — your order is confirmed.' : 'Payment failed. You can try again.', outcome === 'success' ? 'success' : 'danger');
      await onChanged();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Payment could not be completed.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={cx('overflow-hidden', startOpen && 'ring-2 ring-sun')}>
      <details className="group" open={startOpen || awaitingPayment}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-2 p-5">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Order #{reference}</p>
            <p className="mt-0.5 text-sm text-muted">
              {formatDate(order.createdAt)} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
            </p>
          </div>
          <StatusBadge status={order.status} />
          <p className="w-24 text-right font-bold tabular-nums">{formatPaise(order.totalPaise)}</p>
        </summary>
        <div className="border-t border-line bg-cloud/60 p-5">
          <ul className="grid gap-2 text-sm">
            {order.items.map((item) => (
              <li className="flex justify-between gap-4" key={item.id}>
                <span>
                  {item.quantity} × {item.productName} <span className="text-muted">· {item.variantName}</span>
                </span>
                <span className="tabular-nums">{formatPaise(item.lineTotalPaise)}</span>
              </li>
            ))}
          </ul>

          {awaitingPayment && (
            <div className="mt-5 rounded-2xl border border-sun bg-white p-4">
              {!attempt || attempt.status !== 'pending' ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    {attempt?.status === 'failed' ? 'The last payment failed.' : 'This order is waiting for payment.'}
                  </p>
                  <Button loading={busy} onClick={() => void beginPayment()}>
                    {attempt?.status === 'failed' ? 'Try again' : 'Pay now'} · {formatPaise(order.totalPaise)}
                  </Button>
                </div>
              ) : attempt.developmentSimulationAvailable ? (
                <div>
                  <Badge tone="soft">Test mode</Badge>
                  <p className="mt-2 text-sm text-ink-soft">
                    No real payment provider is connected. Simulate the outcome — no money is charged.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button loading={busy} onClick={() => void resolve('success')}>
                      Simulate successful payment
                    </Button>
                    <Button disabled={busy} onClick={() => void resolve('failure')} variant="danger">
                      Simulate failure
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">Payment is in progress. Refresh in a moment to see the result.</p>
              )}
              {error && (
                <Alert className="mt-3" tone="danger">
                  {error}
                </Alert>
              )}
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}

function ReservationsTab({
  reservations,
  onChange,
}: {
  reservations: Reservation[];
  onChange: (reservation: Reservation) => void;
}) {
  const toast = useToast();
  const [cancelling, setCancelling] = useState('');

  async function cancel(reservation: Reservation): Promise<void> {
    if (!window.confirm(`Cancel your table at ${reservation.cafe.name}?`)) return;
    setCancelling(reservation.id);
    try {
      onChange(await cancelReservation(reservation.id));
      toast.show('Reservation cancelled');
    } catch (requestError) {
      toast.show(errorMessage(requestError, 'The reservation could not be cancelled.'), 'danger');
    } finally {
      setCancelling('');
    }
  }

  if (!reservations.length) {
    return (
      <EmptyState
        icon={<CalendarDays size={22} aria-hidden="true" />}
        title="No reservations yet"
        action={<ButtonLink href="/cafe">Reserve a table</ButtonLink>}
      >
        Book a table at a Coffee-T café and it will show up here.
      </EmptyState>
    );
  }

  const now = Date.now();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {reservations.map((reservation) => {
        const upcoming = reservation.status === 'confirmed' && new Date(reservation.startsAt).getTime() > now;
        return (
          <Card className={cx('p-5', !upcoming && 'opacity-70')} key={reservation.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{reservation.cafe.name}</p>
                <p className="mt-0.5 text-sm text-muted">{reservation.cafe.city}</p>
              </div>
              <StatusBadge status={upcoming ? 'confirmed' : reservation.status === 'confirmed' ? 'completed' : reservation.status} />
            </div>
            <p className="mt-4 text-sm font-medium">{formatDateTime(reservation.startsAt, reservation.cafe.timezone)}</p>
            <p className="mt-0.5 text-sm text-muted">
              Table {reservation.table.tableNumber} · {reservation.partySize} {reservation.partySize === 1 ? 'guest' : 'guests'}
            </p>
            {upcoming && (
              <Button
                className="mt-4"
                loading={cancelling === reservation.id}
                onClick={() => void cancel(reservation)}
                size="sm"
                variant="danger"
              >
                Cancel reservation
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function AddressesTab({
  addresses,
  onCreated,
}: {
  addresses: DeliveryAddress[];
  onCreated: (address: DeliveryAddress) => void;
}) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="grid gap-3">
        {addresses.length ? (
          addresses.map((address) => (
            <Card className="flex gap-3 p-5 text-sm" key={address.id}>
              <MapPin className="mt-0.5 shrink-0 text-sun-ink" size={18} aria-hidden="true" />
              <AddressText address={address} />
            </Card>
          ))
        ) : (
          <EmptyState icon={<MapPin size={22} aria-hidden="true" />} title="No saved addresses">
            Add one and it will be ready at checkout.
          </EmptyState>
        )}
      </div>
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Add an address</h2>
        <div className="mt-4">
          <AddressForm onSaved={onCreated} />
        </div>
      </Card>
    </div>
  );
}

function AddressText({ address }: { address: DeliveryAddress }) {
  return (
    <span className="leading-6">
      <strong className="font-semibold">{address.recipientName}</strong>
      <br />
      {address.line1}
      {address.line2 ? `, ${address.line2}` : ''}
      <br />
      {address.city}, {address.state} {address.pincode}
      <br />
      <span className="text-muted">{address.phone}</span>
    </span>
  );
}

function AddressForm({ onSaved, compact = false }: { onSaved: (address: DeliveryAddress) => void; compact?: boolean }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (name: string) => String(data.get(name) ?? '').trim();
    const input: AddressInput = {
      recipientName: value('recipientName'),
      phone: value('phone'),
      line1: value('line1'),
      city: value('city'),
      state: value('state'),
      pincode: value('pincode'),
      ...(value('line2') ? { line2: value('line2') } : {}),
    };
    setSaving(true);
    setError('');
    try {
      const address = await createAddress(input);
      form.reset();
      onSaved(address);
      toast.show('Address saved');
    } catch (requestError) {
      setError(errorMessage(requestError, 'The address could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={cx('grid gap-3', !compact && 'sm:grid-cols-2')} onSubmit={submit}>
      <TextField autoComplete="name" label="Full name" maxLength={120} minLength={2} name="recipientName" required />
      <TextField
        autoComplete="tel"
        inputMode="tel"
        label="Phone"
        name="phone"
        pattern="\+?[0-9 \(\)\-]{8,20}"
        placeholder="+91 98765 43210"
        required
        title="8–20 digits; spaces, brackets and dashes are fine"
      />
      <TextField autoComplete="address-line1" className={cx(!compact && 'sm:col-span-2')} label="Address line 1" maxLength={160} minLength={3} name="line1" required />
      <TextField autoComplete="address-line2" className={cx(!compact && 'sm:col-span-2')} label="Address line 2" maxLength={160} name="line2" optional />
      <TextField autoComplete="address-level2" label="City" maxLength={100} minLength={2} name="city" required />
      <TextField autoComplete="address-level1" label="State" maxLength={100} minLength={2} name="state" required />
      <TextField
        autoComplete="postal-code"
        inputMode="numeric"
        label="PIN code"
        maxLength={6}
        name="pincode"
        pattern="[1-9][0-9]{5}"
        required
        title="A 6-digit Indian PIN code"
      />
      {error && (
        <Alert className={cx(!compact && 'sm:col-span-2')} tone="danger">
          {error}
        </Alert>
      )}
      <Button className={cx(!compact && 'sm:col-span-2')} loading={saving} type="submit" variant="dark">
        Save address
      </Button>
    </form>
  );
}
