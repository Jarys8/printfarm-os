import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Gauge,
  History,
  Pencil,
  Plus,
  Printer as PrinterIcon,
  Trash2,
  Wrench,
  Zap,
} from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { useT } from '../hooks/useT';
import type { MaintenanceTask, Printer, PrinterStatus } from '../types/farm';
import { PRINTER_STATUS_META, formatDate, formatGrams, formatHours, formatNumber, machineDepreciation, percent, uid } from '../utils/format';
import { Badge, Button, Card, EmptyState, Field, Modal, Progress, SectionTitle, cn } from '../components/ui';

interface PrinterDraft {
  name: string;
  model: string;
  buildVolume: string;
  powerDrawW: number;
  purchasePrice: number;
  lifespanHours: number;
  nozzle: string;
  totalHours: number;
  status: PrinterStatus;
  loadedSpoolId: string;
  notes: string;
}

const num = (v: string): number => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

function emptyPrinterDraft(): PrinterDraft {
  return {
    name: '',
    model: 'Bambu Lab P1S',
    buildVolume: '256 × 256 × 256 mm',
    powerDrawW: 350,
    purchasePrice: 699,
    lifespanHours: 5000,
    nozzle: '0.4 mm hardened steel',
    totalHours: 0,
    status: 'idle',
    loadedSpoolId: '',
    notes: '',
  };
}

export function Printers() {
  const { state, dispatch, money } = useFarm();
  const t = useT();
  const [printerDraft, setPrinterDraft] = useState<PrinterDraft | null>(null);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [taskDraft, setTaskDraft] = useState<{ printerId: string; task: MaintenanceTask } | null>(null);

  const openNew = () => {
    setEditingPrinter(null);
    setPrinterDraft(emptyPrinterDraft());
  };

  const openEdit = (printer: Printer) => {
    setEditingPrinter(printer);
    setPrinterDraft({
      name: printer.name,
      model: printer.model,
      buildVolume: printer.buildVolume,
      powerDrawW: printer.powerDrawW,
      purchasePrice: printer.purchasePrice,
      lifespanHours: printer.lifespanHours,
      nozzle: printer.nozzle,
      totalHours: printer.totalHours,
      status: printer.status,
      loadedSpoolId: printer.loadedSpoolId ?? '',
      notes: printer.notes ?? '',
    });
  };

  const savePrinter = () => {
    if (!printerDraft) return;
    const printer: Printer = {
      id: editingPrinter?.id ?? uid('printer'),
      name: printerDraft.name.trim() || 'New printer',
      model: printerDraft.model.trim() || 'Custom build',
      buildVolume: printerDraft.buildVolume,
      powerDrawW: Math.max(0, printerDraft.powerDrawW),
      purchasePrice: Math.max(0, printerDraft.purchasePrice),
      lifespanHours: Math.max(1, printerDraft.lifespanHours),
      nozzle: printerDraft.nozzle,
      totalHours: Math.max(0, printerDraft.totalHours),
      status: printerDraft.status,
      currentJob: editingPrinter?.currentJob ?? null,
      loadedSpoolId: printerDraft.loadedSpoolId || null,
      maintenanceTasks: editingPrinter?.maintenanceTasks ?? [],
      notes: printerDraft.notes,
      acquiredAt: editingPrinter?.acquiredAt ?? null,
    };
    dispatch({ type: 'upsertPrinter', printer });
    setPrinterDraft(null);
    setEditingPrinter(null);
  };

  const fleet = useMemo(() => {
    const hours = state.printers.reduce((s, p) => s + p.totalHours, 0);
    const value = state.printers.reduce((s, p) => s + p.purchasePrice, 0);
    const overdue = state.printers.reduce(
      (sum, p) => sum + p.maintenanceTasks.filter((t) => p.totalHours - t.lastDoneHours >= t.intervalHours).length,
      0,
    );
    return { hours, value, overdue };
  }, [state.printers]);

  const logs = useMemo(
    () => [...state.maintenanceLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10),
    [state.maintenanceLogs],
  );

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Card className="p-3">
          <p className="label">{t('Machines')}</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular">{state.printers.length}</p>
          <p className="text-[10px] text-muted">{t('in the fleet')}</p>
        </Card>
        <Card className="p-3">
          <p className="label">{t('Farm odometer')}</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular">{formatHours(fleet.hours)}</p>
          <p className="text-[10px] text-muted">{t('logged print hours')}</p>
        </Card>
        <Card className="p-3">
          <p className="label">{t('Fleet asset value')}</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular">{money(fleet.value, 0)}</p>
          <p className="text-[10px] text-muted">{t('purchase cost')}</p>
        </Card>
        <Card className="p-3">
          <p className="label">{t('Overdue services')}</p>
          <p className={cn('mt-1 font-mono text-lg font-semibold tabular', fleet.overdue ? 'text-rose-500 dark:text-rose-400' : '')}>
            {fleet.overdue}
          </p>
          <p className="text-[10px] text-muted">{fleet.overdue ? t('reset intervals below') : t('all intervals healthy')}</p>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <SectionTitle
          title={t('Fleet')}
          hint={t('Machine specs, odometers and preventive maintenance.')}
          icon={<PrinterIcon size={15} />}
        />
        <Button variant="primary" size="sm" onClick={openNew}>
          <Plus size={14} /> {t('Add printer')}
        </Button>
      </div>

      {state.printers.length === 0 ? (
        <EmptyState
          icon={<PrinterIcon size={18} />}
          title={t('No printers configured')}
          body={t('Add your machines so jobs can accrue print hours and service intervals.')}
          action={<Button onClick={openNew}>{t('Add first printer')}</Button>}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {state.printers.map((printer) => {
            const spool = state.spools.find((s) => s.id === printer.loadedSpoolId);
            const lifePct = percent(printer.totalHours, printer.lifespanHours);
            const status = PRINTER_STATUS_META[printer.status];
            return (
              <Card key={printer.id} className="flex flex-col overflow-hidden">
                <div
                  className={cn(
                    'h-1 w-full',
                    printer.status === 'printing'
                      ? 'bg-cyan-500'
                      : printer.status === 'idle'
                        ? 'bg-emerald-500'
                        : printer.status === 'bed_clearing'
                          ? 'bg-amber-500'
                          : 'bg-rose-500',
                  )}
                />
                <div className="flex flex-1 flex-col p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[13px] font-semibold text-ink">{printer.name}</h3>
                      <p className="truncate text-[11px] text-muted">
                        {printer.model} · {printer.buildVolume}
                      </p>
                    </div>
                    <Badge tone={status.tone} dot>
                      {status.label}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-lg border border-line bg-raised/60 p-2">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-muted">{t('Nozzle')}</p>
                      <p className="truncate font-mono text-[10px] text-ink">{printer.nozzle}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-muted">{t('Power')}</p>
                      <p className="flex items-center gap-1 font-mono text-[10px] text-ink">
                        <Zap size={9} /> {formatNumber(printer.powerDrawW)} W
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-muted">{t('Depreciation')}</p>
                      <p className="font-mono text-[10px] text-ink">{money(machineDepreciation(printer))}/h</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-muted">{t('Loaded spool')}</p>
                      <p className="flex items-center gap-1 truncate font-mono text-[10px] text-ink">
                        {spool ? (
                          <>
                            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: spool.colorHex }} />
                            <span className="truncate">{spool.colorName}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="flex items-center gap-1 text-muted">
                        <Gauge size={11} /> {t('Odometer')}
                      </span>
                      <span className="text-ink">
                        {formatHours(printer.totalHours)} / {formatHours(printer.lifespanHours)}
                      </span>
                    </div>
                    <Progress value={lifePct} tone={lifePct > 85 ? 'warn' : 'info'} height={4} className="mt-1" />
                  </div>

                  <div className="mt-3 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="label">{t('Maintenance')}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setTaskDraft({
                            printerId: printer.id,
                            task: { id: uid('task'), label: '', intervalHours: 250, lastDoneHours: printer.totalHours },
                          })
                        }
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-muted transition-colors hover:text-maker"
                      >
                        <Plus size={11} /> Task
                      </button>
                    </div>
                    <div className="mt-1.5 space-y-1.5">
                      {printer.maintenanceTasks.length === 0 && (
                        <p className="rounded-lg border border-dashed border-line px-2 py-3 text-center text-[10px] text-muted">
                          {t('No service intervals yet.')}
                        </p>
                      )}
                      {printer.maintenanceTasks.map((task) => {
                        const used = Math.max(0, printer.totalHours - task.lastDoneHours);
                        const remaining = task.intervalHours - used;
                        const health = Math.max(0, Math.min(100, (remaining / Math.max(1, task.intervalHours)) * 100));
                        const overdue = remaining <= 0;
                        const dueSoon = remaining > 0 && remaining < task.intervalHours * 0.15;
                        return (
                          <div key={task.id} className="rounded-lg border border-line bg-raised/40 px-2 py-1.5">
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0">
                                <p className="truncate text-[10px] font-medium text-ink">{task.label}</p>
                                <p className="font-mono text-[9px] text-muted">
                                  {Math.round(used)}h / {task.intervalHours}h
                                  {task.lastDoneAt ? ` · last ${formatDate(task.lastDoneAt)}` : ''}
                                </p>
                              </div>
                              <div className="flex flex-shrink-0 items-center gap-0.5">
                                {overdue ? (
                                  <Badge tone="bad">Due</Badge>
                                ) : dueSoon ? (
                                  <Badge tone="warn">Soon</Badge>
                                ) : (
                                  <span className="font-mono text-[9px] text-muted">{Math.max(0, Math.round(remaining))}h</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => dispatch({ type: 'logMaintenance', printerId: printer.id, taskId: task.id })}
                                  title={t('Log service & reset interval')}
                                  className="flex h-6 w-6 items-center justify-center rounded text-muted transition-colors hover:bg-panel hover:text-emerald-400"
                                >
                                  <CheckCircle2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => dispatch({ type: 'removeMaintenanceTask', printerId: printer.id, taskId: task.id })}
                                  title={t('Remove task')}
                                  className="flex h-6 w-6 items-center justify-center rounded text-muted transition-colors hover:bg-panel hover:text-rose-400"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                            <Progress value={health} tone={overdue ? 'bad' : dueSoon ? 'warn' : 'ok'} height={3} className="mt-1" />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5">
                    <select
                      value={printer.status}
                      onChange={(e) => dispatch({ type: 'setPrinterStatus', id: printer.id, status: e.target.value as PrinterStatus })}
                      className="field h-8 flex-1 py-1 text-[11px]"
                      aria-label={`Status for ${printer.name}`}
                    >
                      <option value="idle">{t('Idle / Ready')}</option>
                      <option value="printing">{t('Printing')}</option>
                      <option value="bed_clearing">{t('Bed clearing')}</option>
                      <option value="maintenance">{t('Maintenance')}</option>
                    </select>
                    <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => openEdit(printer)} aria-label={`Edit ${printer.name}`}>
                      <Pencil size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Delete ${printer.name}`}
                      onClick={() => {
                        if (window.confirm(t('Remove {name}?', { name: printer.name }))) {
                          dispatch({ type: 'deletePrinter', id: printer.id });
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-3.5">
        <SectionTitle
          title={t('Service history')}
          hint={t('Every logged maintenance action with odometer reading')}
          icon={<History size={15} />}
          action={<Badge tone="muted">{state.maintenanceLogs.length} entries</Badge>}
        />
        {logs.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">{t('No service logged yet. Use the check icon on any interval.')}</p>
        ) : (
          <ul className="mt-2.5 divide-y divide-line">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center gap-2.5 py-2">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-500">
                  <Wrench size={12} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-ink">{log.taskLabel}</p>
                  <p className="truncate font-mono text-[10px] text-muted">{log.printerName}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="font-mono text-[10px] tabular text-ink">{formatNumber(log.hoursAt)}h</p>
                  <p className="font-mono text-[9px] text-muted">{formatDate(log.date)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Printer editor */}
      <Modal
        open={!!printerDraft}
        onClose={() => {
          setPrinterDraft(null);
          setEditingPrinter(null);
        }}
        title={editingPrinter ? t('Edit {name}', { name: editingPrinter.name }) : t('Add printer')}
        subtitle={t('Machine economics feed electricity and depreciation costs.')}
        size="lg"
        footer={
          <div className="flex items-center justify-between">
            {editingPrinter ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (window.confirm(t('Remove {name}?', { name: editingPrinter.name }))) {
                    dispatch({ type: 'deletePrinter', id: editingPrinter.id });
                    setPrinterDraft(null);
                    setEditingPrinter(null);
                  }
                }}
              >
                <Trash2 size={14} /> {t('Remove')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPrinterDraft(null);
                  setEditingPrinter(null);
                }}
              >
                {t('Cancel')}
              </Button>
              <Button variant="primary" size="sm" onClick={savePrinter}>
                {editingPrinter ? t('Save printer') : t('Add printer')}
              </Button>
            </div>
          </div>
        }
      >
        {printerDraft && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label={t('Printer name')}>
              <input className="field" value={printerDraft.name} onChange={(e) => setPrinterDraft({ ...printerDraft, name: e.target.value })} placeholder="Bambu Lab P1S #01" />
            </Field>
            <Field label="Model">
              <input className="field" value={printerDraft.model} onChange={(e) => setPrinterDraft({ ...printerDraft, model: e.target.value })} placeholder="Bambu Lab P1S" />
            </Field>
            <Field label={t('Build volume')}>
              <input className="field" value={printerDraft.buildVolume} onChange={(e) => setPrinterDraft({ ...printerDraft, buildVolume: e.target.value })} placeholder="256 × 256 × 256 mm" />
            </Field>
            <Field label={t('Nozzle installed')}>
              <input className="field" value={printerDraft.nozzle} onChange={(e) => setPrinterDraft({ ...printerDraft, nozzle: e.target.value })} placeholder="0.4 mm hardened steel" />
            </Field>
            <Field label={t('Average power draw (W)')}>
              <input
                type="number"
                min={0}
                className="field font-mono tabular-nums"
                value={printerDraft.powerDrawW}
                onChange={(e) => setPrinterDraft({ ...printerDraft, powerDrawW: Math.max(0, num(e.target.value)) })}
              />
            </Field>
            <Field label={t('Purchase price')}>
              <input
                type="number"
                min={0}
                className="field font-mono tabular-nums"
                value={printerDraft.purchasePrice}
                onChange={(e) => setPrinterDraft({ ...printerDraft, purchasePrice: Math.max(0, num(e.target.value)) })}
              />
            </Field>
            <Field
              label={t('Expected lifespan (hours)')}
              hint={`${t('Depreciation')} ≈ ${money(printerDraft.purchasePrice / Math.max(1, printerDraft.lifespanHours))}/h`}
            >
              <input
                type="number"
                min={1}
                className="field font-mono tabular-nums"
                value={printerDraft.lifespanHours}
                onChange={(e) => setPrinterDraft({ ...printerDraft, lifespanHours: Math.max(1, num(e.target.value)) })}
              />
            </Field>
            <Field label={t('Total print hours')}>
              <input
                type="number"
                min={0}
                className="field font-mono tabular-nums"
                value={printerDraft.totalHours}
                onChange={(e) => setPrinterDraft({ ...printerDraft, totalHours: Math.max(0, num(e.target.value)) })}
              />
            </Field>
            <Field label="Status">
              <select
                className="field"
                value={printerDraft.status}
                onChange={(e) => setPrinterDraft({ ...printerDraft, status: e.target.value as PrinterStatus })}
              >
                <option value="idle">{t('Idle / Ready')}</option>
                <option value="printing">{t('Printing')}</option>
                <option value="bed_clearing">{t('Bed clearing')}</option>
                <option value="maintenance">{t('Maintenance')}</option>
              </select>
            </Field>
            <Field label={t('Loaded spool')}>
              <select
                className="field"
                value={printerDraft.loadedSpoolId}
                onChange={(e) => setPrinterDraft({ ...printerDraft, loadedSpoolId: e.target.value })}
              >
                <option value="">None</option>
                {state.spools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.brand} {s.material} · {s.colorName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <textarea
                className="field min-h-[56px] font-sans"
                value={printerDraft.notes}
                onChange={(e) => setPrinterDraft({ ...printerDraft, notes: e.target.value })}
                placeholder="Enclosure, mods, AMS configuration…"
              />
            </Field>
            <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-line bg-raised/60 px-3 py-2">
              <span className="flex items-center gap-1.5 text-[11px] text-muted">
                <Activity size={12} /> {t('Expected cost per print hour')}
              </span>
              <span className="font-mono text-sm tabular text-ink">
                {money(machineDepreciation({ purchasePrice: printerDraft.purchasePrice, lifespanHours: printerDraft.lifespanHours }))}
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* Add task */}
      <Modal
        open={!!taskDraft}
        onClose={() => setTaskDraft(null)}
        title={t('Add maintenance task')}
        subtitle={t('Service interval triggers alerts on the dashboard and fleet cards.')}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setTaskDraft(null)}>
              {t('Cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (!taskDraft) return;
                if (!taskDraft.task.label.trim()) {
                  dispatch({ type: 'toast', kind: 'warn', message: t('Task needs a name') });
                  return;
                }
                dispatch({
                  type: 'addMaintenanceTask',
                  printerId: taskDraft.printerId,
                  task: { ...taskDraft.task, label: taskDraft.task.label.trim() },
                });
                setTaskDraft(null);
              }}
            >
              {t('Add task')}
            </Button>
          </div>
        }
      >
        {taskDraft && (
          <div className="space-y-2.5">
            <Field label="Task">
              <input
                className="field"
                value={taskDraft.task.label}
                onChange={(e) => setTaskDraft({ ...taskDraft, task: { ...taskDraft.task, label: e.target.value } })}
                placeholder="Clean carbon rods & lubricate rails"
                autoFocus
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('Interval (hours)')}>
                <input
                  type="number"
                  min={1}
                  className="field font-mono tabular-nums"
                  value={taskDraft.task.intervalHours}
                  onChange={(e) =>
                    setTaskDraft({ ...taskDraft, task: { ...taskDraft.task, intervalHours: Math.max(1, num(e.target.value)) } })
                  }
                />
              </Field>
              <Field label={t('Last done at (h)')}>
                <input
                  type="number"
                  min={0}
                  className="field font-mono tabular-nums"
                  value={taskDraft.task.lastDoneHours}
                  onChange={(e) =>
                    setTaskDraft({ ...taskDraft, task: { ...taskDraft.task, lastDoneHours: Math.max(0, num(e.target.value)) } })
                  }
                />
              </Field>
            </div>
            <p className="flex items-start gap-1.5 rounded-lg border border-line bg-raised px-2 py-1.5 text-[10px] leading-relaxed text-muted">
              <Clock size={11} className="mt-0.5 flex-shrink-0" />
              {t('Health is computed from current odometer minus “last done”. Logging service resets it automatically.')}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
