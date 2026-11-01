import { API_URL, apiRequest, refreshSession } from './api';
import { CatalogueProduct } from './catalogue-api';
import { PaymentAttempt } from './order-api';

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
  address?: string | null;
  timezone: string;
  openingTime?: string;
  closingTime?: string;
}

export interface CafeTable {
  id: string;
  cafeId: string;
  tableNumber: string;
  capacity: number;
  tableCode?: string;
}

export interface WaiterCall {
  id: string;
  cafeId: string;
  status: string;
  createdAt: string;
  table: { id: string; tableNumber: string } | null;
}

export interface StaffOrder {
  id: string;
  orderNumber: number;
  status: string;
  fulfillmentType: 'dine_in' | 'assisted_dine_in' | 'delivery';
  totalPaise: number;
  createdAt: string;
  cafeTable: { id: string; tableNumber: string } | null;
  items: Array<{ id: string; productName: string; variantName: string; quantity: number }>;
}

export interface DisplayOrder {
  orderNumber: number;
  tableNumber: string;
  status: string;
  items: Array<{ name: string; quantity: number }>;
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
  partySize: number;
  startsAt: string;
  endsAt: string;
  status: string;
  cafe: Pick<CafeLocation, 'id' | 'name' | 'city' | 'timezone'>;
  table: { id: string; tableNumber: string; capacity: number };
}

export interface TableOrderResult {
  id: string;
  orderNumber: number;
  status: string;
  totalPaise: number;
}

// ---- Public café discovery & reservations ----

export function getCafes(): Promise<CafeLocation[]> {
  return apiRequest('/cafes', { refreshOn401: false });
}

export function getReservationAvailability(
  cafeId: string,
  date: string,
  partySize: number,
  signal?: AbortSignal,
): Promise<CafeAvailability> {
  const query = new URLSearchParams({ cafeId, date, partySize: String(partySize) });
  return apiRequest(`/reservations/availability?${query.toString()}`, { signal, refreshOn401: false });
}

export function createReservation(cafeId: string, startsAt: string, partySize: number): Promise<Reservation> {
  return apiRequest('/reservations', { method: 'POST', body: { cafeId, startsAt, partySize } });
}

export function getMyReservations(): Promise<Reservation[]> {
  return apiRequest('/reservations/mine');
}

export function cancelReservation(id: string): Promise<Reservation> {
  return apiRequest(`/reservations/${id}/cancel`, { method: 'PATCH' });
}

// ---- Mounted table tablet (authorised by the table token, not a user session) ----

function tableHeaders(token: string): Record<string, string> {
  return { 'X-Cafe-Table-Token': token };
}

export function getTableContext(tableCode: string, token: string): Promise<TableContext> {
  return apiRequest(`/table/${encodeURIComponent(tableCode)}`, { headers: tableHeaders(token), refreshOn401: false });
}

export async function getCafeMenu(cafeId: string): Promise<CatalogueProduct[]> {
  const query = new URLSearchParams({ channel: 'cafe', cafeId, availableOnly: 'true', limit: '50' });
  const result = await apiRequest<{ data: CatalogueProduct[] }>(`/products?${query.toString()}`, { refreshOn401: false });
  return result.data;
}

export function callWaiter(tableCode: string, token: string): Promise<{ status: string }> {
  return apiRequest(`/table/${encodeURIComponent(tableCode)}/waiter-call`, {
    method: 'POST',
    headers: tableHeaders(token),
    refreshOn401: false,
  });
}

export function createTableOrder(
  tableCode: string,
  token: string,
  items: Array<{ variantId: string; quantity: number }>,
  requestId: string,
): Promise<TableOrderResult> {
  return apiRequest(`/table/${encodeURIComponent(tableCode)}/orders`, {
    method: 'POST',
    headers: tableHeaders(token),
    body: { items, requestId },
    refreshOn401: false,
  });
}

export function startTablePayment(
  tableCode: string,
  token: string,
  orderId: string,
  idempotencyKey: string,
): Promise<PaymentAttempt> {
  return apiRequest(`/table/${encodeURIComponent(tableCode)}/orders/${orderId}/payments`, {
    method: 'POST',
    headers: tableHeaders(token),
    body: { idempotencyKey },
    refreshOn401: false,
  });
}

export function resolveTablePayment(
  tableCode: string,
  token: string,
  attemptId: string,
  outcome: 'success' | 'failure',
): Promise<PaymentAttempt> {
  return apiRequest(`/table/${encodeURIComponent(tableCode)}/payments/${attemptId}/development-resolution`, {
    method: 'POST',
    headers: tableHeaders(token),
    body: { outcome },
    refreshOn401: false,
  });
}

// ---- Café staff ----

export function getAssignedCafes(): Promise<CafeLocation[]> {
  return apiRequest('/staff/cafes');
}

export function getStaffTables(cafeId: string): Promise<CafeTable[]> {
  return apiRequest(`/staff/cafes/${cafeId}/tables`);
}

export function getWaiterCalls(cafeId: string): Promise<WaiterCall[]> {
  return apiRequest(`/staff/cafes/${cafeId}/waiter-calls`);
}

export function resolveWaiterCall(callId: string): Promise<WaiterCall> {
  return apiRequest(`/staff/waiter-calls/${callId}/resolve`, { method: 'POST' });
}

export function getPendingCafeOrders(cafeId: string): Promise<StaffOrder[]> {
  return apiRequest(`/staff/cafes/${cafeId}/pending-orders`);
}

export function getActiveCafeOrders(cafeId: string): Promise<StaffOrder[]> {
  return apiRequest(`/staff/cafes/${cafeId}/active-orders`);
}

export function createAssistedOrder(
  cafeId: string,
  tableId: string,
  items: Array<{ variantId: string; quantity: number }>,
  requestId: string,
): Promise<TableOrderResult> {
  return apiRequest(`/staff/cafes/${cafeId}/tables/${tableId}/assisted-orders`, {
    method: 'POST',
    body: { items, requestId, tableId },
  });
}

export function recordCashCollection(orderId: string): Promise<unknown> {
  return apiRequest(`/staff/orders/${orderId}/cash-collection`, { method: 'POST' });
}

export function updateCafeOrderStatus(
  orderId: string,
  status: 'preparing' | 'ready' | 'delivered',
): Promise<{ id: string; orderNumber: number; status: string }> {
  return apiRequest(`/staff/orders/${orderId}/status`, { method: 'PATCH', body: { status } });
}

/**
 * Streams the preparation display. EventSource cannot refresh an expired access cookie on
 * its own, so on error we refresh the session and reconnect with backoff.
 */
export function subscribeToCafeDisplay(
  cafeId: string,
  onOrders: (orders: DisplayOrder[]) => void,
  onStatus: (status: 'live' | 'reconnecting' | 'signed-out') => void,
): () => void {
  let source: EventSource | null = null;
  let closed = false;
  let retry = 0;
  let timer: number | undefined;

  const connect = () => {
    if (closed) return;
    source = new EventSource(`${API_URL}/staff/cafes/${cafeId}/display/stream`, { withCredentials: true });
    source.onmessage = (event) => {
      retry = 0;
      try {
        onOrders(JSON.parse(event.data) as DisplayOrder[]);
        onStatus('live');
      } catch {
        onStatus('reconnecting');
      }
    };
    source.onerror = () => {
      source?.close();
      if (closed) return;
      onStatus('reconnecting');
      const delay = Math.min(30_000, 1_000 * 2 ** retry++);
      timer = window.setTimeout(async () => {
        const user = await refreshSession().catch(() => undefined);
        if (user === null) {
          onStatus('signed-out');
          return;
        }
        connect();
      }, delay);
    };
  };

  connect();
  return () => {
    closed = true;
    window.clearTimeout(timer);
    source?.close();
  };
}

// ---- Administration ----

export interface ManagedVariant {
  id: string;
  sku: string;
  name: string;
  pricePaise: number;
  stockQuantity: number;
  reservedQuantity: number;
  isActive: boolean;
  product: { id: string; name: string; category: { name: string } };
  cafeAvailability: { isAvailable: boolean; priceOverridePaise: number | null } | null;
  cafeInventory: { quantity: number; reservedQuantity: number } | null;
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  discoveryStatus: 'current' | 'new' | 'upcoming';
  category: { id: string; name: string };
  variants: Array<{
    id: string;
    sku: string;
    name: string;
    pricePaise: number;
    stockQuantity: number;
    reservedQuantity: number;
    isActive: boolean;
  }>;
}

export function getManagedCafes(): Promise<CafeLocation[]> {
  return apiRequest('/admin/cafes');
}

export function getManagedCafeMenu(cafeId: string): Promise<ManagedVariant[]> {
  return apiRequest(`/admin/cafes/${cafeId}/variants`);
}

export function createCafe(
  input: { name: string; slug: string; timezone: string; address?: string; city?: string },
): Promise<CafeLocation> {
  return apiRequest('/admin/cafes', { method: 'POST', body: input });
}

export function updateCafe(
  cafeId: string,
  input: { status?: CafeLocation['status']; openingTime?: string; closingTime?: string },
): Promise<CafeLocation> {
  return apiRequest(`/admin/cafes/${cafeId}`, { method: 'PATCH', body: input });
}

export function createCafeTable(
  cafeId: string,
  input: { tableNumber: string; capacity: number },
): Promise<{ table: CafeTable; tableToken: string }> {
  return apiRequest(`/admin/cafes/${cafeId}/tables`, { method: 'POST', body: input });
}

export function findUserByEmail(email: string): Promise<{ id: string; email: string; role: string; isActive: boolean }> {
  return apiRequest(`/admin/users/lookup?${new URLSearchParams({ email }).toString()}`);
}

export function assignCafeStaff(cafeId: string, input: { userId: string; role: 'cafe_manager' | 'waiter' }) {
  return apiRequest(`/admin/cafes/${cafeId}/staff`, { method: 'POST', body: input });
}

export function setManagedCafeVariant(
  cafeId: string,
  variantId: string,
  input: { isAvailable: boolean; quantity: number; priceOverridePaise?: number },
) {
  return apiRequest(`/admin/cafes/${cafeId}/variants/${variantId}`, { method: 'PATCH', body: input });
}

export function getAdminProducts(): Promise<AdminProduct[]> {
  return apiRequest('/admin/products');
}

export function createProduct(input: {
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  imageUrl?: string;
  discoveryStatus?: 'current' | 'new' | 'upcoming';
}): Promise<AdminProduct> {
  return apiRequest('/admin/products', { method: 'POST', body: input });
}

export function createProductVariant(
  productId: string,
  input: { sku: string; name: string; pricePaise: number; stockQuantity: number; availableOnline?: boolean },
) {
  return apiRequest(`/admin/products/${productId}/variants`, { method: 'POST', body: input });
}

export function updateVariant(variantId: string, input: { pricePaise: number; stockQuantity: number; isActive: boolean }) {
  return apiRequest(`/admin/variants/${variantId}`, { method: 'PATCH', body: input });
}

export function createCategory(input: { name: string; slug: string; description?: string }) {
  return apiRequest('/admin/categories', { method: 'POST', body: input });
}
