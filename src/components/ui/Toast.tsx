import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import DynamicIslandAlert, { IslandAction } from './DynamicIslandAlert';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastOptions {
  variant?: ToastVariant;
  duration?: number;
  /** One contextual button on the pill, e.g. "Review". */
  action?: IslandAction;
}

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  action?: IslandAction;
}

interface ToastAPI {
  toast: (message: string, opts?: ToastOptions) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastAPI | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((cur) => cur.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const push = useCallback((message: string, opts?: ToastOptions) => {
    const id = ++seq.current;
    const duration = opts?.duration ?? (opts?.action ? 7000 : 3200);
    // The same message twice (e.g. a repeated sync) shows once.
    setItems((cur) => [...cur.filter((t) => t.message !== message).slice(-2), { id, message, variant: opts?.variant ?? 'info', action: opts?.action }]);
    timers.current.set(id, setTimeout(() => dismiss(id), duration));
  }, [dismiss]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const api: ToastAPI = {
    toast: push,
    success: (m, d) => push(m, { variant: 'success', duration: d }),
    error: (m, d) => push(m, { variant: 'error', duration: d ?? 4500 }),
    info: (m, d) => push(m, { variant: 'info', duration: d }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed left-1/2 top-3 z-130 flex w-[min(92vw,520px)] -translate-x-1/2 flex-col items-center gap-2"
        role="region"
        aria-label="Notifications"
      >
        {items.map((t) => (
          <DynamicIslandAlert key={t.id} message={t.message} tone={t.variant} action={t.action} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

/** Non-blocking notifications. Falls back to a no-op if the provider is missing. */
export const useToast = (): ToastAPI => {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  const noop = () => {};
  return { toast: noop, success: noop, error: noop, info: noop };
};

export default ToastProvider;
