'use client';

import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cx } from './ui';

type ToastTone = 'success' | 'danger' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === 'danger' ? 6000 : 3500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {toasts.map((toast) => (
          <div
            className={cx(
              'pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-pop',
              toast.tone === 'danger' ? 'bg-danger text-white' : 'bg-ink text-white',
            )}
            key={toast.id}
            role={toast.tone === 'danger' ? 'alert' : 'status'}
          >
            {toast.tone === 'danger' ? (
              <AlertCircle size={18} aria-hidden="true" className="shrink-0" />
            ) : (
              <CheckCircle2 size={18} aria-hidden="true" className="shrink-0 text-sun" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              aria-label="Dismiss notification"
              className="grid size-7 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => dismiss(toast.id)}
              type="button"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside <ToastProvider>');
  return value;
}
