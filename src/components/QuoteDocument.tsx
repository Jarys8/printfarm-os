import { Printer, ReceiptText, X } from 'lucide-react';
import { useT } from '../hooks/useT';
import type { FarmSettings, PrintOrder } from '../types/farm';
import { formatDate, formatGrams, formatMoney, formatNumber, toDateInput } from '../utils/format';
import { Button, PrintPortal } from './ui';
import { QRCodeView } from './QRCodeView';

export interface QuoteDocData {
  number: string;
  title: 'QUOTATION' | 'INVOICE';
  date: string;
  dueDate: string;
  clientName: string;
  clientContact: string;
  partName: string;
  quantity: number;
  unitPrice: number;
  net: number;
  discount: number;
  tax: number;
  total: number;
  taxRate: number;
  rush: boolean;
  rushFee: number;
  material: string;
  gramsPerUnit: number;
  hoursPerUnit: number;
  layerHeight: number;
  infill: number;
  nozzle: number;
  printerName: string;
  notes?: string;
}

export function docFromOrder(order: PrintOrder, settings: FarmSettings, printerName: string): QuoteDocData {
  const taxRate = settings.taxRate;
  const net = order.totalPrice / (1 + taxRate / 100);
  return {
    number: order.orderNumber,
    title: 'INVOICE',
    date: order.createdAt,
    dueDate: order.dueDate,
    clientName: order.clientName,
    clientContact: order.clientContact,
    partName: order.partName,
    quantity: order.quantity,
    unitPrice: order.unitPrice,
    net,
    discount: 0,
    tax: order.totalPrice - net,
    total: order.totalPrice,
    taxRate,
    rush: order.rush,
    rushFee: 0,
    material: order.slicer.material,
    gramsPerUnit: order.filaments.reduce((s, f) => s + f.grams, 0),
    hoursPerUnit: order.hoursPerUnit,
    layerHeight: order.slicer.layerHeight,
    infill: order.slicer.infill,
    nozzle: order.slicer.nozzle,
    printerName,
    notes: order.notes,
  };
}

function QuoteSheet({ doc, settings, currency }: { doc: QuoteDocData; settings: FarmSettings; currency: FarmSettings['currency'] }) {
  const t = useT();
  const money = (v: number) => formatMoney(v, currency, 2);
  const base = doc.rush && doc.rushFee > 0 ? doc.unitPrice - doc.rushFee / Math.max(1, doc.quantity) : doc.unitPrice;
  const lineTotal = base * doc.quantity;

  return (
    <div className="print-sheet mx-auto w-full max-w-[820px] bg-white px-6 py-7 text-zinc-900 sm:px-10 sm:py-10">
      <div className="mb-6 flex items-start justify-between gap-6 border-b-2 border-zinc-900 pb-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold tracking-tight text-orange-500">
            {settings.logoMonogram.slice(0, 3)}
          </div>
          <div>
            <p className="text-lg font-bold leading-tight tracking-tight">{settings.farmName}</p>
            <p className="mt-0.5 max-w-[260px] text-[11px] leading-relaxed text-zinc-500">{settings.address}</p>
            <p className="mt-1 font-mono text-[10px] text-zinc-500">{t('Tax / VAT ID')}: {settings.taxId || '—'}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-orange-600">{t(doc.title)}</p>
          <p className="mt-1 font-mono text-xl font-semibold tracking-tight">{doc.number}</p>
          <p className="mt-1 font-mono text-[10px] text-zinc-500">
            {t('Issued {date}', { date: formatDate(doc.date) })}
          </p>
          <p className="font-mono text-[10px] text-zinc-500">{t('Due {date}', { date: formatDate(doc.dueDate) })}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-6">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{t('Prepared for')}</p>
          <p className="mt-1.5 text-sm font-semibold">{doc.clientName || 'Walk-in client'}</p>
          <p className="text-[11px] text-zinc-600">{doc.clientContact || '—'}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{t('Production')}</p>
          <p className="mt-1.5 text-[11px] text-zinc-600">
            {doc.printerName || 'To be scheduled'} · {doc.material}
          </p>
          <p className="font-mono text-[10px] text-zinc-500">
            {doc.hoursPerUnit.toFixed(2)}h/pc · {formatGrams(doc.gramsPerUnit)}/pc
            {doc.rush ? ' · RUSH' : ''}
          </p>
        </div>
      </div>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-y border-zinc-300 bg-zinc-50">
            <th className="py-2 pl-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{t('Description')}</th>
            <th className="py-2 text-right text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{t('Qty')}</th>
            <th className="py-2 text-right text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{t('Unit')}</th>
            <th className="py-2 pr-2 text-right text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{t('Amount')}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-zinc-200 align-top">
            <td className="py-3 pl-2">
              <p className="text-xs font-semibold">{doc.partName}</p>
              <p className="mt-1 max-w-[360px] text-[10px] leading-relaxed text-zinc-500">
                {t('3D printed to order · {layer} mm layers · {infill}% infill · {nozzle} mm nozzle', {
                  layer: doc.layerHeight,
                  infill: doc.infill,
                  nozzle: doc.nozzle,
                })}
                {doc.rush ? ` · ${t('expedited production')}` : ''}
              </p>
            </td>
            <td className="py-3 text-right font-mono text-xs tabular">{formatNumber(doc.quantity)}</td>
            <td className="py-3 text-right font-mono text-xs tabular">{money(base)}</td>
            <td className="py-3 pr-2 text-right font-mono text-xs tabular">{money(lineTotal)}</td>
          </tr>
          {doc.rush && doc.rushFee > 0 && (
            <tr className="border-b border-zinc-200">
              <td className="py-2 pl-2 text-[11px] text-zinc-600" colSpan={3}>
                {t('Rush production surcharge (+25%)')}
              </td>
              <td className="py-2 pr-2 text-right font-mono text-xs tabular">{money(doc.rushFee)}</td>
            </tr>
          )}
          {doc.discount > 0 && (
            <tr className="border-b border-zinc-200">
              <td className="py-2 pl-2 text-[11px] text-zinc-600" colSpan={3}>
                {t('Batch / volume discount')}
              </td>
              <td className="py-2 pr-2 text-right font-mono text-xs tabular">−{money(doc.discount)}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <div className="w-full max-w-[280px] space-y-1.5">
          <div className="flex justify-between text-[11px] text-zinc-600">
            <span>{t('Net')}</span>
            <span className="font-mono tabular">{money(doc.net)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-zinc-600">
            <span>{t('Tax / VAT ({pct}%)', { pct: doc.taxRate })}</span>
            <span className="font-mono tabular">{money(doc.tax)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t-2 border-zinc-900 pt-2 text-sm font-bold">
            <span>{t('Total due')}</span>
            <span className="font-mono tabular">{money(doc.total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 border-t border-zinc-200 pt-5 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{t('Terms & notes')}</p>
          <p className="mt-1.5 max-w-[400px] text-[10px] leading-relaxed text-zinc-600">{settings.paymentTerms}</p>
          {doc.notes && <p className="mt-2 max-w-[400px] text-[10px] leading-relaxed text-zinc-600">{doc.notes}</p>}
          <div className="mt-3 space-y-0.5 font-mono text-[10px] text-zinc-500">
            <p>{t('Bank')}: {settings.bankAccount || '—'}</p>
            {settings.paymentUrl && <p>{t('Pay online')}: {settings.paymentUrl}</p>}
            <p>{t('Quote valid 30 days · {farm}', { farm: settings.farmName })}</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-start">
          <div className="rounded border border-zinc-200 p-1.5">
            <QRCodeView value={settings.paymentUrl || settings.bankAccount || settings.farmName} size={96} />
          </div>
          <p className="mt-1.5 text-[8px] uppercase tracking-wider text-zinc-400">{t('Scan to pay')}</p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-3 text-[9px] text-zinc-400">
        <span>
          {settings.farmName} · {settings.taxId || t('Tax ID on file')}
        </span>
        <span className="font-mono">{doc.number} · {toDateInput(doc.date)}</span>
      </div>
    </div>
  );
}

export function QuoteDocumentModal({
  open,
  doc,
  settings,
  currency,
  onClose,
}: {
  open: boolean;
  doc: QuoteDocData | null;
  settings: FarmSettings;
  currency: FarmSettings['currency'];
  onClose: () => void;
}) {
  const t = useT();
  if (!open || !doc) return null;
  return (
    <PrintPortal>
      <div className="print-hidden min-h-full pb-6">
        <div className="sticky top-0 z-10 mb-4 flex items-center justify-between gap-2 border-b border-zinc-700/60 bg-zinc-950/90 px-4 py-2.5 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2 text-white">
            <ReceiptText size={16} className="text-orange-400" />
            <span className="truncate text-xs font-medium">
              {doc.title === 'INVOICE' ? t('Invoice') : t('Client quote')} · {doc.number}
            </span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => window.print()}>
              <Printer size={14} /> {t('Print / PDF')}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close document" className="text-zinc-300 hover:text-white">
              <X size={16} />
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-[860px] px-2 sm:px-4">
          <div className="overflow-hidden rounded-lg bg-white shadow-2xl">
            <QuoteSheet doc={doc} settings={settings} currency={currency} />
          </div>
          <p className="mt-3 text-center text-[10px] text-zinc-400">
            {t('Use your browser print dialog and choose “Save as PDF” for a digital quote.')}
          </p>
        </div>
      </div>
      <div className="hidden print:block">
        <QuoteSheet doc={doc} settings={settings} currency={currency} />
      </div>
    </PrintPortal>
  );
}
