'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Plus, Search, Store } from 'lucide-react';
import { errorMessage } from '@/lib/api';
import {
  AdminProduct,
  assignCafeStaff,
  CafeLocation,
  createCafe,
  createCafeTable,
  createCategory,
  createProduct,
  createProductVariant,
  findUserByEmail,
  getAdminProducts,
  getManagedCafeMenu,
  getManagedCafes,
  ManagedVariant,
  setManagedCafeVariant,
  updateCafe,
  updateVariant,
} from '@/lib/cafe-api';
import { getCategories, ProductCategory } from '@/lib/catalogue-api';
import { formatPaise, paiseToRupeesInput, rupeesToPaise } from '@/lib/format';
import { useSession } from './session-provider';
import { StaffGate } from './staff-gate';
import { useToast } from './toast';
import {
  Alert,
  Badge,
  Button,
  Card,
  cx,
  EmptyState,
  SelectField,
  Skeleton,
  Tabs,
  TextAreaField,
  TextField,
} from './ui';

type Tab = 'menu' | 'products' | 'cafes';

export function AdminDashboard() {
  return (
    <StaffGate next="/admin" roles={['admin', 'cafe_manager']}>
      <Console />
    </StaffGate>
  );
}

function Console() {
  const { user } = useSession();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<Tab>('menu');
  const [cafes, setCafes] = useState<CafeLocation[] | null>(null);
  const [cafeId, setCafeId] = useState('');
  const [error, setError] = useState('');

  const loadCafes = useCallback(async () => {
    try {
      const result = await getManagedCafes();
      setCafes(result);
      setCafeId((current) => (current && result.some((cafe) => cafe.id === current) ? current : result[0]?.id ?? ''));
    } catch (requestError) {
      setError(errorMessage(requestError, 'Cafés could not be loaded.'));
    }
  }, []);

  useEffect(() => {
    void loadCafes();
  }, [loadCafes]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sun-ink">{isAdmin ? 'Administration' : 'Café management'}</p>
      <h1 className="mt-1 font-display text-4xl">Catalogue &amp; cafés</h1>

      <Tabs
        className="mt-6 w-fit"
        label="Admin sections"
        onChange={setTab}
        tabs={[
          { value: 'menu', label: 'Café menu & stock' },
          ...(isAdmin
            ? [
                { value: 'products' as const, label: 'Products' },
                { value: 'cafes' as const, label: 'Cafés & staff' },
              ]
            : []),
        ]}
        value={tab}
      />

      <div className="mt-6">
        {error ? (
          <Alert tone="danger">{error}</Alert>
        ) : !cafes ? (
          <Skeleton className="h-96 rounded-3xl" />
        ) : tab === 'menu' ? (
          cafes.length ? (
            <CafeMenuPanel cafeId={cafeId} cafes={cafes} onCafeChange={setCafeId} />
          ) : (
            <EmptyState icon={<Store size={22} aria-hidden="true" />} title="No cafés yet">
              {isAdmin ? 'Create a café under “Cafés & staff” first.' : 'You are not assigned to a café.'}
            </EmptyState>
          )
        ) : tab === 'products' ? (
          <ProductsPanel />
        ) : (
          <CafesPanel cafes={cafes} onChanged={loadCafes} />
        )}
      </div>
    </div>
  );
}

// ---------- Café menu & stock ----------

interface Draft {
  isAvailable: boolean;
  quantity: string;
  priceOverride: string;
}

function draftFor(variant: ManagedVariant): Draft {
  return {
    isAvailable: variant.cafeAvailability?.isAvailable ?? false,
    quantity: String(variant.cafeInventory?.quantity ?? 0),
    priceOverride: paiseToRupeesInput(variant.cafeAvailability?.priceOverridePaise),
  };
}

function CafeMenuPanel({
  cafes,
  cafeId,
  onCafeChange,
}: {
  cafes: CafeLocation[];
  cafeId: string;
  onCafeChange: (id: string) => void;
}) {
  const toast = useToast();
  const [variants, setVariants] = useState<ManagedVariant[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [query, setQuery] = useState('');
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await getManagedCafeMenu(cafeId);
      setVariants(result);
      setDrafts(Object.fromEntries(result.map((variant) => [variant.id, draftFor(variant)])));
    } catch (requestError) {
      setError(errorMessage(requestError, 'The café menu could not be loaded.'));
    }
  }, [cafeId]);

  useEffect(() => {
    setVariants(null);
    if (cafeId) void load();
  }, [cafeId, load]);

  async function save(variant: ManagedVariant): Promise<void> {
    const draft = drafts[variant.id];
    const quantity = Number(draft.quantity);
    const reserved = variant.cafeInventory?.reservedQuantity ?? 0;
    if (!Number.isInteger(quantity) || quantity < reserved) {
      toast.show(`Stock must be a whole number of at least ${reserved} (reserved).`, 'danger');
      return;
    }
    const override = draft.priceOverride.trim() === '' ? undefined : rupeesToPaise(draft.priceOverride);
    if (override === null) {
      toast.show('Enter the café price in rupees, e.g. 180 or 180.50.', 'danger');
      return;
    }
    setSavingId(variant.id);
    try {
      await setManagedCafeVariant(cafeId, variant.id, {
        isAvailable: draft.isAvailable,
        quantity,
        ...(override === undefined ? {} : { priceOverridePaise: override }),
      });
      toast.show(`${variant.product.name} · ${variant.name} saved`);
      await load();
    } catch (requestError) {
      toast.show(errorMessage(requestError, 'The change could not be saved.'), 'danger');
    } finally {
      setSavingId('');
    }
  }

  const filtered = (variants ?? []).filter((variant) =>
    `${variant.product.name} ${variant.name} ${variant.sku}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        {cafes.length > 1 && (
          <SelectField className="w-64" label="Café" onChange={(event) => onCafeChange(event.target.value)} value={cafeId}>
            {cafes.map((cafe) => (
              <option key={cafe.id} value={cafe.id}>
                {cafe.name}
                {cafe.city ? ` · ${cafe.city}` : ''}
              </option>
            ))}
          </SelectField>
        )}
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16} aria-hidden="true" />
          <input
            aria-label="Filter products"
            className="min-h-11 w-full rounded-full border border-line pl-10 pr-4 text-sm outline-none focus:border-ink focus:ring-4 focus:ring-sun/40"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by product or SKU"
            value={query}
          />
        </div>
        <p className="text-xs text-muted">Leave café price blank to use the standard price.</p>
      </div>

      {error && <Alert className="mt-5" tone="danger">{error}</Alert>}

      <Card className="mt-5 overflow-x-auto">
        {!variants ? (
          <div className="p-6"><Skeleton className="h-64" /></div>
        ) : !filtered.length ? (
          <p className="p-8 text-center text-sm text-muted">No products match.</p>
        ) : (
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Product</th>
                <th className="px-3 py-3">Standard</th>
                <th className="px-3 py-3">Café price (₹)</th>
                <th className="px-3 py-3">Café stock</th>
                <th className="px-3 py-3">On menu</th>
                <th className="px-5 py-3 text-right">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((variant) => {
                const draft = drafts[variant.id] ?? draftFor(variant);
                const original = draftFor(variant);
                const dirty =
                  draft.isAvailable !== original.isAvailable ||
                  draft.quantity !== original.quantity ||
                  draft.priceOverride !== original.priceOverride;
                const setDraft = (patch: Partial<Draft>) =>
                  setDrafts((current) => ({ ...current, [variant.id]: { ...draft, ...patch } }));
                return (
                  <tr className={cx(dirty && 'bg-sun-soft/60')} key={variant.id}>
                    <td className="px-5 py-3">
                      <p className="font-semibold">{variant.product.name}</p>
                      <p className="text-xs text-muted">
                        {variant.name} · {variant.sku}
                      </p>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{formatPaise(variant.pricePaise)}</td>
                    <td className="px-3 py-3">
                      <input
                        aria-label={`Café price for ${variant.product.name} ${variant.name}`}
                        className="min-h-10 w-28 rounded-lg border border-line px-2 tabular-nums outline-none focus:border-ink"
                        inputMode="decimal"
                        onChange={(event) => setDraft({ priceOverride: event.target.value })}
                        placeholder={paiseToRupeesInput(variant.pricePaise)}
                        value={draft.priceOverride}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        aria-label={`Café stock for ${variant.product.name} ${variant.name}`}
                        className="min-h-10 w-24 rounded-lg border border-line px-2 tabular-nums outline-none focus:border-ink"
                        inputMode="numeric"
                        min={variant.cafeInventory?.reservedQuantity ?? 0}
                        onChange={(event) => setDraft({ quantity: event.target.value })}
                        type="number"
                        value={draft.quantity}
                      />
                      {(variant.cafeInventory?.reservedQuantity ?? 0) > 0 && (
                        <span className="ml-2 text-xs text-muted">{variant.cafeInventory?.reservedQuantity} reserved</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Toggle
                        checked={draft.isAvailable}
                        label={`${variant.product.name} ${variant.name} on menu`}
                        onChange={(value) => setDraft({ isAvailable: value })}
                      />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button disabled={!dirty} loading={savingId === variant.id} onClick={() => void save(variant)} size="sm" variant={dirty ? 'primary' : 'secondary'}>
                        Save
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={cx('relative h-7 w-12 rounded-full transition-colors', checked ? 'bg-ink' : 'bg-line')}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span className={cx('absolute top-1 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-6 bg-sun' : 'left-1')} />
    </button>
  );
}

// ---------- Products ----------

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function useFormSubmit() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>, action: (data: FormData) => Promise<void>, success: string) => {
      event.preventDefault();
      // Capture the form element now: React clears event.currentTarget once the handler yields.
      const form = event.currentTarget;
      setBusy(true);
      try {
        await action(new FormData(form));
        form.reset();
        toast.show(success);
        return true;
      } catch (requestError) {
        toast.show(errorMessage(requestError, 'The change could not be saved.'), 'danger');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { busy, submit };
}

function ProductsPanel() {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [addingVariantFor, setAddingVariantFor] = useState('');
  const { busy, submit } = useFormSubmit();

  const load = useCallback(async () => {
    try {
      const [nextProducts, nextCategories] = await Promise.all([getAdminProducts(), getCategories()]);
      setProducts(nextProducts);
      setCategories(nextCategories);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Products could not be loaded.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="grid gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {!products ? (
          <Skeleton className="h-80 rounded-3xl" />
        ) : !products.length ? (
          <EmptyState title="No products yet">Create your first product with the form.</EmptyState>
        ) : (
          products.map((product) => (
            <Card className="p-5" key={product.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-xs text-muted">
                    {product.category?.name} · /{product.slug}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {product.discoveryStatus !== 'current' && <Badge tone="soft">{product.discoveryStatus}</Badge>}
                  <Button onClick={() => setAddingVariantFor((current) => (current === product.id ? '' : product.id))} size="sm" variant="secondary">
                    <Plus size={14} aria-hidden="true" /> Variant
                  </Button>
                </div>
              </div>
              {product.variants.length === 0 && (
                <Alert className="mt-3" tone="warning">
                  Add a variant (size and price) so this product can be sold.
                </Alert>
              )}
              <div className="mt-3 divide-y divide-line">
                {product.variants.map((variant) => (
                  <VariantRow key={variant.id} onSaved={load} variant={variant} />
                ))}
              </div>
              {addingVariantFor === product.id && (
                <form
                  className="mt-4 grid gap-3 rounded-2xl bg-cloud p-4 sm:grid-cols-2"
                  onSubmit={(event) =>
                    void submit(
                      event,
                      async (data) => {
                        const pricePaise = rupeesToPaise(String(data.get('price')));
                        if (pricePaise === null) throw new Error('Enter the price in rupees, e.g. 450 or 450.50.');
                        await createProductVariant(product.id, {
                          sku: String(data.get('sku')).trim(),
                          name: String(data.get('name')).trim(),
                          pricePaise,
                          stockQuantity: Number(data.get('stock')),
                          availableOnline: data.get('online') === 'on',
                        });
                        setAddingVariantFor('');
                        await load();
                      },
                      'Variant added',
                    )
                  }
                >
                  <TextField label="Size / name" maxLength={100} minLength={2} name="name" placeholder="250 g" required />
                  <TextField label="SKU" maxLength={64} minLength={2} name="sku" placeholder="CT-ARABICA-250" required />
                  <TextField inputMode="decimal" label="Price (₹)" name="price" placeholder="450" required />
                  <TextField label="Online stock" max={100000} min={0} name="stock" required type="number" defaultValue="0" />
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input className="size-4 accent-ink" defaultChecked name="online" type="checkbox" /> Sell in the online store
                  </label>
                  <Button className="sm:col-span-2" loading={busy} type="submit" variant="dark">
                    Add variant
                  </Button>
                </form>
              )}
            </Card>
          ))
        )}
      </div>

      <div className="grid gap-6 lg:sticky lg:top-24">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">New product</h2>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) =>
              void submit(
                event,
                async (data) => {
                  const imageUrl = String(data.get('imageUrl') ?? '').trim();
                  const product = await createProduct({
                    name: String(data.get('name')).trim(),
                    slug: String(data.get('slug')).trim(),
                    description: String(data.get('description')).trim(),
                    categoryId: String(data.get('categoryId')),
                    discoveryStatus: String(data.get('discoveryStatus')) as AdminProduct['discoveryStatus'],
                    ...(imageUrl ? { imageUrl } : {}),
                  });
                  setName('');
                  await load();
                  setAddingVariantFor(product.id);
                },
                'Product created — now add a variant',
              )
            }
          >
            <TextField label="Name" maxLength={160} minLength={2} name="name" onChange={(event) => setName(event.target.value)} required value={name} />
            <TextField
              hint="Lowercase letters, numbers and dashes."
              key={slugify(name)}
              defaultValue={slugify(name)}
              label="URL slug"
              maxLength={180}
              name="slug"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
            />
            <SelectField label="Category" name="categoryId" required>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>
            <SelectField defaultValue="current" label="Shown as" name="discoveryStatus">
              <option value="current">Regular</option>
              <option value="new">New</option>
              <option value="upcoming">Coming soon</option>
            </SelectField>
            <TextField label="Image URL" maxLength={500} name="imageUrl" optional placeholder="https://…" type="url" />
            <TextAreaField label="Description" maxLength={5000} minLength={10} name="description" required />
            <Button loading={busy} type="submit" variant="dark">
              Create product
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">New category</h2>
          <CategoryForm onCreated={load} />
        </Card>
      </div>
    </div>
  );
}

function CategoryForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = useState('');
  const { busy, submit } = useFormSubmit();
  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={(event) =>
        void submit(
          event,
          async (data) => {
            await createCategory({ name: String(data.get('name')).trim(), slug: String(data.get('slug')).trim() });
            setName('');
            await onCreated();
          },
          'Category created',
        )
      }
    >
      <TextField label="Name" maxLength={100} minLength={2} name="name" onChange={(event) => setName(event.target.value)} required value={name} />
      <TextField defaultValue={slugify(name)} key={slugify(name)} label="Slug" maxLength={120} name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
      <Button loading={busy} type="submit" variant="secondary">
        Add category
      </Button>
    </form>
  );
}

function VariantRow({ variant, onSaved }: { variant: AdminProduct['variants'][number]; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [price, setPrice] = useState(paiseToRupeesInput(variant.pricePaise));
  const [stock, setStock] = useState(String(variant.stockQuantity));
  const [active, setActive] = useState(variant.isActive);
  const [saving, setSaving] = useState(false);
  const dirty = price !== paiseToRupeesInput(variant.pricePaise) || stock !== String(variant.stockQuantity) || active !== variant.isActive;

  async function save(): Promise<void> {
    const pricePaise = rupeesToPaise(price);
    const stockQuantity = Number(stock);
    if (pricePaise === null || !Number.isInteger(stockQuantity) || stockQuantity < variant.reservedQuantity) {
      toast.show(`Check the price, and keep stock at or above ${variant.reservedQuantity} reserved.`, 'danger');
      return;
    }
    setSaving(true);
    try {
      await updateVariant(variant.id, { pricePaise, stockQuantity, isActive: active });
      toast.show(`${variant.name} updated`);
      await onSaved();
    } catch (requestError) {
      toast.show(errorMessage(requestError), 'danger');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-3 text-sm">
      <div className="min-w-32 flex-1">
        <p className="font-medium">{variant.name}</p>
        <p className="text-xs text-muted">{variant.sku}</p>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-muted">
        ₹
        <input aria-label={`${variant.name} price`} className="min-h-9 w-24 rounded-lg border border-line px-2 text-sm text-ink" inputMode="decimal" onChange={(event) => setPrice(event.target.value)} value={price} />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted">
        Stock
        <input aria-label={`${variant.name} stock`} className="min-h-9 w-20 rounded-lg border border-line px-2 text-sm text-ink" min={variant.reservedQuantity} onChange={(event) => setStock(event.target.value)} type="number" value={stock} />
      </label>
      <Toggle checked={active} label={`${variant.name} active`} onChange={setActive} />
      <Button disabled={!dirty} loading={saving} onClick={() => void save()} size="sm" variant={dirty ? 'primary' : 'secondary'}>
        Save
      </Button>
    </div>
  );
}

// ---------- Cafés & staff ----------

function CafesPanel({ cafes, onChanged }: { cafes: CafeLocation[]; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState(cafes[0]?.id ?? '');
  const [cafeName, setCafeName] = useState('');
  const [newTable, setNewTable] = useState<{ number: string; url: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [savingCafe, setSavingCafe] = useState(false);
  const { busy, submit } = useFormSubmit();
  const selected = cafes.find((cafe) => cafe.id === selectedId);
  const [hours, setHours] = useState({ open: '', close: '' });

  useEffect(() => {
    if (!selectedId && cafes[0]) setSelectedId(cafes[0].id);
  }, [cafes, selectedId]);

  useEffect(() => {
    setHours({ open: selected?.openingTime?.slice(0, 5) ?? '08:00', close: selected?.closingTime?.slice(0, 5) ?? '20:00' });
    setNewTable(null);
  }, [selected?.id, selected?.openingTime, selected?.closingTime]);

  const statusOptions = useMemo(() => ['upcoming', 'active', 'inactive'] as const, []);

  async function saveCafe(patch: Parameters<typeof updateCafe>[1], message: string): Promise<void> {
    if (!selected) return;
    setSavingCafe(true);
    try {
      await updateCafe(selected.id, patch);
      toast.show(message);
      await onChanged();
    } catch (requestError) {
      toast.show(errorMessage(requestError), 'danger');
    } finally {
      setSavingCafe(false);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="grid gap-4">
        <div className="grid gap-2">
          {cafes.map((cafe) => (
            <button
              aria-pressed={cafe.id === selectedId}
              className={cx(
                'flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-colors',
                cafe.id === selectedId ? 'border-ink bg-sun-soft' : 'border-line hover:border-ink/40',
              )}
              key={cafe.id}
              onClick={() => setSelectedId(cafe.id)}
              type="button"
            >
              <span className="min-w-0">
                <span className="block font-semibold">{cafe.name}</span>
                <span className="block text-sm text-muted">{cafe.city ?? cafe.timezone}</span>
              </span>
              <Badge tone={cafe.status === 'active' ? 'success' : cafe.status === 'upcoming' ? 'soft' : 'neutral'}>{cafe.status}</Badge>
            </button>
          ))}
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">New café</h2>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) =>
              void submit(
                event,
                async (data) => {
                  const city = String(data.get('city') ?? '').trim();
                  const address = String(data.get('address') ?? '').trim();
                  const cafe = await createCafe({
                    name: String(data.get('name')).trim(),
                    slug: String(data.get('slug')).trim(),
                    timezone: String(data.get('timezone')).trim(),
                    ...(city ? { city } : {}),
                    ...(address ? { address } : {}),
                  });
                  setCafeName('');
                  await onChanged();
                  setSelectedId(cafe.id);
                },
                'Café created as “upcoming”',
              )
            }
          >
            <TextField label="Name" maxLength={120} minLength={2} name="name" onChange={(event) => setCafeName(event.target.value)} required value={cafeName} />
            <TextField defaultValue={slugify(cafeName)} key={slugify(cafeName)} label="Slug" maxLength={140} name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
            <TextField label="City" maxLength={80} name="city" optional />
            <TextField label="Address" maxLength={240} name="address" optional />
            <TextField defaultValue="Asia/Kolkata" hint="IANA time zone used for bookings." label="Time zone" maxLength={80} name="timezone" required />
            <Button loading={busy} type="submit" variant="dark">
              Create café
            </Button>
          </form>
        </Card>
      </div>

      {selected && (
        <div className="grid gap-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold">{selected.name}</h2>
            <p className="text-sm text-muted">Bookings and table ordering are only open while the café is active.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {statusOptions.map((status) => (
                <Button
                  disabled={savingCafe || selected.status === status}
                  key={status}
                  onClick={() => void saveCafe({ status }, `${selected.name} is now ${status}`)}
                  size="sm"
                  variant={selected.status === status ? 'dark' : 'secondary'}
                >
                  {selected.status === status && <Check size={14} aria-hidden="true" />}
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-end gap-3">
              <TextField label="Opens" onChange={(event) => setHours((current) => ({ ...current, open: event.target.value }))} type="time" value={hours.open} />
              <TextField label="Closes" onChange={(event) => setHours((current) => ({ ...current, close: event.target.value }))} type="time" value={hours.close} />
              <Button
                disabled={savingCafe || !hours.open || !hours.close || hours.close <= hours.open}
                onClick={() => void saveCafe({ openingTime: hours.open, closingTime: hours.close }, 'Opening hours saved')}
                variant="secondary"
              >
                Save hours
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold">Add a table</h2>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              onSubmit={(event) =>
                void submit(
                  event,
                  async (data) => {
                    const result = await createCafeTable(selected.id, {
                      tableNumber: String(data.get('tableNumber')).trim(),
                      capacity: Number(data.get('capacity')),
                    });
                    const code = result.table.tableCode ?? '';
                    setCopied(false);
                    setNewTable({
                      number: result.table.tableNumber,
                      token: result.tableToken,
                      url: `${window.location.origin}/cafe/table/${encodeURIComponent(code)}#token=${encodeURIComponent(result.tableToken)}`,
                    });
                  },
                  'Table created',
                )
              }
            >
              <TextField label="Table number" maxLength={20} name="tableNumber" required />
              <TextField defaultValue="4" label="Seats" max={20} min={1} name="capacity" required type="number" />
              <Button loading={busy} type="submit" variant="dark">
                Create
              </Button>
            </form>
            {newTable && (
              <Alert className="mt-4" tone="warning" title={`Table ${newTable.number} — set up the tablet now`}>
                <p>Open this link on the table&apos;s tablet. It contains the access code and is shown only once.</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-xs text-ink">{newTable.url}</code>
                  <Button
                    onClick={() => {
                      void navigator.clipboard.writeText(newTable.url).then(() => setCopied(true));
                    }}
                    size="sm"
                    variant="secondary"
                  >
                    {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </Alert>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold">Assign staff</h2>
            <p className="text-sm text-muted">The person must already have a Coffee-T account.</p>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-[1.5fr_1fr_auto] sm:items-end"
              onSubmit={(event) =>
                void submit(
                  event,
                  async (data) => {
                    const target = await findUserByEmail(String(data.get('email')).trim());
                    await assignCafeStaff(selected.id, {
                      userId: target.id,
                      role: String(data.get('role')) as 'cafe_manager' | 'waiter',
                    });
                  },
                  'Staff member assigned',
                )
              }
            >
              <TextField autoComplete="off" label="Email" maxLength={320} name="email" required type="email" />
              <SelectField defaultValue="waiter" label="Role" name="role">
                <option value="waiter">Waiter</option>
                <option value="cafe_manager">Café manager</option>
              </SelectField>
              <Button loading={busy} type="submit" variant="dark">
                Assign
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
