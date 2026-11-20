import { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Gauge,
  Printer as PrinterIcon,
  ScanLine,
  Sparkles,
  TimerReset,
  TrendingUp,
  Wrench,
  Zap,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFarm } from '../context/FarmContext';
import { useT } from '../hooks/useT';
import type { Printer } from '../types/farm';
import { useNow } from '../hooks/useNow';
import { formatCountdown, formatGrams, formatHours, formatNumber, percent } from '../utils/format';
import { Badge, Button, Card, EmptyState, Progress, SectionTitle, Stat, cn } from '../components/ui';

export function Dashboard({
  onNavigate,
  onScan,
  onNewQuote,
}: {
  onNavigate: (tab: 'calculator' | 'inventory' | 'orders' | 'printers') => void;
  onScan: () => void;
  onNewQuote: () => void;
}) {
  const { state, dispatch, money } = useFarm();
  const t = useT();
  const now = useNow(1000);

  const telemetry = useMemo(() => {
    const printing = state.printers.filter((p) => p.status === 'printing');
    const idle = state.printers.filter((p) => p.status === 'idle');
    const maintenance = state.printers.filter((p) => p.status === 'maintenance');
    const bedClearing = state.printers.filter((p) => p.status === 'bed_clearing');

    const inventoryValue = state.spools.reduce((sum, s) => sum + (s.remainingGrams / 1000) * s.costPerKg, 0);
    const activeOrders = state.orders.filter((o) => o.status !== 'ready');
    const activeRevenue = activeOrders.reduce((sum, o) => sum + o.totalPrice, 0);
    const unpaid = state.orders.filter((o) => o.paymentStatus !== 'paid').reduce((s, o) => s + o.totalPrice, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEntries = state.ledger.filter((e) => new Date(e.date) >= monthStart);
    const monthRevenue = monthEntries.reduce((s, e) => s + e.revenue, 0);
    const monthProfit = monthEntries.reduce((s, e) => s + e.profit, 0);
    const allRevenue = state.ledger.reduce((s, e) => s + e.revenue, 0);
    const allProfit = state.ledger.reduce((s, e) => s + e.profit, 0);

    return {
      printing,
      idle,
      maintenance,
      bedClearing,
      inventoryValue,
      activeOrders,
      activeRevenue,
      unpaid,
      monthRevenue,
      monthProfit,
      allRevenue,
      allProfit,
    };
  }, [state]);

  const monthSeries = useMemo(() => {
    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (5 - i));
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString(undefined, { month: 'short' }),
        revenue: 0,
        profit: 0,
      };
    });
    for (const entry of state.ledger) {
      const d = new Date(entry.date);
      const bucket = buckets.find((b) => b.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (bucket) {
        bucket.revenue += entry.revenue;
        bucket.profit += entry.profit;
      }
    }
    return buckets.map((b) => ({ ...b, revenue: Math.round(b.revenue), profit: Math.round(b.profit) }));
  }, [state.ledger]);

  const alerts = useMemo(() => {
    const list: Array<{
      id: string;
      tone: 'bad' | 'warn' | 'info';
      icon: typeof AlertTriangle;
      title: string;
      detail: string;
      action: string;
      onClick: () => void;
    }> = [];

    for (const spool of state.spools) {
      if (spool.remainingGrams < state.settings.lowStockThreshold) {
        list.push({
          id: `spool-${spool.id}`,
          tone: spool.remainingGrams < 100 ? 'bad' : 'warn',
          icon: Boxes,
          title: t('{material} {color} low', { material: spool.material, color: spool.colorName }),
          detail: t('{grams} left · {brand} · {location}', {
            grams: formatGrams(spool.remainingGrams),
            brand: spool.brand,
            location: spool.location,
          }),
          action: t('Restock'),
          onClick: () => onNavigate('inventory'),
        });
      }
    }

    for (const printer of state.printers) {
      for (const task of printer.maintenanceTasks) {
        const used = printer.totalHours - task.lastDoneHours;
        if (task.intervalHours > 0 && used >= task.intervalHours) {
          list.push({
            id: `task-${printer.id}-${task.id}`,
            tone: used > task.intervalHours * 1.15 ? 'bad' : 'warn',
            icon: Wrench,
            title: t('{printer}: {task}', { printer: printer.name, task: t(task.label) }),
            detail: t('{used} / {interval} service interval', {
              used: formatHours(printer.totalHours),
              interval: formatHours(task.intervalHours),
            }),
            action: t('Service'),
            onClick: () => onNavigate('printers'),
          });
        }
      }
    }

    for (const order of state.orders) {
      if (order.status === 'ready') continue;
      const hours = (new Date(order.dueDate).getTime() - now) / 3600_000;
      if (hours <= 48) {
        list.push({
          id: `due-${order.id}`,
          tone: hours < 0 ? 'bad' : hours < 24 ? 'warn' : 'info',
          icon: ClipboardList,
          title: t('{number} due {state}', {
            number: order.orderNumber,
            state: hours < 0 ? t('overdue') : t('due soon'),
          }),
          detail: t('{client} · {part} · {printed}/{qty} printed', {
            client: order.clientName,
            part: order.partName,
            printed: order.printedQty,
            qty: order.quantity,
          }),
          action: t('Open'),
          onClick: () => onNavigate('orders'),
        });
      }
    }

    const order = { bad: 0, warn: 1, info: 2 };
    return list.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 6);
  }, [state.spools, state.printers, state.orders, state.settings.lowStockThreshold, now, onNavigate, t]);

  const upcoming = [...state.orders]
    .filter((o) => o.status !== 'ready')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-4">
      {/* Status strip */}
      <Card className="tech-grid relative overflow-hidden p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-maker/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="label">{t('Live farm telemetry')}</span>
            </div>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight sm:text-xl">
              {telemetry.printing.length
                ? t('{n} machines extruding · {farm}', {
                    n: telemetry.printing.length,
                    farm: state.settings.farmName || t('Your farm'),
                  })
                : t('{farm} is idle and ready', { farm: state.settings.farmName || t('Your farm') })}
            </h2>
            <p className="mt-1 text-xs text-muted">
              {t('{printers} printers · {spools} spools · {orders} orders · {grams} on shelf', {
                printers: formatNumber(state.printers.length),
                spools: formatNumber(state.spools.length),
                orders: formatNumber(state.orders.length),
                grams: formatGrams(state.spools.reduce((s, sp) => s + sp.remainingGrams, 0)),
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onScan}>
              <ScanLine size={14} /> {t('Scan spool')}
            </Button>
            <Button variant="primary" size="sm" onClick={onNewQuote}>
              <Sparkles size={14} /> {t('New quote')}
            </Button>
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: t('Printing'), value: telemetry.printing.length, tone: 'text-cyan-500 dark:text-cyan-400', icon: Zap },
            { label: t('Bed clearing'), value: telemetry.bedClearing.length, tone: 'text-amber-500 dark:text-amber-400', icon: TimerReset },
            { label: t('Ready'), value: telemetry.idle.length, tone: 'text-emerald-500 dark:text-emerald-400', icon: CheckCircle2 },
            { label: t('Maintenance'), value: telemetry.maintenance.length, tone: 'text-rose-500 dark:text-rose-400', icon: Wrench },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center justify-between rounded-lg border border-line bg-raised/70 px-2.5 py-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted">{s.label}</p>
                  <p className={cn('font-mono text-lg font-semibold tabular', s.tone)}>{s.value}</p>
                </div>
                <Icon size={16} className={s.tone} />
              </div>
            );
          })}
        </div>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat
          label={t('Filament on shelf')}
          value={money(telemetry.inventoryValue, 0)}
          sub={t('{grams} across {n} spools', {
            grams: formatGrams(state.spools.reduce((s, sp) => s + sp.remainingGrams, 0)),
            n: state.spools.length,
          })}
          icon={<Boxes size={16} />}
          tone="maker"
        />
        <Stat
          label={t('Active order revenue')}
          value={money(telemetry.activeRevenue, 0)}
          sub={t('{n} open · {money} outstanding', {
            n: telemetry.activeOrders.length,
            money: money(telemetry.unpaid, 0),
          })}
          icon={<CircleDollarSign size={16} />}
          tone="info"
        />
        <Stat
          label={t('Net profit · this month')}
          value={money(telemetry.monthProfit, 0)}
          sub={t('{money} revenue logged', { money: money(telemetry.monthRevenue, 0) })}
          icon={<TrendingUp size={16} />}
          tone={telemetry.monthProfit >= 0 ? 'ok' : 'bad'}
        />
        <Stat
          label={t('All-time profit')}
          value={money(telemetry.allProfit, 0)}
          sub={t('{money} lifetime revenue', { money: money(telemetry.allRevenue, 0) })}
          icon={<Activity size={16} />}
          tone="ok"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {/* Printer grid */}
          <div>
            <SectionTitle
              title={t('Live printer farm')}
              hint={t('Countdowns survive refreshes — timestamps are persisted.')}
              icon={<PrinterIcon size={15} />}
              action={
                <Button variant="ghost" size="sm" onClick={() => onNavigate('printers')}>
                  {t('Manage fleet')} <ArrowRight size={13} />
                </Button>
              }
            />
            {state.printers.length === 0 ? (
              <EmptyState
                className="mt-2 bg-panel"
                icon={<PrinterIcon size={18} />}
                title={t('No printers on the farm yet')}
                body={t('Add your machines to unlock live status, odometers and maintenance schedules.')}
                action={<Button onClick={() => onNavigate('printers')}>{t('Add first printer')}</Button>}
              />
            ) : (
              <div className="mt-2 grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
                {state.printers.map((printer) => (
                  <PrinterCard key={printer.id} printer={printer} now={now} onOpen={() => onNavigate('printers')} />
                ))}
              </div>
            )}
          </div>

          {/* Revenue chart */}
          <Card className="p-3.5 sm:p-4">
            <SectionTitle
              title={t('Revenue vs net profit')}
              hint={t('Last six months, from the job ledger.')}
              icon={<TrendingUp size={15} />}
            />
            <div className="mt-3 h-[190px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthSeries} margin={{ top: 6, right: 4, left: -18, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: 11,
                      color: 'var(--text)',
                    }}
                    formatter={(value: number, name: string) => [money(value, 0), name === 'revenue' ? t('Revenue') : t('Net profit')]}
                  />
                  <Bar dataKey="revenue" fill="#27272A" radius={[3, 3, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="profit" fill="#F97316" radius={[3, 3, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex items-center gap-4 text-[10px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-zinc-700" /> {t('Revenue')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-maker" /> {t('Net profit')}
              </span>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Alerts */}
          <Card className="p-3.5 sm:p-4">
            <SectionTitle
              title={t('Action required')}
              hint={t('{n} items on the board', { n: alerts.length })}
              icon={<AlertTriangle size={15} />}
              action={<Badge tone={alerts.length ? 'warn' : 'ok'}>{alerts.length ? t('Attention') : t('Clear')}</Badge>}
            />
            <div className="mt-2.5 space-y-1.5">
              {alerts.length === 0 && (
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-6 text-center">
                  <CheckCircle2 size={20} className="mx-auto mb-2 text-emerald-500" />
                  <p className="text-xs font-medium text-ink">{t('All systems nominal')}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{t('No low spools, overdue service or near-due orders.')}</p>
                </div>
              )}
              {alerts.map((alert) => {
                const Icon = alert.icon;
                return (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={alert.onClick}
                    className="group flex w-full items-start gap-2.5 rounded-lg border border-line bg-raised/60 px-2.5 py-2 text-left transition-colors hover:border-maker/40"
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md',
                        alert.tone === 'bad'
                          ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400'
                          : alert.tone === 'warn'
                            ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400'
                            : 'bg-cyan-500/10 text-cyan-500 dark:text-cyan-400',
                      )}
                    >
                      <Icon size={13} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-semibold text-ink">{alert.title}</span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-muted">{alert.detail}</span>
                    </span>
                    <span className="mt-0.5 flex-shrink-0 text-[10px] font-medium text-muted transition-colors group-hover:text-maker">
                      {alert.action}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Upcoming */}
          <Card className="p-3.5 sm:p-4">
            <SectionTitle
              title={t('Next out the door')}
              hint={t('Orders sorted by deadline')}
              icon={<ClipboardList size={15} />}
              action={
                <Button variant="ghost" size="sm" onClick={() => onNavigate('orders')}>
                  {t('All')}
                </Button>
              }
            />
            <div className="mt-2.5 divide-y divide-line">
              {upcoming.length === 0 && <p className="py-6 text-center text-xs text-muted">{t('No open production orders.')}</p>}
              {upcoming.map((order) => {
                const due = new Date(order.dueDate);
                const hours = (due.getTime() - now) / 3600_000;
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => onNavigate('orders')}
                    className="flex w-full items-center gap-2.5 py-2.5 text-left"
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-line bg-raised font-mono text-[10px] text-muted">
                      {order.orderNumber.replace('PF-', '')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium text-ink">{order.partName}</span>
                      <span className="block truncate text-[10px] text-muted">
                        {order.clientName} · {order.printedQty}/{order.quantity} {t('pcs')}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'flex-shrink-0 font-mono text-[10px] tabular',
                        hours < 0 ? 'text-rose-400' : hours < 24 ? 'text-amber-400' : 'text-muted',
                      )}
                    >
                      {hours < 0
                        ? t('{n}d late', { n: Math.ceil(-hours / 24) })
                        : t('{n}h', { n: Math.max(1, Math.round(hours)) })}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] text-muted">
                <Gauge size={14} /> {t('Farm utilisation')}
              </div>
              <span className="font-mono text-[11px] tabular text-ink">
                {percent(telemetry.printing.length, Math.max(1, state.printers.length)).toFixed(0)}%
              </span>
            </div>
            <Progress
              value={telemetry.printing.length}
              max={Math.max(1, state.printers.length)}
              tone="info"
              height={5}
              className="mt-2"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={() => onNavigate('inventory')}>
                <Boxes size={13} /> {t('Spools')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onNavigate('orders')}>
                <ClipboardList size={13} /> {t('Kanban')}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function printerHealth(printer: Printer): { worst: number; label: string; used: number; interval: number } {
  let worst = 100;
  let label = 'No service schedule';
  let used = 0;
  let interval = 0;
  for (const task of printer.maintenanceTasks) {
    if (!task.intervalHours || task.intervalHours <= 0) continue;
    const since = Math.max(0, printer.totalHours - task.lastDoneHours);
    const pct = Math.max(0, Math.min(100, 100 - (since / task.intervalHours) * 100));
    if (pct < worst) {
      worst = pct;
      label = task.label;
      used = since;
      interval = task.intervalHours;
    }
  }
  return { worst, label, used, interval };
}

function PrinterCard({ printer, now, onOpen }: { printer: Printer; now: number; onOpen: () => void }) {
  const { state, dispatch } = useFarm();
  const t = useT();
  const spool = state.spools.find((s) => s.id === printer.loadedSpoolId);
  const health = printerHealth(printer);
  const job = printer.currentJob;
  const remainingSeconds = job?.endsAt ? Math.max(0, Math.floor((job.endsAt - now) / 1000)) : 0;
  const elapsedPct =
    job?.endsAt && job.startedAt ? Math.max(0, Math.min(100, ((now - job.startedAt) / (job.endsAt - job.startedAt)) * 100)) : 0;

  const statusBadge =
    printer.status === 'printing'
      ? { label: t('Printing'), tone: 'info' as const }
      : printer.status === 'idle'
        ? { label: t('Idle / Ready'), tone: 'ok' as const }
        : printer.status === 'bed_clearing'
          ? { label: t('Bed Clearing'), tone: 'warn' as const }
          : { label: t('Maintenance'), tone: 'bad' as const };

  return (
    <Card className="relative flex flex-col overflow-hidden p-3.5">
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-[2px]',
          printer.status === 'printing'
            ? 'bg-cyan-500'
            : printer.status === 'idle'
              ? 'bg-emerald-500/60'
              : printer.status === 'bed_clearing'
                ? 'bg-amber-500'
                : 'bg-rose-500',
        )}
      />
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <p className="truncate text-[13px] font-semibold text-ink">{printer.name}</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
            {printer.nozzle} · {formatHours(printer.totalHours)}
          </p>
        </button>
        <Badge tone={statusBadge.tone} dot>
          {statusBadge.label}
        </Badge>
      </div>

      {printer.status === 'printing' ? (
        <div className="mt-3 rounded-lg border border-line bg-raised/70 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[11px] font-medium text-ink">{job?.name ?? 'Active job'}</span>
            <span className="flex-shrink-0 font-mono text-[10px] text-cyan-500 dark:text-cyan-400">
              {formatNumber(Math.round(elapsedPct))}%
            </span>
          </div>
          <div className="mt-1 flex items-end justify-between gap-2">
            <span className="font-mono text-[22px] font-semibold leading-none tabular text-ink">
              {formatCountdown(job?.endsAt ?? null, now)}
            </span>
            <span className="pb-0.5 text-[10px] text-muted">{t('remaining')}</span>
          </div>
          <Progress value={elapsedPct} tone="info" height={4} className="mt-2" />
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-dashed border-line px-2.5 py-3">
          <span className="text-[11px] text-muted">
            {printer.status === 'idle'
              ? t('Bed clear · ready to slice')
              : printer.status === 'bed_clearing'
                ? t('Part removal pending')
                : t('Service in progress')}
          </span>
          <span className="font-mono text-[10px] text-muted">{formatNumber(printer.powerDrawW)} W</span>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2 text-[10px]">
        {spool ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-white/20"
              style={{ background: spool.colorHex }}
            />
            <span className="truncate text-muted">
              {spool.material} {spool.colorName}
            </span>
            <span className="flex-shrink-0 font-mono tabular text-ink">{formatGrams(spool.remainingGrams)}</span>
          </span>
        ) : (
          <span className="text-muted">{t('No spool loaded')}</span>
        )}
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="flex min-w-0 items-center gap-1 text-muted">
            <Wrench size={10} className="flex-shrink-0" />
            <span className="truncate">{t(health.label)}</span>
          </span>
          <span
            className={cn(
              'flex-shrink-0 font-mono tabular',
              health.worst < 15 ? 'text-rose-400' : health.worst < 40 ? 'text-amber-400' : 'text-muted',
            )}
          >
            {health.interval ? `${formatNumber(Math.round(health.used))}/${formatNumber(health.interval)}h` : '—'}
          </span>
        </div>
        <Progress
          value={health.worst}
          tone={health.worst < 15 ? 'bad' : health.worst < 40 ? 'warn' : 'ok'}
          height={4}
          className="mt-1"
        />
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {printer.status === 'printing' ? (
          <>
            <Button
              size="sm"
              variant="primary"
              className="flex-1"
              onClick={() => dispatch({ type: 'completePrinterJob', id: printer.id })}
            >
              <CheckCircle2 size={13} /> {t('Mark done')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => dispatch({ type: 'setPrinterStatus', id: printer.id, status: 'bed_clearing' })}
              title={t('Needs bed clearing')}
            >
              <TimerReset size={13} />
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant={printer.status === 'idle' ? 'secondary' : 'outline'}
              className="flex-1"
              onClick={() => dispatch({ type: 'setPrinterStatus', id: printer.id, status: 'idle' })}
            >
              {t('Ready')}
            </Button>
            <Button
              size="sm"
              variant={printer.status === 'maintenance' ? 'danger' : 'secondary'}
              onClick={() => dispatch({ type: 'setPrinterStatus', id: printer.id, status: 'maintenance' })}
              title={t('Flag maintenance')}
            >
              <Wrench size={13} />
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
