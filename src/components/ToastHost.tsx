import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { useT } from '../hooks/useT';
import { cn } from './ui';

const ICONS = {
  success: CheckCircle2,
  info: Info,
  warn: AlertTriangle,
  error: XCircle,
} as const;

const TONE = {
  success: 'text-emerald-500 dark:text-emerald-400',
  info: 'text-cyan-500 dark:text-cyan-400',
  warn: 'text-amber-500 dark:text-amber-400',
  error: 'text-rose-500 dark:text-rose-400',
} as const;

export function ToastHost() {
  const { state, dispatch } = useFarm();
  const tr = useT();

  useEffect(() => {
    if (!state.toasts.length) return;
    const timers = state.toasts.map((t) =>
      window.setTimeout(() => dispatch({ type: 'dismissToast', id: t.id }), 4600),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [state.toasts, dispatch]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-3 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end">
      {state.toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-line bg-panel/95 px-3 py-2.5 shadow-2xl backdrop-blur animate-slide-in"
            role="status"
          >
            <Icon size={17} className={cn('mt-0.5 flex-shrink-0', TONE[toast.kind])} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold leading-snug text-ink">{tr(toast.message)}</p>
              {toast.detail && <p className="mt-0.5 text-[11px] leading-snug text-muted">{tr(toast.detail)}</p>}
            </div>
            <button
              type="button"
              aria-label={tr('Dismiss notification')}
              onClick={() => dispatch({ type: 'dismissToast', id: toast.id })}
              className="-mr-1 rounded p-1 text-muted transition-colors hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
