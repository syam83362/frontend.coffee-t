import { apiRequest } from './api';

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

export function getCategories(signal?: AbortSignal): Promise<ProductCategory[]> {
  return apiRequest('/categories', { signal, refreshOn401: false });
}

export function getProducts(
  filters: { category?: string; search?: string; page?: number },
  signal?: AbortSignal,
): Promise<ProductPage> {
  const query = new URLSearchParams({ channel: 'online', page: String(filters.page ?? 1) });
  if (filters.category) query.set('category', filters.category);
  if (filters.search) query.set('search', filters.search);
  return apiRequest(`/products?${query.toString()}`, { signal, refreshOn401: false });
}
