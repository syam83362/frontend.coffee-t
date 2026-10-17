'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Save } from 'lucide-react';
import { Account, getCsrfToken, getCurrentUser } from '@/lib/auth-api';
import { getCategories, ProductCategory } from '@/lib/catalogue-api';
import {
  CafeLocation,
  createCafe,
  createCafeTable,
  createProduct,
  createProductVariant,
  getManagedCafeMenu,
  getManagedCafes,
  ManagedVariant,
  setManagedCafeVariant,
  assignCafeStaff,
} from '@/lib/cafe-api';

interface InventoryDraft {
  isAvailable: boolean;
  quantity: string;
  priceOverride: string;
}

export function AdminDashboard() {
  const [account, setAccount] = useState<Account | null>(null);
  const [cafes, setCafes] = useState<CafeLocation[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [variants, setVariants] = useState<ManagedVariant[]>([]);
  const [drafts, setDrafts] = useState<Record<string, InventoryDraft>>({});
  const [cafeId, setCafeId] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [tableToken, setTableToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadCafes(): Promise<void> {
    const nextCafes = await getManagedCafes();
    setCafes(nextCafes);
    setCafeId((current) => current || nextCafes[0]?.id || '');
  }

  async function loadVariants(selectedCafeId: string): Promise<void> {
    const nextVariants = await getManagedCafeMenu(selectedCafeId);
    setVariants(nextVariants);
    setDrafts(Object.fromEntries(nextVariants.map((variant) => [variant.id, {
      isAvailable: variant.cafeAvailability?.isAvailable ?? false,
      quantity: String(variant.cafeInventory?.quantity ?? 0),
      priceOverride: variant.cafeAvailability?.priceOverridePaise == null ? '' : String(variant.cafeAvailability.priceOverridePaise),
    }])));
  }

  useEffect(() => {
    let active = true;
    Promise.all([getCurrentUser(), getCsrfToken(), getManagedCafes(), getCategories()])
      .then(([user, token, locations, nextCategories]) => {
        if (!active) return;
        setAccount(user.user);
        setCsrfToken(token);
        setCafes(locations);
        setCafeId(locations[0]?.id ?? '');
        setCategories(nextCategories);
      })
      .catch((requestError: unknown) => { if (active) setError(requestError instanceof Error ? requestError.message : 'Admin access could not be loaded.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!cafeId) return;
    let active = true;
    getManagedCafeMenu(cafeId).then((nextVariants) => {
      if (!active) return;
      setVariants(nextVariants);
      setDrafts(Object.fromEntries(nextVariants.map((variant) => [variant.id, {
        isAvailable: variant.cafeAvailability?.isAvailable ?? false,
        quantity: String(variant.cafeInventory?.quantity ?? 0),
        priceOverride: variant.cafeAvailability?.priceOverridePaise == null ? '' : String(variant.cafeAvailability.priceOverridePaise),
      }])));
    }).catch((requestError: unknown) => { if (active) setError(requestError instanceof Error ? requestError.message : 'Café menu could not be loaded.'); });
    return () => { active = false; };
  }, [cafeId]);

  async function submitForm(event: FormEvent<HTMLFormElement>, action: (data: FormData) => Promise<void>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action(new FormData(event.currentTarget));
      event.currentTarget.reset();
      setNotice('Changes saved.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The change could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  const isAdmin = account?.role === 'admin';
  const canManage = isAdmin || account?.role === 'cafe_manager';

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="border-b border-ink/15 bg-white px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between"><div><p className="text-[10px] font-bold uppercase text-coral">Coffee-T · Administration</p><h1 className="mt-1 font-display text-3xl">Catalogue &amp; cafés</h1></div><Link className="inline-flex items-center gap-2 text-sm font-bold" href="/"><ArrowLeft size={16} /> Store</Link></div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8">
        {error && <p className="mb-5 border-l-4 border-coral bg-white px-4 py-3 text-sm" role="alert">{error}</p>}
        {notice && <p className="mb-5 border-l-4 border-leaf bg-mint px-4 py-3 text-sm" role="status">{notice}</p>}
        {!canManage ? <p className="border-y border-ink/15 py-5 text-sm">Sign in with an administrator or café manager account.</p> : (
          <>
            <section aria-labelledby="locations-title">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-3"><h2 className="font-display text-2xl" id="locations-title">Café locations</h2><label className="flex items-center gap-3 text-xs font-bold uppercase">Location<select className="min-h-10 border border-ink/20 bg-white px-3 text-sm normal-case" onChange={(event) => setCafeId(event.target.value)} value={cafeId}>{cafes.map((cafe) => <option key={cafe.id} value={cafe.id}>{cafe.name} · {cafe.city}</option>)}</select></label></div>
              {isAdmin && <div className="grid gap-8 py-5 lg:grid-cols-3">
                <form className="grid gap-3 border-r border-ink/10 pr-5" onSubmit={(event) => void submitForm(event, async (data) => { await createCafe({ name: String(data.get('name')), slug: String(data.get('slug')), timezone: String(data.get('timezone')), city: String(data.get('city')) }, csrfToken); await loadCafes(); })}>
                  <h3 className="font-bold">Add café</h3><Input name="name" label="Name" required /><Input name="slug" label="Slug" required /><Input name="city" label="City" /><Input name="timezone" label="IANA timezone" placeholder="Asia/Kolkata" required /><button className="min-h-10 bg-ink px-3 text-xs font-bold text-white" disabled={busy}>Create café</button>
                </form>
                <form className="grid content-start gap-3 border-r border-ink/10 pr-5" onSubmit={(event) => void submitForm(event, async (data) => { await createCafeTable(cafeId, { tableNumber: String(data.get('tableNumber')), capacity: Number(data.get('capacity')) }, csrfToken).then((result) => setTableToken(result.tableToken)); })}>
                  <h3 className="font-bold">Add table</h3><Input name="tableNumber" label="Table number" required /><Input name="capacity" label="Seats" type="number" min="1" max="20" required /><button className="min-h-10 bg-ink px-3 text-xs font-bold text-white" disabled={busy || !cafeId}>Create table token</button>
                  {tableToken && <p className="break-all border border-sun bg-white p-3 text-xs"><strong>Table token, shown once:</strong><br />{tableToken}</p>}
                </form>
                <form className="grid content-start gap-3" onSubmit={(event) => void submitForm(event, async (data) => { await assignCafeStaff(cafeId, { userId: String(data.get('userId')), role: String(data.get('role')) as 'cafe_manager' | 'waiter' }, csrfToken); })}>
                  <h3 className="font-bold">Assign staff</h3><Input name="userId" label="Existing user ID" required /><label className="grid gap-1 text-xs font-semibold">Role<select className="min-h-10 border border-ink/20 bg-white px-2 text-sm" name="role"><option value="waiter">Waiter</option><option value="cafe_manager">Café manager</option></select></label><button className="min-h-10 bg-ink px-3 text-xs font-bold text-white" disabled={busy || !cafeId}>Assign to café</button>
                </form>
              </div>}
            </section>

            {isAdmin && <section className="mt-12" aria-labelledby="product-title">
              <div className="border-b-2 border-ink pb-3"><h2 className="font-display text-2xl" id="product-title">Add a product</h2></div>
              <form className="grid gap-3 py-5 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => void submitForm(event, async (data) => { await createProduct({ name: String(data.get('name')), slug: String(data.get('slug')), description: String(data.get('description')), categoryId: String(data.get('categoryId')), discoveryStatus: String(data.get('discoveryStatus')) as 'current' | 'new' | 'upcoming' }, csrfToken); if (cafeId) await loadVariants(cafeId); })}>
                <Input name="name" label="Product name" required /><Input name="slug" label="Slug" required />
                <label className="grid gap-1 text-xs font-semibold">Category<select className="min-h-10 border border-ink/20 bg-white px-2 text-sm" name="categoryId" required>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label className="grid gap-1 text-xs font-semibold">Discovery<select className="min-h-10 border border-ink/20 bg-white px-2 text-sm" name="discoveryStatus"><option value="current">Current</option><option value="new">New</option><option value="upcoming">Upcoming</option></select></label>
                <label className="grid gap-1 text-xs font-semibold sm:col-span-2 lg:col-span-3">Description<textarea className="min-h-20 border border-ink/20 bg-white p-2 text-sm" name="description" required /></label>
                <button className="self-end min-h-10 bg-leaf px-4 text-xs font-bold text-white" disabled={busy}>Create product</button>
              </form>
            </section>}

            <section className="mt-12" aria-labelledby="inventory-title">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-3"><h2 className="font-display text-2xl" id="inventory-title">Café menu &amp; inventory</h2><span className="text-xs text-muted">Reserved units cannot be reduced below their current count.</span></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead><tr className="border-b border-ink/15 text-[10px] uppercase text-muted"><th className="py-3 pr-4">Product</th><th className="py-3 pr-4">Variant / SKU</th><th className="py-3 pr-4">Global price</th><th className="py-3 pr-4">Café price override</th><th className="py-3 pr-4">Café stock</th><th className="py-3 pr-4">Available</th><th className="py-3">Save</th></tr></thead>
                  <tbody className="divide-y divide-ink/10">{variants.map((variant) => {
                    const draft = drafts[variant.id] ?? { isAvailable: false, quantity: '0', priceOverride: '' };
                    return <tr key={variant.id}>
                      <td className="py-3 pr-4"><strong>{variant.product.name}</strong><span className="block text-xs text-muted">{variant.product.category.name}</span></td>
                      <td className="py-3 pr-4">{variant.name}<span className="block text-xs text-muted">{variant.sku}</span></td>
                      <td className="py-3 pr-4">₹{(variant.pricePaise / 100).toFixed(2)}</td>
                      <td className="py-3 pr-4"><input aria-label={`Price override for ${variant.product.name}`} className="min-h-9 w-28 border border-ink/20 px-2" min="0" onChange={(event) => setDrafts((current) => ({ ...current, [variant.id]: { ...draft, priceOverride: event.target.value } }))} placeholder="Global" type="number" value={draft.priceOverride} /></td>
                      <td className="py-3 pr-4"><input aria-label={`Stock for ${variant.product.name}`} className="min-h-9 w-20 border border-ink/20 px-2" min={variant.cafeInventory?.reservedQuantity ?? 0} onChange={(event) => setDrafts((current) => ({ ...current, [variant.id]: { ...draft, quantity: event.target.value } }))} type="number" value={draft.quantity} /><span className="ml-2 text-xs text-muted">{variant.cafeInventory?.reservedQuantity ?? 0} reserved</span></td>
                      <td className="py-3 pr-4"><input aria-label={`Available at this café: ${variant.product.name}`} checked={draft.isAvailable} className="size-5 accent-leaf" onChange={(event) => setDrafts((current) => ({ ...current, [variant.id]: { ...draft, isAvailable: event.target.checked } }))} type="checkbox" /></td>
                      <td className="py-3"><button aria-label={`Save ${variant.product.name}`} className="grid size-9 place-items-center border border-ink/20 hover:bg-mint disabled:opacity-50" disabled={busy || !cafeId} onClick={() => void saveVariant(variant.id, draft)} type="button"><Save size={15} /></button></td>
                    </tr>;
                  })}</tbody>
                </table>
                {!variants.length && <p className="py-8 text-sm text-muted">No catalogue variants are available to manage.</p>}
              </div>
            </section>
            {isAdmin && <p className="mt-10 text-right"><Link className="text-xs font-bold text-leaf" href="/cafe/staff">Open café staff workspace <ArrowUpRight className="inline" size={13} /></Link></p>}
          </>
        )}
      </div>
    </main>
  );

  async function saveVariant(variantId: string, draft: InventoryDraft): Promise<void> {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await setManagedCafeVariant(cafeId, variantId, {
        isAvailable: draft.isAvailable,
        quantity: Number(draft.quantity),
        ...(draft.priceOverride === '' ? {} : { priceOverridePaise: Number(draft.priceOverride) }),
      }, csrfToken);
      await loadVariants(cafeId);
      setNotice('Café menu and inventory updated.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The café menu could not be updated.');
    } finally {
      setBusy(false);
    }
  }
}

function Input({ name, label, required, type = 'text', min, max, placeholder }: { name: string; label: string; required?: boolean; type?: string; min?: string; max?: string; placeholder?: string }) {
  return <label className="grid gap-1 text-xs font-semibold">{label}<input className="min-h-10 min-w-0 border border-ink/20 bg-white px-2 text-sm" max={max} min={min} name={name} placeholder={placeholder} required={required} type={type} /></label>;
}