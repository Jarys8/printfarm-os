# Spool QR labels

Every spool can be labelled with a QR code that the built-in scanner
(**Scan QR** in the header, or **Scan spool** on the dashboard) resolves back to
the exact spool.

## Payload

```
PFOS:SPOOL:<spoolId>
```

`<spoolId>` is the internal ID, for example `PFOS:SPOOL:spool-01`. The scanner is
case-insensitive for the prefix and also accepts the short spool ID typed
manually when a camera or `BarcodeDetector` is unavailable.

Printer payloads (`PFOS:PRINTER:<id>`) are still parsed by the scanner helper,
but printer labels are no longer part of the UI.

## Printing

1. Open **Inventory** and press **QR labels**.
2. Choose the spools and the number of copies per spool (1–20).
3. Check the on-screen sheet; it repeats each label the requested number of
   times.
4. Print. Every label is laid out at **50 × 30 mm** with 2 mm padding and QR
   error correction level M.

Print at **100% scale** ("Actual size", no "fit to page") on adhesive label
sheets or plain paper. Disable browser headers/footers for a clean sheet. The QR
modules are dark `#09090B` on white for maximum contrast.

## Scanning tips

- Hold the phone 10–20 cm from the label in good light.
- Native `BarcodeDetector` is available on Android Chrome and iOS 17+; elsewhere
  use **Manual lookup** and type the ID printed under the code.
- After a scan, the modal shows brand, material, color and remaining grams, with
  an action to open the spool in Inventory.
