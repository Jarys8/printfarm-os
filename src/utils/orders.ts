import type { PrintOrder } from '../types/farm';
import { addDays } from './format';

export function nextOrderNumber(orders: PrintOrder[]): string {
  const numbers = orders
    .map((o) => parseInt(o.orderNumber.replace(/\D/g, ''), 10))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length ? Math.max(...numbers) : 1040) + 1;
  return `PF-${next}`;
}

export function defaultDueDate(days = 7): string {
  return addDays(new Date(), Math.max(0, days)).toISOString();
}

export function orderFilamentGrams(order: PrintOrder): number {
  return order.filaments.reduce((sum, f) => sum + f.grams, 0);
}
