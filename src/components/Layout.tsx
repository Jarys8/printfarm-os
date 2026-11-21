import { useState } from 'react';
import {
  CalendarDays,
  Calculator,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Gauge,
  Layers,
  Moon,
  Plus,
  Printer,
  QrCode,
  ScanLine,
  Settings,
  Sun,
  Zap,
} from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { useT } from '../hooks/useT';
import { Badge, Button, Kbd, Modal, cn } from './ui';

export type Tab = 'dashboard' | 'calculator' | 'inventory' | 'orders' | 'printers' | 'settings';

export const NAV_ITEMS: Array<{ id: Tab; label: string; short: string; icon: typeof Gauge }> = [
  { id: 'dashboard', label: 'Command Center', short: 'Farm', icon: Gauge },
  { id: 'calculator', label: 'Quote Engine', short: 'Quote', icon: Calculator },
  { id: 'inventory', label: 'Filament & Stock', short: 'Stock', icon: Layers },
  { id: 'orders', label: 'Production Orders', short: 'Orders', icon: ClipboardList },
  { id: 'printers', label: 'Printer Fleet', short: 'Fleet', icon: Printer },
];

const PAGE_META: Record<Tab, { title: string; subtitle: string }> = {
  dashboard: { title: 'Command Center', subtitle: 'Live farm telemetry, throughput and what needs you next.' },
  calculator: { title: 'Quote Engine', subtitle: 'Slicer-aware costing, margins and client-ready quotes.' },
  inventory: { title: 'Filament & Stock', subtitle: 'Spools, weights, locations and consumables.' },
  orders: { title: 'Production Orders', subtitle: 'Kanban pipeline with inventory and finance sync.' },
  printers: { title: 'Printer Fleet', subtitle: 'Machine specs, odometers and preventive maintenance.' },
  settings: { title: 'Farm Settings', subtitle: 'Branding, rates, currency and data portability.' },
};

function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/10"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none">
        <path d="M4 8h16v4H4z" fill="#F97316" />
        <path d="M6.5 8V5.5h11V8" stroke="#F97316" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M12 12v3" stroke="#06B6D4" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M12 15.5 10 18h4z" fill="#06B6D4" />
        <path d="M8 21h8" stroke="#F97316" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function Layout({
  tab,
  onNavigate,
  onScan,
  onNewOrder,
  onNewQuote,
  onOpenSettings,
  children,
}: {
  tab: Tab;
  onNavigate: (tab: Tab) => void;
  onScan: () => void;
  onNewOrder: () => void;
  onNewQuote: () => void;
  onOpenSettings: () => void;
  children: React.ReactNode;
}) {
  const { state, dispatch } = useFarm();
  const t = useT();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('pfos:sidebar') === '1');
  const [quickOpen, setQuickOpen] = useState(false);

  const printing = state.printers.filter((p) => p.status === 'printing').length;
  const attention = state.printers.filter((p) => p.status === 'maintenance' || p.status === 'bed_clearing').length;
  const meta = PAGE_META[tab];

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('pfos:sidebar', next ? '1' : '0');
  };

  const theme = state.theme;

  return (
    <div className="app-shell min-h-dvh bg-surface text-ink">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-panel transition-[width] duration-200 md:flex',
          collapsed ? 'w-[76px]' : 'w-[248px]',
        )}
      >
        <div className={cn('flex h-16 items-center gap-2.5 border-b border-line px-4', collapsed && 'justify-center px-0')}>
          <LogoMark />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold leading-tight tracking-tight">PrintFarm OS</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{t('Farm operations')}</p>
            </div>
          )}
        </div>

        <div className={cn('mx-3 mt-3 rounded-lg border border-line bg-raised p-2.5', collapsed && 'mx-2 flex justify-center p-2')}>
          {collapsed ? (
            <span className="relative flex h-2 w-2">
              <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60', printing ? 'animate-ping bg-cyan-400' : 'bg-emerald-400')} />
              <span className={cn('relative inline-flex h-2 w-2 rounded-full', printing ? 'bg-cyan-400' : 'bg-emerald-400')} />
            </span>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="label">{t('Farm status')}</span>
                <span className={cn('h-1.5 w-1.5 rounded-full', printing ? 'bg-cyan-400' : 'bg-emerald-400')} />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="font-mono text-lg font-semibold tabular">{printing}</span>
                <span className="text-[11px] text-muted">/ {state.printers.length} {t('printing')}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge tone={attention ? 'bad' : 'ok'}>
                  {attention ? `${attention} ${t('need service')}` : t('All nominal')}
                </Badge>
              </div>
            </>
          )}
        </div>

        <nav className="mt-3 flex-1 space-y-1 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[13px] font-medium transition-colors',
                  active ? 'bg-maker-soft text-orange-600 dark:text-orange-400' : 'text-muted hover:bg-raised hover:text-ink',
                  collapsed && 'justify-center px-0',
                )}
              >
                {active && <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r bg-maker" />}
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                {!collapsed && <span className="truncate">{t(item.label)}</span>}
                {!collapsed && active && <span className="ml-auto font-mono text-[10px] text-orange-500/70">{t(item.short)}</span>}
              </button>
            );
          })}
        </nav>

        <div className={cn('space-y-1 border-t border-line p-2', collapsed && 'flex flex-col items-center')}>
          <button
            type="button"
            onClick={onOpenSettings}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
              tab === 'settings' ? 'bg-raised text-ink' : 'text-muted hover:bg-raised hover:text-ink',
              collapsed && 'w-auto px-2',
            )}
            title="Farm settings"
          >
            <Settings size={17} />
            {!collapsed && t('Settings')}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'setTheme', theme: theme === 'dark' ? 'light' : 'dark' })}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-raised hover:text-ink',
              collapsed && 'w-auto px-2',
            )}
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            {!collapsed && (theme === 'dark' ? t('Light mode') : t('Dark mode'))}
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-raised hover:text-ink',
              collapsed && 'w-auto px-2',
            )}
            title="Collapse sidebar"
          >
            {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
            {!collapsed && t('Collapse')}
          </button>
          {!collapsed && (
            <div className="mt-1.5 hidden items-center gap-1.5 px-2.5 pb-1 lg:flex">
              <Kbd>N</Kbd>
              <span className="text-[10px] text-muted">{t('quote')}</span>
              <Kbd>S</Kbd>
              <span className="text-[10px] text-muted">{t('scan')}</span>
              <Kbd>K</Kbd>
              <span className="text-[10px] text-muted">{t('orders')}</span>
            </div>
          )}
        </div>
      </aside>

      <div className={cn('flex min-h-dvh flex-col transition-[padding] duration-200', collapsed ? 'md:pl-[76px]' : 'md:pl-[248px]')}>
        <header className="sticky top-0 z-20 border-b border-line bg-surface">
          <div className="flex h-14 items-center gap-3 px-3 sm:h-16 sm:px-5">
            <div className="md:hidden">
              <LogoMark size={32} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight sm:text-base">{t(meta.title)}</h1>
              <p className="hidden truncate text-[11px] text-muted sm:block">{t(meta.subtitle)}</p>
            </div>

            <div className="hidden items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-1.5 lg:flex">
              <CalendarDays size={13} className="text-muted" />
              <span className="font-mono text-[11px] text-muted">
                {new Date().toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}
              </span>
            </div>

            <Button variant="secondary" size="icon" onClick={onScan} title={t('Scan QR (S)')} aria-label={t('Scan QR code')}>
              <ScanLine size={17} />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => dispatch({ type: 'setTheme', theme: theme === 'dark' ? 'light' : 'dark' })}
              title={t('Toggle theme')}
              aria-label={t('Toggle color theme')}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={onOpenSettings}
              title="Settings"
              aria-label="Farm settings"
              className="hidden sm:inline-flex"
            >
              <Settings size={17} />
            </Button>
            <Button variant="primary" size="md" onClick={onNewQuote} className="hidden sm:inline-flex">
              <Plus size={15} /> {t('New quote')}
            </Button>
          </div>
        </header>

        <main className="flex-1 px-3 pb-28 pt-3 sm:px-5 sm:pt-4 md:pb-10">
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-6">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5 text-[9px] font-medium transition-colors',
                  active ? 'text-orange-500 dark:text-orange-400' : 'text-muted',
                )}
              >
                {active && <span className="absolute top-0 h-[2px] w-8 rounded-b bg-maker" />}
                <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
                <span>{t(item.short)}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-current={tab === 'settings' ? 'page' : undefined}
            aria-label={t('Farm settings')}
            className={cn(
              'relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5 text-[9px] font-medium transition-colors',
              tab === 'settings' ? 'text-orange-500 dark:text-orange-400' : 'text-muted',
            )}
          >
            {tab === 'settings' && <span className="absolute top-0 h-[2px] w-8 rounded-b bg-maker" />}
            <Settings size={19} strokeWidth={tab === 'settings' ? 2.3 : 1.8} />
            <span>{t('Settings')}</span>
          </button>
        </div>
      </nav>

      {/* Floating quick action */}
      <button
        type="button"
        onClick={() => setQuickOpen(true)}
        aria-label={t('Quick actions')}
        className="fixed bottom-[76px] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-maker text-zinc-950 shadow-[0_12px_30px_-8px_rgba(249,115,22,0.7)] transition-transform active:scale-95 md:hidden"
      >
        <Plus size={26} strokeWidth={2.4} />
      </button>

      <Modal open={quickOpen} onClose={() => setQuickOpen(false)} title={t('Quick actions')} subtitle={t('Workshop shortcuts')} size="sm">
        <div className="space-y-2">
          {[
            {
              icon: Calculator,
              label: 'New quote',
              hint: 'Cost a print and send a quote',
              action: () => {
                onNewQuote();
                setQuickOpen(false);
              },
            },
            {
              icon: ClipboardList,
              label: 'New order',
              hint: 'Push a job onto the Kanban',
              action: () => {
                onNewOrder();
                setQuickOpen(false);
              },
            },
            {
              icon: QrCode,
              label: 'Scan spool QR',
              hint: 'Look up a spool, log usage',
              action: () => {
                onScan();
                setQuickOpen(false);
              },
            },
            {
              icon: Layers,
              label: 'Open inventory',
              hint: 'Weigh, deduct, print labels',
              action: () => {
                onNavigate('inventory');
                setQuickOpen(false);
              },
            },
            {
              icon: Zap,
              label: 'Printer fleet',
              hint: 'Status and maintenance',
              action: () => {
                onNavigate('printers');
                setQuickOpen(false);
              },
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="flex w-full items-center gap-3 rounded-lg border border-line bg-raised px-3 py-3 text-left transition-colors hover:border-maker/40"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-panel text-maker">
                  <Icon size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{t(item.label)}</span>
                  <span className="block text-[11px] text-muted">{t(item.hint)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
