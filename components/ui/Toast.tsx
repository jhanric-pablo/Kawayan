import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import './toast.css';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastAPI {
  toast: (message: string, opts?: { variant?: ToastVariant; duration?: number }) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastAPI | null>(null);

const ICONS: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((cur) => cur.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const push = useCallback((message: string, opts?: { variant?: ToastVariant; duration?: number }) => {
    const id = ++seq.current;
    const duration = opts?.duration ?? 3200;
    setItems((cur) => [...cur.slice(-3), { id, message, variant: opts?.variant ?? 'info', duration }]);
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
      <div className="kw-toast-stack" role="region" aria-label="Notifications">
        {items.map((t) => {
          const Icon = ICONS[t.variant];
          return (
            <div key={t.id} className={`kw-toast kw-toast--${t.variant}`} role="status">
              <Icon className="kw-toast__icon w-4 h-4" aria-hidden />
              <span className="kw-toast__msg">{t.message}</span>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="kw-toast__x">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
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
