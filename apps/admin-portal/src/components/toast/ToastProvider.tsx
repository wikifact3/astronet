'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  message?: string;
  durationMs: number;
}

interface ToastContextValue {
  show: (toast: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4000;
const MAX_VISIBLE = 4;

const TONE_STYLES: Record<
  ToastTone,
  { border: string; icon: string; bar: string; Icon: typeof CheckCircle2 }
> = {
  success: {
    border: 'border-green-200',
    icon: 'text-green-600',
    bar: 'bg-green-500',
    Icon: CheckCircle2,
  },
  error: {
    border: 'border-red-200',
    icon: 'text-red-600',
    bar: 'bg-red-500',
    Icon: XCircle,
  },
  warning: {
    border: 'border-amber-200',
    icon: 'text-amber-600',
    bar: 'bg-amber-500',
    Icon: AlertCircle,
  },
  info: {
    border: 'border-brand-200',
    icon: 'text-brand-600',
    bar: 'bg-brand-500',
    Icon: Info,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback<ToastContextValue['show']>(
    ({ tone, title, message, durationMs = DEFAULT_DURATION_MS }) => {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      setToasts((prev) => {
        const next = [...prev, { id, tone, title, message, durationMs }];
        return next.slice(-MAX_VISIBLE);
      });

      if (durationMs > 0) {
        const handle = window.setTimeout(() => dismiss(id), durationMs);
        timers.current.set(id, handle);
      }
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      dismiss,
      success: (title, message) => show({ tone: 'success', title, message }),
      error: (title, message) =>
        show({ tone: 'error', title, message, durationMs: 6000 }),
      info: (title, message) => show({ tone: 'info', title, message }),
      warning: (title, message) =>
        show({ tone: 'warning', title, message, durationMs: 5000 }),
    }),
    [show, dismiss],
  );

  useEffect(() => {
    const handler = () => {
      show({
        tone: 'warning',
        title: 'Session expired',
        message: 'Please sign in again to continue.',
        durationMs: 6000,
      });
    };
    window.addEventListener('powerlink:session-expired', handler);
    return () => window.removeEventListener('powerlink:session-expired', handler);
  }, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3 sm:right-6 sm:top-6"
    >
      {[...toasts].reverse().map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const style = TONE_STYLES[toast.tone];
  const Icon = style.Icon;

  return (
    <div
      role="status"
      className={`pointer-events-auto relative overflow-hidden rounded-xl border ${style.border} bg-white shadow-lg shadow-admin-900/5 animate-toast-in-top`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0 top-0 h-full w-1 ${style.bar}`}
      />

      <div className="flex items-start gap-3 py-3 pl-5 pr-3">
        <span className={`mt-0.5 shrink-0 ${style.icon}`}>
          <Icon size={18} strokeWidth={2} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-admin-900">{toast.title}</p>
          {toast.message && (
            <p className="mt-0.5 text-xs leading-relaxed text-admin-600">
              {toast.message}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="shrink-0 rounded-md p-1 text-admin-400 transition hover:bg-admin-100 hover:text-admin-700"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
