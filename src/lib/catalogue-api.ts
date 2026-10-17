const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
}

export interface CatalogueVariant {
  id: string;
  name: string;
  pricePaise: number;
  available: boolean;
}

export interface CatalogueProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  discoveryStatus: 'current' | 'new' | 'upcoming';
  category: ProductCategory;
  variants: CatalogueVariant[];
}

export interface ProductPage {
  data: CatalogueProduct[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function getCategories(): Promise<ProductCategory[]> {
  return request<ProductCategory[]>('/categories');
}

export async function getProducts(filters: {
  category?: string;
  search?: string;
  page?: number;
}): Promise<ProductPage> {
  const query = new URLSearchParams({ channel: 'online', page: String(filters.page ?? 1) });
  if (filters.category) query.set('category', filters.category);
  if (filters.search) query.set('search', filters.search);
  return request<ProductPage>(`/products?${query.toString()}`);
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }
  return payload as T;
}

function readErrorMessage(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const { message } = payload;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string') return message;
  }
  return 'The catalogue could not be loaded.';
}