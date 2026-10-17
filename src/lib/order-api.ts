const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface CartItem {
  variantId: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  available: boolean;
}

export interface Cart {
  id: string;
  items: CartItem[];
  totalPaise: number;
}

export interface DeliveryAddress {
  id: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
}

export interface CustomerOrder {
  id: string;
  status: string;
  fulfillmentType: 'delivery' | 'dine_in' | 'assisted_dine_in';
  totalPaise: number;
  deliveryAddressSnapshot: Record<string, string | null>;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    variantName: string;
    quantity: number;
    unitPricePaise: number;
    lineTotalPaise: number;
  }>;
}

  export interface PaymentAttempt {
    id: string;
    orderId: string;
    provider: 'development';
    status: 'pending' | 'succeeded' | 'failed' | 'refunded';
    amountPaise: number;
    developmentSimulationAvailable: boolean;
  }

export interface AddressInput {
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export function getCart(): Promise<Cart> {
  return request('/cart');
}

export function addCartItem(variantId: string, quantity: number, csrfToken: string): Promise<Cart> {
  return request(`/cart/items/${variantId}`, {
    method: 'POST',
    body: JSON.stringify({ quantity }),
    csrfToken,
  });
}

export function setCartItem(variantId: string, quantity: number, csrfToken: string): Promise<Cart> {
  return request(`/cart/items/${variantId}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
    csrfToken,
  });
}

export function removeCartItem(variantId: string, csrfToken: string): Promise<void> {
  return request(`/cart/items/${variantId}`, { method: 'DELETE', csrfToken });
}

export function getAddresses(): Promise<DeliveryAddress[]> {
  return request('/addresses');
}

export function createAddress(input: AddressInput, csrfToken: string): Promise<DeliveryAddress> {
  return request('/addresses', { method: 'POST', body: JSON.stringify(input), csrfToken });
}

export function checkout(addressId: string, csrfToken: string): Promise<CustomerOrder> {
  return request('/orders/checkout', {
    method: 'POST',
    body: JSON.stringify({ addressId }),
    csrfToken,
  });
}

export function getOrders(): Promise<CustomerOrder[]> {
  return request('/orders');
}

export function startPayment(orderId: string, idempotencyKey: string, csrfToken: string): Promise<PaymentAttempt> {
  return request(`/orders/${orderId}/payments`, {
    method: 'POST',
    body: JSON.stringify({ idempotencyKey }),
    csrfToken,
  });
}

export function resolveDevelopmentPayment(
  orderId: string,
  attemptId: string,
  outcome: 'success' | 'failure',
  csrfToken: string,
): Promise<PaymentAttempt> {
  return request(`/orders/${orderId}/payments/${attemptId}/development-resolution`, {
    method: 'POST',
    body: JSON.stringify({ outcome }),
    csrfToken,
  });
}

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: string;
    csrfToken?: string;
  } = {},
): Promise<T> {
  const headers = new Headers();
  if (options.body) headers.set('Content-Type', 'application/json');
  if (options.csrfToken) headers.set('X-CSRF-Token', options.csrfToken);

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body,
    credentials: 'include',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(readErrorMessage(payload));
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