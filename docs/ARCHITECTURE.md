# Architecture

## Stack

- React 18 + TypeScript (strict), Vite 5
- Tailwind CSS with a small custom UI kit (`src/components/ui.tsx`)
- Recharts for the finance chart, lucide-react for icons
- `qrcode` for SVG QR generation, JSZip for backup archives/export helpers

## State

`FarmProvider` (`src/context/FarmContext.tsx`) owns a single `FarmState` object
and exposes it through context:

```ts
interface FarmState {
  version: number;
  settings: FarmSettings;
  theme: 'dark' | 'light';
  printers: Printer[];
  spools: FilamentSpool[];
  hardware: HardwareItem[];
  orders: PrintOrder[];
  presets: ProductPreset[];
  maintenanceLogs: MaintenanceLog[];
  ledger: LedgerEntry[];
  toasts: Toast[];
}
```

All mutations go through a typed reducer action (`setSettings`, `upsertOrder`,
`logMaintenance`, `printPiece`, `importState`, …). Actions that affect money or
stock also update the ledger, spool weights, printer hours or toasts in the same
transition, so the UI never derives inconsistent state.

`FarmProvider` also:

- persists the state to `localStorage` under `printfarm-os:state:v1` (debounced),
- applies the theme class and `document.documentElement.lang`,
- exposes helpers such as `money()` and the currency formatter,
- keeps printer status in sync when orders change stage.

## Persistence and versioning

State is serialized as JSON with a `version` field. On load, missing sections are
merged with defaults so older backups remain usable. Import validates the shape
before replacing state; invalid payloads are rejected with an error toast.

Because storage is per-origin, the app is single-device by design. Use the JSON
backup to move data (see [BACKUP.md](BACKUP.md)).

## Cost model

`computeQuote()` in `src/utils/calculations.ts` normalizes every numeric input,
then builds cost per unit and prices the batch:

- material = Σ grams/1000 × cost/kg × (1 + waste%)
- electricity = kW × hours × rate
- machine = hours × (purchase price / lifespan hours)
- labor = minutes / 60 × hourly rate
- unit cost = sum of the above + hardware
- price = unit cost × (1 + markup%) or unit cost / (1 − margin%)
- rush = +25% of unit price
- volume discount applies to the batch, then tax is added

All money is rounded to cents; margin is computed on net revenue.

## Printing

`src/index.css` contains the print rules and `@page` setup. Printable quote
documents are rendered in a portal and hidden outside print media. Spool labels
render at fixed 50 × 30 mm with a dedicated print toolbar.

## QR codes

`src/utils/qr.ts` generates SVG data URLs with `qrcode` (error correction M,
dark modules `#09090B`). Spool payloads are `PFOS:SPOOL:<spoolId>`. The scanner
parses `PFOS:SPOOL:` and `PFOS:PRINTER:` prefixes and falls back to a raw ID.

## PWA

`public/manifest.webmanifest` and `public/sw.js` provide installability and an
offline app shell. The service worker caches built assets after the first load;
farm data is already local.

## Directory notes

- `src/utils/orders.ts` — status metadata, ordering, CSV mapping helpers
- `src/utils/exporters.ts` — JSON/CSV/backup helpers
- `src/utils/gcodeParser.ts` — extracts time/filament estimates from slicer
  comments in G-code
- `src/i18n.ts` — phrase-keyed dictionary and translator
