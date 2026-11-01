'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BellRing, ChefHat, Clock, HandCoins, MonitorPlay, RefreshCw, Store } from 'lucide-react';
import { errorMessage } from '@/lib/api';
import {
  CafeLocation,
  CafeTable,
  createAssistedOrder,
  getActiveCafeOrders,
  getAssignedCafes,
  getCafeMenu,
  getPendingCafeOrders,
  getStaffTables,
  getWaiterCalls,
  recordCashCollection,
  resolveWaiterCall,
  StaffOrder,
  updateCafeOrderStatus,
  WaiterCall,
} from '@/lib/cafe-api';
import { CatalogueProduct } from '@/lib/catalogue-api';
import { formatPaise, formatTime, minutesSince } from '@/lib/format';
import { StaffGate } from './staff-gate';
import { useToast } from './toast';
import { Alert, Badge, Button, Card, cx, EmptyState, QuantityStepper, SelectField, Skeleton, Tabs } from './ui';

const POLL_INTERVAL_MS = 10_000;
type Tab = 'queue' | 'calls' | 'payments' | 'new';
const NEXT_STATUS = { confirmed: 'preparing', preparing: 'ready', ready: 'delivered' } as const;
const NEXT_LABEL = { confirmed: 'Start preparing', preparing: 'Mark ready', ready: 'Mark served' } as const;

export function CafeStaffDashboard() {
  return (
    <StaffGate next="/cafe/staff" roles={['admin', 'cafe_manager', 'waiter']}>
      <Workspace />
    </StaffGate>
  );
}

function Workspace() {
  const [cafes, setCafes] = useState<CafeLocation[] | null>(null);
  const [cafeId, setCafeId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getAssignedCafes()
      .then((result) => {
        setCafes(result);
        setCafeId((current) => current || result[0]?.id || '');
      })
      .catch((requestError: unknown) => setError(errorMessage(requestError, 'Your cafés could not be loaded.')));
  }, []);

  if (error) return <div className="mx-auto max-w-7xl px-4 py-10"><Alert tone="danger">{error}</Alert></div>;
  if (!cafes) return <div className="mx-auto max-w-7xl px-4 py-10"><Skeleton className="h-96 rounded-3xl" /></div>;
  if (!cafes.length) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <EmptyState icon={<Store size={22} aria-hidden="true" />} title="No café assigned">
          Ask an administrator to assign you to a café.
        </EmptyState>
      </div>
    );
  }

  return <CafeOperations cafeId={cafeId} cafes={cafes} key={cafeId} onCafeChange={setCafeId} />;
}

function CafeOperations({
  cafes,
  cafeId,
  onCafeChange,
}: {
  cafes: CafeLocation[];
  cafeId: string;
  onCafeChange: (id: string) => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('queue');
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [menu, setMenu] = useState<CatalogueProduct[]>([]);
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [pending, setPending] = useState<StaffOrder[]>([]);
  const [active, setActive] = useState<StaffOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [nextCalls, nextPending, nextActive] = await Promise.all([
        getWaiterCalls(cafeId),
        getPendingCafeOrders(cafeId),
        getActiveCafeOrders(cafeId),
      ]);
      setCalls(nextCalls);
      setPending(nextPending);
      setActive(nextActive);
      setLastUpdated(new Date());
      setError('');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Live updates paused — retrying.'));
    } finally {
      setRefreshing(false);
    }
  }, [cafeId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getStaffTables(cafeId), getCafeMenu(cafeId), refresh()])
      .then(([nextTables, nextMenu]) => {
        if (cancelled) return;
        setTables(nextTables);
        setMenu(nextMenu);
      })
      .catch((requestError: unknown) => !cancelled && setError(errorMessage(requestError)))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [cafeId, refresh]);

  // Poll while the tab is visible; refresh immediately when staff come back to it.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
      setTick((value) => value + 1);
    }, POLL_INTERVAL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  async function run(id: string, action: () => Promise<unknown>, success: string): Promise<void> {
    setBusyId(id);
    try {
      await action();
      toast.show(success);
      await refresh();
    } catch (requestError) {
      toast.show(errorMessage(requestError), 'danger');
    } finally {
      setBusyId('');
    }
  }

  const cafe = cafes.find((candidate) => candidate.id === cafeId);
  const cashDue = pending.filter((order) => order.fulfillmentType === 'assisted_dine_in').length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sun-ink">Staff workspace</p>
          <h1 className="mt-1 font-display text-4xl">{cafe?.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cafes.length > 1 && (
            <select
              aria-label="Café"
              className="min-h-11 rounded-full border border-line bg-white px-4 text-sm font-semibold"
              onChange={(event) => onCafeChange(event.target.value)}
              value={cafeId}
            >
              {cafes.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                  {option.city ? ` · ${option.city}` : ''}
                </option>
              ))}
            </select>
          )}
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold hover:border-ink"
            href={`/cafe/display/${cafeId}`}
            target="_blank"
          >
            <MonitorPlay size={16} aria-hidden="true" /> TV display <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Workspace sections"
          onChange={setTab}
          tabs={[
            { value: 'queue', label: 'Kitchen queue', count: active.length },
            { value: 'calls', label: 'Staff calls', count: calls.length },
            { value: 'payments', label: 'Payments', count: pending.length },
            { value: 'new', label: 'New order' },
          ]}
          value={tab}
        />
        <button
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink"
          onClick={() => void refresh()}
          type="button"
        >
          <RefreshCw className={cx(refreshing && 'animate-spin')} size={14} aria-hidden="true" />
          {lastUpdated ? `Updated ${formatTime(lastUpdated.toISOString())}` : 'Refresh'}
        </button>
      </div>

      {calls.length > 0 && tab !== 'calls' && (
        <button
          className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-sun px-4 py-3 text-left text-sm font-semibold"
          onClick={() => setTab('calls')}
          type="button"
        >
          <BellRing className="animate-pulse" size={18} aria-hidden="true" />
          {calls.length === 1 ? `Table ${calls[0].table?.tableNumber ?? '?'} is asking for staff` : `${calls.length} tables are asking for staff`}
          <span className="ml-auto underline">View</span>
        </button>
      )}
      {cashDue > 0 && tab !== 'payments' && (
        <p className="mt-3 text-sm text-muted">
          <HandCoins className="mr-1 inline" size={15} aria-hidden="true" />
          {cashDue} assisted {cashDue === 1 ? 'order needs' : 'orders need'} cash collected.
        </p>
      )}
      {error && <Alert className="mt-5" tone="warning">{error}</Alert>}

      <div className="mt-6">
        {!loaded ? (
          <Skeleton className="h-80 rounded-3xl" />
        ) : tab === 'queue' ? (
          <KitchenQueue busyId={busyId} orders={active} onAdvance={(order) => {
            const status = order.status as keyof typeof NEXT_STATUS;
            const next = NEXT_STATUS[status];
            if (next) void run(order.id, () => updateCafeOrderStatus(order.id, next), `Order ${order.orderNumber} updated`);
          }} />
        ) : tab === 'calls' ? (
          calls.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {calls.map((call) => {
                const waited = minutesSince(call.createdAt);
                return (
                  <Card className={cx('flex items-center gap-4 p-5', waited >= 5 && 'border-danger/40')} key={call.id}>
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sun">
                      <BellRing size={20} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold">Table {call.table?.tableNumber ?? '?'}</p>
                      <p className={cx('text-sm', waited >= 5 ? 'font-semibold text-danger' : 'text-muted')}>
                        {waited < 1 ? 'Just now' : `Waiting ${waited} min`}
                      </p>
                    </div>
                    <Button
                      loading={busyId === call.id}
                      onClick={() => void run(call.id, () => resolveWaiterCall(call.id), `Table ${call.table?.tableNumber ?? ''} helped`)}
                      variant="dark"
                    >
                      Done
                    </Button>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={<BellRing size={22} aria-hidden="true" />} title="All quiet">
              Calls from table tablets appear here automatically.
            </EmptyState>
          )
        ) : tab === 'payments' ? (
          pending.length ? (
            <div className="grid gap-3">
              {pending.map((order) => (
                <Card className="flex flex-wrap items-center gap-4 p-5" key={order.id}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      Order {order.orderNumber} · Table {order.cafeTable?.tableNumber ?? '—'}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {order.items.map((item) => `${item.quantity} × ${item.productName}`).join(', ')}
                    </p>
                  </div>
                  <span className="font-bold tabular-nums">{formatPaise(order.totalPaise)}</span>
                  {order.fulfillmentType === 'assisted_dine_in' ? (
                    <Button
                      loading={busyId === order.id}
                      onClick={() => {
                        if (window.confirm(`Confirm you collected ${formatPaise(order.totalPaise)} in cash for order ${order.orderNumber}?`)) {
                          void run(order.id, () => recordCashCollection(order.id), `Cash recorded for order ${order.orderNumber}`);
                        }
                      }}
                    >
                      <HandCoins size={16} aria-hidden="true" /> Cash collected
                    </Button>
                  ) : (
                    <Badge tone="soft">Guest paying at table</Badge>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState icon={<HandCoins size={22} aria-hidden="true" />} title="Nothing awaiting payment" />
          )
        ) : (
          <AssistedOrderForm
            cafeId={cafeId}
            menu={menu}
            onCreated={async (orderNumber) => {
              toast.show(`Order ${orderNumber} created — collect cash, then confirm it under Payments`);
              await refresh();
              setTab('payments');
            }}
            tables={tables}
          />
        )}
      </div>
    </div>
  );
}

function KitchenQueue({
  orders,
  busyId,
  onAdvance,
}: {
  orders: StaffOrder[];
  busyId: string;
  onAdvance: (order: StaffOrder) => void;
}) {
  const columns = useMemo(
    () => [
      { status: 'confirmed', title: 'New' },
      { status: 'preparing', title: 'Preparing' },
      { status: 'ready', title: 'Ready to serve' },
    ] as const,
    [],
  );

  if (!orders.length) {
    return (
      <EmptyState icon={<ChefHat size={22} aria-hidden="true" />} title="No orders in the queue">
        Paid orders show up here as soon as they are confirmed.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {columns.map((column) => {
        const items = orders.filter((order) => order.status === column.status);
        return (
          <section aria-label={column.title} className="rounded-3xl bg-cloud p-3" key={column.status}>
            <div className="flex items-center justify-between px-2 py-2">
              <h2 className="font-semibold">{column.title}</h2>
              <Badge tone={column.status === 'ready' ? 'dark' : column.status === 'preparing' ? 'sun' : 'neutral'}>{items.length}</Badge>
            </div>
            <div className="grid gap-3">
              {items.map((order) => {
                const age = minutesSince(order.createdAt);
                return (
                  <Card className="p-4" key={order.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-3xl leading-none">#{order.orderNumber}</p>
                        <p className="mt-1 text-sm text-muted">Table {order.cafeTable?.tableNumber ?? '—'}</p>
                      </div>
                      <span className={cx('inline-flex items-center gap-1 text-xs font-semibold', age >= 15 ? 'text-danger' : 'text-muted')}>
                        <Clock size={13} aria-hidden="true" /> {age}m
                      </span>
                    </div>
                    <ul className="mt-3 grid gap-1 border-t border-line pt-3 text-sm">
                      {order.items.map((item) => (
                        <li className="flex justify-between gap-2" key={item.id}>
                          <span>
                            {item.productName} <span className="text-muted">· {item.variantName}</span>
                          </span>
                          <strong className="tabular-nums">×{item.quantity}</strong>
                        </li>
                      ))}
                    </ul>
                    <Button
                      block
                      className="mt-4"
                      loading={busyId === order.id}
                      onClick={() => onAdvance(order)}
                      variant={column.status === 'ready' ? 'dark' : 'primary'}
                    >
                      {NEXT_LABEL[column.status]}
                    </Button>
                  </Card>
                );
              })}
              {!items.length && <p className="px-2 pb-3 text-sm text-muted">Nothing here.</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AssistedOrderForm({
  cafeId,
  tables,
  menu,
  onCreated,
}: {
  cafeId: string;
  tables: CafeTable[];
  menu: CatalogueProduct[];
  onCreated: (orderNumber: number) => Promise<void>;
}) {
  const toast = useToast();
  const [tableId, setTableId] = useState(tables[0]?.id ?? '');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const lines = menu.flatMap((product) =>
    product.variants.filter((variant) => variant.available).map((variant) => ({ product, variant })),
  );
  const chosen = lines.filter((line) => (quantities[line.variant.id] ?? 0) > 0);
  const total = chosen.reduce((sum, line) => sum + line.variant.pricePaise * quantities[line.variant.id], 0);

  async function submit(): Promise<void> {
    setSaving(true);
    try {
      const result = await createAssistedOrder(
        cafeId,
        tableId,
        chosen.map((line) => ({ variantId: line.variant.id, quantity: quantities[line.variant.id] })),
        crypto.randomUUID(),
      );
      setQuantities({});
      await onCreated(result.orderNumber);
    } catch (requestError) {
      toast.show(errorMessage(requestError, 'The order could not be created.'), 'danger');
    } finally {
      setSaving(false);
    }
  }

  if (!tables.length || !lines.length) {
    return (
      <EmptyState icon={<Store size={22} aria-hidden="true" />} title={!tables.length ? 'No tables set up' : 'Nothing on the menu'}>
        {!tables.length ? 'An administrator needs to add tables to this café.' : 'Make items available for this café in Admin → Café menu.'}
      </EmptyState>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
      <Card className="divide-y divide-line">
        {lines.map(({ product, variant }) => (
          <div className="flex items-center justify-between gap-4 p-4" key={variant.id}>
            <div className="min-w-0">
              <p className="font-semibold">{product.name}</p>
              <p className="text-sm text-muted">
                {variant.name} · {formatPaise(variant.pricePaise)}
              </p>
            </div>
            <QuantityStepper
              label={`${product.name} ${variant.name}`}
              onChange={(next) => setQuantities((current) => ({ ...current, [variant.id]: next }))}
              size="sm"
              value={quantities[variant.id] ?? 0}
            />
          </div>
        ))}
      </Card>
      <Card className="p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-semibold">Order for a table</h2>
        <SelectField className="mt-4" label="Table" onChange={(event) => setTableId(event.target.value)} value={tableId}>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              Table {table.tableNumber} · {table.capacity} seats
            </option>
          ))}
        </SelectField>
        <ul className="mt-5 grid gap-1 text-sm">
          {chosen.map((line) => (
            <li className="flex justify-between" key={line.variant.id}>
              <span>
                {quantities[line.variant.id]} × {line.product.name}
              </span>
              <span className="tabular-nums">{formatPaise(line.variant.pricePaise * quantities[line.variant.id])}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-line pt-4 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatPaise(total)}</span>
        </div>
        <Button block className="mt-5" disabled={!chosen.length || !tableId} loading={saving} onClick={() => void submit()} size="lg">
          Create order
        </Button>
        <p className="mt-3 text-xs text-muted">The order is confirmed once you record the cash payment.</p>
      </Card>
    </div>
  );
}
