'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Coffee, Search, ShoppingBag, X } from 'lucide-react';
import { errorMessage, isAbortError } from '@/lib/api';
import { CatalogueProduct, getCategories, getProducts, ProductCategory } from '@/lib/catalogue-api';
import { formatPaise } from '@/lib/format';
import { addCartItem } from '@/lib/order-api';
import { useSession } from './session-provider';
import { useToast } from './toast';
import { Alert, Badge, Button, cx, EmptyState, Skeleton } from './ui';

export function CatalogueSection() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getCategories(controller.signal)
      .then(setCategories)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  // Debounce typing so every keystroke does not hit the API.
  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [activeCategory, search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getProducts({ category: activeCategory, search, page }, controller.signal)
      .then((result) => {
        setProducts((current) => (page === 1 ? result.data : [...current, ...result.data]));
        setTotalPages(result.totalPages);
      })
      .catch((requestError: unknown) => {
        if (!isAbortError(requestError)) setError(errorMessage(requestError, 'The catalogue could not be loaded.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [activeCategory, search, page, reloadKey]);

  const filterButton = (slug: string, label: string) => (
    <button
      aria-pressed={activeCategory === slug}
      className={cx(
        'min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors',
        activeCategory === slug ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-soft hover:border-ink',
      )}
      key={slug || 'all'}
      onClick={() => setActiveCategory(slug)}
      type="button"
    >
      {label}
    </button>
  );

  const firstLoad = loading && page === 1;

  return (
    <section className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8 lg:py-24" id="shop" aria-labelledby="shop-title">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-sun-ink">The collection</p>
          <h2 className="font-display text-4xl leading-tight sm:text-5xl" id="shop-title">
            Choose your ritual.
          </h2>
        </div>
        <form
          className="relative w-full md:max-w-xs"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput.trim());
          }}
          role="search"
        >
          <label className="sr-only" htmlFor="catalogue-search">
            Search coffee and tea
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} aria-hidden="true" />
          <input
            className="min-h-12 w-full rounded-full border border-line bg-white pl-11 pr-11 text-sm outline-none transition focus:border-ink focus:ring-4 focus:ring-sun/40"
            id="catalogue-search"
            maxLength={100}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search coffee and tea"
            type="search"
            value={searchInput}
          />
          {searchInput && (
            <button
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-cloud hover:text-ink"
              onClick={() => setSearchInput('')}
              type="button"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </form>
      </div>

      <div className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Filter by category" role="group">
        {filterButton('', 'All')}
        {categories.map((category) => filterButton(category.slug, category.name))}
      </div>

      <div className="mt-8">
        {error ? (
          <Alert
            tone="danger"
            title="We couldn't load the collection"
            action={
              <Button size="sm" variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>
                Try again
              </Button>
            }
          >
            {error}
          </Alert>
        ) : firstLoad ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading products">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index}>
                <Skeleton className="aspect-[4/5] rounded-3xl" />
                <Skeleton className="mt-4 h-5 w-2/3" />
                <Skeleton className="mt-2 h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : products.length ? (
          <>
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {page < totalPages && (
              <div className="mt-12 flex justify-center">
                <Button loading={loading} onClick={() => setPage((current) => current + 1)} variant="secondary">
                  Show more
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={<Coffee size={22} aria-hidden="true" />}
            title="No products match"
            action={
              (search || activeCategory) && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearchInput('');
                    setActiveCategory('');
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          >
            Try a different search or category.
          </EmptyState>
        )}
      </div>
    </section>
  );
}

function ProductCard({ product }: { product: CatalogueProduct }) {
  const router = useRouter();
  const { status, syncCart } = useSession();
  const toast = useToast();
  const defaultVariant = product.variants.find((variant) => variant.available) ?? product.variants[0];
  const [variantId, setVariantId] = useState(defaultVariant?.id ?? '');
  const [adding, setAdding] = useState(false);
  const variant = product.variants.find((candidate) => candidate.id === variantId) ?? defaultVariant;
  const upcoming = product.discoveryStatus === 'upcoming';
  const canAdd = Boolean(variant?.available) && !upcoming;

  async function handleAdd(): Promise<void> {
    if (!variant || !canAdd) return;
    if (status !== 'authenticated') {
      router.push(`/account?next=${encodeURIComponent('/#shop')}`);
      return;
    }
    setAdding(true);
    try {
      const cart = await addCartItem(variant.id, 1);
      await syncCart(cart);
      toast.show(`${product.name} added to your basket`);
    } catch (requestError) {
      toast.show(errorMessage(requestError, 'This item could not be added.'), 'danger');
    } finally {
      setAdding(false);
    }
  }

  return (
    <article className="group flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-cloud">
        {product.imageUrl ? (
          <Image
            alt={product.name}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            src={product.imageUrl}
            unoptimized
          />
        ) : (
          <div className="grid h-full place-items-center bg-sun-soft">
            <Coffee className="text-sun-ink/50" size={48} aria-hidden="true" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge className="bg-white/95">{product.category.name}</Badge>
          {product.discoveryStatus === 'new' && <Badge tone="sun">New</Badge>}
          {upcoming && <Badge tone="dark">Coming soon</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col pt-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-snug">{product.name}</h3>
          {variant && <span className="shrink-0 text-base font-bold">{formatPaise(variant.pricePaise)}</span>}
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted">{product.description}</p>

        {product.variants.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${product.name} size`}>
            {product.variants.map((option) => (
              <button
                aria-checked={option.id === variant?.id}
                className={cx(
                  'min-h-8 rounded-full border px-3 text-xs font-semibold transition-colors',
                  option.id === variant?.id ? 'border-ink bg-ink text-white' : 'border-line text-ink-soft hover:border-ink',
                  !option.available && 'line-through opacity-60',
                )}
                key={option.id}
                onClick={() => setVariantId(option.id)}
                role="radio"
                type="button"
              >
                {option.name}
              </button>
            ))}
          </div>
        )}
        {product.variants.length === 1 && variant && <p className="mt-2 text-xs font-medium text-muted">{variant.name}</p>}

        <div className="mt-auto pt-4">
          <Button block disabled={!canAdd} loading={adding} onClick={() => void handleAdd()} variant={canAdd ? 'primary' : 'secondary'}>
            {upcoming ? (
              'Coming soon'
            ) : !variant?.available ? (
              'Out of stock'
            ) : (
              <>
                <ShoppingBag size={16} aria-hidden="true" /> Add to basket
              </>
            )}
          </Button>
        </div>
      </div>
    </article>
  );
}

export function SignInPrompt() {
  return (
    <Link className="font-semibold underline" href="/account">
      Sign in
    </Link>
  );
}
