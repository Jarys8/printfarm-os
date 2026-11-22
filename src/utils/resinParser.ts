import JSZip from 'jszip';
import type { ParsedSlicerFile } from './gcodeParser';

/**
 * Resin slicer slice-format reader.
 *
 * Only the metadata header is decoded — never the layer bitmaps — so files are
 * read locally, instantly and without touching the encrypted layer data.
 * Layouts come from the community documentation for the Chitu (CTB/CBDDLP)
 * family, Elegoo's GOO spec, the Anycubic Photon Workshop container and
 * PrusaSlicer's SL1 archive.
 */

export const RESIN_EXTENSIONS = [
  'ctb',
  'cbddlp',
  'goo',
  'photon',
  'photons',
  'phz',
  'pwmx',
  'pwms',
  'pws',
  'pwma',
  'pwmb',
  'pw0',
  'pwmo',
  'pwx',
  'pm3',
  'pm3m',
  'pm3n',
  'pm3r',
  'pm5',
  'pm5s',
  'pmx2',
  'px6s',
  'dlp',
  'dl2p',
  'sl1',
  'sl1s',
] as const;

const PROJECT_EXTENSIONS = new Set(['lyt', 'lys', 'chitubox', 'ctp']);
const DETECTED_ONLY_EXTENSIONS = new Set([
  'cws',
  'zcode',
  'zcodex',
  'prz',
  'fdg',
  'svgx',
  'lgs',
  'vdt',
  'cxdlp',
  'cxdlpv4',
  'qdt',
  'qdx',
  'osla',
  'jxs',
  'mdlp',
  'uvj',
  'gf',
  'slc',
  'fhd',
  'wow',
  'form',
  'zip',
]);

const CTB_MAGICS = new Set([0x12fd0019, 0x12fd0086, 0x12fd0106, 0x12fd0107, 0xff220810]);

const RESIN_DENSITY_G_PER_ML = 1.1;

export function fileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export function isResinSlicerName(name: string): boolean {
  return (RESIN_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

function sane(value: number, min: number, max: number): value is number {
  return Number.isFinite(value) && value >= min && value <= max;
}

class Bytes {
  readonly view: DataView;
  readonly raw: Uint8Array;

  constructor(buffer: ArrayBuffer) {
    this.raw = new Uint8Array(buffer);
    this.view = new DataView(buffer);
  }

  get length(): number {
    return this.raw.byteLength;
  }

  private guard(offset: number, size: number): void {
    if (offset < 0 || offset + size > this.raw.byteLength) {
      throw new Error('File header looks truncated or corrupted.');
    }
  }

  u16(offset: number, littleEndian = true): number {
    this.guard(offset, 2);
    return this.view.getUint16(offset, littleEndian);
  }

  u32(offset: number, littleEndian = true): number {
    this.guard(offset, 4);
    return this.view.getUint32(offset, littleEndian);
  }

  f32(offset: number, littleEndian = true): number {
    this.guard(offset, 4);
    return this.view.getFloat32(offset, littleEndian);
  }

  ascii(offset: number, length: number): string {
    this.guard(offset, length);
    let out = '';
    for (let i = 0; i < length; i += 1) {
      const code = this.raw[offset + i];
      if (code === 0) break;
      if (code >= 32 && code < 127) out += String.fromCharCode(code);
    }
    return out.trim();
  }

  startsWith(text: string, offset = 0): boolean {
    if (offset + text.length > this.raw.byteLength) return false;
    for (let i = 0; i < text.length; i += 1) {
      if (this.raw[offset + i] !== text.charCodeAt(i)) return false;
    }
    return true;
  }
}

interface ResinDraft {
  source: string;
  layers: number | null;
  layerHeight: number | null;
  seconds: number;
  grams: number;
  resinMl: number | null;
  resolution: string | null;
  buildVolume: string | null;
  machine: string | null;
  exposure: string | null;
  notes: string[];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Resin printers add lift/retract dwell on top of every exposure. */
function estimateResinSeconds(
  layers: number,
  exposure: number,
  bottomExposure: number,
  bottomLayers: number,
): number {
  if (!sane(layers, 1, 200000)) return 0;
  const base = Math.min(Math.max(0, Math.round(bottomLayers)), layers);
  const normal = Math.max(0, layers - base);
  const cycle = sane(exposure, 0, 600) ? exposure + 6 : 8;
  const baseCycle = sane(bottomExposure, 0, 900) ? bottomExposure + 8 : cycle + 8;
  return Math.round(base * baseCycle + normal * cycle);
}

function buildVolumeLabel(x: number, y: number, z: number): string | null {
  if (!sane(x, 1, 2000) || !sane(y, 1, 2000) || !sane(z, 1, 2000)) return null;
  return `${round1(x)} × ${round1(y)} × ${round1(z)} mm`;
}

function resolutionLabel(x: number, y: number): string | null {
  if (!sane(x, 100, 40000) || !sane(y, 100, 40000)) return null;
  return `${Math.round(x)} × ${Math.round(y)} px`;
}

function finish(draft: ResinDraft, fileName: string): ParsedSlicerFile {
  const cleanName = fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const notes: string[] = [draft.source];
  if (draft.machine) notes.push(draft.machine);
  if (draft.resolution) notes.push(draft.resolution);
  if (draft.buildVolume) notes.push(draft.buildVolume);
  if (draft.layers) notes.push(`${draft.layers} layers`);
  if (draft.exposure) notes.push(draft.exposure);
  if (draft.resinMl) notes.push(`${round1(draft.resinMl)} mL resin`);
  notes.push(...draft.notes);

  return {
    fileName,
    partName: cleanName || 'Untitled part',
    source: draft.source,
    grams: Math.max(0, round1(draft.grams)),
    seconds: Math.max(0, Math.round(draft.seconds)),
    layerHeight: draft.layerHeight,
    nozzle: null,
    material: 'Resin',
    notes,
    technology: 'resin',
    layers: draft.layers ?? undefined,
    resinMl: draft.resinMl ?? undefined,
    machine: draft.machine ?? undefined,
    resolution: draft.resolution ?? undefined,
    buildVolume: draft.buildVolume ?? undefined,
  };
}

/** Chitubox CTB / ChiTu CBDDLP — also used by Lychee, Elegoo, Anycubic and UVtools. */
function parseChitu(bytes: Bytes, ext: string): ResinDraft {
  const magic = bytes.u32(0);
  const isCbddlp = magic === 0x12fd0019;
  const version = bytes.u32(4);

  const bedX = bytes.f32(8);
  const bedY = bytes.f32(12);
  const bedZ = bytes.f32(16);
  const layerHeight = bytes.f32(32);
  const exposure = bytes.f32(36);
  const bottomExposure = bytes.f32(40);
  const bottomLayers = bytes.u32(48);
  const resX = bytes.u32(52);
  const resY = bytes.u32(56);
  const layerCount = bytes.u32(68);
  const printTime = bytes.u32(76);
  const paramsOffset = bytes.u32(84);
  const paramsSize = bytes.u32(88);

  let volumeMl = 0;
  let weightG = 0;
  if (paramsOffset >= 112 && paramsOffset + 28 <= bytes.length && paramsSize >= 24) {
    const volume = bytes.f32(paramsOffset + 20);
    const weight = bytes.f32(paramsOffset + 24);
    if (sane(volume, 0, 50000)) volumeMl = volume;
    if (sane(weight, 0, 100000)) weightG = weight;
  }

  const layers = sane(layerCount, 1, 200000) ? Math.round(layerCount) : null;
  const grams = weightG > 0 ? weightG : volumeMl > 0 ? volumeMl * RESIN_DENSITY_G_PER_ML : 0;

  const draft: ResinDraft = {
    source: isCbddlp ? 'ChiTu CBDDLP' : `Chitubox CTB v${version}`,
    layers,
    layerHeight: sane(layerHeight, 0.001, 1) ? Math.round(layerHeight * 1000) / 1000 : null,
    seconds: sane(printTime, 1, 7 * 24 * 3600)
      ? printTime
      : layers
        ? estimateResinSeconds(layers, exposure, bottomExposure, bottomLayers)
        : 0,
    grams,
    resinMl: volumeMl > 0 ? volumeMl : null,
    resolution: resolutionLabel(resX, resY),
    buildVolume: buildVolumeLabel(bedX, bedY, bedZ),
    machine: null,
    exposure:
      sane(exposure, 0, 600) && sane(bottomExposure, 0, 900)
        ? `Exposure ${round1(exposure)}s · base ${round1(bottomExposure)}s × ${Math.round(bottomLayers)}`
        : null,
    notes: [],
  };

  if (!sane(printTime, 1, 7 * 24 * 3600)) {
    draft.notes.push('Print time estimated from layers and exposure');
  }
  if (grams <= 0) draft.notes.push('No resin weight in file — enter grams manually');
  return draft;
}

/** Elegoo GOO — big-endian, fixed 185 KB header with embedded previews. */
function parseGoo(bytes: Bytes): ResinDraft {
  const version = bytes.ascii(0, 4);
  const software = bytes.ascii(12, 32);
  const machine = bytes.ascii(92, 32);

  const layerCount = bytes.u32(185310, false);
  const resX = bytes.u16(185314, false);
  const resY = bytes.u16(185316, false);
  const displayWidth = bytes.f32(185320, false);
  const displayHeight = bytes.f32(185324, false);
  const machineZ = bytes.f32(185328, false);
  const layerHeight = bytes.f32(185332, false);
  const exposure = bytes.f32(185336, false);

  const layers = sane(layerCount, 1, 200000) ? Math.round(layerCount) : null;
  if (!layers) throw new Error('Not a readable GOO slice file.');

  // The delay-mode field size varies between slicer builds, so try both
  // candidate offsets and keep whichever yields plausible print statistics.
  let printTime = 0;
  let volumeMl = 0;
  let grams = 0;
  let bottomLayers = 0;
  let bottomExposure = 0;
  for (const delayModeSize of [1, 4]) {
    if (bytes.length < 185453 + delayModeSize + 12) continue;
    const time = bytes.u32(185453 + delayModeSize, false);
    const volume = bytes.f32(185457 + delayModeSize, false);
    const weight = bytes.f32(185461 + delayModeSize, false);
    if (!sane(time, 1, 7 * 24 * 3600) || !sane(weight, 0, 100000)) continue;
    printTime = time;
    if (sane(volume, 0, 50000)) volumeMl = volume;
    grams = weight;
    if (bytes.length >= 185384 + delayModeSize) {
      bottomExposure = bytes.f32(185376 + delayModeSize, false);
      bottomLayers = bytes.u32(185380 + delayModeSize, false);
    }
    break;
  }

  return {
    source: `Elegoo GOO${version ? ` ${version}` : ''}`.trim(),
    layers,
    layerHeight: sane(layerHeight, 0.001, 1) ? Math.round(layerHeight * 1000) / 1000 : null,
    seconds: printTime > 0 ? printTime : estimateResinSeconds(layers, exposure, bottomExposure, bottomLayers),
    grams: grams > 0 ? grams : volumeMl * RESIN_DENSITY_G_PER_ML,
    resinMl: volumeMl > 0 ? volumeMl : null,
    resolution: resolutionLabel(resX, resY),
    buildVolume: buildVolumeLabel(displayWidth, displayHeight, machineZ),
    machine: machine || null,
    exposure: sane(exposure, 0, 600) ? `Exposure ${round1(exposure)}s` : null,
    notes: [
      software ? `Sliced with ${software}` : '',
      printTime <= 0 ? 'Print time estimated from layers and exposure' : '',
      grams <= 0 ? 'No resin weight in file — enter grams manually' : '',
    ].filter(Boolean),
  };
}

/** Anycubic Photon Workshop family (.pwmx/.pwms/.pws/.photon/…). */
function parseAnycubic(bytes: Bytes): ResinDraft {
  const version = bytes.u32(12);
  const headerAddress = bytes.u32(20);
  const layerDefAddress = bytes.u32(36);

  if (!sane(headerAddress, 32, bytes.length) || headerAddress + 112 > bytes.length) {
    throw new Error('Anycubic header is outside the file.');
  }

  const layerHeight = bytes.f32(headerAddress + 20);
  const exposure = bytes.f32(headerAddress + 24);
  const bottomExposure = bytes.f32(headerAddress + 32);
  const bottomLayers = bytes.f32(headerAddress + 36);
  const volumeMl = bytes.f32(headerAddress + 52);
  const resX = bytes.u32(headerAddress + 60);
  const resY = bytes.u32(headerAddress + 64);
  const weightG = bytes.f32(headerAddress + 68);
  const printTime = bytes.u32(headerAddress + 84);

  let layers: number | null = null;
  if (sane(layerDefAddress, 32, bytes.length) && layerDefAddress + 20 <= bytes.length) {
    const count = bytes.u32(layerDefAddress + 16);
    if (sane(count, 1, 200000)) layers = Math.round(count);
  }

  const grams = sane(weightG, 0.1, 100000)
    ? weightG
    : sane(volumeMl, 0.01, 50000)
      ? volumeMl * RESIN_DENSITY_G_PER_ML
      : 0;

  return {
    source: `Anycubic Photon Workshop v${version}`,
    layers,
    layerHeight: sane(layerHeight, 0.001, 1) ? Math.round(layerHeight * 1000) / 1000 : null,
    seconds: sane(printTime, 1, 7 * 24 * 3600)
      ? printTime
      : layers
        ? estimateResinSeconds(layers, exposure, bottomExposure, bottomLayers)
        : 0,
    grams,
    resinMl: sane(volumeMl, 0.01, 50000) ? volumeMl : null,
    resolution: resolutionLabel(resX, resY),
    buildVolume: null,
    machine: null,
    exposure: sane(exposure, 0, 600) ? `Exposure ${round1(exposure)}s` : null,
    notes: [
      grams <= 0 ? 'No resin weight in file — enter grams manually' : '',
      !sane(printTime, 1, 7 * 24 * 3600) ? 'Print time estimated from layers and exposure' : '',
    ].filter(Boolean),
  };
}

/** PrusaSlicer resin archive (.sl1/.sl1s): zip with config.ini and PNG layers. */
async function parseSl1(buffer: ArrayBuffer): Promise<ResinDraft> {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files);

  const layers = names.filter((name) => /\d{8}\.png$/i.test(name)).length || null;

  const iniName = names.find((name) => /(^|\/)config\.ini$/i.test(name)) ?? names.find((name) => /\.ini$/i.test(name));
  const ini = iniName ? await zip.file(iniName)!.async('string') : '';

  const values = new Map<string, string>();
  for (const line of ini.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (match) values.set(match[1], match[2]);
  }
  const pick = (...keys: string[]): string | null => {
    for (const key of keys) {
      const exact = values.get(key);
      if (exact !== undefined) return exact;
      for (const [candidate, value] of values) {
        if (candidate.toLowerCase() === key.toLowerCase()) return value;
      }
    }
    return null;
  };
  const num = (...keys: string[]): number | null => {
    const raw = pick(...keys);
    if (!raw) return null;
    const parsed = Number.parseFloat(raw.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const layerHeight = num('layer_height', 'layerHeight');
  const exposure = num('exposure_time', 'exposureTime');
  const bottomExposure = num('initial_exposure_time', 'initialExposureTime');
  const bottomLayers = num('initial_exposure_layers', 'initialExposureLayers', 'initial_exposure_layers_count') ?? 0;
  const machine = pick('printer_model', 'printerModel', 'printer_settings_id');
  const material = pick('material_type', 'materialType');
  const density = num('material_density', 'materialDensity');
  const printTime = num('print_time', 'printTime', 'estimated_print_time');

  const seconds =
    printTime && sane(printTime, 1, 7 * 24 * 3600)
      ? Math.round(printTime)
      : layers && exposure
        ? estimateResinSeconds(layers, exposure, bottomExposure ?? exposure, bottomLayers)
        : 0;

  return {
    source: 'PrusaSlicer SL1',
    layers,
    layerHeight: layerHeight && sane(layerHeight, 0.001, 1) ? Math.round(layerHeight * 1000) / 1000 : null,
    seconds,
    grams: 0,
    resinMl: null,
    resolution: null,
    buildVolume: null,
    machine: machine || null,
    exposure:
      exposure !== null
        ? `Exposure ${round1(exposure)}s${bottomExposure !== null ? ` · base ${round1(bottomExposure)}s` : ''}`
        : null,
    notes: [
      material ? `Resin ${material}` : '',
      density ? `Density ${density} g/mL` : '',
      'PrusaSlicer does not store resin weight — enter grams manually',
    ].filter(Boolean),
  };
}

function unsupportedError(ext: string): Error {
  if (PROJECT_EXTENSIONS.has(ext)) {
    return new Error(
      'That is a slicer project file, not a sliced print. Export slices (.ctb, .goo, .photon…) and drop that instead.',
    );
  }
  if (DETECTED_ONLY_EXTENSIONS.has(ext)) {
    return new Error(`.${ext} files are recognised but their header is not readable yet. Enter the values manually.`);
  }
  return new Error(`Unsupported file. Drop a G-code, 3MF, CTB, GOO, Photon or SL1 export.`);
}

export async function parseResinFile(file: File): Promise<ParsedSlicerFile> {
  const ext = fileExtension(file.name);
  if (!file.size) throw new Error('The file is empty.');

  if (ext === 'sl1' || ext === 'sl1s') {
    if (file.size > 400 * 1024 * 1024) throw new Error('Archive is too large to read.');
    return finish(await parseSl1(await file.arrayBuffer()), file.name);
  }

  const head = new Bytes(await file.slice(0, Math.min(file.size, 600 * 1024)).arrayBuffer());
  let draft: ResinDraft | null = null;

  if (head.length >= 112 && CTB_MAGICS.has(head.u32(0))) {
    draft = parseChitu(head, ext);
  } else if (head.length >= 200 && (head.startsWith('goo') || head.startsWith('goo', 4))) {
    draft = parseGoo(head);
  } else if (head.startsWith('ANYCUBIC')) {
    draft = parseAnycubic(head);
  }

  if (!draft) throw unsupportedError(ext);
  return finish(draft, file.name);
}
