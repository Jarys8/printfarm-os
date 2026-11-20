# PrintFarm OS

An offline-first operating system for small 3D-printing farms. Quoting, filament
inventory, production orders, printer maintenance and a simple finance ledger in
one installable web app. No account, no server, no cloud: all data lives in the
browser on the device.

Built with React 18, Vite, TypeScript (strict), Tailwind CSS, Recharts, JSZip and
`qrcode`.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle in dist/
npm run preview  # serve the production build locally
```

Node 18+ is recommended. On first launch the farm is **empty** — no demo
printers, spools or orders. Add your machines and material, or load the sample
farm from **Settings → Data & backups → Load demo**. A factory reset clears
everything again.

## What it does

- **Dashboard** — live printer telemetry, fleet KPIs (filament value, active
  order revenue, monthly and all-time profit), a six-month revenue/profit chart,
  low-stock and overdue-maintenance alerts, upcoming shipments.
- **Calculator** — full cost build-up per part: material with waste buffer,
  electricity, machine depreciation, labor, hardware, markup or margin pricing,
  rush fee, volume discount and tax. Saves presets and converts a calculation
  into a production order or a printable A4 quote/invoice with a payment QR code.
- **Inventory** — filament spools (material, color, remaining grams, cost per
  kg, temperatures, tare weight, storage location), weigh/adjust actions,
  hardware consumables with low-stock thresholds, and printable QR label sheets
  for spools.
- **Orders** — Kanban pipeline (quote sent → queued → printing → post-processing
  → ready) with drag and drop, per-piece print logging that deducts filament
  from the linked spool, payment status cycling, and invoice/quote documents.
- **Printers** — FDM and resin (SLA/MSLA) machines, specs, odometer, loaded
  spool or resin vat, preventive maintenance intervals with health bars, service
  logging and history. Resin printers expose a resin type/VAT field instead of a
  nozzle. Camera monitoring is intentionally not part of the app.
- **Settings** — farm identity and branding, financial defaults, light/dark
  theme, **English / Čeština**, JSON backup and restore, orders CSV export, demo
  data loading and factory reset.
- **PWA** — installable, with a service worker that caches the shell for offline
  use.

## Project structure

```
src/
  App.tsx                 routing between tabs
  components/             layout, UI kit, QR view, quote document, scanner, toasts
  context/FarmContext.tsx reducer, persistence, derived actions
  data/demoData.ts        demo seed and default settings
  hooks/                  useNow, useT
  i18n.ts                 English → Czech dictionary and translate()
  pages/                  Dashboard, Calculator, Inventory, Orders, Printers, Settings
  types/farm.ts           domain model
  utils/                  calculations, exporters, formatting, order helpers, QR
public/
  manifest.webmanifest, sw.js, icon.svg
```

State is persisted to `localStorage` under `printfarm-os:state:v1`; a version
field allows future migrations. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentation

- [Features](docs/FEATURES.md) — screen-by-screen behaviour
- [Architecture](docs/ARCHITECTURE.md) — state, persistence, cost model
- [QR labels](docs/QR-LABELS.md) — payload format and printing
- [Backup & data](docs/BACKUP.md) — export, import, reset, CSV
- [Localization](docs/LOCALIZATION.md) — how English/Czech works

## Cost model

Per unit:

```
material      = Σ (grams / 1000 × costPerKg) × (1 + waste%)
electricity  = kW × hours × electricityRate
depreciation = hours × (purchasePrice / lifespanHours)
labor        = (laborMinutes / 60) × laborRate
hardware     = fixed hardware cost
unitCost     = material + electricity + depreciation + labor + hardware
```

Pricing is either `unitCost × (1 + markup%)` or margin mode
`unitCost / (1 − margin%)`. Rush adds 25% to the unit price; a volume discount
is applied to the batch, then tax is added for the client total.

## Limitations

- Single device: data is per browser profile and is not synced between devices.
  Use JSON backup/restore to move it.
- No background service: nothing runs while the tab is closed.
- Camera spool scanning depends on `BarcodeDetector` (Android Chrome, iOS 17+);
  manual spool lookup always works.
- Printed output depends on the browser print dialog; verify margins and scale
  on your printer before using label sheets in production.

## Uploading to GitHub

The project is a plain Vite app, so any static host works. To publish it as a
repository:

```bash
git init
git add .
git commit -m "PrintFarm OS v1.0"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

For a hosted demo, build with `npm run build` and deploy `dist/` to GitHub Pages,
Netlify, Vercel or Cloudflare Pages. If you use a project page such as
`https://<you>.github.io/<repo>/`, set Vite's `base` option accordingly.
