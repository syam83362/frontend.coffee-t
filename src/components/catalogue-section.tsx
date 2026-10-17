'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Search, ShoppingBasket, X } from 'lucide-react';
import { addCartItem } from '../lib/order-api';
import { getCsrfToken } from '../lib/auth-api';
import {
  CatalogueProduct,
  getCategories,
  getProducts,
  ProductCategory,
} from '../lib/catalogue-api';

const priceFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function CatalogueSection() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch((requestError: unknown) =>
        setError(requestError instanceof Error ? requestError.message : 'The catalogue could not be loaded.'),
      );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getProducts({ category: activeCategory, search })
      .then((result) => setProducts(result.data))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : 'The catalogue could not be loaded.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [activeCategory, search]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <section className="mx-auto max-w-[1440px] px-5 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-28 lg:px-14" id="collections">
      <div className="mb-9 flex flex-col justify-between gap-5 sm:mb-12 sm:flex-row sm:items-end">
        <div>
          <p className="mb-3 text-[11px] font-bold uppercase text-coral">The good stuff</p>
          <h2 className="font-display text-[43px] leading-none sm:text-[56px]">Choose your ritual.</h2>
        </div>
        <form className="flex min-h-12 w-full border-b border-ink/30 sm:max-w-[340px]" onSubmit={submitSearch} role="search">
          <label className="sr-only" htmlFor="catalogue-search">Search coffee and tea</label>
          <input
            className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted focus-visible:border-coral"
            id="catalogue-search"
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search coffee and tea"
            value={searchInput}
          />
          {searchInput ? (
            <button
              aria-label="Clear search"
              className="grid size-11 place-items-center text-muted hover:text-ink"
              onClick={() => {
                setSearchInput('');
                setSearch('');
              }}
              type="button"
            >
              <X size={17} aria-hidden="true" />
            </button>
          ) : (
            <button aria-label="Search products" className="grid size-11 place-items-center text-ink" type="submit">
              <Search size={18} aria-hidden="true" />
            </button>
          )}
        </form>
      </div>

      <div className="mb-7 flex flex-wrap gap-2" aria-label="Filter by category">
        <button
          aria-pressed={!activeCategory}
          className={`min-h-10 border px-4 text-sm font-semibold transition-colors ${activeCategory ? 'border-ink/20 text-muted hover:border-ink' : 'border-ink bg-ink text-white'}`}
          onClick={() => setActiveCategory('')}
          type="button"
        >
          All
        </button>
        {categories.map((category) => (
          <button
            aria-pressed={activeCategory === category.slug}
            className={`min-h-10 border px-4 text-sm font-semibold transition-colors ${activeCategory === category.slug ? 'border-ink bg-ink text-white' : 'border-ink/20 text-muted hover:border-ink'}`}
            key={category.id}
            onClick={() => setActiveCategory(category.slug)}
            type="button"
          >
            {category.name}
          </button>
        ))}
      </div>

      {error ? (
        <div className="border-l-4 border-coral bg-white px-5 py-4 text-sm" role="alert">
          {error}
        </div>
      ) : loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading products" aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="animate-pulse" key={index}>
              <div className="aspect-[4/5] bg-mint" />
              <div className="mt-4 h-4 w-2/3 bg-mint" />
              <div className="mt-3 h-3 w-1/2 bg-mint" />
            </div>
          ))}
        </div>
      ) : products.length ? (
        <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => {
            const variant = product.variants[0];
            return (
              <article className="group" key={product.id}>
                <ProductCard product={product} variant={variant} />
              </article>
            );
          })}
        </div>
      ) : (
        <p className="border-y border-ink/15 py-10 text-center font-display text-2xl">No products found.</p>
      )}
    </section>
  );
}

function ProductCard({ product, variant }: { product: CatalogueProduct; variant: CatalogueProduct['variants'][number] | undefined }) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [message, setMessage] = useState('');

  async function handleAdd(): Promise<void> {
    if (!variant?.available) return;
    setAdding(true);
    setMessage('');
    try {
      const token = await getCsrfToken();
      await addCartItem(variant.id, 1, token);
      setAdded(true);
    } catch {
      setMessage('Sign in to add this to your basket.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <div className="relative aspect-[4/5] overflow-hidden bg-mint">
        {product.imageUrl ? (
          <Image
            alt={product.name}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            src={product.imageUrl}
            unoptimized
          />
        ) : (
          <div className="grid h-full place-items-center font-display text-4xl text-leaf/50">Coffee-T</div>
        )}
        <span className="absolute left-3 top-3 bg-paper px-3 py-1 text-[10px] font-bold uppercase text-ink">
                  {product.discoveryStatus === 'new' ? 'New · ' : ''}{product.category.name}
        </span>
      </div>
                <div className="flex items-start justify-between gap-3 pt-4">
                  <div>
                    <h3 className="font-display text-[25px] leading-tight">{product.name}</h3>
                    <p className="mt-1 text-xs text-muted">{variant?.name ?? 'Unavailable'}</p>
                  </div>
                  {variant && <span className="shrink-0 text-sm font-bold">{priceFormatter.format(variant.pricePaise / 100)}</span>}
                </div>
                <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-muted">{product.description}</p>
                <p className={`mt-3 text-[10px] font-bold uppercase ${variant?.available ? 'text-leaf' : 'text-coral'}`}>
                  {product.discoveryStatus === 'upcoming' ? 'Coming soon' : variant?.available ? 'Available online' : 'Currently unavailable'}
                </p>
      <button
        className="mt-4 inline-flex min-h-11 w-full items-center justify-between border border-ink px-4 text-sm font-bold transition-colors hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:border-ink/15 disabled:text-muted"
        disabled={!variant?.available || product.discoveryStatus === 'upcoming' || adding}
        onClick={() => void handleAdd()}
        type="button"
      >
        {product.discoveryStatus === 'upcoming' ? 'Coming soon' : added ? 'Added to basket' : adding ? 'Adding…' : 'Add to basket'}
        <ShoppingBasket size={17} aria-hidden="true" />
      </button>
      {message && <p className="mt-2 text-xs text-coral" role="status">{message} <Link className="font-bold underline" href="/account">Sign in</Link></p>}
      {added && <Link className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-leaf" href="/account">View basket <ArrowUpRight size={13} aria-hidden="true" /></Link>}
    </>
  );
}