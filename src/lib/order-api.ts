import { apiRequest } from './api';

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
  deliveryAddressSnapshot: Record<string, string | null> | null;
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
  status: 'pending' | 'succeeded' | 'failed' | 'expired' | 'refunded';
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
  return apiRequest('/cart');
}

export function addCartItem(variantId: string, quantity: number): Promise<Cart> {
  return apiRequest(`/cart/items/${variantId}`, { method: 'POST', body: { quantity } });
}

export function setCartItem(variantId: string, quantity: number): Promise<Cart> {
  return apiRequest(`/cart/items/${variantId}`, { method: 'PUT', body: { quantity } });
}

export function removeCartItem(variantId: string): Promise<Cart | undefined> {
  return apiRequest(`/cart/items/${variantId}`, { method: 'DELETE' });
}

export function getAddresses(): Promise<DeliveryAddress[]> {
  return apiRequest('/addresses');
}

export function createAddress(input: AddressInput): Promise<DeliveryAddress> {
  return apiRequest('/addresses', { method: 'POST', body: input });
}

export function checkout(addressId: string): Promise<CustomerOrder> {
  return apiRequest('/orders/checkout', { method: 'POST', body: { addressId } });
}

export function getOrders(): Promise<CustomerOrder[]> {
  return apiRequest('/orders');
}

export function startPayment(orderId: string, idempotencyKey: string): Promise<PaymentAttempt> {
  return apiRequest(`/orders/${orderId}/payments`, { method: 'POST', body: { idempotencyKey } });
}

export function resolveDevelopmentPayment(
  orderId: string,
  attemptId: string,
  outcome: 'success' | 'failure',
): Promise<PaymentAttempt> {
  return apiRequest(`/orders/${orderId}/payments/${attemptId}/development-resolution`, {
    method: 'POST',
    body: { outcome },
  });
}
