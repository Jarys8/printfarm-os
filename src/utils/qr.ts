import QRCode from 'qrcode';

export async function qrSvg(text: string, size = 120): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 0,
    width: size,
    errorCorrectionLevel: 'M',
    color: { dark: '#09090B', light: '#FFFFFF' },
  });
}

export const spoolPayload = (id: string): string => `PFOS:SPOOL:${id}`;
export const printerPayload = (id: string): string => `PFOS:PRINTER:${id}`;

export function parseScanPayload(raw: string): { kind: 'spool' | 'printer' | 'raw'; id: string } {
  const text = (raw || '').trim();
  const spool = text.match(/^PFOS:SPOOL:(.+)$/i);
  if (spool) return { kind: 'spool', id: spool[1] };
  const printer = text.match(/^PFOS:PRINTER:(.+)$/i);
  if (printer) return { kind: 'printer', id: printer[1] };
  return { kind: 'raw', id: text };
}
