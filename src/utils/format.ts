import type { Currency, OrderStatus, PaymentStatus, PrinterStatus } from '../types/farm';

export const CURRENCY_META: Record<Currency, { code: Currency; symbol: string; locale: string; label: string }> = {
  USD: { code: 'USD', symbol: '$', locale: 'en-US', label: 'USD $' },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE', label: 'EUR €' },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', label: 'GBP £' },
  CZK: { code: 'CZK', symbol: 'Kč', locale: 'cs-CZ', label: 'CZK Kč' },
  PLN: { code: 'PLN', symbol: 'zł', locale: 'pl-PL', label: 'PLN zł' },
};

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function formatMoney(value: number, currency: Currency, digits = 2): string {
  const meta = CURRENCY_META[currency] ?? CURRENCY_META.USD;
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: meta.code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(safe);
  } catch {
    return `${meta.symbol}${safe.toFixed(digits)}`;
  }
}

export function formatCompactMoney(value: number, currency: Currency): string {
  const meta = CURRENCY_META[currency] ?? CURRENCY_META.USD;
  if (Math.abs(value) >= 10000) {
    try {
      return new Intl.NumberFormat(meta.locale, {
        style: 'currency',
        currency: meta.code,
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value);
    } catch {
      return `${meta.symbol}${(value / 1000).toFixed(1)}k`;
    }
  }
  return formatMoney(value, currency, 0);
}

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatGrams(grams: number): string {
  if (!Number.isFinite(grams)) return '0 g';
  return `${formatNumber(Math.round(grams))} g`;
}

export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return '0h';
  return `${formatNumber(Math.round(hours))}h`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

export function formatCountdown(endsAt: number | null | undefined, now: number): string {
  if (!endsAt) return '--:--:--';
  const delta = Math.floor((endsAt - now) / 1000);
  if (delta <= 0) return 'FINISHED';
  const h = Math.floor(delta / 3600);
  const m = Math.floor((delta % 3600) / 60);
  const s = delta % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function hoursUntil(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (t - Date.now()) / 3600000;
}

export function dueMeta(iso: string | null | undefined): { label: string; tone: 'bad' | 'warn' | 'ok' | 'muted' } {
  const hrs = hoursUntil(iso);
  if (!Number.isFinite(hrs)) return { label: 'No due date', tone: 'muted' };
  if (hrs < 0) {
    const days = Math.ceil(-hrs / 24);
    return { label: `${days}d overdue`, tone: 'bad' };
  }
  if (hrs < 24) return { label: `${Math.max(1, Math.round(hrs))}h left`, tone: 'bad' };
  if (hrs < 48) return { label: `${Math.round(hrs / 24)}d left`, tone: 'warn' };
  return { label: `${Math.round(hrs / 24)}d left`, tone: 'ok' };
}

export const PRINTER_STATUS_META: Record<PrinterStatus, { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'muted' }> = {
  printing: { label: 'Printing', tone: 'info' },
  idle: { label: 'Idle / Ready', tone: 'ok' },
  bed_clearing: { label: 'Bed Clearing', tone: 'warn' },
  maintenance: { label: 'Maintenance', tone: 'bad' },
};

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; short: string }> = {
  quote_sent: { label: 'Quote Sent', short: 'Quote' },
  queued: { label: 'Queued', short: 'Queued' },
  printing: { label: 'Printing', short: 'Printing' },
  post_processing: { label: 'Post-Processing', short: 'Post' },
  ready: { label: 'Ready / Shipped', short: 'Ready' },
};

export const ORDER_STATUS_ORDER: OrderStatus[] = ['quote_sent', 'queued', 'printing', 'post_processing', 'ready'];

export const PAYMENT_META: Record<PaymentStatus, { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
  paid: { label: 'Paid', tone: 'ok' },
  deposit: { label: 'Deposit', tone: 'warn' },
  unpaid: { label: 'Unpaid', tone: 'bad' },
};

export function percent(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return clamp((part / total) * 100, 0, 100);
}

export function sanitizeHex(hex: string, fallback = '#F97316'): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
}

export function textColorFor(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#FFFFFF';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#09090B' : '#FFFFFF';
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function machineDepreciation(printer: { purchasePrice: number; lifespanHours: number }): number {
  const lifespan = Number(printer.lifespanHours);
  if (!Number.isFinite(lifespan) || lifespan <= 0) return 0;
  return (Number(printer.purchasePrice) || 0) / lifespan;
}
