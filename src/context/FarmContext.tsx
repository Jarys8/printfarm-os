import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type {
  FarmSettings,
  FarmState,
  FilamentSpool,
  HardwareItem,
  MaintenanceLog,
  MaintenanceTask,
  PaymentStatus,
  PrintOrder,
  Printer,
  PrinterStatus,
  ProductPreset,
  ThemeMode,
  Toast,
  ToastKind,
  OrderStatus,
} from '../types/farm';
import { BLANK_SETTINGS, buildDemoState, buildEmptyState, DEFAULT_SETTINGS } from '../data/demoData';
import { formatMoney, round, uid } from '../utils/format';
import { validateImportedState } from '../utils/exporters';

const STORAGE_KEY = 'printfarm-os:state:v1';

export type FarmAction =
  | { type: 'setSettings'; patch: Partial<FarmSettings> }
  | { type: 'setTheme'; theme: ThemeMode }
  | { type: 'upsertPrinter'; printer: Printer }
  | { type: 'deletePrinter'; id: string }
  | { type: 'setPrinterStatus'; id: string; status: PrinterStatus }
  | { type: 'completePrinterJob'; id: string }
  | { type: 'addMaintenanceTask'; printerId: string; task: MaintenanceTask }
  | { type: 'updateMaintenanceTask'; printerId: string; task: MaintenanceTask }
  | { type: 'removeMaintenanceTask'; printerId: string; taskId: string }
  | { type: 'logMaintenance'; printerId: string; taskId: string; notes?: string }
  | { type: 'upsertSpool'; spool: FilamentSpool }
  | { type: 'deleteSpool'; id: string }
  | { type: 'adjustSpool'; id: string; delta: number; reason?: string }
  | { type: 'weighSpool'; id: string; grossGrams: number }
  | { type: 'upsertHardware'; item: HardwareItem }
  | { type: 'deleteHardware'; id: string }
  | { type: 'adjustHardware'; id: string; delta: number }
  | { type: 'upsertOrder'; order: PrintOrder }
  | { type: 'deleteOrder'; id: string }
  | { type: 'moveOrder'; id: string; status: OrderStatus }
  | { type: 'setPayment'; id: string; paymentStatus: PaymentStatus }
  | { type: 'printPiece'; id: string }
  | { type: 'upsertPreset'; preset: ProductPreset }
  | { type: 'deletePreset'; id: string }
  | { type: 'loadDemo' }
  | { type: 'clearAll' }
  | { type: 'importState'; payload: unknown }
  | { type: 'toast'; kind: ToastKind; message: string; detail?: string }
  | { type: 'dismissToast'; id: string };

interface FarmContextValue {
  state: FarmState;
  dispatch: React.Dispatch<FarmAction>;
  money: (value: number, digits?: number) => string;
}

const FarmContext = createContext<FarmContextValue | null>(null);

function toast(state: FarmState, message: string, detail?: string, kind: ToastKind = 'success'): FarmState {
  const t: Toast = { id: uid('toast'), message, detail, kind };
  return { ...state, toasts: [...state.toasts.slice(-3), t] };
}

function deductFromSpools(spools: FilamentSpool[], allocations: Array<{ spoolId: string; grams: number }>): FilamentSpool[] {
  if (!allocations.length) return spools;
  const used = new Map<string, number>();
  for (const a of allocations) {
    const grams = Math.max(0, Number(a.grams) || 0);
    used.set(a.spoolId, (used.get(a.spoolId) ?? 0) + grams);
  }
  return spools.map((s) => {
    const grams = used.get(s.id);
    if (!grams) return s;
    const remaining = Math.max(0, round(s.remainingGrams - grams, 1));
    return { ...s, remainingGrams: remaining };
  });
}

function allocationSummary(state: FarmState, allocations: Array<{ spoolId: string; grams: number }>): string {
  return allocations
    .map((a) => {
      const spool = state.spools.find((s) => s.id === a.spoolId);
      const label = spool ? `${spool.brand} ${spool.material} ${spool.colorName}` : 'filament';
      return `${Math.round(a.grams)}g ${label}`;
    })
    .join(' · ');
}

/** Applies one printed piece: inventory deduction, odometer, batch counter, sale ledger. */
function applyPrintedPiece(state: FarmState, orderId: string): FarmState {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return toast(state, 'Order not found', undefined, 'error');
  if (order.printedQty >= order.quantity) {
    return toast(state, 'Batch already complete', `${order.partName} is fully printed.`, 'info');
  }
  if (!order.filaments.length) {
    return toast(state, 'No filament linked', `Assign a spool to ${order.partName} before printing.`, 'warn');
  }

  const nextPrinted = order.printedQty + 1;
  const completed = nextPrinted >= order.quantity;
  const spools = deductFromSpools(state.spools, order.filaments);
  const printers = state.printers.map((p) =>
    p.id === order.printerId ? { ...p, totalHours: round(p.totalHours + order.hoursPerUnit, 1) } : p,
  );
  const orders = state.orders.map((o) =>
    o.id !== order.id
      ? o
      : {
          ...o,
          printedQty: nextPrinted,
          status: (completed && o.status !== 'ready' ? 'post_processing' : o.status === 'quote_sent' || o.status === 'queued' ? 'printing' : o.status) as OrderStatus,
        },
  );

  let ledger = state.ledger;
  if (completed && !state.ledger.some((e) => e.orderId === order.id)) {
    const cost = order.costSnapshot?.totalCost ?? order.totalPrice * 0.55;
    ledger = [
      ...ledger,
      {
        id: uid('led'),
        date: new Date().toISOString(),
        label: `${order.partName} — ${order.clientName}`,
        orderId: order.id,
        revenue: round(order.totalPrice),
        cost: round(cost),
        profit: round(order.totalPrice - cost),
      },
    ];
  }

  let next: FarmState = { ...state, spools, printers, orders, ledger };
  next = toast(
    next,
    `Printed 1 × ${order.partName}`,
    `Deducted ${allocationSummary(state, order.filaments)}${completed ? ' · batch complete, revenue logged' : ''}`,
    'success',
  );
  return next;
}

function reducer(state: FarmState, action: FarmAction): FarmState {
  switch (action.type) {
    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'setTheme':
      return { ...state, theme: action.theme };

    case 'upsertPrinter': {
      const exists = state.printers.some((p) => p.id === action.printer.id);
      return {
        ...state,
        printers: exists ? state.printers.map((p) => (p.id === action.printer.id ? action.printer : p)) : [...state.printers, action.printer],
        toasts: [
          ...state.toasts.slice(-3),
          { id: uid('toast'), message: exists ? 'Printer updated' : 'Printer added', detail: action.printer.name, kind: 'success' },
        ],
      };
    }
    case 'deletePrinter':
      return toast(
        {
          ...state,
          printers: state.printers.filter((p) => p.id !== action.id),
          orders: state.orders.map((o) => (o.printerId === action.id ? { ...o, printerId: null } : o)),
        },
        'Printer removed',
        'Assigned orders were unassigned.',
        'info',
      );

    case 'setPrinterStatus': {
      const printers = state.printers.map((p) =>
        p.id === action.id
          ? {
              ...p,
              status: action.status,
              currentJob: action.status === 'printing' ? p.currentJob : null,
            }
          : p,
      );
      const printer = state.printers.find((p) => p.id === action.id);
      return toast({ ...state, printers }, 'Status updated', printer ? `${printer.name} → ${action.status.replace('_', ' ')}` : undefined, 'info');
    }

    case 'completePrinterJob': {
      const printer = state.printers.find((p) => p.id === action.id);
      if (!printer) return state;
      let next = state;
      if (printer.currentJob?.orderId) {
        const order = state.orders.find((o) => o.id === printer.currentJob?.orderId);
        if (order) next = applyPrintedPiece(next, order.id);
      }
      next = {
        ...next,
        printers: next.printers.map((p) => (p.id === action.id ? { ...p, status: 'idle', currentJob: null } : p)),
      };
      return toast(next, 'Print marked done', `${printer.name} is ready for the next job.`, 'success');
    }

    case 'addMaintenanceTask': {
      return {
        ...state,
        printers: state.printers.map((p) =>
          p.id === action.printerId ? { ...p, maintenanceTasks: [...p.maintenanceTasks, action.task] } : p,
        ),
      };
    }
    case 'updateMaintenanceTask': {
      return {
        ...state,
        printers: state.printers.map((p) =>
          p.id === action.printerId
            ? { ...p, maintenanceTasks: p.maintenanceTasks.map((t) => (t.id === action.task.id ? action.task : t)) }
            : p,
        ),
      };
    }
    case 'removeMaintenanceTask':
      return {
        ...state,
        printers: state.printers.map((p) =>
          p.id === action.printerId
            ? { ...p, maintenanceTasks: p.maintenanceTasks.filter((t) => t.id !== action.taskId) }
            : p,
        ),
      };
    case 'logMaintenance': {
      const printer = state.printers.find((p) => p.id === action.printerId);
      if (!printer) return state;
      const task = printer.maintenanceTasks.find((t) => t.id === action.taskId);
      if (!task) return state;
      const nowIso = new Date().toISOString();
      const log: MaintenanceLog = {
        id: uid('mnt'),
        printerId: printer.id,
        printerName: printer.name,
        taskLabel: task.label,
        hoursAt: round(printer.totalHours, 1),
        date: nowIso,
        notes: action.notes,
      };
      const printers = state.printers.map((p) =>
        p.id !== printer.id
          ? p
          : {
              ...p,
              maintenanceTasks: p.maintenanceTasks.map((t) =>
                t.id === task.id ? { ...t, lastDoneHours: round(p.totalHours, 1), lastDoneAt: nowIso } : t,
              ),
            },
      );
      return toast(
        { ...state, printers, maintenanceLogs: [log, ...state.maintenanceLogs] },
        'Service logged',
        `${printer.name} · ${task.label} reset at ${Math.round(printer.totalHours)}h.`,
        'success',
      );
    }

    case 'upsertSpool': {
      const exists = state.spools.some((s) => s.id === action.spool.id);
      return toast(
        {
          ...state,
          spools: exists ? state.spools.map((s) => (s.id === action.spool.id ? action.spool : s)) : [...state.spools, action.spool],
        },
        exists ? 'Spool updated' : 'Spool added',
        `${action.spool.brand} ${action.spool.material} ${action.spool.colorName}`,
        'success',
      );
    }
    case 'deleteSpool':
      return toast(
        {
          ...state,
          spools: state.spools.filter((s) => s.id !== action.id),
          printers: state.printers.map((p) => (p.loadedSpoolId === action.id ? { ...p, loadedSpoolId: null } : p)),
        },
        'Spool deleted',
        undefined,
        'info',
      );

    case 'adjustSpool': {
      const spool = state.spools.find((s) => s.id === action.id);
      if (!spool) return state;
      const remaining = Math.max(0, Math.min(spool.totalGrams, round(spool.remainingGrams + action.delta, 1)));
      const applied = round(remaining - spool.remainingGrams, 1);
      const spools = state.spools.map((s) => (s.id === action.id ? { ...s, remainingGrams: remaining } : s));
      return toast(
        { ...state, spools },
        `${applied >= 0 ? 'Added' : 'Deducted'} ${Math.abs(applied)}g`,
        `${spool.brand} ${spool.colorName} → ${remaining}g remaining${action.reason ? ` · ${action.reason}` : ''}`,
        applied >= 0 ? 'success' : 'info',
      );
    }

    case 'weighSpool': {
      const spool = state.spools.find((s) => s.id === action.id);
      if (!spool) return state;
      const net = Math.max(0, Math.min(spool.totalGrams, round(action.grossGrams - spool.tareWeightGrams, 1)));
      return toast(
        {
          ...state,
          spools: state.spools.map((s) => (s.id === action.id ? { ...s, remainingGrams: net } : s)),
        },
        'Spool weighed',
        `${spool.brand} ${spool.colorName}: ${net}g net (gross ${Math.round(action.grossGrams)}g − tare ${spool.tareWeightGrams}g).`,
        'success',
      );
    }

    case 'upsertHardware': {
      const exists = state.hardware.some((h) => h.id === action.item.id);
      return {
        ...state,
        hardware: exists ? state.hardware.map((h) => (h.id === action.item.id ? action.item : h)) : [...state.hardware, action.item],
        toasts: [
          ...state.toasts.slice(-3),
          { id: uid('toast'), message: exists ? 'Hardware updated' : 'Hardware added', detail: action.item.name, kind: 'success' },
        ],
      };
    }
    case 'deleteHardware':
      return { ...state, hardware: state.hardware.filter((h) => h.id !== action.id) };

    case 'adjustHardware': {
      const item = state.hardware.find((h) => h.id === action.id);
      if (!item) return state;
      const quantity = Math.max(0, round(item.quantity + action.delta, 0));
      return {
        ...state,
        hardware: state.hardware.map((h) => (h.id === action.id ? { ...h, quantity } : h)),
        toasts: [
          ...state.toasts.slice(-3),
          {
            id: uid('toast'),
            message: `${action.delta > 0 ? 'Stocked' : 'Used'} ${Math.abs(action.delta)} ${item.unit}`,
            detail: `${item.name} → ${quantity} in stock`,
            kind: action.delta > 0 ? 'success' : 'info',
          },
        ],
      };
    }

    case 'upsertOrder': {
      const exists = state.orders.some((o) => o.id === action.order.id);
      let printers = state.printers;
      if (action.order.status === 'printing' && action.order.printerId) {
        const startedAt = Date.now();
        printers = printers.map((p) =>
          p.id !== action.order.printerId
            ? p
            : {
                ...p,
                status: 'printing',
                currentJob:
                  p.currentJob?.orderId === action.order.id
                    ? p.currentJob
                    : {
                        name: action.order.partName,
                        orderId: action.order.id,
                        startedAt,
                        endsAt: startedAt + Math.max(0.1, action.order.hoursPerUnit) * 3600_000,
                        hours: action.order.hoursPerUnit,
                      },
              },
        );
      } else {
        printers = printers.map((p) =>
          p.currentJob?.orderId === action.order.id
            ? { ...p, currentJob: null, status: p.status === 'printing' ? 'idle' : p.status }
            : p,
        );
      }
      return toast(
        {
          ...state,
          printers,
          orders: exists ? state.orders.map((o) => (o.id === action.order.id ? action.order : o)) : [action.order, ...state.orders],
        },
        exists ? 'Order updated' : 'Order created',
        `${action.order.orderNumber} · ${action.order.partName}`,
        'success',
      );
    }
    case 'deleteOrder':
      return { ...state, orders: state.orders.filter((o) => o.id !== action.id) };

    case 'moveOrder': {
      const order = state.orders.find((o) => o.id === action.id);
      if (!order) return state;
      const orders = state.orders.map((o) => (o.id === action.id ? { ...o, status: action.status } : o));
      let printers = state.printers;
      if (action.status === 'printing' && order.printerId) {
        const startedAt = Date.now();
        printers = printers.map((p) =>
          p.id === order.printerId
            ? {
                ...p,
                status: 'printing',
                currentJob: {
                  name: order.partName,
                  orderId: order.id,
                  startedAt,
                  endsAt: startedAt + Math.max(0.1, order.hoursPerUnit) * 3600_000,
                  hours: order.hoursPerUnit,
                },
              }
            : p,
        );
      }
      if (action.status !== 'printing') {
        printers = printers.map((p) =>
          p.currentJob?.orderId === order.id ? { ...p, currentJob: null, status: p.status === 'printing' ? 'idle' : p.status } : p,
        );
      }
      return toast({ ...state, orders, printers }, 'Order moved', `${order.partName} → ${action.status.replace('_', ' ')}`, 'info');
    }

    case 'setPayment': {
      const order = state.orders.find((o) => o.id === action.id);
      return toast(
        { ...state, orders: state.orders.map((o) => (o.id === action.id ? { ...o, paymentStatus: action.paymentStatus } : o)) },
        'Payment updated',
        order ? `${order.partName} marked ${action.paymentStatus}.` : undefined,
        action.paymentStatus === 'paid' ? 'success' : 'info',
      );
    }

    case 'printPiece':
      return applyPrintedPiece(state, action.id);

    case 'upsertPreset': {
      const exists = state.presets.some((p) => p.id === action.preset.id);
      return toast(
        {
          ...state,
          presets: exists ? state.presets.map((p) => (p.id === action.preset.id ? action.preset : p)) : [...state.presets, action.preset],
        },
        exists ? 'Preset updated' : 'Preset saved',
        action.preset.name,
        'success',
      );
    }
    case 'deletePreset':
      return { ...state, presets: state.presets.filter((p) => p.id !== action.id) };

    case 'loadDemo':
      return toast({ ...buildDemoState(), theme: state.theme }, 'Demo farm loaded', '3 printers · 6 spools · 4 orders · 2 presets', 'success');

    case 'clearAll':
      return toast(buildEmptyState(state.settings), 'All data cleared', 'Farm reset to a blank slate.', 'info');

    case 'importState': {
      try {
        const imported = validateImportedState(action.payload);
        return toast(
          {
            ...imported,
            theme: imported.theme ?? state.theme,
            settings: { ...DEFAULT_SETTINGS, ...imported.settings },
          },
          'Backup imported',
          `${imported.printers.length} printers · ${imported.spools.length} spools · ${imported.orders.length} orders`,
          'success',
        );
      } catch (err) {
        return toast(state, 'Import rejected', err instanceof Error ? err.message : 'Unknown file format.', 'error');
      }
    }

    case 'toast':
      return toast(state, action.message, action.detail, action.kind);

    case 'dismissToast':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };

    default:
      return state;
  }
}

function mergeStoredState(raw: unknown): FarmState | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<FarmState>;
  if (!Array.isArray(data.printers) || !Array.isArray(data.spools) || !Array.isArray(data.orders)) return null;
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
    theme: data.theme === 'light' ? 'light' : 'dark',
    printers: data.printers as Printer[],
    spools: data.spools as FilamentSpool[],
    hardware: Array.isArray(data.hardware) ? (data.hardware as HardwareItem[]) : [],
    orders: data.orders as PrintOrder[],
    presets: Array.isArray(data.presets) ? (data.presets as ProductPreset[]) : [],
    maintenanceLogs: Array.isArray(data.maintenanceLogs) ? (data.maintenanceLogs as MaintenanceLog[]) : [],
    ledger: Array.isArray(data.ledger) ? (data.ledger as FarmState['ledger']) : [],
    toasts: [],
  };
}

function loadInitialState(): FarmState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const merged = mergeStoredState(JSON.parse(raw));
      if (merged) return merged;
    }
  } catch {
    /* corrupted storage — fall through to a clean farm */
  }
  return buildEmptyState(BLANK_SETTINGS);
}

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);
  const quotaWarned = useRef(false);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        const payload = JSON.stringify({ ...state, toasts: [] });
        localStorage.setItem(STORAGE_KEY, payload);
        quotaWarned.current = false;
      } catch (err) {
        console.warn('[PrintFarm OS] Unable to persist state (storage quota?)', err);
        if (!quotaWarned.current) {
          quotaWarned.current = true;
          dispatch({
            type: 'toast',
            kind: 'warn',
            message: 'Local storage is full',
            detail: 'Export a JSON backup, then remove old orders or spools to free space.',
          });
        }
      }
    }, 350);
    return () => window.clearTimeout(handle);
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', state.theme === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.theme === 'dark' ? '#09090B' : '#F4F4F5');
  }, [state.theme]);

  useEffect(() => {
    document.documentElement.lang = state.settings.language === 'cs' ? 'cs' : 'en';
  }, [state.settings.language]);

  const money = useCallback(
    (value: number, digits = 2) => formatMoney(value, state.settings.currency, digits),
    [state.settings.currency],
  );

  const value = useMemo(() => ({ state, dispatch, money }), [state, money]);

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm(): FarmContextValue {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error('useFarm must be used inside a FarmProvider');
  return ctx;
}

export { STORAGE_KEY };
