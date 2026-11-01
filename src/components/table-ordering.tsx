'use client';

import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, CheckCircle2, Coffee, KeyRound, ShoppingBag, X } from 'lucide-react';
import { ApiError, errorMessage } from '@/lib/api';
import {
  callWaiter,
  createTableOrder,
  getCafeMenu,
  getTableContext,
  resolveTablePayment,
  startTablePayment,
  TableContext,
  TableOrderResult,
} from '@/lib/cafe-api';
import { CatalogueProduct, CatalogueVariant } from '@/lib/catalogue-api';
import { formatPaise } from '@/lib/format';
import { PaymentAttempt } from '@/lib/order-api';
import { Logo } from './site-header';
import { useToast } from './toast';
import { Alert, Badge, Button, Card, cx, EmptyState, QuantityStepper, Skeleton, StatusBadge, TextField } from './ui';

const WAITER_COOLDOWN_MS = 60_000;
const storageKey = (tableCode: string) => `coffee-t-table:${tableCode}`;

function readStored(tableCode: string): string {
  try {
    return window.localStorage.getItem(storageKey(tableCode)) ?? '';
  } catch {
    return '';
  }
}

function writeStored(tableCode: string, token: string | null): void {
  try {
    if (token) window.localStorage.setItem(storageKey(tableCode), token);
    else window.localStorage.removeItem(storageKey(tableCode));
  } catch {
    // Storage can be unavailable (private mode); the token then lives for this page view only.
  }
}

interface MenuLine {
  product: CatalogueProduct;
  variant: CatalogueVariant;
}

export function TableOrdering({ tableCode }: { tableCode: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState('');
  const [context, setContext] = useState<TableContext | null>(null);
  const [menu, setMenu] = useState<CatalogueProduct[] | null>(null);
  const [loadError, setLoadError] = useState('');

  // Read the token once on mount: a QR link carries it in the URL fragment, which is never sent to a server.
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (fragment) {
      writeStored(tableCode, fragment);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setToken(fragment);
    } else {
      setToken(readStored(tableCode));
    }
  }, [tableCode]);

  const load = useCallback(async (value: string) => {
    setLoadError('');
    try {
      const table = await getTableContext(tableCode, value);
      setContext(table);
      setMenu(await getCafeMenu(table.cafe.id));
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
        writeStored(tableCode, null);
        setToken('');
        setContext(null);
        setTokenError('That table code was not recognised. Ask a member of staff for help.');
        return;
      }
      setLoadError(errorMessage(error, 'The menu could not be loaded.'));
    }
  }, [tableCode]);

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  if (token === null) return <FullScreenLoader />;

  if (!token) {
    return (
      <TokenEntry
        error={tokenError}
        onSubmit={(value) => {
          setTokenError('');
          writeStored(tableCode, value);
          setToken(value);
        }}
        tableCode={tableCode}
      />
    );
  }

  if (loadError) {
    return (
      <main className="grid min-h-dvh place-items-center bg-white px-4">
        <Alert
          className="max-w-md"
          tone="danger"
          title="Something went wrong"
          action={
            <Button size="sm" variant="secondary" onClick={() => void load(token)}>
              Retry
            </Button>
          }
        >
          {loadError}
        </Alert>
      </main>
    );
  }

  if (!context || !menu) return <FullScreenLoader />;
  return <TableMenu context={context} menu={menu} tableCode={tableCode} token={token} />;
}

function FullScreenLoader() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8" aria-busy="true">
      <Skeleton className="h-24 rounded-3xl" />
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton className="h-64 rounded-3xl" key={index} />
        ))}
      </div>
    </main>
  );
}

function TokenEntry({
  tableCode,
  error,
  onSubmit,
}: {
  tableCode: string;
  error: string;
  onSubmit: (token: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <main className="grid min-h-dvh place-items-center bg-white px-4">
      <Card className="w-full max-w-md overflow-hidden">
        <div className="bg-sun px-6 py-5">
          <Logo />
        </div>
        <form
          className="p-6"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (value.trim()) onSubmit(value.trim());
          }}
        >
          <span className="grid size-11 place-items-center rounded-xl bg-sun-soft text-sun-ink">
            <KeyRound size={20} aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-display text-3xl">Set up this table</h1>
          <p className="mt-1 text-sm text-muted">
            Table <span className="font-semibold text-ink">{tableCode}</span>. Enter the access code from the café admin.
          </p>
          <TextField
            autoComplete="off"
            className="mt-5"
            label="Table access code"
            maxLength={200}
            onChange={(event) => setValue(event.target.value)}
            required
            spellCheck={false}
            value={value}
          />
          {error && (
            <Alert className="mt-4" tone="danger">
              {error}
            </Alert>
          )}
          <Button block className="mt-5" size="lg" type="submit">
            Open menu
          </Button>
        </form>
      </Card>
    </main>
  );
}

interface PlacedOrder extends TableOrderResult {
  attempt: PaymentAttempt | null;
  lines: Array<{ name: string; quantity: number }>;
}

function TableMenu({
  tableCode,
  token,
  context,
  menu,
}: {
  tableCode: string;
  token: string;
  context: TableContext;
  menu: CatalogueProduct[];
}) {
  const toast = useToast();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [category, setCategory] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [waiterCooldownUntil, setWaiterCooldownUntil] = useState(0);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (waiterCooldownUntil <= now) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [waiterCooldownUntil, now]);

  const lines = useMemo<MenuLine[]>(
    () =>
      menu.flatMap((product) =>
        product.variants.filter((variant) => variant.available).map((variant) => ({ product, variant })),
      ),
    [menu],
  );
  const categories = useMemo(
    () => [...new Map(menu.map((product) => [product.category.slug, product.category.name])).entries()],
    [menu],
  );
  const selected = lines.filter((line) => (quantities[line.variant.id] ?? 0) > 0);
  const itemCount = selected.reduce((sum, line) => sum + quantities[line.variant.id], 0);
  const total = selected.reduce((sum, line) => sum + line.variant.pricePaise * quantities[line.variant.id], 0);
  const visible = menu.filter((product) => !category || product.category.slug === category);

  function setQuantity(variantId: string, quantity: number): void {
    setQuantities((current) => ({ ...current, [variantId]: Math.max(0, Math.min(20, quantity)) }));
  }

  async function requestWaiter(): Promise<void> {
    setCallingWaiter(true);
    try {
      await callWaiter(tableCode, token);
      toast.show('A member of staff is on the way');
      setWaiterCooldownUntil(Date.now() + WAITER_COOLDOWN_MS);
      setNow(Date.now());
    } catch (error) {
      toast.show(errorMessage(error, 'We could not reach the staff. Please wave us over.'), 'danger');
    } finally {
      setCallingWaiter(false);
    }
  }

  async function sendOrder(): Promise<void> {
    const items = selected.map((line) => ({ variantId: line.variant.id, quantity: quantities[line.variant.id] }));
    const summary = selected.map((line) => ({
      name: line.product.variants.length > 1 ? `${line.product.name} (${line.variant.name})` : line.product.name,
      quantity: quantities[line.variant.id],
    }));
    setSending(true);
    try {
      const result = await createTableOrder(tableCode, token, items, crypto.randomUUID());
      const attempt =
        result.status === 'pending_payment'
          ? await startTablePayment(tableCode, token, result.id, crypto.randomUUID())
          : null;
      setOrders((current) => [{ ...result, attempt, lines: summary }, ...current]);
      setQuantities({});
      setReviewOpen(false);
    } catch (error) {
      toast.show(errorMessage(error, 'The order could not be sent.'), 'danger');
    } finally {
      setSending(false);
    }
  }

  async function updatePayment(orderId: string, action: () => Promise<PaymentAttempt>, paid?: boolean): Promise<void> {
    try {
      const attempt = await action();
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId ? { ...order, attempt, status: paid && attempt.status === 'succeeded' ? 'confirmed' : order.status } : order,
        ),
      );
      if (attempt.status === 'succeeded') toast.show('Payment received — your order is with the kitchen');
      if (attempt.status === 'failed') toast.show('Payment failed. You can try again.', 'danger');
    } catch (error) {
      toast.show(errorMessage(error, 'Payment could not be completed.'), 'danger');
    }
  }

  const waiterCooling = waiterCooldownUntil > now;

  return (
    <div className="min-h-dvh bg-white pb-28">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="h-1.5 bg-sun" />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sun-ink">
              Table {context.table.number}
            </p>
            <h1 className="truncate font-display text-2xl sm:text-3xl">{context.cafe.name}</h1>
          </div>
          <Button
            disabled={waiterCooling}
            loading={callingWaiter}
            onClick={() => void requestWaiter()}
            size="lg"
            variant={waiterCooling ? 'secondary' : 'dark'}
          >
            <BellRing size={18} aria-hidden="true" />
            {waiterCooling ? `Staff notified · ${Math.ceil((waiterCooldownUntil - now) / 1000)}s` : 'Call staff'}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {orders.length > 0 && (
          <section className="mb-8 grid gap-3" aria-label="Your orders">
            {orders.map((order) => (
              <PlacedOrderCard
                key={order.id}
                onPay={() =>
                  updatePayment(order.id, () => startTablePayment(tableCode, token, order.id, crypto.randomUUID()))
                }
                onSimulate={async (outcome) => {
                  const attemptId = order.attempt?.id;
                  if (!attemptId) return;
                  await updatePayment(
                    order.id,
                    () => resolveTablePayment(tableCode, token, attemptId, outcome),
                    outcome === 'success',
                  );
                }}
                order={order}
              />
            ))}
          </section>
        )}

        {categories.length > 1 && (
          <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Menu sections">
            {[['', 'Everything'], ...categories].map(([slug, name]) => (
              <button
                aria-pressed={category === slug}
                className={cx(
                  'min-h-11 shrink-0 rounded-full border px-5 text-sm font-semibold transition-colors',
                  category === slug ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink',
                )}
                key={slug || 'all'}
                onClick={() => setCategory(slug)}
                type="button"
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {lines.length === 0 ? (
          <EmptyState icon={<Coffee size={22} aria-hidden="true" />} title="The menu is being prepared">
            Nothing is available to order right now. Please ask a member of staff.
          </EmptyState>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((product) => {
              const available = product.variants.filter((variant) => variant.available);
              if (!available.length) return null;
              return (
                <Card className="flex flex-col overflow-hidden" key={product.id}>
                  <div className="relative aspect-[16/10] bg-cloud">
                    {product.imageUrl ? (
                      <Image alt={product.name} className="object-cover" fill sizes="(max-width: 640px) 100vw, 33vw" src={product.imageUrl} unoptimized />
                    ) : (
                      <div className="grid h-full place-items-center bg-sun-soft">
                        <Coffee className="text-sun-ink/50" size={40} aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h2 className="text-lg font-semibold">{product.name}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{product.description}</p>
                    <div className="mt-auto grid gap-3 pt-4">
                      {available.map((variant) => (
                        <div className="flex items-center justify-between gap-3" key={variant.id}>
                          <div>
                            <p className="text-sm font-semibold">{formatPaise(variant.pricePaise)}</p>
                            {available.length > 1 && <p className="text-xs text-muted">{variant.name}</p>}
                          </div>
                          <QuantityStepper
                            label={`${product.name} ${variant.name}`}
                            onChange={(next) => setQuantity(variant.id, next)}
                            value={quantities[variant.id] ?? 0}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <p className="text-sm">
              <span className="font-semibold">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
              <span className="text-muted"> · {formatPaise(total)}</span>
            </p>
            <Button onClick={() => setReviewOpen(true)} size="lg">
              <ShoppingBag size={18} aria-hidden="true" /> Review order
            </Button>
          </div>
        </div>
      )}

      {reviewOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="review-title">
          <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-pop sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-3xl" id="review-title">Your order</h2>
              <button aria-label="Close" className="grid size-10 place-items-center rounded-full hover:bg-cloud" onClick={() => setReviewOpen(false)} type="button">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <ul className="mt-5 divide-y divide-line">
              {selected.map((line) => (
                <li className="flex items-center justify-between gap-3 py-3" key={line.variant.id}>
                  <div className="min-w-0">
                    <p className="font-semibold">{line.product.name}</p>
                    <p className="text-xs text-muted">
                      {line.variant.name} · {formatPaise(line.variant.pricePaise)}
                    </p>
                  </div>
                  <QuantityStepper
                    label={`${line.product.name} quantity`}
                    onChange={(next) => setQuantity(line.variant.id, next)}
                    size="sm"
                    value={quantities[line.variant.id]}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-between border-t border-line pt-4 text-lg">
              <span className="font-semibold">Total</span>
              <span className="font-bold tabular-nums">{formatPaise(total)}</span>
            </div>
            <Button block className="mt-6" disabled={!itemCount} loading={sending} onClick={() => void sendOrder()} size="lg">
              Send to kitchen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlacedOrderCard({
  order,
  onPay,
  onSimulate,
}: {
  order: PlacedOrder;
  onPay: () => Promise<void>;
  onSimulate: (outcome: 'success' | 'failure') => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const wrap = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const paid = order.status !== 'pending_payment';

  return (
    <Card className={cx('p-5', paid ? 'border-success/30' : 'border-sun')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {paid && <CheckCircle2 className="text-success" size={22} aria-hidden="true" />}
          <div>
            <p className="font-semibold">Order {order.orderNumber}</p>
            <p className="text-sm text-muted">
              {order.lines.map((line) => `${line.quantity} × ${line.name}`).join(', ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          <span className="font-bold tabular-nums">{formatPaise(order.totalPaise)}</span>
        </div>
      </div>
      {!paid && (
        <div className="mt-4 rounded-2xl bg-cloud p-4">
          {order.attempt?.status === 'pending' && order.attempt.developmentSimulationAvailable ? (
            <>
              <Badge tone="soft">Test mode</Badge>
              <p className="mt-2 text-sm text-ink-soft">No payment provider is connected. Simulate the result — nothing is charged.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button disabled={busy} onClick={wrap(() => onSimulate('success'))}>
                  Simulate payment
                </Button>
                <Button disabled={busy} onClick={wrap(() => onSimulate('failure'))} variant="danger">
                  Simulate failure
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">{order.attempt?.status === 'failed' ? 'Payment failed.' : 'Awaiting payment.'}</p>
              <Button disabled={busy} onClick={wrap(onPay)}>
                {order.attempt?.status === 'failed' ? 'Try again' : 'Pay now'}
              </Button>
            </div>
          )}
        </div>
      )}
      {paid && <p className="mt-3 text-sm text-success">Confirmed — the kitchen has your order.</p>}
    </Card>
  );
}
