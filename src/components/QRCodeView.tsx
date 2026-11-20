import { useEffect, useState } from 'react';
import { qrSvg } from '../utils/qr';
import { cn } from './ui';

export function QRCodeView({ value, size = 112, className }: { value: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    qrSvg(value, size)
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => {
        if (!cancelled) setSvg('');
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!svg) {
    return <div className={cn('animate-pulse rounded bg-line', className)} style={{ width: size, height: size }} aria-hidden />;
  }

  return (
    <div
      className={cn('bg-white [&>svg]:block [&>svg]:h-full [&>svg]:w-full', className)}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
      role="img"
      aria-label={`QR code for ${value}`}
    />
  );
}
