import { ApiError } from './auth-api';
import { CatalogueProduct } from './catalogue-api';
import { Account } from './auth-api';
import { CustomerOrder, PaymentAttempt } from './order-api';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface TableContext {
  cafe: { id: string; name: string; city: string | null };
  table: { id: string; number: string };
}

export interface CafeLocation {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'upcoming' | 'inactive';
  city: string | null;
  timezone: string;
}

export interface CafeTable {
  id: string;
  cafeId: string;
  tableNumber: string;
  capacity: number;
}

export interface WaiterCall {
  id: string;
  cafeId: string;
  status: string;
  createdAt: string;
  table: { tableNumber: string };
}

export interface CafeOrder {
  id: string;
  orderNumber: number;
  status: string;
  fulfillmentType: string;
  totalPaise: number;
  cafeTable: { tableNumber: string } | null;
  items: Array<{ id: string; productName: string; variantName: string; quantity: number }>;
}

export interface ReservationSlot {
  startsAt: string;
  endsAt: string;
  tablesAvailable: number;
}

export interface CafeAvailability {
  cafe: { id: string; name: string; timezone: string };
  date: string;
  durationMinutes: number;
  slots: ReservationSlot[];
}

export interface Reservation {
  id: string;
  cafeId: string;
  cafeTableId: string;
  partySize: number;
  startsAt: string;
  endsAt: string;
  status: string;
  cafe: CafeLocation;
  table: CafeTable;
}

export function getActiveCafes(): Promise<CafeLocation[]> {
  return request('/cafes');
}

export function getReservationAvailability(cafeId: string, date: string, partySize: number): Promise<CafeAvailability> {
  const query = new URLSearchParams({ cafeId, date, partySize: String(partySize) });
  return request(`/reservations/availability?${query.toString()}`);
}

export function createReservation(cafeId: string, startsAt: string, partySize: number, csrfToken: string): Promise<Reservation> {
  return request('/reservations', {
    method: 'POST', csrfToken, body: JSON.stringify({ cafeId, startsAt, partySize }),
  });
}

export function getMyReservations(): Promise<Reservation[]> {
  return request('/reservations/mine');
}

export function cancelReservation(id: string, csrfToken: string): Promise<Reservation> {
  return request(`/reservations/${id}/cancel`, { method: 'PATCH', csrfToken });
}

export function getAssignedCafes(): Promise<CafeLocation[]> {
  return request('/staff/cafes');
}

export function getStaffTables(cafeId: string): Promise<CafeTable[]> {
  return request(`/staff/cafes/${cafeId}/tables`);
}

export function getWaiterCalls(cafeId: string): Promise<WaiterCall[]> {
  return request(`/staff/cafes/${cafeId}/waiter-calls`);
}

export function resolveWaiterCall(callId: string, csrfToken: string): Promise<WaiterCall> {
  return request(`/staff/waiter-calls/${callId}/resolve`, { method: 'POST', csrfToken });
}

export function createAssistedOrder(
  cafeId: string,
  tableId: string,
  items: Array<{ variantId: string; quantity: number }>,
  requestId: string,
  csrfToken: string,
) {
  return request(`/staff/cafes/${cafeId}/tables/${tableId}/assisted-orders`, {
    method: 'POST', csrfToken, body: JSON.stringify({ items, requestId }),
  });
}

export function getPendingCafeOrders(cafeId: string): Promise<CafeOrder[]> {
  return request(`/staff/cafes/${cafeId}/pending-orders`);
}

export function recordCashCollection(orderId: string, csrfToken: string) {
  return request(`/staff/orders/${orderId}/cash-collection`, { method: 'POST', csrfToken });
}

export function updateCafeOrderStatus(
  orderId: string,
  status: 'preparing' | 'ready' | 'delivered',
  csrfToken: string,
): Promise<CafeOrder> {
  return request(`/staff/orders/${orderId}/status`, {
    method: 'PATCH', csrfToken, body: JSON.stringify({ status }),
  });
}

export function subscribeToCafeDisplay(
  cafeId: string,
  onOrders: (orders: Array<{ orderNumber: number; tableNumber: string; status: string; items: Array<{ name: string; quantity: number }> }>) => void,
  onError: () => void,
): () => void {
  const source = new EventSource(`${apiBaseUrl}/staff/cafes/${cafeId}/display/stream`, { withCredentials: true });
  source.onmessage = (event) => {
    try {
      onOrders(JSON.parse(event.data) as Array<{ orderNumber: number; tableNumber: string; status: string; items: Array<{ name: string; quantity: number }> }>);
    } catch {
      onError();
    }
  };
  source.onerror = onError;
  return () => source.close();
}
export async function getTableContext(tableCode: string, token: string): Promise<TableContext> {
  return request(`/table/${encodeURIComponent(tableCode)}`, { token });
}

export async function getCafeMenu(cafeId: string): Promise<CatalogueProduct[]> {
  const query = new URLSearchParams({ channel: 'cafe', cafeId, availableOnly: 'true', limit: '50' });
  const result = await request<{ data: CatalogueProduct[] }>(`/products?${query.toString()}`);
  return result.data;
}

export function callWaiter(tableCode: string, token: string, csrfToken: string): Promise<{ status: string }> {
  return request(`/table/${encodeURIComponent(tableCode)}/waiter-call`, {
    method: 'POST', token, csrfToken,
  });
}

export function createTableOrder(
  tableCode: string,
  token: string,
  items: Array<{ variantId: string; quantity: number }>,
  requestId: string,
  csrfToken: string,
): Promise<Pick<CustomerOrder, 'id' | 'status' | 'totalPaise'> & { orderNumber: number }> {
  return request(`/table/${encodeURIComponent(tableCode)}/orders`, {
    method: 'POST', token, csrfToken,
    body: JSON.stringify({ items, requestId }),
  });
}

export function startTablePayment(
  tableCode: string,
  token: string,
  orderId: string,
  idempotencyKey: string,
  csrfToken: string,
): Promise<PaymentAttempt> {
  return request(`/table/${encodeURIComponent(tableCode)}/orders/${orderId}/payments`, {
    method: 'POST', token, csrfToken, body: JSON.stringify({ idempotencyKey }),
  });
}

export function resolveTablePayment(
  tableCode: string,
  token: string,
  attemptId: string,
  outcome: 'success' | 'failure',
  csrfToken: string,
): Promise<PaymentAttempt> {
  return request(`/table/${encodeURIComponent(tableCode)}/payments/${attemptId}/development-resolution`, {
    method: 'POST', token, csrfToken, body: JSON.stringify({ outcome }),
  });
}

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH';
    body?: string;
    token?: string;
    csrfToken?: string;
  } = {},
): Promise<T> {
  const headers = new Headers();
  if (options.body) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('X-Cafe-Table-Token', options.token);
  if (options.csrfToken) headers.set('X-CSRF-Token', options.csrfToken);
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body,
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError('Cannot reach the Coffee-T API.', 0);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(readErrorMessage(payload), response.status);
  }
  return payload as T;
}

function readErrorMessage(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const { message } = payload;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string') return message;
  }
  return 'The request could not be completed.';
}

export interface ManagedVariant {
  id: string;
  sku: string;
  name: string;
  pricePaise: number;
  stockQuantity: number;
  reservedQuantity: number;
  isActive: boolean;
  product: { name: string; category: { name: string } };
  cafeAvailability: { isAvailable: boolean; priceOverridePaise: number | null } | null;
  cafeInventory: { quantity: number; reservedQuantity: number } | null;
}

export function getManagedCafes(): Promise<CafeLocation[]> {
  return request('/admin/cafes');
}

export function getManagedCafeMenu(cafeId: string): Promise<ManagedVariant[]> {
  return request(`/admin/cafes/${cafeId}/variants`);
}

export function createCafe(input: { name: string; slug: string; timezone: string; address?: string; city?: string }, csrfToken: string) {
  return request('/admin/cafes', { method: 'POST', csrfToken, body: JSON.stringify(input) });
}

export function createCafeTable(cafeId: string, input: { tableNumber: string; capacity: number }, csrfToken: string): Promise<{ table: CafeTable; tableToken: string }> {
  return request(`/admin/cafes/${cafeId}/tables`, { method: 'POST', csrfToken, body: JSON.stringify(input) });
}

export function assignCafeStaff(cafeId: string, input: { userId: string; role: 'cafe_manager' | 'waiter' }, csrfToken: string) {
  return request(`/admin/cafes/${cafeId}/staff`, { method: 'POST', csrfToken, body: JSON.stringify(input) });
}

export function setManagedCafeVariant(cafeId: string, variantId: string, input: { isAvailable: boolean; quantity: number; priceOverridePaise?: number }, csrfToken: string) {
  return request(`/admin/cafes/${cafeId}/variants/${variantId}`, { method: 'PATCH', csrfToken, body: JSON.stringify(input) });
}

export function getAdminProducts(): Promise<CatalogueProduct[]> {
  return request('/admin/products');
}

export function createProduct(input: { name: string; slug: string; description: string; categoryId: string; imageUrl?: string; discoveryStatus?: 'current' | 'new' | 'upcoming' }, csrfToken: string) {
  return request('/admin/products', { method: 'POST', csrfToken, body: JSON.stringify(input) });
}

export function createProductVariant(productId: string, input: { sku: string; name: string; pricePaise: number; stockQuantity: number }, csrfToken: string) {
  return request(`/admin/products/${productId}/variants`, { method: 'POST', csrfToken, body: JSON.stringify(input) });
}