import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Database,
  Download,
  HardDrive,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Wallet,
  WifiOff,
} from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { useT } from '../hooks/useT';
import type { Currency, FarmSettings, Language } from '../types/farm';
import { CURRENCY_META, downloadFile, formatMoney } from '../utils/format';
import { downloadJson, ordersToCsv } from '../utils/exporters';
import { Badge, Button, Card, Field, SectionTitle, Segmented, cn } from '../components/ui';

const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'CZK', 'PLN'];

const num = (v: string): number => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

function SettingsSection({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-3.5 sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-raised text-maker">{icon}</span>
        <div>
          <h3 className="text-xs font-semibold text-ink">{title}</h3>
          {hint && <p className="text-[10px] text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

export function Settings({ onBack }: { onBack: () => void }) {
  const { state, dispatch, money } = useFarm();
  const t = useT();
  const { settings } = state;
  const importInput = useRef<HTMLInputElement | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    if (!navigator.storage?.estimate) return;
    navigator.storage
      .estimate()
      .then((est) => setStorage({ usage: est.usage ?? 0, quota: est.quota ?? 0 }))
      .catch(() => undefined);
  }, [state.spools.length, state.orders.length, state.ledger.length]);

  const update = <K extends keyof FarmSettings>(key: K, value: FarmSettings[K]) => {
    dispatch({ type: 'setSettings', patch: { [key]: value } as Partial<FarmSettings> });
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      dispatch({ type: 'importState', payload });
    } catch {
      dispatch({
        type: 'toast',
        kind: 'error',
        message: t('Could not read backup'),
        detail: t('The file is not valid JSON. Export a fresh backup from PrintFarm OS.'),
      });
    }
  };

  const usageMb = storage ? storage.usage / (1024 * 1024) : 0;
  const quotaMb = storage ? storage.quota / (1024 * 1024) : 0;

  return (
    <div className="space-y-3.5">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-1">
        <ArrowLeft size={14} /> {t('Back to farm')}
      </Button>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="ok" dot>
          {t('Autosaved locally')}
        </Badge>
        <Badge tone="info">
          <WifiOff size={10} /> {t('Offline-first')}
        </Badge>
        <Badge tone="muted">{state.printers.length} {t('printers')}</Badge>
        <Badge tone="muted">{state.spools.length} {t('spools')}</Badge>
        <Badge tone="muted">{state.orders.length} {t('orders')}</Badge>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <SettingsSection title={t('Farm identity')} hint={t('Branding for quotes, invoices and labels')} icon={<Building2 size={13} />}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label={t('Company / farm name')} className="sm:col-span-2">
              <input
                className="field"
                value={settings.farmName}
                onChange={(e) => update('farmName', e.target.value)}
              />
            </Field>
            <Field label={t('Logo monogram')} hint={t('Up to 3 characters.')}>
              <input
                className="field font-mono uppercase"
                maxLength={3}
                value={settings.logoMonogram}
                onChange={(e) => update('logoMonogram', e.target.value.toUpperCase())}
              />
            </Field>
            <Field label={t('Tax / VAT ID')}>
              <input className="field font-mono" value={settings.taxId} onChange={(e) => update('taxId', e.target.value)} />
            </Field>
            <Field label={t('Address')} className="sm:col-span-2">
              <textarea
                className="field min-h-[54px] font-sans"
                value={settings.address}
                onChange={(e) => update('address', e.target.value)}
              />
            </Field>
            <Field label={t('Bank account / IBAN')}>
              <input
                className="field font-mono"
                value={settings.bankAccount}
                onChange={(e) => update('bankAccount', e.target.value)}
              />
            </Field>
            <Field label={t('Payment link')} hint={t('Encoded in the quote QR code.')}>
              <input
                className="field"
                value={settings.paymentUrl}
                onChange={(e) => update('paymentUrl', e.target.value)}
              />
            </Field>
            <Field label={t('Payment terms')} className="sm:col-span-2">
              <textarea
                className="field min-h-[58px] font-sans"
                value={settings.paymentTerms}
                onChange={(e) => update('paymentTerms', e.target.value)}
              />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection title={t('Financial defaults')} hint={t('Used to prefill every new quote')} icon={<Wallet size={13} />}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label={t('Currency')} hint={t('All totals reformat instantly.')}>
              <select
                className="field"
                value={settings.currency}
                onChange={(e) => update('currency', e.target.value as Currency)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {CURRENCY_META[c].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('Low-stock threshold (g)')}>
              <input
                type="number"
                min={0}
                className="field font-mono tabular-nums"
                value={settings.lowStockThreshold}
                onChange={(e) => update('lowStockThreshold', Math.max(0, num(e.target.value)))}
              />
            </Field>
            <Field label={t('Electricity rate / kWh')}>
              <input
                type="number"
                min={0}
                step={0.01}
                className="field font-mono tabular-nums"
                value={settings.electricityRate}
                onChange={(e) => update('electricityRate', Math.max(0, num(e.target.value)))}
              />
            </Field>
            <Field label={t('Operator rate / hour')}>
              <input
                type="number"
                min={0}
                step={0.5}
                className="field font-mono tabular-nums"
                value={settings.laborRate}
                onChange={(e) => update('laborRate', Math.max(0, num(e.target.value)))}
              />
            </Field>
            <Field label={t('Failure / waste buffer %')}>
              <input
                type="number"
                min={0}
                max={100}
                className="field font-mono tabular-nums"
                value={settings.failureBuffer}
                onChange={(e) => update('failureBuffer', Math.max(0, Math.min(100, num(e.target.value))))}
              />
            </Field>
            <Field label={t('Default markup %')}>
              <input
                type="number"
                min={0}
                className="field font-mono tabular-nums"
                value={settings.defaultMarkup}
                onChange={(e) => update('defaultMarkup', Math.max(0, num(e.target.value)))}
              />
            </Field>
            <Field label={t('Tax / VAT %')}>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                className="field font-mono tabular-nums"
                value={settings.taxRate}
                onChange={(e) => update('taxRate', Math.max(0, Math.min(100, num(e.target.value))))}
              />
            </Field>
            <div className="flex flex-col justify-end rounded-lg border border-line bg-raised/60 px-3 py-2">
              <span className="text-[9px] uppercase tracking-wider text-muted">{t('Example total')}</span>
              <span className="font-mono text-sm font-semibold tabular text-ink">{formatMoney(1234.5, settings.currency)}</span>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title={t('Appearance')} hint={t('Workshop dark or daylight high-contrast')} icon={<Sun size={13} />}>
          <Field label={t('Language / Jazyk')} hint={t('Changes apply immediately across the app, including printed documents.')} className="mb-3">
            <select
              className="field"
              value={settings.language}
              onChange={(e) => update('language', e.target.value as Language)}
              aria-label={t('Interface language')}
            >
              <option value="en">{t('English')}</option>
              <option value="cs">{t('Czech')}</option>
            </select>
          </Field>
          <Segmented
            value={state.theme}
            onChange={(theme) => dispatch({ type: 'setTheme', theme })}
            options={[
              { value: 'dark', label: t('Workshop dark'), icon: <Moon size={13} /> },
              { value: 'light', label: t('Daylight'), icon: <Sun size={13} /> },
            ]}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-raised/60 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
                <ShieldCheck size={13} className="text-emerald-500" /> {t('Installable PWA')}
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">
                {t('Install from your browser menu (iOS: Share → Add to Home Screen) for a standalone, full-screen workshop app.')}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-raised/60 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
                <CheckCircle2 size={13} className="text-cyan-500" /> {t('Offline shell')}
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">
                {t("The service worker caches the app after the first load. All farm data lives in this device's localStorage.")}
              </p>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title={t('Data & backups')} hint={t('Move the farm between phone and office PC')} icon={<Database size={13} />}>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={() => downloadJson(state)}>
              <Download size={14} /> {t('JSON backup')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => importInput.current?.click()}>
              <Upload size={14} /> {t('Import JSON')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                downloadFile(
                  `printfarm-orders-${new Date().toISOString().slice(0, 10)}.csv`,
                  ordersToCsv(state.orders, (id) => state.printers.find((p) => p.id === id)?.name ?? 'Unassigned'),
                  'text/csv;charset=utf-8',
                )
              }
            >
              <Download size={14} /> {t('Orders CSV')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (window.confirm(t('Load demo farm data? This replaces the current printers, spools, orders and ledger on this device.'))) {
                  dispatch({ type: 'loadDemo' });
                }
              }}
            >
              <Sparkles size={14} /> {t('Load demo')}
            </Button>
          </div>
          <input
            ref={importInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />

          <div className="mt-3 rounded-lg border border-line bg-raised/60 p-2.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1.5 text-muted">
                <HardDrive size={12} /> {t('Local storage')}
              </span>
              <span className="font-mono tabular text-ink">
                {storage ? `${usageMb.toFixed(2)} MB${quotaMb ? ` / ${quotaMb.toFixed(0)} MB` : ''}` : t('measuring…')}
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-cyan-500"
                style={{ width: `${storage && storage.quota > 0 ? Math.min(100, (storage.usage / storage.quota) * 100) : 0}%` }}
              />
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-rose-500/25 bg-rose-500/5 px-2.5 py-2">
            <div>
              <p className="text-[11px] font-medium text-ink">{t('Factory reset')}</p>
              <p className="text-[10px] text-muted">{t('Erase printers, spools, orders, presets and ledger.')}</p>
            </div>
            <Button
              variant="danger"
              size="sm"
              className="flex-shrink-0"
              onClick={() => {
                if (
                  window.confirm(
                    t(
                      'Factory reset PrintFarm OS? All printers, spools, orders, presets, service logs and finance entries on this device will be deleted. Export a backup first.',
                    ),
                  )
                ) {
                  dispatch({ type: 'clearAll' });
                }
              }}
            >
              <Trash2 size={13} /> {t('Reset')}
            </Button>
          </div>
        </SettingsSection>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2 text-[10px] text-muted">
          <RefreshCw size={12} /> {t('PrintFarm OS v1.0.2 · single-device offline mode')}
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone={state.theme === 'dark' ? 'muted' : 'maker'}>
            {state.theme === 'dark' ? t('Dark') : t('Light')}
          </Badge>
          <span className={cn('font-mono text-[10px]', state.printers.length ? 'text-emerald-500' : 'text-amber-500')}>
            {state.printers.length ? t('system ready') : t('add a printer')}
          </span>
        </div>
      </Card>
    </div>
  );
}
