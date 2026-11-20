import type { QuoteInput, QuoteResult } from '../types/farm';
import { clamp, round } from './format';

const safe = (n: number): number => (Number.isFinite(n) ? n : 0);

export function normalizeQuoteInput(input: QuoteInput): QuoteInput {
  return {
    ...input,
    quantity: Math.max(1, Math.floor(safe(input.quantity) || 1)),
    printTimeHours: Math.max(0, safe(input.printTimeHours)),
    wastePct: clamp(safe(input.wastePct), 0, 100),
    electricityRate: Math.max(0, safe(input.electricityRate)),
    laborMinutes: Math.max(0, safe(input.laborMinutes)),
    laborRate: Math.max(0, safe(input.laborRate)),
    hardwareCost: Math.max(0, safe(input.hardwareCost)),
    markupPct: Math.max(0, safe(input.markupPct)),
    taxRate: clamp(safe(input.taxRate), 0, 100),
    volumeDiscountPct: clamp(safe(input.volumeDiscountPct), 0, 100),
    filaments: input.filaments.map((f) => ({
      ...f,
      grams: Math.max(0, safe(f.grams)),
      costPerKg: Math.max(0, safe(f.costPerKg)),
    })),
  };
}

/**
 * Per-unit cost build-up, then batch pricing with rush, volume discount and tax.
 * All monetary values are rounded to cents for display stability.
 */
export function computeQuote(rawInput: QuoteInput): QuoteResult {
  const input = normalizeQuoteInput(rawInput);
  const qty = input.quantity;
  const hours = input.printTimeHours;

  const gramsPerUnit = input.filaments.reduce((sum, f) => sum + f.grams, 0);
  const materialCost = input.filaments.reduce(
    (sum, f) => sum + (f.grams / 1000) * f.costPerKg * (1 + input.wastePct / 100),
    0,
  );
  const watts = input.printer ? Math.max(0, safe(input.printer.powerDrawW)) : 0;
  const electricityCost = (watts / 1000) * hours * input.electricityRate;
  const depreciation = input.printer ? Math.max(0, safe(input.printer.depreciationPerHour)) : 0;
  const machineCost = hours * depreciation;
  const laborCost = (input.laborMinutes / 60) * input.laborRate;
  const hardwareCost = input.hardwareCost;

  const unitCost = materialCost + electricityCost + machineCost + laborCost + hardwareCost;

  const markup = clamp(input.markupPct, 0, input.pricingMode === 'margin' ? 95 : 100000);
  const basePrice =
    input.pricingMode === 'margin'
      ? unitCost / Math.max(0.05, 1 - markup / 100)
      : unitCost * (1 + markup / 100);

  const rushFee = input.rush ? basePrice * 0.25 : 0;
  const unitPrice = basePrice + rushFee;
  const batchPrice = unitPrice * qty;
  const volumeDiscount = batchPrice * (input.volumeDiscountPct / 100);
  const netRevenue = Math.max(0, batchPrice - volumeDiscount);
  const tax = netRevenue * (input.taxRate / 100);
  const totalClient = netRevenue + tax;
  const totalCost = unitCost * qty;
  const profit = netRevenue - totalCost;
  const margin = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;

  return {
    quantity: qty,
    gramsPerUnit: round(gramsPerUnit, 1),
    printMinutes: round(hours * 60, 0),
    materialCost: round(materialCost),
    electricityCost: round(electricityCost),
    machineCost: round(machineCost),
    laborCost: round(laborCost),
    hardwareCost: round(hardwareCost),
    unitCost: round(unitCost),
    rushFee: round(rushFee),
    unitPrice: round(unitPrice),
    batchPrice: round(batchPrice),
    volumeDiscount: round(volumeDiscount),
    netRevenue: round(netRevenue),
    tax: round(tax),
    totalClient: round(totalClient),
    totalCost: round(totalCost),
    profit: round(profit),
    margin: round(margin, 1),
  };
}

export interface StackSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function buildCostSegments(result: QuoteResult): StackSegment[] {
  return [
    { key: 'material', label: 'Material', value: result.materialCost, color: '#F97316' },
    { key: 'electricity', label: 'Electricity', value: result.electricityCost, color: '#06B6D4' },
    { key: 'machine', label: 'Depreciation', value: result.machineCost, color: '#8B5CF6' },
    { key: 'labor', label: 'Labor', value: result.laborCost, color: '#10B981' },
    { key: 'hardware', label: 'Hardware', value: result.hardwareCost, color: '#F59E0B' },
  ].filter((s) => s.value > 0);
}

export function suggestedBatchPrice(unitCost: number, quantity: number, markup: number): number {
  return round(unitCost * quantity * (1 + Math.max(0, markup) / 100));
}
