import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, CircleAlert, QrCode, ScanLine, Search } from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { useT } from '../hooks/useT';
import type { FilamentSpool } from '../types/farm';
import { formatGrams } from '../utils/format';
import { parseScanPayload } from '../utils/qr';
import { Badge, Button, Modal, Progress } from './ui';

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

export function ScanSpoolModal({
  open,
  onClose,
  onOpenSpool,
}: {
  open: boolean;
  onClose: () => void;
  onOpenSpool?: (spoolId: string) => void;
}) {
  const { state, dispatch, money } = useFarm();
  const t = useT();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const [cameraState, setCameraState] = useState<'starting' | 'running' | 'error'>('starting');
  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState<{ raw: string; spool: FilamentSpool | null } | null>(null);
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState('');

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const lookup = (raw: string) => {
    const parsed = parseScanPayload(raw);
    const needle = parsed.id.trim().toLowerCase();
    const spool =
      state.spools.find((s) => s.id.toLowerCase() === needle) ??
      state.spools.find((s) => s.id.toLowerCase().endsWith(needle) && needle.length >= 4) ??
      state.spools.find((s) =>
        `${s.brand} ${s.material} ${s.colorName} ${s.location}`.toLowerCase().includes(needle),
      ) ??
      null;
    setResult({ raw, spool });
    if (spool) {
      stopStream();
      setCameraState('error');
      setCameraError('');
    }
  };

  const submitManual = () => {
    const text = manual.trim();
    if (!text) {
      setManualError(t('Enter a spool ID from the label.'));
      return;
    }
    setManualError('');
    lookup(text);
  };

  useEffect(() => {
    if (!open) {
      stopStream();
      setResult(null);
      setManual('');
      setManualError('');
      setCameraState('starting');
      setCameraError('');
      return;
    }

    let cancelled = false;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('error');
        setCameraError(t('Camera API is not available in this browser. Use manual lookup.'));
        return;
      }
      setCameraState('starting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraState('running');
        if (window.BarcodeDetector) {
          try {
            detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
          } catch {
            detectorRef.current = null;
          }
        }
      } catch {
        setCameraState('error');
        setCameraError(t('Camera unavailable or permission denied. Use manual lookup below.'));
      }
    };
    void start();

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || cameraState !== 'running' || result) return;
    const interval = window.setInterval(async () => {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState < 2) return;
      try {
        const codes = await detector.detect(video);
        if (codes.length && codes[0].rawValue) lookup(codes[0].rawValue);
      } catch {
        /* transient detector errors are ignored */
      }
    }, 450);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cameraState, result, state.spools]);

  const found = result?.spool ?? null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Scan spool QR')}
      subtitle={t('Point the camera at a PrintFarm label, or type a spool ID.')}
      size="md"
      footer={
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <QrCode size={13} /> {t('Label format: PFOS:SPOOL:<id>')}
          </span>
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t('Close')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!result && (
          <div className="relative overflow-hidden rounded-xl border border-line bg-black">
            <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover opacity-90" />
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-[12%] rounded-2xl border-2 border-white/25" />
              <div className="absolute left-[12%] top-[12%] h-7 w-7 rounded-tl-xl border-l-2 border-t-2 border-maker" />
              <div className="absolute right-[12%] top-[12%] h-7 w-7 rounded-tr-xl border-r-2 border-t-2 border-maker" />
              <div className="absolute bottom-[12%] left-[12%] h-7 w-7 rounded-bl-xl border-b-2 border-l-2 border-maker" />
              <div className="absolute bottom-[12%] right-[12%] h-7 w-7 rounded-br-xl border-b-2 border-r-2 border-maker" />
              {cameraState === 'running' && <div className="scanline" />}
              {cameraState !== 'running' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-6 text-center">
                  {cameraState === 'starting' ? (
                    <>
                      <Camera size={22} className="animate-pulse text-white/70" />
                      <p className="text-xs text-white/70">{t('Requesting camera…')}</p>
                    </>
                  ) : (
                    <>
                      <CircleAlert size={22} className="text-amber-400" />
                      <p className="max-w-[260px] text-xs leading-relaxed text-white/80">{cameraError}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            {found ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                <div className="flex items-center justify-between gap-2">
                                      <Badge tone="ok" dot>
                    {t('Spool found')}
                  </Badge>
                  <span className="font-mono text-[10px] text-muted">{found.id}</span>
                </div>
                <div className="mt-3 flex items-start gap-3">
                  <span
                    className="mt-0.5 h-10 w-10 flex-shrink-0 rounded-full border-2 border-white/20 shadow-inner"
                    style={{ background: found.colorHex }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      {found.brand} {found.material}
                    </p>
                    <p className="text-xs text-muted">
                      {found.colorName} · {found.diameter} mm · {found.location}
                    </p>
                    <div className="mt-2 flex items-baseline justify-between font-mono text-[11px] tabular">
                      <span className="text-ink">{formatGrams(found.remainingGrams)}</span>
                      <span className="text-muted">
                        / {formatGrams(found.totalGrams)} · {money((found.remainingGrams / 1000) * found.costPerKg)}
                      </span>
                    </div>
                    <Progress
                      value={found.remainingGrams}
                      max={found.totalGrams}
                      tone={found.remainingGrams < state.settings.lowStockThreshold ? 'warn' : 'ok'}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      dispatch({ type: 'adjustSpool', id: found.id, delta: -10, reason: 'QR quick deduct' });
                      onClose();
                    }}
                  >
                    −10 g
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      dispatch({ type: 'adjustSpool', id: found.id, delta: -50, reason: 'QR quick deduct' });
                      onClose();
                    }}
                  >
                    −50 g
                  </Button>
                </div>
                {onOpenSpool && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => {
                      onOpenSpool(found.id);
                      onClose();
                    }}
                  >
                    {t('Open in inventory')} <ArrowRight size={13} />
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-center">
                <CircleAlert size={20} className="mx-auto mb-2 text-rose-400" />
                <p className="text-sm font-medium text-ink">{t('No spool matched this code')}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-muted">{result.raw}</p>
              </div>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => {
                setResult(null);
                setCameraState('starting');
                if (open) {
                  void (async () => {
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: { ideal: 'environment' } },
                        audio: false,
                      });
                      streamRef.current = stream;
                      if (videoRef.current) videoRef.current.srcObject = stream;
                      setCameraState('running');
                    } catch {
                      setCameraState('error');
                      setCameraError(t('Camera unavailable or permission denied. Use manual lookup below.'));
                    }
                  })();
                }
              }}
            >
              <ScanLine size={14} /> {t('Scan another')}
            </Button>
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label">{t('Manual lookup')}</span>
            <span className="text-[10px] text-muted">{t('BarcodeDetector fallback')}</span>
          </div>
          <div className="flex gap-2">
            <input
              list="spool-lookup-list"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitManual();
              }}
              placeholder={t('Spool ID, color or location…')}
              className="field flex-1"
              aria-label={t('Spool lookup')}
            />
            <Button onClick={submitManual} aria-label={t('Look up spool')}>
              <Search size={15} />
            </Button>
          </div>
          <datalist id="spool-lookup-list">
            {state.spools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.brand} {s.material} {s.colorName}
              </option>
            ))}
          </datalist>
          {manualError && <p className="mt-1 text-[11px] text-rose-400">{manualError}</p>}
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            {t(
              'Camera scanning works on Android Chrome and iOS 17+. On unsupported devices, type the short spool ID printed under each label.',
            )}
          </p>
        </div>
      </div>
    </Modal>
  );
}
