import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-maker text-zinc-950 font-semibold hover:bg-orange-400 active:bg-orange-500 shadow-[0_6px_18px_-10px_rgba(249,115,22,0.9)]',
  secondary: 'bg-raised text-ink border border-line hover:border-zinc-500/60 active:bg-line',
  ghost: 'text-muted hover:text-ink hover:bg-raised',
  danger: 'bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/20 dark:text-rose-400',
  outline: 'border border-line text-ink hover:border-maker/60 hover:bg-raised',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5 rounded-md',
  md: 'h-10 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-5 text-sm gap-2 rounded-xl',
  icon: 'h-10 w-10 rounded-lg',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maker/60 disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'muted' | 'maker';

const TONES: Record<Tone, string> = {
  ok: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  bad: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
  info: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/25',
  muted: 'bg-raised text-muted border-line',
  maker: 'bg-maker-soft text-orange-600 dark:text-orange-400 border-orange-500/25',
};

export function Badge({
  tone = 'muted',
  className,
  children,
  dot = false,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider leading-4',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('panel', className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  hint,
  icon,
  action,
  className,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          {icon && <span className="text-muted">{icon}</span>}
          {title}
        </h2>
        {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
  right,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="label">{label}</span>
        {right}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'field font-mono tabular-nums text-sm';

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  className,
  sheetOnMobile = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  sheetOnMobile?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex overflow-y-auto bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4',
        sheetOnMobile ? 'items-end justify-center' : 'items-center justify-center p-4',
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'flex max-h-[92dvh] w-full flex-col border border-line bg-panel shadow-2xl animate-slide-in',
          sheetOnMobile ? 'rounded-t-2xl sm:rounded-xl' : 'rounded-xl',
          widths[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-ink">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog" className="-mr-1 -mt-1 h-9 w-9">
            <X size={18} />
          </Button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && <div className="safe-bottom border-t border-line bg-raised/60 px-4 py-3 sm:px-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function PrintPortal({ children }: { children: React.ReactNode }) {
  return createPortal(<div className="print-portal fixed inset-0 z-[60] overflow-y-auto bg-black/80 p-0 sm:p-6">{children}</div>, document.body);
}

export function Progress({
  value,
  max = 100,
  tone = 'maker',
  className,
  height = 6,
}: {
  value: number;
  max?: number;
  tone?: 'maker' | 'ok' | 'warn' | 'bad' | 'info';
  className?: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const colors = {
    maker: 'bg-maker',
    ok: 'bg-emerald-500',
    warn: 'bg-amber-500',
    bad: 'bg-rose-500',
    info: 'bg-cyan-500',
  } as const;
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-line', className)} style={{ height }}>
      <div className={cn('h-full rounded-full transition-all duration-500', colors[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg border border-line bg-raised px-3 py-2.5 text-left transition hover:border-zinc-500/50"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[11px] leading-snug text-muted">{description}</span>}
      </span>
      <span
        className={cn(
          'relative h-5 w-9 flex-shrink-0 rounded-full border transition-colors',
          checked ? 'border-maker bg-maker' : 'border-line bg-line',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: {
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cn('inline-flex rounded-lg border border-line bg-raised p-0.5', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors',
            size === 'sm' ? 'h-7 px-2 text-[11px]' : 'h-8 px-3 text-xs',
            value === opt.value ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-10 text-center', className)}>
      {icon && <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-raised text-muted">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-raised px-1 font-mono text-[10px] font-medium text-muted">
      {children}
    </kbd>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon,
  tone = 'default',
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'default' | 'maker' | 'info' | 'ok' | 'bad';
  className?: string;
}) {
  const accent = {
    default: 'text-muted',
    maker: 'text-orange-500 dark:text-orange-400',
    info: 'text-cyan-600 dark:text-cyan-400',
    ok: 'text-emerald-600 dark:text-emerald-400',
    bad: 'text-rose-600 dark:text-rose-400',
  }[tone];
  return (
    <div className={cn('panel relative overflow-hidden p-3.5 sm:p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="label">{label}</span>
        {icon && <span className={accent}>{icon}</span>}
      </div>
      <div className="mt-1.5 font-mono text-xl font-semibold tabular text-ink sm:text-2xl">{value}</div>
      {sub && <div className={cn('mt-1 text-[11px]', accent === 'text-muted' ? 'text-muted' : accent)}>{sub}</div>}
    </div>
  );
}
