# Features

## Dashboard

- Header switch for printer status cards and quick actions (scan spool, new
  quote).
- Fleet KPIs: machines and status counts, filament value on shelf, revenue of
  active orders, outstanding balance, monthly and all-time net profit.
- Printer cards with status, loaded spool, current job progress and a live
  countdown. Actions depend on status: finish print, clear bed, mark ready,
  report maintenance.
- Six-month revenue vs. net profit chart from the ledger.
- Action board: low filament, overdue maintenance and orders due within 48 h.
- Upcoming shipments sorted by due date, plus fleet utilization.

## Calculator

- Filament lines from inventory (or manual label/grams/cost per kg), each
  contributing to material cost.
- Inputs: quantity, print hours, waste buffer, printer (power draw and
  depreciation), electricity rate, labor minutes and rate, hardware cost,
  markup or margin pricing, rush priority, tax and volume discount.
- Live summary: cost per unit, suggested unit and batch price, discount, net
  revenue, tax, client total, profit and margin; cost breakdown chart.
- Save/load product presets.
- Export a printable A4 quote or invoice (client details, line items, totals,
  payment terms, bank details and optional payment QR).
- Convert the calculation directly into a production order.

## Inventory

- Spool list with search and material filter, color dot, remaining grams,
  percentage bar, low-stock badge, cost per kg and storage location.
- Add/edit spool: brand, material, color name/hex, diameter, total and remaining
  weight, cost per kg, nozzle/bed temperature, tare weight, location, notes.
- Weigh a spool on a scale: gross weight minus tare becomes the new remaining
  weight.
- Adjust remaining weight by deducting used material or adding stock.
- Printable QR label sheet: choose copies per spool (1–20), preview and print
  50 × 30 mm labels. See [QR-LABELS.md](QR-LABELS.md).
- Hardware inventory: category, quantity, unit, low-stock threshold, unit cost,
  location; low-stock warnings on the shelf summary.

## Orders

- Five-column Kanban with drag and drop and per-column counts.
- Order fields: client and contact, part name, quantity, due date, printer,
  linked spool, grams and hours per piece, unit price, volume discount, payment
  status, slicer summary (layer height, infill, nozzle), rush flag, notes.
- Payment status cycles unpaid → deposit → paid from the card.
- "Log one printed piece" increments printed quantity and deducts the allocated
  filament from the linked spool.
- Move orders between stages with buttons or drag and drop; printer status is
  kept in sync when an order enters printing or becomes ready.
- Generate a quote or invoice document for any order.
- Orders CSV export from Settings.

## Printers

- Fleet list with model, nozzle, power draw, depreciation per hour, odometer,
  loaded spool and maintenance health.
- Status control (idle/ready, printing, bed clearing, maintenance).
- Maintenance tasks per printer with interval and last-done hours; health is
  computed from the odometer; logging service resets the interval and appends to
  the service history.
- Add/edit printer economics: purchase price and expected lifespan drive
  depreciation, which feeds quoting.
- Camera monitoring and printer QR labels are intentionally excluded.

## Settings

- Farm identity: name, monogram, tax ID, address, bank account, payment URL,
  payment terms used on documents.
- Financial defaults: currency (USD, EUR, GBP, CZK, PLN), low-stock threshold,
  electricity and labor rates, failure buffer, markup and tax.
- Appearance: dark/light theme and **English / Čeština**; the choice applies
  immediately, including printable documents, and is persisted.
- Data: JSON backup export/import, orders CSV, demo data, storage usage,
  factory reset.
- PWA installation and offline-shell notes.

## Notifications

Toasts confirm actions (added/updated/removed, printing progress, imports,
errors). They are translated where a fixed message exists.
