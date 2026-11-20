# Backups and data

All farm data is stored in the browser's `localStorage` for the app's origin,
under the key `printfarm-os:state:v1`. Nothing is sent to a server.

## JSON backup

**Settings → Data & backups → JSON backup** downloads the complete state:
settings, theme, printers, spools, hardware, orders, presets, maintenance logs
and the ledger. Keep this file somewhere safe; it is the only portable copy.

**Import JSON** replaces the current state after validating the payload. Import
on the new device before adding data there.

## Orders CSV

**Orders CSV** exports a spreadsheet-friendly summary of orders (number, client,
part, quantity, stage, payment, due date, prices). CSV is for reporting only; use
JSON to restore data.

## Demo data

A fresh install starts with a blank farm. **Load demo** replaces the current data
with the built-in sample farm (3 printers, 6 spools, 4 orders, presets and
ledger). This is destructive; export a backup first if the current data matters.

## Factory reset

**Reset** clears all printers, spools, orders, presets, maintenance logs and
finance entries on this device and returns settings to defaults. It cannot be
undone without a backup.

## Storage limits

The Settings page shows current usage and the browser quota. If storage fills
up, the app warns and stops persisting; export a backup, reset, and re-import
only what you need. Private/incognito windows discard storage when closed.

## Moving to another device

1. Export JSON on the old device.
2. Open the app on the new device.
3. Import the JSON file.
4. Optionally re-add the PWA to the home screen.
