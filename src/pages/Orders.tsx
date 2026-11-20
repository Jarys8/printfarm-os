import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  CircleDollarSign,
  Download,
  GripVertical,
  Pencil,
  Plus,
  Printer as PrinterIcon,
  ReceiptText,
  Trash2,
  Zap,
} from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { useT } from '../hooks/useT';
import type { OrderStatus, PaymentStatus, PrintOrder } from '../types/farm';
import type { QuoteDocData } from '../components/QuoteDocument';
import { computeQuote } from '../utils/calculations';
import {
  ORDER_STATUS_META,
  ORDER_STATUS_ORDER,
  PAYMENT_META,
  addDays,
  downloadFile,
  formatDateShort,
  machineDepreciation,
  percent,
  toDateInput,
} from '../utils/format';
import { nextOrderNumber } from '../utils/orders';
import { ordersToCsv } from '../utils/exporters';
import { docFromOrder, QuoteDocumentModal } from '../components/QuoteDocument';
import { Badge, Button, Card, EmptyState, Field, Modal, Progress, cn } from '../components/ui';

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const COLUMN_ACCENT: Record<OrderStatus, string> = {
  quote_sent: 'bg-zinc-400',
  queued: 'bg-amber-500',
  printing: 'bg-cyan-500',
  post_processing: 'bg-violet-500',
  ready: 'bg-emerald-500',
};

const PAYMENT_CYCLE: PaymentStatus[] = ['unpaid', 'deposit', 'paid'];

interface OrderDraft {
  clientName: string;
  clientContact: string;
  partName: string;
  quantity: number;
  dueDate: string;
  printerId: string;
  spoolId: string;
  gramsPerUnit: number;
  hoursPerUnit: number;
  layerHeight: number;
  infill: number;
  nozzle: number;
  unitPrice: number;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  rush: boolean;
  volumeDiscountPct: number;
  notes: string;
}

const num = (v: string): number => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

function draftFromOrder(order: PrintOrder): OrderDraft {
  return {
    clientName: order.clientName,
    clientContact: order.clientContact,
    partName: order.partName,
    quantity: order.quantity,
    dueDate: toDateInput(order.dueDate),
    printerId: order.printerId ?? '',
    spoolId: order.filaments[0]?.spoolId ?? '',
    gramsPerUnit: order.filaments[0]?.grams ?? 0,
    hoursPerUnit: order.hoursPerUnit,
    layerHeight: order.slicer.layerHeight,
    infill: order.slicer.infill,
    nozzle: order.slicer.nozzle,
    unitPrice: order.unitPrice,
    paymentStatus: order.paymentStatus,
    status: order.status,
    rush: order.rush,
    volumeDiscountPct: order.volumeDiscountPct,
    notes: order.notes ?? '',
  };
}

export function Orders({ openNewNonce = 0 }: { openNewNonce?: number }) {
  const { state, dispatch, money } = useFarm();
  const t = useT();
  const [dragId, setDragId] = useState<string | null>(null);
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [editing, setEditing] = useState<PrintOrder | null>(null);
  const [invoice, setInvoice] = useState<QuoteDocData | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  useEffect(() => {
    if (openNewNonce > 0) openNewOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNewNonce]);

  const printerName = (id: string | null) => state.printers.find((p) => p.id === id)?.name ?? t('Unassigned');

  function openNewOrder() {
    const now = new Date();
    setEditing(null);
    setDraft({
      clientName: '',
      clientContact: '',
      partName: '',
      quantity: 1,
      dueDate: toDateInput(addDays(now, 7).toISOString()),
      printerId: state.printers[0]?.id ?? '',
      spoolId: state.spools[0]?.id ?? '',
      gramsPerUnit: 80,
      hoursPerUnit: 2,
      layerHeight: 0.2,
      infill: 15,
      nozzle: 0.4,
      unitPrice: 0,
      paymentStatus: 'unpaid',
      status: 'queued',
      rush: false,
      volumeDiscountPct: 0,
      notes: '',
    });
  }

  function openEdit(order: PrintOrder) {
    setEditing(order);
    setDraft(draftFromOrder(order));
  }

  const saveOrder = () => {
    if (!draft) return;
    const spool = state.spools.find((s) => s.id === draft.spoolId);
    const printer = state.printers.find((p) => p.id === draft.printerId);
    const quantity = Math.max(1, Math.floor(draft.quantity) || 1);
    const unitPrice = Math.max(0, draft.unitPrice);
    const net = unitPrice * quantity * (1 - Math.max(0, Math.min(100, draft.volumeDiscountPct)) / 100);
    const totalPrice = net * (1 + state.settings.taxRate / 100);
    const costCalc = computeQuote({
      quantity,
      printTimeHours: draft.hoursPerUnit,
      filaments: [{ spoolId: draft.spoolId, label: spool?.colorName ?? 'Material', grams: draft.gramsPerUnit, costPerKg: spool?.costPerKg ?? 0 }],
      wastePct: state.settings.failureBuffer,
      printer: printer ? { powerDrawW: printer.powerDrawW, depreciationPerHour: machineDepreciation(printer) } : null,
      electricityRate: state.settings.electricityRate,
      laborMinutes: editing?.laborMinutes ?? 10,
      laborRate: state.settings.laborRate,
      hardwareCost: 0,
      markupPct: 0,
      pricingMode: 'markup',
      rush: false,
      taxRate: 0,
      volumeDiscountPct: 0,
    });

    const order: PrintOrder = {
      id: editing?.id ?? uid('order'),
      orderNumber: editing?.orderNumber ?? nextOrderNumber(state.orders),
      clientName: draft.clientName.trim() || 'Walk-in client',
      clientContact: draft.clientContact.trim(),
      partName: draft.partName.trim() || 'Untitled part',
      quantity,
      printedQty: Math.min(editing?.printedQty ?? 0, quantity),
      status: draft.status,
      dueDate: draft.dueDate ? new Date(`${draft.dueDate}T12:00:00`).toISOString() : new Date().toISOString(),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      printerId: draft.printerId || null,
      filaments: draft.spoolId ? [{ spoolId: draft.spoolId, grams: Math.max(0, draft.gramsPerUnit) }] : [],
      slicer: {
        layerHeight: draft.layerHeight,
        infill: draft.infill,
        nozzle: draft.nozzle,
        material: spool?.material ?? editing?.slicer.material ?? 'PLA',
      },
      unitPrice,
      totalPrice,
      paymentStatus: draft.paymentStatus,
      rush: draft.rush,
      volumeDiscountPct: draft.volumeDiscountPct,
      hoursPerUnit: Math.max(0.05, draft.hoursPerUnit),
      laborMinutes: editing?.laborMinutes ?? 10,
      notes: draft.notes.trim(),
      costSnapshot: {
        unitCost: costCalc.unitCost,
        totalCost: costCalc.totalCost,
        profit: net - costCalc.totalCost,
        margin: net > 0 ? ((net - costCalc.totalCost) / net) * 100 : 0,
      },
    };
    dispatch({ type: 'upsertOrder', order });
    setDraft(null);
    setEditing(null);
  };

  const move = (order: PrintOrder, direction: -1 | 1) => {
    const index = ORDER_STATUS_ORDER.indexOf(order.status);
    const next = ORDER_STATUS_ORDER[index + direction];
    if (!next) return;
    dispatch({ type: 'moveOrder', id: order.id, status: next });
  };

  const cyclePayment = (order: PrintOrder) => {
    const index = PAYMENT_CYCLE.indexOf(order.paymentStatus);
    const next = PAYMENT_CYCLE[(index + 1) % PAYMENT_CYCLE.length];
    dispatch({ type: 'setPayment', id: order.id, paymentStatus: next });
  };

  const openInvoice = (order: PrintOrder) => {
    setInvoice(docFromOrder(order, state.settings, printerName(order.printerId)));
    setInvoiceOpen(true);
  };

  const stats = useMemo(() => {
    const open = state.orders.filter((o) => o.status !== 'ready');
    const value = open.reduce((s, o) => s + o.totalPrice, 0);
    const dueSoon = open.filter((o) => {
      const hours = (new Date(o.dueDate).getTime() - Date.now()) / 3600_000;
      return hours <= 48;
    }).length;
    const printedPieces = state.orders.reduce((s, o) => s + o.printedQty, 0);
    return { open: open.length, value, dueSoon, printedPieces };
  }, [state.orders]);

  const sortedOrders = useMemo(
    () =>
      [...state.orders].sort((a, b) => {
        if (a.rush !== b.rush) return a.rush ? -1 : 1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }),
    [state.orders],
  );

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="info">{t('{n} open', { n: stats.open })}</Badge>
          <Badge tone="maker">{money(stats.value, 0)} {t('pipeline')}</Badge>
          <Badge tone={stats.dueSoon ? 'warn' : 'ok'}>{t('{n} due ≤48h', { n: stats.dueSoon })}</Badge>
          <Badge tone="muted">{t('{n} pcs printed', { n: stats.printedPieces })}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              downloadFile(
                `printfarm-orders-${new Date().toISOString().slice(0, 10)}.csv`,
                ordersToCsv(state.orders, printerName),
                'text/csv;charset=utf-8',
              )
            }
          >
            <Download size={14} /> {t('CSV')}
          </Button>
          <Button variant="primary" size="sm" onClick={openNewOrder}>
            <Plus size={14} /> {t('New order')}
          </Button>
        </div>
      </div>

      {state.orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={18} />}
          title={t('No production orders')}
          body={t('Convert a quote or add a manual order to start filling the pipeline.')}
          action={<Button onClick={openNewOrder}>{t('Create first order')}</Button>}
        />
      ) : (
        <>
          {/* Desktop Kanban */}
          <div className="hidden gap-2.5 md:grid md:grid-cols-5">
            {ORDER_STATUS_ORDER.map((status) => {
              const columnOrders = sortedOrders.filter((o) => o.status === status);
              const columnValue = columnOrders.reduce((s, o) => s + o.totalPrice, 0);
              return (
                <div
                  key={status}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('text/plain') || dragId;
                    if (id) dispatch({ type: 'moveOrder', id, status });
                    setDragId(null);
                  }}
                  className="flex min-h-[420px] flex-col rounded-xl border border-line bg-panel/40"
                >
                  <div className="flex items-center justify-between gap-1 border-b border-line px-2.5 py-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', COLUMN_ACCENT[status])} />
                      <span className="truncate text-[11px] font-semibold text-ink">{t(ORDER_STATUS_META[status].label)}</span>
                      <span className="font-mono text-[10px] text-muted">{columnOrders.length}</span>
                    </div>
                    <span className="flex-shrink-0 font-mono text-[9px] text-muted">{money(columnValue, 0)}</span>
                  </div>
                  <div className="flex-1 space-y-2 p-1.5">
                    {columnOrders.length === 0 && (
                      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-line/70 text-[10px] text-muted">
                        {t('Drop orders here')}
                      </div>
                    )}
                    {columnOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        money={money}
                        printerLabel={printerName(order.printerId)}
                        spools={state.spools}
                        dragging={dragId === order.id}
                        onDragStart={() => setDragId(order.id)}
                        onDragEnd={() => setDragId(null)}
                        onMoveLeft={() => move(order, -1)}
                        onMoveRight={() => move(order, 1)}
                        onEdit={() => openEdit(order)}
                        onInvoice={() => openInvoice(order)}
                        onPrintPiece={() => dispatch({ type: 'printPiece', id: order.id })}
                        onCyclePayment={() => cyclePayment(order)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile pipeline list */}
          <div className="space-y-3 md:hidden">
            {ORDER_STATUS_ORDER.map((status) => {
              const columnOrders = sortedOrders.filter((o) => o.status === status);
              if (!columnOrders.length) return null;
              return (
                <div key={status}>
                  <div className="mb-1.5 flex items-center justify-between px-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('h-1.5 w-1.5 rounded-full', COLUMN_ACCENT[status])} />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                        {t(ORDER_STATUS_META[status].label)}
                      </span>
                      <span className="font-mono text-[10px] text-muted">{columnOrders.length}</span>
                    </div>
                    <span className="font-mono text-[10px] text-muted">
                      {money(columnOrders.reduce((s, o) => s + o.totalPrice, 0), 0)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {columnOrders.map((order) => (
                      <MobileOrderRow
                        key={order.id}
                        order={order}
                        money={money}
                        printerLabel={printerName(order.printerId)}
                        due={formatDateShort(order.dueDate)}
                        onOpen={() => openEdit(order)}
                        onPrintPiece={() => dispatch({ type: 'printPiece', id: order.id })}
                        onCyclePayment={() => cyclePayment(order)}
                        onInvoice={() => openInvoice(order)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Order editor */}
      <Modal
        open={!!draft}
        onClose={() => {
          setDraft(null);
          setEditing(null);
        }}
        title={editing ? t('Edit {number}', { number: editing.orderNumber }) : t('New production order')}
        subtitle={editing ? editing.partName : t('Batch tracked through the pipeline with inventory sync.')}
        size="lg"
        footer={
          <div className="flex items-center justify-between">
            {editing ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (window.confirm(t('Delete order {number}? This cannot be undone.', { number: editing.orderNumber }))) {
                    dispatch({ type: 'deleteOrder', id: editing.id });
                    setDraft(null);
                    setEditing(null);
                  }
                }}
              >
                <Trash2 size={14} /> {t('Delete')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(null);
                  setEditing(null);
                }}
              >
                {t('Cancel')}
              </Button>
              <Button variant="primary" size="sm" onClick={saveOrder}>
                {editing ? t('Save order') : t('Create order')}
              </Button>
            </div>
          </div>
        }
      >
        {draft && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label={t('Client name')}>
              <input className="field" value={draft.clientName} onChange={(e) => setDraft({ ...draft, clientName: e.target.value })} placeholder="Northline Studio" />
            </Field>
            <Field label={t('Contact')}>
              <input className="field" value={draft.clientContact} onChange={(e) => setDraft({ ...draft, clientContact: e.target.value })} placeholder="email / phone" />
            </Field>
            <Field label={t('Part name')} className="sm:col-span-2">
              <input className="field" value={draft.partName} onChange={(e) => setDraft({ ...draft, partName: e.target.value })} placeholder="Articulated Dragon Batch" />
            </Field>
            <Field label={t('Quantity (pcs)')}>
              <input
                type="number"
                min={1}
                className="field font-mono tabular-nums"
                value={draft.quantity}
                onChange={(e) => setDraft({ ...draft, quantity: Math.max(1, Math.floor(num(e.target.value)) || 1) })}
              />
            </Field>
            <Field label={t('Due date')}>
              <input
                type="date"
                className="field font-mono"
                value={draft.dueDate}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
              />
            </Field>
            <Field label={t('Printer')}>
              <select className="field" value={draft.printerId} onChange={(e) => setDraft({ ...draft, printerId: e.target.value })}>
                <option value="">{t('Unassigned')}</option>
                {state.printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('Filament spool')}>
              <select className="field" value={draft.spoolId} onChange={(e) => setDraft({ ...draft, spoolId: e.target.value })}>
                <option value="">{t('No spool linked')}</option>
                {state.spools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.brand} {s.material} · {s.colorName} · {s.remainingGrams}g
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('Grams per piece')}>
              <input
                type="number"
                min={0}
                className="field font-mono tabular-nums"
                value={draft.gramsPerUnit}
                onChange={(e) => setDraft({ ...draft, gramsPerUnit: Math.max(0, num(e.target.value)) })}
              />
            </Field>
            <Field label={t('Print hours per piece')}>
              <input
                type="number"
                min={0.05}
                step={0.05}
                className="field font-mono tabular-nums"
                value={draft.hoursPerUnit}
                onChange={(e) => setDraft({ ...draft, hoursPerUnit: Math.max(0.05, num(e.target.value)) })}
              />
            </Field>
            <Field label={t('Unit price (ex tax)')}>
              <input
                type="number"
                min={0}
                step={0.5}
                className="field font-mono tabular-nums"
                value={draft.unitPrice}
                onChange={(e) => setDraft({ ...draft, unitPrice: Math.max(0, num(e.target.value)) })}
              />
            </Field>
            <Field label={t('Volume discount %')}>
              <input
                type="number"
                min={0}
                max={100}
                className="field font-mono tabular-nums"
                value={draft.volumeDiscountPct}
                onChange={(e) => setDraft({ ...draft, volumeDiscountPct: Math.max(0, Math.min(100, num(e.target.value))) })}
              />
            </Field>
            <Field label={t('Pipeline status')}>
              <select className="field" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as OrderStatus })}>
                {ORDER_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {t(ORDER_STATUS_META[s].label)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('Payment')}>
              <select
                className="field"
                value={draft.paymentStatus}
                onChange={(e) => setDraft({ ...draft, paymentStatus: e.target.value as PaymentStatus })}
              >
                <option value="unpaid">{t('Unpaid')}</option>
                <option value="deposit">{t('Deposit paid')}</option>
                <option value="paid">{t('Paid')}</option>
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
              <Field label={t('Layer (mm)')}>
                <input
                  type="number"
                  step={0.02}
                  min={0.05}
                  className="field font-mono tabular-nums"
                  value={draft.layerHeight}
                  onChange={(e) => setDraft({ ...draft, layerHeight: num(e.target.value) })}
                />
              </Field>
              <Field label={t('Infill %')}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="field font-mono tabular-nums"
                  value={draft.infill}
                  onChange={(e) => setDraft({ ...draft, infill: num(e.target.value) })}
                />
              </Field>
              <Field label={t('Nozzle (mm)')}>
                <input
                  type="number"
                  step={0.1}
                  min={0.1}
                  className="field font-mono tabular-nums"
                  value={draft.nozzle}
                  onChange={(e) => setDraft({ ...draft, nozzle: num(e.target.value) })}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-line bg-raised px-3 py-2 text-xs text-ink sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.rush}
                onChange={(e) => setDraft({ ...draft, rush: e.target.checked })}
                className="h-4 w-4 accent-orange-500"
              />
              <Zap size={13} className="text-amber-500" /> {t('Rush priority — front of queue')}
            </label>
            <Field label={t('Job notes')} className="sm:col-span-2">
              <textarea
                className="field min-h-[60px] font-sans"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Packing, inspection, colour notes…"
              />
            </Field>
            <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-line bg-raised/60 px-3 py-2">
              <span className="text-[11px] text-muted">{t('Order total incl. {tax}% tax', { tax: state.settings.taxRate })}</span>
              <span className="font-mono text-sm font-semibold tabular text-ink">
                {money(draft.unitPrice * draft.quantity * (1 - draft.volumeDiscountPct / 100) * (1 + state.settings.taxRate / 100))}
              </span>
            </div>
          </div>
        )}
      </Modal>

      <QuoteDocumentModal
        open={invoiceOpen}
        doc={invoice}
        settings={state.settings}
        currency={state.settings.currency}
        onClose={() => setInvoiceOpen(false)}
      />
    </div>
  );
}

interface CardProps {
  order: PrintOrder;
  money: (v: number, digits?: number) => string;
  printerLabel: string;
  spools: ReturnType<typeof useFarm>['state']['spools'];
  dragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onEdit: () => void;
  onInvoice: () => void;
  onPrintPiece: () => void;
  onCyclePayment: () => void;
}

function FilamentDots({ order, spools }: { order: PrintOrder; spools: CardProps['spools'] }) {
  const t = useT();
  if (!order.filaments.length) return <span className="text-[10px] text-muted">{t('No filament linked')}</span>;
  return (
    <span className="flex items-center gap-1">
      {order.filaments.slice(0, 3).map((f) => {
        const spool = spools.find((s) => s.id === f.spoolId);
        return (
          <span key={f.spoolId} className="flex items-center gap-1" title={`${spool?.brand ?? 'Spool'} ${spool?.colorName ?? ''} · ${f.grams}g/pc`}>
            <span
              className="h-2.5 w-2.5 rounded-full border border-white/20"
              style={{ background: spool?.colorHex ?? '#71717A' }}
            />
            <span className="font-mono text-[9px] text-muted">{spool?.material ?? '—'}</span>
          </span>
        );
      })}
    </span>
  );
}

function OrderCard({
  order,
  money,
  printerLabel,
  spools,
  dragging,
  onDragStart,
  onDragEnd,
  onMoveLeft,
  onMoveRight,
  onEdit,
  onInvoice,
  onPrintPiece,
  onCyclePayment,
}: CardProps) {
  const t = useT();
  const pct = percent(order.printedQty, order.quantity);
  const due = new Date(order.dueDate);
  const hours = (due.getTime() - Date.now()) / 3600_000;
  const dueTone = order.status === 'ready' ? 'ok' : hours < 0 ? 'bad' : hours < 48 ? 'warn' : 'muted';
  const payment = PAYMENT_META[order.paymentStatus];
  const index = ORDER_STATUS_ORDER.indexOf(order.status);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', order.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'group cursor-grab rounded-lg border border-line bg-panel p-2.5 transition-all active:cursor-grabbing',
        dragging ? 'opacity-50 ring-1 ring-maker' : 'hover:border-zinc-500/50',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1">
          <GripVertical size={11} className="flex-shrink-0 text-muted/50" />
          <span className="font-mono text-[9px] text-muted">{order.orderNumber}</span>
          {order.rush && <Zap size={10} className="flex-shrink-0 text-amber-500" />}
        </div>
        <button
          type="button"
          onClick={onCyclePayment}
          title={t('Cycle payment status')}
          className="flex-shrink-0"
        >
          <Badge tone={payment.tone}>{t(payment.label)}</Badge>
        </button>
      </div>

      <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug text-ink">{order.partName}</p>
      <p className="mt-0.5 truncate text-[10px] text-muted">{order.clientName}</p>
      {order.clientContact && <p className="truncate font-mono text-[9px] text-muted/80">{order.clientContact}</p>}

      <div className="mt-1.5 flex items-center justify-between gap-1">
        <span className="flex min-w-0 items-center gap-1 truncate text-[9px] text-muted">
          <CalendarDays size={10} className="flex-shrink-0" />
          {due.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
        </span>
        <Badge tone={dueTone}>
          {order.status === 'ready'
            ? t('ready')
            : hours < 0
              ? t('{n}d late', { n: Math.ceil(-hours / 24) })
              : t('{n}d', { n: Math.max(1, Math.round(hours / 24)) })}
        </Badge>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-1">
        <span className="flex min-w-0 items-center gap-1 truncate text-[9px] text-muted">
          <PrinterIcon size={10} className="flex-shrink-0" />
          <span className="truncate">{printerLabel}</span>
        </span>
        <FilamentDots order={order} spools={spools} />
      </div>

      <p className="mt-1 font-mono text-[9px] text-muted">
        {order.slicer.layerHeight.toFixed(2)} mm · {order.slicer.infill}% · {order.slicer.nozzle} mm
      </p>

      <div className="mt-2">
        <div className="flex items-center justify-between font-mono text-[9px]">
          <span className="text-muted">
            {t('{printed}/{qty} pcs', { printed: order.printedQty, qty: order.quantity })}
          </span>
          <span className="text-muted">{Math.round(pct)}%</span>
        </div>
        <Progress value={pct} tone={pct >= 100 ? 'ok' : 'maker'} height={3} className="mt-1" />
      </div>

      <div className="mt-2 flex items-center justify-between gap-1">
        <span className="font-mono text-[11px] font-semibold tabular text-ink">{money(order.totalPrice, 0)}</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onPrintPiece}
            disabled={order.printedQty >= order.quantity}
            title={t('Log one printed piece and deduct filament')}
            className="flex h-6 items-center gap-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-1 font-mono text-[9px] font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-30 dark:text-emerald-400"
          >
            <Plus size={9} />1
          </button>
          <button
            type="button"
            onClick={onMoveLeft}
            disabled={index <= 0}
            aria-label={t('Move order back')}
            className="flex h-6 w-6 items-center justify-center rounded text-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-30"
          >
            <ArrowLeft size={11} />
          </button>
          <button
            type="button"
            onClick={onMoveRight}
            disabled={index >= ORDER_STATUS_ORDER.length - 1}
            aria-label={t('Move order forward')}
            className="flex h-6 w-6 items-center justify-center rounded text-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-30"
          >
            <ArrowRight size={11} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={t('Edit order')}
            className="flex h-6 w-6 items-center justify-center rounded text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <Pencil size={11} />
          </button>
          <button
            type="button"
            onClick={onInvoice}
            aria-label={t('Open invoice')}
            className="flex h-6 w-6 items-center justify-center rounded text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <ReceiptText size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileOrderRow({
  order,
  money,
  printerLabel,
  due,
  onOpen,
  onPrintPiece,
  onCyclePayment,
  onInvoice,
}: {
  order: PrintOrder;
  money: (v: number, digits?: number) => string;
  printerLabel: string;
  due: string;
  onOpen: () => void;
  onPrintPiece: () => void;
  onCyclePayment: () => void;
  onInvoice: () => void;
}) {
  const t = useT();
  const payment = PAYMENT_META[order.paymentStatus];
  const pct = percent(order.printedQty, order.quantity);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
      }}
      className="rounded-lg border border-line bg-panel p-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-mono text-[9px] text-muted">{order.orderNumber}</span>
            {order.rush && <Zap size={10} className="text-amber-500" />}
          </div>
          <p className="truncate text-[12px] font-semibold text-ink">{order.partName}</p>
          <p className="truncate text-[10px] text-muted">
            {order.clientName} · {printerLabel}
          </p>
          {order.clientContact && <p className="truncate font-mono text-[9px] text-muted/80">{order.clientContact}</p>}
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-[12px] font-semibold tabular text-ink">{money(order.totalPrice, 0)}</span>
          <Badge tone={payment.tone}>{t(payment.label)}</Badge>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Progress value={pct} tone={pct >= 100 ? 'ok' : 'maker'} height={4} className="flex-1" />
        <span className="flex-shrink-0 font-mono text-[10px] text-muted">
          {order.printedQty}/{order.quantity}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[10px] text-muted">
          <CalendarDays size={10} /> {due}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onCyclePayment();
            }}
          >
            <CircleDollarSign size={13} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onInvoice();
            }}
          >
            <ReceiptText size={13} />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              onPrintPiece();
            }}
            disabled={order.printedQty >= order.quantity}
          >
            <Check size={12} /> {t('+1 printed')}
          </Button>
        </div>
      </div>
    </div>
  );
}
