import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Calculator as CalculatorIcon,
  Clock,
  FileCode2,
  Loader2,
  PackagePlus,
  Percent,
  Plus,
  Printer as PrinterIcon,
  ReceiptText,
  RotateCcw,
  Save,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  Wrench,
  Zap,
} from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { useT } from '../hooks/useT';
import type { PrintOrder, ProductPreset } from '../types/farm';
import { buildCostSegments, computeQuote } from '../utils/calculations';
import { formatDuration, formatGrams, formatNumber, machineDepreciation } from '../utils/format';
import { normalizeMaterial, parseSlicerFile, type ParsedSlicerFile } from '../utils/gcodeParser';
import { nextOrderNumber } from '../utils/orders';
import { uid, addDays } from '../utils/format';
import { QuoteDocumentModal, type QuoteDocData } from '../components/QuoteDocument';
import { Badge, Button, Card, Field, Segmented, Toggle, cn } from '../components/ui';

interface FilamentRow {
  key: string;
  spoolId: string;
  grams: number;
  customCost: number;
}

interface QuoteForm {
  partName: string;
  clientName: string;
  clientContact: string;
  quantity: number;
  printHours: number;
  multi: boolean;
  filaments: FilamentRow[];
  wastePct: number;
  printerId: string;
  electricityRate: number;
  laborMinutes: number;
  laborRate: number;
  hardwareCost: number;
  hardwareNote: string;
  markupPct: number;
  pricingMode: 'markup' | 'margin';
  rush: boolean;
  taxRate: number;
  volumeDiscountPct: number;
  layerHeight: number;
  infill: number;
  nozzle: number;
  material: string;
  notes: string;
  dueDays: number;
}

const num = (v: string): number => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

function Section({
  title,
  hint,
  icon,
  action,
  children,
}: {
  title: string;
  hint?: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-3.5 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-line bg-raised text-maker">
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-ink">{title}</h3>
            {hint && <p className="truncate text-[10px] text-muted">{hint}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function Calculator({ onOrderCreated }: { onOrderCreated: () => void }) {
  const { state, dispatch, money } = useFarm();
  const t = useT();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const defaultSpool = state.spools[0];
  const [form, setForm] = useState<QuoteForm>(() => ({
    partName: '',
    clientName: '',
    clientContact: '',
    quantity: 1,
    printHours: 2,
    multi: false,
    filaments: [
      {
        key: uid('line'),
        spoolId: defaultSpool?.id ?? '',
        grams: 80,
        customCost: 25,
      },
    ],
    wastePct: state.settings.failureBuffer,
    printerId: state.printers[0]?.id ?? '',
    electricityRate: state.settings.electricityRate,
    laborMinutes: 10,
    laborRate: state.settings.laborRate,
    hardwareCost: 0,
    hardwareNote: '',
    markupPct: state.settings.defaultMarkup,
    pricingMode: 'markup',
    rush: false,
    taxRate: state.settings.taxRate,
    volumeDiscountPct: 0,
    layerHeight: 0.2,
    infill: 15,
    nozzle: 0.4,
    material: defaultSpool?.material ?? 'PLA',
    notes: '',
    dueDays: 7,
  }));
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedSlicerFile | null>(null);
  const [docData, setDocData] = useState<QuoteDocData | null>(null);
  const [docOpen, setDocOpen] = useState(false);

  const set = <K extends keyof QuoteForm>(key: K, value: QuoteForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const spoolFor = (row: FilamentRow) => state.spools.find((s) => s.id === row.spoolId) ?? null;

  const activeFilaments = form.multi ? form.filaments : form.filaments.slice(0, 1);

  const printer = state.printers.find((p) => p.id === form.printerId) ?? null;

  const quote = useMemo(
    () =>
      computeQuote({
        quantity: form.quantity,
        printTimeHours: form.printHours,
        filaments: activeFilaments.map((row) => {
          const spool = state.spools.find((s) => s.id === row.spoolId);
          return {
            spoolId: row.spoolId || null,
            label: spool ? `${spool.brand} ${spool.material} ${spool.colorName}` : 'Custom filament',
            grams: row.grams,
            costPerKg: spool ? spool.costPerKg : row.customCost,
          };
        }),
        wastePct: form.wastePct,
        printer: printer
          ? {
              powerDrawW: printer.powerDrawW,
              depreciationPerHour: machineDepreciation(printer),
              name: printer.name,
            }
          : null,
        electricityRate: form.electricityRate,
        laborMinutes: form.laborMinutes,
        laborRate: form.laborRate,
        hardwareCost: form.hardwareCost,
        markupPct: form.markupPct,
        pricingMode: form.pricingMode,
        rush: form.rush,
        taxRate: form.taxRate,
        volumeDiscountPct: form.volumeDiscountPct,
      }),
    [form, activeFilaments, printer, state.spools],
  );

  const segments = useMemo(() => {
    const costs = buildCostSegments(quote);
    const profit = Math.max(0, quote.unitPrice - quote.unitCost);
    return [...costs, { key: 'profit', label: 'Profit', value: profit, color: '#10B981' }].filter((s) => s.value > 0);
  }, [quote]);
  const segmentTotal = segments.reduce((sum, s) => sum + s.value, 0);

  const materialSummary = activeFilaments
    .map((row) => {
      const spool = spoolFor(row);
      return spool ? `${spool.brand} ${spool.material} ${spool.colorName}` : `Custom ${form.material}`;
    })
    .join(' + ');

  const lowStockLines = activeFilaments
    .map((row) => {
      const spool = spoolFor(row);
      if (!spool) return null;
      const needed = row.grams * Math.max(1, quote.quantity);
      return spool.remainingGrams < needed ? { spool, needed } : null;
    })
    .filter((v): v is { spool: NonNullable<ReturnType<typeof spoolFor>>; needed: number } => v !== null);

  const handleParsed = useCallback(
    (data: ParsedSlicerFile) => {
      const gramsList = data.filamentGrams && data.filamentGrams.length > 1 ? data.filamentGrams : [data.grams];
      setForm((f) => {
        const existing = f.filaments;
        const rows: FilamentRow[] = gramsList.map((grams, i) => {
          const baseLine = existing[i] ?? existing[0];
          const candidate =
            state.spools.find(
              (s) => s.id === baseLine?.spoolId && s.material === normalizeMaterial(data.material),
            ) ??
            state.spools.find((s) => s.material === normalizeMaterial(data.material)) ??
            state.spools[0];
          return {
            key: uid('line'),
            spoolId: candidate?.id ?? '',
            grams: Math.max(0, Math.round(grams * 10) / 10),
            customCost: baseLine?.customCost ?? 25,
          };
        });
        return {
          ...f,
          partName: data.partName || f.partName,
          printHours: data.seconds > 0 ? Math.max(0.1, Math.round((data.seconds / 3600) * 100) / 100) : f.printHours,
          filaments: rows.length ? rows : f.filaments,
          multi: rows.length > 1 ? true : f.multi,
          wastePct: f.wastePct,
          layerHeight: data.layerHeight ?? f.layerHeight,
          nozzle: data.nozzle ?? f.nozzle,
          material: normalizeMaterial(data.material),
          notes: data.notes.join(' · '),
        };
      });
      setParsed(data);
      dispatch({
        type: 'toast',
        kind: 'success',
        message: t('Slicer metadata imported'),
        detail: `${data.source} · ${formatGrams(data.grams)} · ${formatDuration(data.seconds)} · ${data.layerHeight ?? '?'} mm`,
      });
    },
    [dispatch, state.spools, t],
  );

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const data = await parseSlicerFile(file);
      handleParsed(data);
    } catch (err) {
      dispatch({
        type: 'toast',
        kind: 'error',
        message: t('Could not read slicer file'),
        detail: err instanceof Error ? err.message : 'Unsupported file. Drop a .gcode or .3mf export.',
      });
    } finally {
      setParsing(false);
    }
  };

  const updateRow = (key: string, patch: Partial<FilamentRow>) =>
    setForm((f) => ({
      ...f,
      filaments: f.filaments.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    }));

  const addRow = () =>
    setForm((f) => ({
      ...f,
      multi: true,
      filaments: [
        ...f.filaments,
        { key: uid('line'), spoolId: state.spools[0]?.id ?? '', grams: 0, customCost: 25 },
      ],
    }));

  const removeRow = (key: string) =>
    setForm((f) => ({
      ...f,
      filaments: f.filaments.length > 1 ? f.filaments.filter((r) => r.key !== key) : f.filaments,
    }));

  const loadPreset = (preset: ProductPreset) => {
    const spool = state.spools.find((s) => s.id === preset.spoolId) ?? state.spools[0];
    setForm((f) => ({
      ...f,
      partName: preset.name,
      quantity: preset.quantity,
      printHours: preset.printTimeHours,
      filaments: [
        { key: uid('line'), spoolId: spool?.id ?? '', grams: preset.filamentGrams, customCost: 25 },
      ],
      multi: false,
      laborMinutes: preset.laborMinutes,
      hardwareCost: preset.hardwareCost,
      markupPct: preset.markupPct,
      layerHeight: preset.layerHeight,
      infill: preset.infill,
      nozzle: preset.nozzle,
      material: preset.material,
      notes: preset.notes,
    }));
    dispatch({ type: 'toast', kind: 'info', message: t('Preset loaded'), detail: preset.name });
  };

  const savePreset = () => {
    const first = activeFilaments[0];
    const spool = first ? spoolFor(first) : null;
    const preset: ProductPreset = {
      id: uid('preset'),
      name: form.partName.trim() || 'Untitled preset',
      notes: form.notes || `${form.layerHeight} mm · ${form.infill}% infill · ${form.nozzle} mm nozzle`,
      quantity: Math.max(1, form.quantity),
      printTimeHours: form.printHours,
      filamentGrams: quote.gramsPerUnit,
      material: spool?.material ?? form.material,
      layerHeight: form.layerHeight,
      infill: form.infill,
      nozzle: form.nozzle,
      laborMinutes: form.laborMinutes,
      hardwareCost: form.hardwareCost,
      markupPct: form.markupPct,
      spoolId: spool?.id ?? null,
    };
    dispatch({ type: 'upsertPreset', preset });
  };

  const buildOrder = (): PrintOrder => {
    const filaments = activeFilaments
      .filter((row) => row.spoolId && row.grams > 0)
      .map((row) => ({ spoolId: row.spoolId, grams: row.grams }));
    return {
      id: uid('order'),
      orderNumber: nextOrderNumber(state.orders),
      clientName: form.clientName.trim() || 'Walk-in client',
      clientContact: form.clientContact.trim(),
      partName: form.partName.trim() || 'Untitled part',
      quantity: Math.max(1, Math.floor(form.quantity) || 1),
      printedQty: 0,
      status: 'queued',
      dueDate: addDays(new Date(), Math.max(1, form.dueDays)).toISOString(),
      createdAt: new Date().toISOString(),
      printerId: form.printerId || null,
      filaments,
      slicer: {
        layerHeight: form.layerHeight,
        infill: form.infill,
        nozzle: form.nozzle,
        material: spoolFor(activeFilaments[0])?.material ?? form.material,
      },
      unitPrice: quote.unitPrice,
      totalPrice: quote.totalClient,
      paymentStatus: 'unpaid',
      rush: form.rush,
      volumeDiscountPct: form.volumeDiscountPct,
      hoursPerUnit: form.printHours,
      laborMinutes: form.laborMinutes,
      notes: [form.notes, form.hardwareNote ? `BOM: ${form.hardwareNote}` : ''].filter(Boolean).join(' · '),
      costSnapshot: {
        unitCost: quote.unitCost,
        totalCost: quote.totalCost,
        profit: quote.profit,
        margin: quote.margin,
      },
    };
  };

  const convertToOrder = () => {
    dispatch({ type: 'upsertOrder', order: buildOrder() });
    onOrderCreated();
  };

  const openDocument = () => {
    const order = buildOrder();
    setDocData({
      number: order.orderNumber,
      title: 'QUOTATION',
      date: order.createdAt,
      dueDate: order.dueDate,
      clientName: order.clientName,
      clientContact: order.clientContact,
      partName: order.partName,
      quantity: order.quantity,
      unitPrice: quote.unitPrice,
      net: quote.netRevenue,
      discount: quote.volumeDiscount,
      tax: quote.tax,
      total: quote.totalClient,
      taxRate: form.taxRate,
      rush: form.rush,
      rushFee: quote.rushFee * quote.quantity,
      material: materialSummary,
      gramsPerUnit: quote.gramsPerUnit,
      hoursPerUnit: form.printHours,
      layerHeight: form.layerHeight,
      infill: form.infill,
      nozzle: form.nozzle,
      printerName: printer?.name ?? 'To be scheduled',
      notes: form.notes,
    });
    setDocOpen(true);
  };

  const reset = () => {
    setForm((f) => ({
      ...f,
      partName: '',
      quantity: 1,
      printHours: 2,
      multi: false,
      filaments: [{ key: uid('line'), spoolId: state.spools[0]?.id ?? '', grams: 80, customCost: 25 }],
      hardwareCost: 0,
      hardwareNote: '',
      rush: false,
      volumeDiscountPct: 0,
      notes: '',
      clientName: '',
      clientContact: '',
      wastePct: state.settings.failureBuffer,
      markupPct: state.settings.defaultMarkup,
    }));
    setParsed(null);
    dispatch({ type: 'toast', kind: 'info', message: t('Quote form reset') });
  };

  return (
    <div className="space-y-3.5">
      {/* Preset rail */}
      <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
        <span className="flex flex-shrink-0 items-center gap-1.5 pr-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
          <Tag size={12} /> {t('SKUs')}
        </span>
        {state.presets.length === 0 && <span className="text-[11px] text-muted">{t('No presets yet — save your first recurring print below.')}</span>}
        {state.presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => loadPreset(preset)}
            className="group flex flex-shrink-0 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-left transition-colors hover:border-maker/50"
          >
            <span className="max-w-[180px] truncate text-[11px] font-medium text-ink">{preset.name}</span>
            <span className="font-mono text-[10px] text-muted">{preset.filamentGrams}g</span>
            <ArrowRight size={11} className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-maker" />
          </button>
        ))}
      </div>

      <div className="grid gap-3.5 lg:grid-cols-12">
        <div className="space-y-3.5 lg:col-span-7 xl:col-span-8">
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              'relative overflow-hidden rounded-xl border border-dashed p-4 transition-colors',
              dragging ? 'border-maker bg-maker-soft' : 'border-line bg-panel hover:border-zinc-500/60',
            )}
          >
            <input
              ref={fileInput}
              type="file"
              accept=".gcode,.gco,.3mf"
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-line bg-raised text-maker">
                {parsing ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t('Drop a sliced file to auto-fill the quote')}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                  {t(
                    '.gcode or .3mf from PrusaSlicer, OrcaSlicer, Bambu Studio or Cura. Print time, filament weight, layer height and material are read locally in your browser — no upload.',
                  )}
                </p>
                {parsed && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone="maker">{parsed.source}</Badge>
                    <Badge tone="muted">{formatGrams(parsed.grams)}</Badge>
                    <Badge tone="muted">{formatDuration(parsed.seconds)}</Badge>
                    {parsed.layerHeight && <Badge tone="muted">{parsed.layerHeight} mm</Badge>}
                    {parsed.nozzle && <Badge tone="muted">{parsed.nozzle} mm nozzle</Badge>}
                  </div>
                )}
              </div>
              <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()} className="flex-shrink-0">
                <FileCode2 size={14} /> {t('Browse')}
              </Button>
            </div>
          </div>

          <Section
            title={t('Job')}
            hint={t('What are we making, for whom, and how many?')}
            icon={<Sparkles size={13} />}
            action={
              <Button variant="ghost" size="sm" onClick={reset} title="Reset quote">
                <RotateCcw size={13} />
              </Button>
            }
          >
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Field label={t('Part / project name')} className="sm:col-span-2">
                <input
                  className="field"
                  value={form.partName}
                  onChange={(e) => set('partName', e.target.value)}
                  placeholder={t('e.g. Articulated Dragon — Medium')}
                />
              </Field>
              <Field label={t('Client name')}>
                <input
                  className="field"
                  value={form.clientName}
                  onChange={(e) => set('clientName', e.target.value)}
                  placeholder={t('Walk-in client')}
                />
              </Field>
              <Field label={t('Contact')}>
                <input
                  className="field"
                  value={form.clientContact}
                  onChange={(e) => set('clientContact', e.target.value)}
                  placeholder="email / phone"
                />
              </Field>
              <Field label={t('Quantity (pcs)')}>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="field font-mono tabular-nums"
                  value={form.quantity}
                  onChange={(e) => set('quantity', Math.max(1, Math.floor(num(e.target.value)) || 1))}
                />
              </Field>
              <Field label={t('Batch discount %')} hint={t('Applied to the batch total.')}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="field font-mono tabular-nums"
                  value={form.volumeDiscountPct}
                  onChange={(e) => set('volumeDiscountPct', num(e.target.value))}
                />
              </Field>
              <Field label={t('Due in (days)')}>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="field font-mono tabular-nums"
                  value={form.dueDays}
                  onChange={(e) => set('dueDays', Math.max(1, Math.floor(num(e.target.value)) || 1))}
                />
              </Field>
              <div className="flex items-end">
                <Toggle
                  checked={form.multi}
                  onChange={(v) => set('multi', v)}
                  label={t('Multi-filament / AMS')}
                  description={t('Allocate several spools to one print.')}
                />
              </div>
            </div>
          </Section>

          <Section
            title={t('Material & waste')}
            hint={t('Pull exact cost from inventory spools')}
            icon={<Boxes size={13} />}
            action={
              <Button variant="secondary" size="sm" onClick={addRow}>
                <Plus size={13} /> {t('Filament')}
              </Button>
            }
          >
            <div className="space-y-2">
              {(form.multi ? form.filaments : form.filaments.slice(0, 1)).map((row, index) => {
                const spool = spoolFor(row);
                return (
                  <div key={row.key} className="rounded-lg border border-line bg-raised/60 p-2.5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-white/20"
                          style={{ background: spool?.colorHex ?? '#71717A' }}
                        />
                        {t('Filament {n}', { n: index + 1 })}
                      </span>
                      {(form.multi ? form.filaments.length : 1) > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                          className="rounded p-1 text-muted transition-colors hover:text-rose-400"
                          aria-label="Remove filament line"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_92px_96px]">
                      <select
                        className="field"
                        value={row.spoolId}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          const nextSpool = state.spools.find((s) => s.id === nextId);
                          updateRow(row.key, { spoolId: nextId, customCost: nextSpool?.costPerKg ?? row.customCost });
                          if (nextSpool) set('material', nextSpool.material);
                        }}
                        aria-label={`Spool for filament ${index + 1}`}
                      >
                        <option value="">{t('Custom material price…')}</option>
                        {state.spools.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.brand} {s.material} · {s.colorName} · {s.remainingGrams}g
                          </option>
                        ))}
                      </select>
                      <div>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="field font-mono tabular-nums"
                          value={row.grams}
                          onChange={(e) => updateRow(row.key, { grams: Math.max(0, num(e.target.value)) })}
                          aria-label={`Grams per unit for filament ${index + 1}`}
                        />
                        <span className="mt-0.5 block text-center text-[9px] uppercase tracking-wider text-muted">{t('g / unit')}</span>
                      </div>
                      <div>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="field font-mono tabular-nums"
                          value={spool ? spool.costPerKg : row.customCost}
                          onChange={(e) => updateRow(row.key, { customCost: Math.max(0, num(e.target.value)) })}
                          disabled={!!spool}
                          aria-label={`Cost per kg for filament ${index + 1}`}
                        />
                        <span className="mt-0.5 block text-center text-[9px] uppercase tracking-wider text-muted">{t('cost / kg')}</span>
                      </div>
                    </div>
                    {spool && (
                      <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-muted">
                        <span>
                          {spool.location} · {spool.diameter} mm · {spool.nozzleTemp}°C / {spool.bedTemp}°C
                        </span>
                        <span className={spool.remainingGrams < state.settings.lowStockThreshold ? 'text-amber-400' : ''}>
                          {spool.remainingGrams}g left
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
              <Field label={t('Failure / waste buffer %')}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="field font-mono tabular-nums"
                  value={form.wastePct}
                  onChange={(e) => set('wastePct', Math.max(0, num(e.target.value)))}
                />
              </Field>
              <Field label={t('Layer height (mm)')}>
                <input
                  type="number"
                  min={0.05}
                  step={0.02}
                  className="field font-mono tabular-nums"
                  value={form.layerHeight}
                  onChange={(e) => set('layerHeight', num(e.target.value))}
                />
              </Field>
              <Field label={t('Infill %')}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="field font-mono tabular-nums"
                  value={form.infill}
                  onChange={(e) => set('infill', num(e.target.value))}
                />
              </Field>
            </div>

            {lowStockLines.length > 0 && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/5 px-2 py-1.5 text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                {t('Not enough filament for {qty} units:', { qty: quote.quantity })}{' '}
                {lowStockLines.map((l) => `${l.spool.brand} ${l.spool.colorName} (${l.spool.remainingGrams}g of ${Math.round(l.needed)}g)`).join(', ')}.
              </p>
            )}
          </Section>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Section title={t('Machine & energy')} hint={t('Depreciation from real machine cost')} icon={<PrinterIcon size={13} />}>
              <div className="space-y-2.5">
                <Field label={t('Target printer')}>
                  <select className="field" value={form.printerId} onChange={(e) => set('printerId', e.target.value)}>
                    <option value="">{t('No machine (manual)')}</option>
                    {state.printers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('Print time (hours)')}>
                  <input
                    type="number"
                    min={0}
                    step={0.05}
                    className="field font-mono tabular-nums"
                    value={form.printHours}
                    onChange={(e) => set('printHours', Math.max(0, num(e.target.value)))}
                  />
                </Field>
                <Field label={t('Electricity rate / kWh')}>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="field font-mono tabular-nums"
                    value={form.electricityRate}
                    onChange={(e) => set('electricityRate', Math.max(0, num(e.target.value)))}
                  />
                </Field>
                <div className="flex items-center justify-between rounded-lg border border-line bg-raised/60 px-2.5 py-2 font-mono text-[10px] text-muted">
                  <span className="flex items-center gap-1">
                    <Zap size={11} />{' '}
                    {printer ? t('{w} W draw', { w: formatNumber(printer.powerDrawW) }) : t('no machine')}
                  </span>
                  <span>{printer ? `${money(machineDepreciation(printer))}/h dep.` : '—'}</span>
                </div>
              </div>
            </Section>

            <Section title={t('Labor & hardware')} hint={t('Setup, post-processing, BOM extras')} icon={<Wrench size={13} />}>
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t('Labor minutes')}>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="field font-mono tabular-nums"
                      value={form.laborMinutes}
                      onChange={(e) => set('laborMinutes', Math.max(0, num(e.target.value)))}
                    />
                  </Field>
                  <Field label={t('Rate / hour')}>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="field font-mono tabular-nums"
                      value={form.laborRate}
                      onChange={(e) => set('laborRate', Math.max(0, num(e.target.value)))}
                    />
                  </Field>
                </div>
                <Field label={t('Hardware / BOM cost per unit')}>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    className="field font-mono tabular-nums"
                    value={form.hardwareCost}
                    onChange={(e) => set('hardwareCost', Math.max(0, num(e.target.value)))}
                  />
                </Field>
                <Field label={t('Hardware notes')} hint={t('Inserts, magnets, screws, packaging…')}>
                  <input
                    className="field"
                    value={form.hardwareNote}
                    onChange={(e) => set('hardwareNote', e.target.value)}
                    placeholder="8× M3 heat-set inserts, 4 magnets"
                  />
                </Field>
                <div className="flex items-center gap-2 rounded-lg border border-line bg-raised/60 px-2.5 py-2 font-mono text-[10px] text-muted">
                  <Clock size={11} />
                  {formatDuration(form.printHours * 3600)} machine · {form.laborMinutes} min operator
                </div>
              </div>
            </Section>
          </div>

          <Section title={t('Pricing, rush & tax')} hint={t('Margin strategy and client-facing totals')} icon={<Percent size={13} />}>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <Field
                label={form.pricingMode === 'margin' ? t('Target margin %') : t('Profit markup %')}
                right={
                  <Segmented
                    size="sm"
                    value={form.pricingMode}
                    onChange={(v) => set('pricingMode', v)}
                    options={[
                      { value: 'markup', label: t('Markup') },
                      { value: 'margin', label: t('Margin') },
                    ]}
                  />
                }
              >
                <input
                  type="number"
                  min={0}
                  max={form.pricingMode === 'margin' ? 95 : 100000}
                  step={1}
                  className="field font-mono tabular-nums"
                  value={form.markupPct}
                  onChange={(e) => set('markupPct', Math.max(0, num(e.target.value)))}
                />
              </Field>
              <Field label={t('Tax / VAT %')}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  className="field font-mono tabular-nums"
                  value={form.taxRate}
                  onChange={(e) => set('taxRate', Math.max(0, num(e.target.value)))}
                />
              </Field>
              <div className="flex items-end">
                <Toggle
                  checked={form.rush}
                  onChange={(v) => set('rush', v)}
                  label={t('Rush fee +25%')}
                  description={t('Client-priority queue.')}
                />
              </div>
            </div>
          </Section>

          <Section
            title={t('Notes for the job ticket')}
            hint={t('Optional — appears on the printable quote')}
            icon={<ReceiptText size={13} />}
          >
            <textarea
              className="field min-h-[68px] resize-y font-sans"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Seam position, color tolerance, packaging, inspection requirements…"
            />
          </Section>
        </div>

        {/* Summary */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="space-y-3.5 lg:sticky lg:top-20">
            <Card className="overflow-hidden">
              <div className="border-b border-line bg-raised/40 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="label">{t('Quote summary')}</span>
                  <Badge tone={quote.margin >= 30 ? 'ok' : quote.margin >= 15 ? 'warn' : 'bad'}>
                    {t('{x}% margin', { x: quote.margin.toFixed(1) })}
                  </Badge>
                </div>
                <div className="mt-1.5 flex items-end justify-between gap-2">
                  <div>
                    <p className="font-mono text-[28px] font-semibold leading-none tabular text-ink">{money(quote.totalClient)}</p>
                    <p className="mt-1 text-[10px] text-muted">
                      {t('total client price · {qty} pcs · incl. {tax}% tax', {
                        qty: quote.quantity,
                        tax: form.taxRate,
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm tabular text-ink">{money(quote.unitPrice)}</p>
                    <p className="text-[9px] uppercase tracking-wider text-muted">{t('per unit')}</p>
                  </div>
                </div>
              </div>

              <div className="p-3.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="label">{t('Unit cost composition')}</span>
                  <span className="font-mono text-[10px] text-muted">{t('{money} cost', { money: money(quote.unitCost) })}</span>
                </div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-line">
                  {segments.map((seg) => (
                    <div
                      key={seg.key}
                      title={`${seg.label}: ${money(seg.value)}`}
                      style={{ width: `${segmentTotal > 0 ? (seg.value / segmentTotal) * 100 : 0}%`, background: seg.color }}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                    />
                  ))}
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
                  {segments.map((seg) => (
                    <div key={seg.key} className="flex items-center justify-between gap-1 text-[10px]">
                      <span className="flex min-w-0 items-center gap-1.5 text-muted">
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-sm" style={{ background: seg.color }} />
                        <span className="truncate">{t(seg.label)}</span>
                      </span>
                      <span className="flex-shrink-0 font-mono tabular text-ink">{money(seg.value)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3.5 space-y-1 border-t border-line pt-2.5">
                  {[
                    { label: t('Material'), value: quote.materialCost },
                    { label: t('Electricity'), value: quote.electricityCost },
                    { label: t('Machine depreciation'), value: quote.machineCost },
                    { label: t('Labor'), value: quote.laborCost },
                    { label: t('Hardware / BOM'), value: quote.hardwareCost },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-[11px]">
                      <span className="text-muted">{row.label}</span>
                      <span className="font-mono tabular text-ink">{money(row.value)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-line pt-1.5 text-[11px] font-medium">
                    <span className="text-muted">{t('Unit cost')}</span>
                    <span className="font-mono tabular text-ink">{money(quote.unitCost)}</span>
                  </div>
                  {form.rush && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
                        <Zap size={10} /> {t('Rush fee')}
                      </span>
                      <span className="font-mono tabular text-ink">{money(quote.rushFee)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted">
                      {t('Batch ({qty} × {unit})', { qty: quote.quantity, unit: money(quote.unitPrice) })}
                    </span>
                    <span className="font-mono tabular text-ink">{money(quote.batchPrice)}</span>
                  </div>
                  {quote.volumeDiscount > 0 && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted">{t('Volume discount ({pct}%)', { pct: form.volumeDiscountPct })}</span>
                      <span className="font-mono tabular text-amber-500 dark:text-amber-400">−{money(quote.volumeDiscount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted">{t('Net revenue')}</span>
                    <span className="font-mono tabular text-ink">{money(quote.netRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted">{t('Tax / VAT ({pct}%)', { pct: form.taxRate })}</span>
                    <span className="font-mono tabular text-ink">{money(quote.tax)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-raised px-2 py-1.5 text-[11px] font-semibold">
                    <span className="text-ink">{t('Total client')}</span>
                    <span className="font-mono tabular text-ink">{money(quote.totalClient)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted">{t('Profit (batch)')}</span>
                    <span className="font-mono tabular text-emerald-600 dark:text-emerald-400">
                      {money(quote.profit)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-lg border border-line bg-raised/50 p-2 text-center">
                  <div>
                    <p className="font-mono text-xs tabular text-ink">{formatGrams(quote.gramsPerUnit)}</p>
                    <p className="text-[9px] uppercase tracking-wider text-muted">{t('per unit')}</p>
                  </div>
                  <div>
                    <p className="font-mono text-xs tabular text-ink">{form.printHours.toFixed(2)}h</p>
                    <p className="text-[9px] uppercase tracking-wider text-muted">{t('print')}</p>
                  </div>
                  <div>
                    <p className="font-mono text-xs tabular text-ink">{Math.round(quote.gramsPerUnit * quote.quantity)}g</p>
                    <p className="text-[9px] uppercase tracking-wider text-muted">{t('batch')}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <Button variant="primary" className="w-full" onClick={convertToOrder}>
                    <PackagePlus size={15} /> {t('Convert to production order')}
                  </Button>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button variant="secondary" size="sm" onClick={savePreset}>
                      <Save size={13} /> {t('Save SKU')}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={openDocument}>
                      <ReceiptText size={13} /> {t('Quote / Invoice')}
                    </Button>
                  </div>
                </div>
                {activeFilaments.some((r) => !r.spoolId) && (
                  <p className="mt-2 text-[10px] leading-relaxed text-muted">
                    {t("Custom-priced material won't auto-deduct inventory. Link a spool to enable stock sync.")}
                  </p>
                )}
              </div>
            </Card>

            <Card className="p-3.5">
              <div className="flex items-center gap-2 text-[10px] text-muted">
                <CalculatorIcon size={13} /> {t('Batch at a glance')}
              </div>
              <div className="mt-2 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted">{t('Filament required')}</span>
                  <span className="font-mono tabular text-ink">{formatGrams(quote.gramsPerUnit * quote.quantity)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{t('Machine time')}</span>
                  <span className="font-mono tabular text-ink">{formatDuration(form.printHours * 3600 * quote.quantity)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{t('Operator time')}</span>
                  <span className="font-mono tabular text-ink">{formatNumber(form.laborMinutes * quote.quantity)} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{t('Batch cost')}</span>
                  <span className="font-mono tabular text-ink">{money(quote.totalCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{t('Profit per unit')}</span>
                  <span className="font-mono tabular text-emerald-600 dark:text-emerald-400">
                    {money(quote.unitPrice - quote.unitCost)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <QuoteDocumentModal
        open={docOpen}
        doc={docData}
        settings={state.settings}
        currency={state.settings.currency}
        onClose={() => setDocOpen(false)}
      />
    </div>
  );
}
