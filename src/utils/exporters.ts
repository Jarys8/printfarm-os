import type { FarmState, PrintOrder } from '../types/farm';
import { ORDER_STATUS_META, formatDate } from './format';

const CSV_HEADERS = [
  'Order #',
  'Client',
  'Contact',
  'Part',
  'Qty',
  'Printed',
  'Status',
  'Due date',
  'Printer',
  'Unit price',
  'Total price',
  'Payment',
  'Material g / unit',
  'Print hours / unit',
  'Created',
];

function escapeCsv(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function ordersToCsv(orders: PrintOrder[], printerName: (id: string | null) => string): string {
  const rows = orders.map((o) => [
    o.orderNumber,
    o.clientName,
    o.clientContact,
    o.partName,
    o.quantity,
    o.printedQty,
    ORDER_STATUS_META[o.status].label,
    formatDate(o.dueDate),
    printerName(o.printerId),
    o.unitPrice.toFixed(2),
    o.totalPrice.toFixed(2),
    o.paymentStatus,
    o.filaments.reduce((s, f) => s + f.grams, 0),
    o.hoursPerUnit,
    formatDate(o.createdAt),
  ]);
  return [CSV_HEADERS, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\r\n');
}

export function downloadJson(state: FarmState): void {
  const payload: FarmState = { ...state, toasts: [] };
  const content = JSON.stringify(payload, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `printfarm-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const ARRAY_KEYS = ['printers', 'spools', 'hardware', 'orders', 'presets', 'maintenanceLogs', 'ledger'] as const;

/** Structural validation for imported backups. Throws a human-readable error. */
export function validateImportedState(raw: unknown): FarmState {
  if (!raw || typeof raw !== 'object') throw new Error('Backup is not a valid JSON object.');
  const data = raw as Record<string, unknown>;
  if (!data.settings || typeof data.settings !== 'object') throw new Error('Backup is missing farm settings.');
  for (const key of ARRAY_KEYS) {
    if (!Array.isArray(data[key])) throw new Error(`Backup is missing the "${key}" collection.`);
  }
  const settings = data.settings as Record<string, unknown>;
  if (typeof settings.farmName !== 'string') throw new Error('Backup settings are malformed.');
  const state = data as unknown as FarmState;
  if (!state.printers.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string')) {
    throw new Error('Printer records are malformed.');
  }
  if (!state.orders.every((o) => o && typeof o.id === 'string' && typeof o.quantity === 'number')) {
    throw new Error('Order records are malformed.');
  }
  return {
    ...state,
    version: 1,
    toasts: [],
    theme: state.theme === 'light' ? 'light' : 'dark',
  };
}
