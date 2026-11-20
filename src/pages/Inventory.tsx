import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Cable,
  Check,
  Minus,
  Package,
  Pencil,
  Plus,
  Printer as PrinterIcon,
  QrCode,
  ScanLine,
  Search,
  SlidersHorizontal,
  Thermometer,
  Trash2,
  Weight,
} from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { useT } from '../hooks/useT';
import type { FilamentMaterial, FilamentSpool, HardwareItem } from '../types/farm';
import { formatGrams, formatMoney, sanitizeHex, uid, textColorFor } from '../utils/format';
import { spoolPayload } from '../utils/qr';
import { QRCodeView } from '../components/QRCodeView';
import { Badge, Button, Card, EmptyState, Field, Modal, PrintPortal, Progress, Segmented, cn } from '../components/ui';

const MATERIALS: FilamentMaterial[] = ['PLA', 'PETG', 'ASA', 'ABS', 'TPU', 'PA-CF', 'PC', 'Resin'];
const LOCATION_SUGGESTIONS = ['AMS Slot 1', 'AMS Slot 2', 'AMS Slot 3', 'AMS Slot 4', 'Dryer Box', 'Shelf A1', 'Shelf B2', 'Shelf C1'];
const HARDWARE_CATEGORIES: HardwareItem['category'][] = [
  'Nozzles',
  'Build Plates',
  'Fasteners',
  'Inserts',
  'Adhesives',
  'Packaging',
  'Electronics',
  'Other',
];

interface SpoolDraft {
  brand: string;
  material: FilamentMaterial;
  colorName: string;
  colorHex: string;
  diameter: 1.75 | 2.85;
  totalGrams: number;
  remainingGrams: number;
  costPerKg: number;
  nozzleTemp: number;
  bedTemp: number;
  location: string;
  tareWeightGrams: number;
  notes: string;
}

function emptySpoolDraft(): SpoolDraft {
  return {
    brand: '',
    material: 'PLA',
    colorName: '',
    colorHex: '#F97316',
    diameter: 1.75,
    totalGrams: 1000,
    remainingGrams: 1000,
    costPerKg: 24.9,
    nozzleTemp: 220,
    bedTemp: 60,
    location: 'Shelf A1',
    tareWeightGrams: 200,
    notes: '',
  };
}

function draftToSpool(draft: SpoolDraft, id?: string): FilamentSpool {
  const total = Math.max(1, draft.totalGrams);
  return {
    id: id ?? uid('spool'),
    brand: draft.brand.trim() || 'Unbranded',
    material: draft.material,
    colorName: draft.colorName.trim() || 'Unnamed color',
    colorHex: sanitizeHex(draft.colorHex),
    diameter: draft.diameter,
    totalGrams: total,
    remainingGrams: Math.max(0, Math.min(total, draft.remainingGrams)),
    costPerKg: Math.max(0, draft.costPerKg),
    nozzleTemp: Math.max(0, draft.nozzleTemp),
    bedTemp: Math.max(0, draft.bedTemp),
    location: draft.location.trim() || 'Unassigned',
    tareWeightGrams: Math.max(0, draft.tareWeightGrams),
    notes: draft.notes.trim() || undefined,
  };
}

const num = (v: string): number => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

function LabelsModal({
  open,
  onClose,
  spools,
  initialIds,
  farmName,
}: {
  open: boolean;
  onClose: () => void;
  spools: FilamentSpool[];
  initialIds: string[];
  farmName: string;
}) {
  const t = useT();
  const [selected, setSelected] = useState<string[]>(initialIds);
  const [copies, setCopies] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open) {
      const ids = initialIds.length ? initialIds : spools.map((s) => s.id);
      setSelected(ids);
      setCopies(Object.fromEntries(ids.map((id) => [id, 1])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialIds.join(',')]);

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

  const chosen = spools.filter((s) => selected.includes(s.id));
  const copyCount = (id: string) => Math.max(1, Math.min(20, copies[id] ?? 1));
  const totalLabels = chosen.reduce((sum, s) => sum + copyCount(s.id), 0);

  const toggle = (id: string) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setCopies((cur) => ({ ...cur, [id]: cur[id] ?? 1 }));
  };

  const changeCopies = (id: string, delta: number) =>
    setCopies((cur) => ({ ...cur, [id]: Math.max(1, Math.min(20, (cur[id] ?? 1) + delta)) }));

  const renderLabels = () =>
    chosen.flatMap((s) =>
      Array.from({ length: copyCount(s.id) }, (_, index) => label(s, `${s.id}-${index}`)),
    );

  const label = (s: FilamentSpool, key: string) => (
    <div
      key={key}
      className="label relative flex overflow-hidden border border-zinc-300 bg-white text-zinc-900"
      style={{ width: '50mm', height: '30mm', padding: '2mm', boxSizing: 'border-box' }}
    >
      <div className="absolute inset-x-0 top-0 bg-orange-500" style={{ height: '1.2mm' }} />
      <div className="flex h-full w-full items-stretch gap-1.5 pt-1">
        <div className="flex flex-shrink-0 items-center justify-center">
          <QRCodeView value={spoolPayload(s.id)} size={82} />
        </div>
        <div className="flex min-w-0 flex-col justify-center" style={{ lineHeight: 1.15 }}>
          <p className="truncate font-semibold uppercase" style={{ fontSize: '7pt', letterSpacing: '0.02em' }}>
            {s.brand}
          </p>
          <p className="truncate" style={{ fontSize: '6pt' }}>
            {s.material} · {s.colorName}
          </p>
          <p className="truncate font-mono" style={{ fontSize: '5.5pt' }}>
            {s.material === 'Resin'
              ? `${s.remainingGrams} g resin`
              : `${s.nozzleTemp}° / ${s.bedTemp}° · ${s.diameter}mm`}
          </p>
          <p className="truncate font-mono" style={{ fontSize: '5pt', color: '#71717A' }}>
            {farmName}
          </p>
          <p className="truncate font-mono font-semibold" style={{ fontSize: '6pt' }}>
            {s.id}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <PrintPortal>
      <div className="print-hidden min-h-full pb-6">
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-700/60 bg-zinc-950/90 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center gap-2 text-white">
            <QrCode size={16} className="text-orange-400" />
            <span className="text-xs font-medium">{t('QR label sheet · 50 × 30 mm')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => window.print()} disabled={!chosen.length}>
              <PrinterIcon size={14} /> {t('Print {n}', { n: totalLabels || '' })}
            </Button>
            <Button size="sm" variant="ghost" className="text-zinc-300 hover:text-white" onClick={onClose}>
              {t('Close')}
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-3xl space-y-3 px-3">
          <div className="rounded-xl border border-line bg-panel p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="label">{t('Spools on this sheet')}</span>
              <span className="text-[10px] text-muted">
                {totalLabels === 1 ? t('{n} label', { n: totalLabels }) : t('{n} labels', { n: totalLabels })}
              </span>
              <button
                type="button"
                className="text-[10px] text-muted underline decoration-dotted hover:text-ink"
                onClick={() => setSelected(selected.length === spools.length ? [] : spools.map((s) => s.id))}
              >
                {selected.length === spools.length ? t('Clear all') : t('Select all')}
              </button>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              {t('Select the spools and number of copies. Each label carries a unique scan code.')}
            </p>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {spools.map((s) => {
                const isSelected = selected.includes(s.id);
                return (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center gap-1 rounded-lg border px-1.5 py-1.5 transition-colors',
                      isSelected ? 'border-maker/50 bg-maker-soft' : 'border-line bg-raised hover:border-zinc-500/50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-pressed={isSelected}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border',
                          isSelected ? 'border-maker bg-maker text-zinc-950' : 'border-line',
                        )}
                      >
                        {isSelected && <Check size={11} />}
                      </span>
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: s.colorHex }} />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-ink">
                        {s.brand} {s.material} {s.colorName}
                      </span>
                    </button>
                    {isSelected && (
                      <div className="flex flex-shrink-0 items-center gap-0.5 rounded border border-line bg-panel">
                        <button
                          type="button"
                          onClick={() => changeCopies(s.id, -1)}
                          disabled={copyCount(s.id) <= 1}
                          className="flex h-6 w-6 items-center justify-center text-muted transition-colors hover:text-ink disabled:opacity-30"
                          aria-label={`Fewer labels for ${s.colorName}`}
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-6 text-center font-mono text-[10px] tabular text-ink">{copyCount(s.id)}</span>
                        <button
                          type="button"
                          onClick={() => changeCopies(s.id, 1)}
                          disabled={copyCount(s.id) >= 20}
                          className="flex h-6 w-6 items-center justify-center text-muted transition-colors hover:text-ink disabled:opacity-30"
                          aria-label={`More labels for ${s.colorName}`}
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 rounded-xl bg-white p-3">{renderLabels()}</div>
          <p className="text-center text-[10px] text-muted">
            {t('Use a 50 × 30 mm thermal label roll. Print at 100% scale — no fit-to-page.')}
          </p>
        </div>
      </div>
      <div className="hidden print:block">
        <div className="flex flex-wrap gap-[3mm]">{renderLabels()}</div>
      </div>
    </PrintPortal>
  );
}

export function Inventory({
  onScan,
  focusSpoolId,
  onFocusHandled,
}: {
  onScan: () => void;
  focusSpoolId?: string | null;
  onFocusHandled?: () => void;
}) {
  const { state, dispatch, money } = useFarm();
  const t = useT();
  const [tab, setTab] = useState<'spools' | 'hardware'>('spools');
  const [search, setSearch] = useState('');
  const [material, setMaterial] = useState<'ALL' | FilamentMaterial>('ALL');
  const [location, setLocation] = useState('ALL');
  const [lowOnly, setLowOnly] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSpool, setEditingSpool] = useState<FilamentSpool | null>(null);
  const [draft, setDraft] = useState<SpoolDraft>(emptySpoolDraft);

  const [weighSpool, setWeighSpool] = useState<FilamentSpool | null>(null);
  const [gross, setGross] = useState(0);

  const [adjustSpool, setAdjustSpool] = useState<FilamentSpool | null>(null);
  const [adjustMode, setAdjustMode] = useState<'deduct' | 'add'>('deduct');
  const [adjustAmount, setAdjustAmount] = useState(10);

  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelIds, setLabelIds] = useState<string[]>([]);

  const [hardwareOpen, setHardwareOpen] = useState(false);
  const [hardwareDraft, setHardwareDraft] = useState<HardwareItem | null>(null);

  useEffect(() => {
    if (!focusSpoolId) return;
    const spool = state.spools.find((s) => s.id === focusSpoolId);
    if (spool) {
      setTab('spools');
      openEditor(spool);
    }
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSpoolId]);

  const locations = useMemo(() => Array.from(new Set(state.spools.map((s) => s.location))).sort(), [state.spools]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.spools.filter((s) => {
      if (material !== 'ALL' && s.material !== material) return false;
      if (location !== 'ALL' && s.location !== location) return false;
      if (lowOnly && s.remainingGrams >= state.settings.lowStockThreshold) return false;
      if (!q) return true;
      return `${s.brand} ${s.material} ${s.colorName} ${s.location} ${s.id}`.toLowerCase().includes(q);
    });
  }, [state.spools, search, material, location, lowOnly, state.settings.lowStockThreshold]);

  const totals = useMemo(() => {
    const grams = state.spools.reduce((sum, s) => sum + s.remainingGrams, 0);
    const value = state.spools.reduce((sum, s) => sum + (s.remainingGrams / 1000) * s.costPerKg, 0);
    const low = state.spools.filter((s) => s.remainingGrams < state.settings.lowStockThreshold).length;
    const hardwareLow = state.hardware.filter((h) => h.quantity <= h.lowStockThreshold).length;
    const hardwareValue = state.hardware.reduce((sum, h) => sum + h.quantity * h.unitCost, 0);
    return { grams, value, low, hardwareLow, hardwareValue };
  }, [state.spools, state.hardware, state.settings.lowStockThreshold]);

  function openEditor(spool: FilamentSpool | null) {
    if (spool) {
      setEditingSpool(spool);
      setDraft({
        brand: spool.brand,
        material: spool.material,
        colorName: spool.colorName,
        colorHex: spool.colorHex,
        diameter: spool.diameter,
        totalGrams: spool.totalGrams,
        remainingGrams: spool.remainingGrams,
        costPerKg: spool.costPerKg,
        nozzleTemp: spool.nozzleTemp,
        bedTemp: spool.bedTemp,
        location: spool.location,
        tareWeightGrams: spool.tareWeightGrams,
        notes: spool.notes ?? '',
      });
    } else {
      setEditingSpool(null);
      setDraft(emptySpoolDraft());
    }
    setEditorOpen(true);
  }

  const saveSpool = () => {
    const spool = draftToSpool(draft, editingSpool?.id);
    dispatch({ type: 'upsertSpool', spool });
    setEditorOpen(false);
  };

  const openLabels = (ids: string[]) => {
    setLabelIds(ids);
    setLabelsOpen(true);
  };

  const openWeigh = (spool: FilamentSpool) => {
    setWeighSpool(spool);
    setGross(spool.remainingGrams + spool.tareWeightGrams);
  };

  const openAdjust = (spool: FilamentSpool) => {
    setAdjustSpool(spool);
    setAdjustMode('deduct');
    setAdjustAmount(10);
  };

  const openHardware = (item: HardwareItem | null) => {
    setHardwareDraft(
      item ?? {
        id: uid('hw'),
        name: '',
        category: 'Other',
        quantity: 0,
        unit: 'pcs',
        lowStockThreshold: 5,
        unitCost: 1,
        location: '',
      },
    );
    setHardwareOpen(true);
  };

  const saveHardware = () => {
    if (!hardwareDraft) return;
    dispatch({
      type: 'upsertHardware',
      item: {
        ...hardwareDraft,
        name: hardwareDraft.name.trim() || 'Untitled item',
        quantity: Math.max(0, hardwareDraft.quantity),
      },
    });
    setHardwareOpen(false);
  };

  return (
    <div className="space-y-3.5">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Card className="p-3">
          <p className="label">{t('Filament on shelf')}</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular">{money(totals.value, 0)}</p>
          <p className="text-[10px] text-muted">{formatGrams(totals.grams)} net</p>
        </Card>
        <Card className="p-3">
          <p className="label">{t('Spools')}</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular">{state.spools.length}</p>
          <p className="text-[10px] text-muted">{new Set(state.spools.map((s) => s.material)).size} materials</p>
        </Card>
        <Card className="p-3">
          <p className="label">{t('Low stock')}</p>
          <p className={cn('mt-1 font-mono text-lg font-semibold tabular', totals.low ? 'text-amber-500 dark:text-amber-400' : '')}>
            {totals.low}
          </p>
          <p className="text-[10px] text-muted">{t('below {n}g', { n: state.settings.lowStockThreshold })}</p>
        </Card>
        <Card className="p-3">
          <p className="label">{t('Hardware value')}</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular">{money(totals.hardwareValue, 0)}</p>
          <p className={cn('text-[10px]', totals.hardwareLow ? 'text-amber-500 dark:text-amber-400' : 'text-muted')}>
            {totals.hardwareLow === 1 ? t('item low') : t('items low')}
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'spools', label: t('Spools ({n})', { n: state.spools.length }), icon: <Boxes size={13} /> },
            { value: 'hardware', label: t('Hardware ({n})', { n: state.hardware.length }), icon: <Package size={13} /> },
          ]}
        />
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={onScan}>
            <ScanLine size={14} /> {t('Scan')}
          </Button>
          {tab === 'spools' ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => openLabels(filtered.map((s) => s.id))}>
                <QrCode size={14} /> {t('QR labels')}
              </Button>
              <Button variant="primary" size="sm" onClick={() => openEditor(null)}>
                <Plus size={14} /> {t('Spool')}
              </Button>
            </>
          ) : (
                          <Button variant="primary" size="sm" onClick={() => openHardware(null)}>
                <Plus size={14} /> {t('Item')}
              </Button>
          )}
        </div>
      </div>

      {tab === 'spools' ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('Search brand, color, material, location…')}
                className="field pl-8"
                aria-label="Search spools"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="field h-9 w-auto py-1 text-xs"
                aria-label="Filter by location"
              >
                <option value="ALL">{t('All locations')}</option>
                {locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setLowOnly((v) => !v)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors',
                  lowOnly ? 'border-amber-500/40 bg-amber-500/10 text-amber-500' : 'border-line bg-panel text-muted hover:text-ink',
                )}
              >
                <AlertTriangle size={12} /> {t('Low')}
              </button>
            </div>
          </div>

          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {(['ALL', ...MATERIALS] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMaterial(m as 'ALL' | FilamentMaterial)}
                className={cn(
                  'flex-shrink-0 rounded-md border px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider transition-colors',
                  material === m
                    ? 'border-maker/50 bg-maker-soft text-orange-600 dark:text-orange-400'
                    : 'border-line bg-panel text-muted hover:text-ink',
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Boxes size={18} />}
              title={state.spools.length ? t('No spools match these filters') : t('No filament spools yet')}
              body={
                state.spools.length
                  ? t('Clear the search or material filter to see the shelf.')
                  : t('Add your first spool to link material costs into quotes and jobs.')
              }
              action={
                state.spools.length ? (
                                      <Button
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setMaterial('ALL');
                      setLocation('ALL');
                      setLowOnly(false);
                    }}
                  >
                    {t('Clear filters')}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => openEditor(null)}>
                    {t('Add spool')}
                  </Button>
                )
              }
            />
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((spool) => {
                const pct = (spool.remainingGrams / Math.max(1, spool.totalGrams)) * 100;
                const low = spool.remainingGrams < state.settings.lowStockThreshold;
                return (
                  <Card key={spool.id} className="flex flex-col overflow-hidden">
                    <div className="h-1.5 w-full" style={{ background: spool.colorHex }} />
                    <div className="flex flex-1 flex-col p-3">
                      <div className="flex items-start gap-2.5">
                        <span
                          className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 border-white/15 shadow-inner"
                          style={{ background: spool.colorHex }}
                        >
                          <span
                            className="h-2 w-2 rounded-full opacity-70"
                            style={{ background: textColorFor(spool.colorHex) }}
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1.5">
                            <p className="truncate text-[13px] font-semibold leading-tight text-ink">
                              {spool.brand} {spool.material}
                            </p>
                            {low && <Badge tone="warn">{t('Low')}</Badge>}
                          </div>
                          <p className="truncate text-[11px] text-muted">{spool.colorName}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <Badge tone="muted">{spool.location}</Badge>
                            <Badge tone="muted">{spool.diameter} mm</Badge>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5">
                        <div className="flex items-baseline justify-between font-mono text-[11px] tabular">
                          <span className={cn('font-semibold', low ? 'text-amber-500 dark:text-amber-400' : 'text-ink')}>
                            {formatGrams(spool.remainingGrams)}
                          </span>
                          <span className="text-muted">/ {formatGrams(spool.totalGrams)}</span>
                        </div>
                        <Progress value={pct} tone={pct < 15 ? 'bad' : pct < 35 ? 'warn' : 'ok'} className="mt-1" height={5} />
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-line bg-raised/60 px-2 py-1.5 text-center">
                        <div>
                          <p className="font-mono text-[10px] tabular text-ink">{money(spool.costPerKg)}</p>
                          <p className="text-[8px] uppercase tracking-wider text-muted">{t('per kg')}</p>
                        </div>
                        <div className="border-x border-line">
                          <p className="flex items-center justify-center gap-0.5 font-mono text-[10px] tabular text-ink">
                            <Thermometer size={9} />
                            {spool.nozzleTemp}
                          </p>
                          <p className="text-[8px] uppercase tracking-wider text-muted">{t('nozzle')}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[10px] tabular text-ink">{spool.bedTemp}°</p>
                          <p className="text-[8px] uppercase tracking-wider text-muted">{t('bed')}</p>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-1">
                        <Button size="sm" variant="secondary" className="flex-1 px-1.5 text-[11px]" onClick={() => dispatch({ type: 'adjustSpool', id: spool.id, delta: -10, reason: 'Quick deduct' })}>
                          −10g
                        </Button>
                        <Button size="sm" variant="secondary" className="flex-1 px-1.5 text-[11px]" onClick={() => dispatch({ type: 'adjustSpool', id: spool.id, delta: -50, reason: 'Quick deduct' })}>
                          −50g
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openWeigh(spool)} title={t('Weigh spool')} aria-label={t('Weigh spool')}>
                          <Weight size={14} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openAdjust(spool)} title={t('Custom deduction')} aria-label={t('Custom deduction')}>
                          <SlidersHorizontal size={14} />
                        </Button>
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="flex-1" onClick={() => openLabels([spool.id])}>
                          <QrCode size={12} /> {t('Label')}
                        </Button>
                        <Button size="sm" variant="ghost" className="flex-1" onClick={() => openEditor(spool)}>
                          <Pencil size={12} /> {t('Edit')}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line bg-raised/40 px-3 py-2">
            <span className="label">{t('Consumables & spare parts')}</span>
            <span className="text-[10px] text-muted">{t('Low when quantity ≤ threshold')}</span>
          </div>
          {state.hardware.length === 0 ? (
            <EmptyState
              className="border-0"
              icon={<Package size={18} />}
              title={t('No hardware tracked')}
              body={t('Track nozzles, plates, inserts, magnets and packaging to avoid mid-job surprises.')}
              action={<Button size="sm" onClick={() => openHardware(null)}>{t('Add item')}</Button>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {state.hardware.map((item) => {
                const low = item.quantity <= item.lowStockThreshold;
                return (
                  <li key={item.id} className="flex flex-wrap items-center gap-2.5 px-3 py-2.5">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-line bg-raised text-muted">
                      {item.category === 'Fasteners' || item.category === 'Inserts' ? <Cable size={14} /> : <Package size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-ink">{item.name}</p>
                      <p className="truncate font-mono text-[10px] text-muted">
                        {item.category} · {item.location || t('no bin')} · {money(item.unitCost)}/{item.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {low && <Badge tone="warn">{t('Low')}</Badge>}
                      <div className="flex items-center rounded-lg border border-line">
                        <button
                          type="button"
                          onClick={() => dispatch({ type: 'adjustHardware', id: item.id, delta: -1 })}
                          className="flex h-8 w-8 items-center justify-center text-muted transition-colors hover:text-ink"
                          aria-label={`Use one ${item.name}`}
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-12 border-x border-line text-center font-mono text-[11px] tabular text-ink">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => dispatch({ type: 'adjustHardware', id: item.id, delta: 1 })}
                          className="flex h-8 w-8 items-center justify-center text-muted transition-colors hover:text-ink"
                          aria-label={`Add one ${item.name}`}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openHardware(item)}
                        aria-label={`Edit ${item.name}`}
                      >
                        <Pencil size={13} />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {/* Spool editor */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingSpool ? t('Edit spool') : t('Add filament spool')}
        subtitle={editingSpool ? editingSpool.id : t('Cost and temperatures feed the quote engine automatically.')}
        size="lg"
        footer={
          <div className="flex items-center justify-between gap-2">
            {editingSpool ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (window.confirm(`Delete ${editingSpool.brand} ${editingSpool.colorName}? This cannot be undone.`)) {
                    dispatch({ type: 'deleteSpool', id: editingSpool.id });
                    setEditorOpen(false);
                  }
                }}
              >
                <Trash2 size={14} /> {t('Delete')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditorOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button variant="primary" size="sm" onClick={saveSpool}>
                {editingSpool ? t('Save changes') : t('Add spool')}
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Field label={t('Brand')}>
            <input className="field" value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} placeholder="Prusament" />
          </Field>
          <Field label={t('Color name')}>
            <input className="field" value={draft.colorName} onChange={(e) => setDraft({ ...draft, colorName: e.target.value })} placeholder="Galaxy Black" />
          </Field>
          <Field label={t('Material')}>
            <select
              className="field"
              value={draft.material}
              onChange={(e) => setDraft({ ...draft, material: e.target.value as FilamentMaterial })}
            >
              {MATERIALS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('Color hex')}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={sanitizeHex(draft.colorHex)}
                onChange={(e) => setDraft({ ...draft, colorHex: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded border border-line bg-raised p-0.5"
                aria-label="Spool color"
              />
              <input
                className="field flex-1 font-mono uppercase"
                value={draft.colorHex}
                onChange={(e) => setDraft({ ...draft, colorHex: e.target.value })}
                maxLength={7}
              />
            </div>
          </Field>
          <Field label={t('Total spool weight (g)')}>
            <input
              type="number"
              min={1}
              className="field font-mono tabular-nums"
              value={draft.totalGrams}
              onChange={(e) => setDraft({ ...draft, totalGrams: Math.max(1, num(e.target.value)) })}
            />
          </Field>
          <Field label={t('Remaining (g)')}>
            <input
              type="number"
              min={0}
              className="field font-mono tabular-nums"
              value={draft.remainingGrams}
              onChange={(e) => setDraft({ ...draft, remainingGrams: Math.max(0, num(e.target.value)) })}
            />
          </Field>
          <Field label={t('Cost per kg')}>
            <input
              type="number"
              min={0}
              step={0.1}
              className="field font-mono tabular-nums"
              value={draft.costPerKg}
              onChange={(e) => setDraft({ ...draft, costPerKg: Math.max(0, num(e.target.value)) })}
            />
          </Field>
          {draft.material === 'Resin' ? (
            <div className="sm:col-span-2 rounded-lg border border-line bg-raised/60 p-2.5 text-[11px] leading-relaxed text-muted">
              {t('Resin stock is tracked in grams. Nozzle and bed temperatures do not apply to resin.')}
            </div>
          ) : (
            <>
              <Field label={t('Diameter (mm)')}>
                <select
                  className="field"
                  value={draft.diameter}
                  onChange={(e) => setDraft({ ...draft, diameter: Number(e.target.value) === 2.85 ? 2.85 : 1.75 })}
                >
                  <option value={1.75}>1.75 mm</option>
                  <option value={2.85}>2.85 mm</option>
                </select>
              </Field>
              <Field label={t('Nozzle temp (°C)')}>
                <input
                  type="number"
                  className="field font-mono tabular-nums"
                  value={draft.nozzleTemp}
                  onChange={(e) => setDraft({ ...draft, nozzleTemp: num(e.target.value) })}
                />
              </Field>
              <Field label={t('Bed temp (°C)')}>
                <input
                  type="number"
                  className="field font-mono tabular-nums"
                  value={draft.bedTemp}
                  onChange={(e) => setDraft({ ...draft, bedTemp: num(e.target.value) })}
                />
              </Field>
            </>
          )}
          <Field label={t('Location')}>
            <input
              className="field"
              list="location-suggestions"
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            />
            <datalist id="location-suggestions">
              {LOCATION_SUGGESTIONS.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </Field>
          <Field label={t('Empty spool tare (g)')}>
            <input
              type="number"
              min={0}
              className="field font-mono tabular-nums"
              value={draft.tareWeightGrams}
              onChange={(e) => setDraft({ ...draft, tareWeightGrams: Math.max(0, num(e.target.value)) })}
            />
          </Field>
          <Field label={t('Notes')} className="sm:col-span-2">
            <input className="field" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Dried 6h at 65°C, sealed 2026-11" />
          </Field>
          <div className="sm:col-span-2 rounded-lg border border-line bg-raised/60 p-2.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="label">{t('Remaining after save')}</span>
              <span className="font-mono tabular text-ink">{formatGrams(Math.min(draft.remainingGrams, draft.totalGrams))}</span>
            </div>
            <Progress
              value={Math.min(draft.remainingGrams, draft.totalGrams)}
              max={Math.max(1, draft.totalGrams)}
              tone={draft.remainingGrams / Math.max(1, draft.totalGrams) < 0.2 ? 'warn' : 'ok'}
              className="mt-1.5"
            />
          </div>
        </div>
      </Modal>

      {/* Weigh modal */}
      <Modal
        open={!!weighSpool}
        onClose={() => setWeighSpool(null)}
        title={t('Weigh spool')}
        subtitle={weighSpool ? `${weighSpool.brand} ${weighSpool.colorName}` : ''}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setWeighSpool(null)}>
              {t('Cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (weighSpool) dispatch({ type: 'weighSpool', id: weighSpool.id, grossGrams: gross });
                setWeighSpool(null);
              }}
            >
              {t('Save weight')}
            </Button>
          </div>
        }
      >
        {weighSpool && (
          <div className="space-y-3">
            <Field
              label={t('Gross weight on scale (g)')}
              hint={t('Tare weight for this spool is {n}g.', { n: weighSpool.tareWeightGrams })}
            >
              <input
                type="number"
                min={0}
                step={1}
                className="field font-mono text-lg tabular-nums"
                value={gross}
                onChange={(e) => setGross(num(e.target.value))}
                autoFocus
              />
            </Field>
            <div className="rounded-lg border border-line bg-raised p-3">
              <div className="flex items-baseline justify-between">
                <span className="label">{t('Net filament')}</span>
                <span className="font-mono text-xl font-semibold tabular text-ink">
                  {Math.max(0, Math.min(weighSpool.totalGrams, gross - weighSpool.tareWeightGrams)).toFixed(0)} g
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-muted">
                {gross.toFixed(0)}g gross − {weighSpool.tareWeightGrams}g tare ={' '}
                {Math.max(0, gross - weighSpool.tareWeightGrams).toFixed(0)}g net
              </p>
              <Progress
                value={Math.max(0, Math.min(weighSpool.totalGrams, gross - weighSpool.tareWeightGrams))}
                max={weighSpool.totalGrams}
                className="mt-2"
                tone="info"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Adjust modal */}
      <Modal
        open={!!adjustSpool}
        onClose={() => setAdjustSpool(null)}
        title={t('Adjust spool weight')}
        subtitle={adjustSpool ? `${adjustSpool.brand} ${adjustSpool.material} ${adjustSpool.colorName}` : ''}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdjustSpool(null)}>
              {t('Cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (adjustSpool) {
                  const delta = adjustMode === 'deduct' ? -Math.abs(adjustAmount) : Math.abs(adjustAmount);
                  dispatch({ type: 'adjustSpool', id: adjustSpool.id, delta, reason: 'Manual adjustment' });
                }
                setAdjustSpool(null);
              }}
            >
              {t('Apply')}
            </Button>
          </div>
        }
      >
        {adjustSpool && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-line bg-raised px-3 py-2">
              <span className="text-[11px] text-muted">{t('Current remaining')}</span>
              <span className="font-mono text-sm tabular text-ink">{formatGrams(adjustSpool.remainingGrams)}</span>
            </div>
            <Segmented
              value={adjustMode}
              onChange={setAdjustMode}
              options={[
                { value: 'deduct', label: t('Deduct used') },
                { value: 'add', label: t('Add stock') },
              ]}
            />
            <Field label={t('Amount (g)')}>
              <input
                type="number"
                min={0}
                step={1}
                className="field font-mono text-lg tabular-nums"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(Math.max(0, num(e.target.value)))}
                autoFocus
              />
            </Field>
            <p className="text-[11px] text-muted">
              {t('New remaining:')}{' '}
              <span className="font-mono text-ink">
                {Math.max(
                  0,
                  Math.min(
                    adjustSpool.totalGrams,
                    adjustSpool.remainingGrams + (adjustMode === 'deduct' ? -Math.abs(adjustAmount) : Math.abs(adjustAmount)),
                  ),
                ).toFixed(0)}
                g
              </span>
            </p>
          </div>
        )}
      </Modal>

      {/* Hardware editor */}
      <Modal
        open={hardwareOpen}
        onClose={() => setHardwareOpen(false)}
        title={
          hardwareDraft && state.hardware.some((h) => h.id === hardwareDraft.id)
            ? t('Edit hardware item')
            : t('Add hardware item')
        }
        subtitle={t('Consumables, spare parts and packaging.')}
        size="md"
        footer={
          <div className="flex items-center justify-between">
            {hardwareDraft && state.hardware.some((h) => h.id === hardwareDraft.id) ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  dispatch({ type: 'deleteHardware', id: hardwareDraft.id });
                  setHardwareOpen(false);
                }}
              >
                <Trash2 size={14} /> {t('Delete')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setHardwareOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button variant="primary" size="sm" onClick={saveHardware}>
                {t('Save item')}
              </Button>
            </div>
          </div>
        }
      >
        {hardwareDraft && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label={t('Item name')} className="sm:col-span-2">
              <input
                className="field"
                value={hardwareDraft.name}
                onChange={(e) => setHardwareDraft({ ...hardwareDraft, name: e.target.value })}
                placeholder="Nozzle 0.4 mm hardened"
              />
            </Field>
            <Field label={t('Category')}>
              <select
                className="field"
                value={hardwareDraft.category}
                onChange={(e) => setHardwareDraft({ ...hardwareDraft, category: e.target.value as HardwareItem['category'] })}
              >
                {HARDWARE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('Unit')}>
              <input
                className="field"
                value={hardwareDraft.unit}
                onChange={(e) => setHardwareDraft({ ...hardwareDraft, unit: e.target.value || 'pcs' })}
              />
            </Field>
            <Field label={t('Quantity')}>
              <input
                type="number"
                min={0}
                className="field font-mono tabular-nums"
                value={hardwareDraft.quantity}
                onChange={(e) => setHardwareDraft({ ...hardwareDraft, quantity: Math.max(0, num(e.target.value)) })}
              />
            </Field>
            <Field label={t('Low-stock threshold')}>
              <input
                type="number"
                min={0}
                className="field font-mono tabular-nums"
                value={hardwareDraft.lowStockThreshold}
                onChange={(e) => setHardwareDraft({ ...hardwareDraft, lowStockThreshold: Math.max(0, num(e.target.value)) })}
              />
            </Field>
            <Field label={t('Unit cost')}>
              <input
                type="number"
                min={0}
                step={0.01}
                className="field font-mono tabular-nums"
                value={hardwareDraft.unitCost}
                onChange={(e) => setHardwareDraft({ ...hardwareDraft, unitCost: Math.max(0, num(e.target.value)) })}
              />
            </Field>
            <Field label={t('Location')}>
              <input
                className="field"
                value={hardwareDraft.location ?? ''}
                onChange={(e) => setHardwareDraft({ ...hardwareDraft, location: e.target.value })}
                placeholder="Drawer 1"
              />
            </Field>
          </div>
        )}
      </Modal>

      <LabelsModal
        open={labelsOpen}
        onClose={() => setLabelsOpen(false)}
        spools={state.spools}
        initialIds={labelIds}
        farmName={state.settings.farmName}
      />
    </div>
  );
}
