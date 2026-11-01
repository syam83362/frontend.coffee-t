'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Account, onSessionChange } from '@/lib/api';
import { getCurrentUser, login as loginRequest, logout as logoutRequest, register as registerRequest } from '@/lib/auth-api';
import { Cart, getCart } from '@/lib/order-api';

type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

interface SessionValue {
  status: SessionStatus;
  user: Account | null;
  cartCount: number;
  signIn: (email: string, password: string) => Promise<Account>;
  register: (email: string, password: string) => Promise<Account>;
  signOut: () => Promise<void>;
  /** Re-reads the basket count, or applies a cart the caller already has. */
  syncCart: (cart?: Cart) => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<Account | null>(null);
  const [cartCount, setCartCount] = useState(0);

  const applyUser = useCallback((next: Account | null) => {
    setUser(next);
    setStatus(next ? 'authenticated' : 'anonymous');
    if (!next) setCartCount(0);
  }, []);

  const syncCart = useCallback(async (cart?: Cart) => {
    try {
      const current = cart ?? (await getCart());
      setCartCount(current.items.reduce((sum, item) => sum + item.quantity, 0));
    } catch {
      // The count is decorative; a failed read must not break the page.
    }
  }, []);

  useEffect(() => onSessionChange(applyUser), [applyUser]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // getCurrentUser refreshes transparently when the access cookie has expired.
        const current = await getCurrentUser();
        if (active) applyUser(current);
      } catch {
        // 401 after a failed refresh, or the API is unreachable: either way show the
        // signed-out experience and let individual pages surface their own errors.
        if (active) applyUser(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [applyUser]);

  useEffect(() => {
    if (user) void syncCart();
  }, [user, syncCart]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      cartCount,
      syncCart,
      signIn: async (email, password) => {
        const next = await loginRequest(email, password);
        applyUser(next);
        return next;
      },
      register: async (email, password) => {
        const next = await registerRequest(email, password);
        applyUser(next);
        return next;
      },
      signOut: async () => {
        try {
          await logoutRequest();
        } finally {
          applyUser(null);
        }
      },
    }),
    [status, user, cartCount, syncCart, applyUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
