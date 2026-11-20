import JSZip from 'jszip';

export interface ParsedSlicerFile {
  fileName: string;
  partName: string;
  source: string;
  grams: number;
  seconds: number;
  layerHeight: number | null;
  nozzle: number | null;
  material: string;
  notes: string[];
  filamentGrams?: number[];
}

const MATERIALS = ['PLA', 'PETG', 'ASA', 'ABS', 'TPU', 'PA-CF', 'PC', 'Resin'] as const;

export function normalizeMaterial(raw: string | null | undefined): string {
  if (!raw) return 'PLA';
  const upper = raw.toUpperCase().replace(/\s+/g, '');
  if (/PAHT.?CF|PA.?CF|NYLON.?CF|PA6.?CF/.test(upper)) return 'PA-CF';
  if (upper.includes('PETG')) return 'PETG';
  if (upper.includes('ASA')) return 'ASA';
  if (upper.includes('ABS')) return 'ABS';
  if (upper.includes('TPU') || upper.includes('FLEX')) return 'TPU';
  if (upper.includes('RESIN')) return 'Resin';
  if (upper.includes('PC')) return 'PC';
  if (upper.includes('PLA')) return 'PLA';
  return (MATERIALS as readonly string[]).includes(upper) ? upper : 'PLA';
}

/** Parses "1h 42m 8s", "2d 3h", "83.4s", or a bare seconds count. */
export function parseTimeToSeconds(raw: string | null | undefined): number {
  if (!raw) return 0;
  const text = String(raw).trim();
  if (!text) return 0;
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(parseFloat(text));

  let total = 0;
  let matched = false;
  const patterns: Array<[RegExp, number]> = [
    [/(\d+(?:\.\d+)?)\s*d(?:ays?)?\b/i, 86400],
    [/(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\b/i, 3600],
    [/(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?\b(?!s)/i, 60],
    [/(\d+(?:\.\d+)?)\s*s(?:ec(?:onds?)?)?\b/i, 1],
  ];
  for (const [re, mult] of patterns) {
    const m = text.match(re);
    if (m) {
      total += parseFloat(m[1]) * mult;
      matched = true;
    }
  }
  return matched ? Math.round(total) : 0;
}

const FIRST_LAYER_DENSITY: Record<string, number> = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  ASA: 1.07,
  TPU: 1.21,
  'PA-CF': 1.18,
  PC: 1.2,
  Resin: 1.1,
};

export function gramsFromMeters(meters: number, material = 'PLA', diameter = 1.75): number {
  if (!Number.isFinite(meters) || meters <= 0) return 0;
  const radiusCm = (diameter / 10) / 2;
  const volumeCm3 = meters * 100 * Math.PI * radiusCm * radiusCm;
  const density = FIRST_LAYER_DENSITY[normalizeMaterial(material)] ?? 1.24;
  return Math.round(volumeCm3 * density * 10) / 10;
}

function firstNumber(candidates: Array<string | null | undefined>): number | null {
  for (const c of candidates) {
    if (c === null || c === undefined) continue;
    const n = parseFloat(String(c).replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function detectSource(text: string): string {
  if (/PrusaSlicer/i.test(text)) return 'PrusaSlicer';
  if (/OrcaSlicer/i.test(text)) return 'OrcaSlicer';
  if (/BambuStudio|Bambu Studio/i.test(text)) return 'Bambu Studio';
  if (/Cura_SteamEngine|Ultimaker Cura/i.test(text)) return 'Cura';
  if (/Simplify3D/i.test(text)) return 'Simplify3D';
  return 'Slicer';
}

function grabValue(text: string, regexes: RegExp[]): string | null {
  for (const re of regexes) {
    const m = text.match(re);
    if (m && m[1] !== undefined) return m[1].trim();
  }
  return null;
}

function parseCommentBlock(text: string): ParsedSlicerFile {
  const head = text.slice(0, 400_000);
  const source = detectSource(head);

  const gramsRaw = grabValue(head, [
    /filament used \[g\]\s*=\s*([\d.,\s]+)/i,
    /total filament weight \[g\]\s*[:=]\s*([\d.]+)/i,
    /total filament used \[g\]\s*[:=]\s*([\d.]+)/i,
    /filament used\s*[:=]\s*([\d.]+)\s*g/i,
    /filament weight\s*[:=]\s*([\d.]+)\s*g/i,
    /total filament weight\s*[:=]\s*([\d.]+)/i,
  ]);

  let grams = 0;
  let filamentGrams: number[] | undefined;
  if (gramsRaw) {
    const parts = gramsRaw
      .split(/[,;\s]+/)
      .map((s) => parseFloat(s.replace(',', '.')))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (parts.length) {
      filamentGrams = parts;
      grams = parts.reduce((a, b) => a + b, 0);
    }
  }

  const materialRaw = grabValue(head, [
    /;\s*filament_type\s*=\s*([^\n;]+)/i,
    /;\s*filament type\s*[:=]\s*([^\n;]+)/i,
    /filament_type\s*=\s*([^\n;]+)/i,
  ]);
  const material = normalizeMaterial(materialRaw?.split(/[;,\s]/)[0]);

  if (!grams) {
    const meters = firstNumber([
      grabValue(head, [/;\s*Filament used:\s*([\d.]+)m/i, /filament length[^:]*:\s*([\d.]+)\s*m/i]),
    ]);
    if (meters) grams = gramsFromMeters(meters, material);
  }

  let seconds = 0;
  const timeRaw = grabValue(head, [
    /estimated printing time \(normal mode\)\s*=\s*([^\n;]+)/i,
    /estimated printing time\s*=\s*([^\n;]+)/i,
    /total estimated time\s*[:=]\s*([^\n;]+)/i,
    /model printing time\s*[:=]\s*([^\n;]+)/i,
    /;\s*TIME:\s*(\d+)/i,
    /print(?:ing)? time\s*[:=]\s*([^\n;]+)/i,
  ]);
  if (timeRaw) seconds = parseTimeToSeconds(timeRaw);

  const layerHeight = firstNumber([
    grabValue(head, [/;\s*layer_height\s*=\s*([\d.]+)/i, /;\s*Layer height:\s*([\d.]+)/i, /;\s*LAYER_HEIGHT:([\d.]+)/i]),
  ]);
  const nozzle = firstNumber([
    grabValue(head, [/;\s*nozzle_diameter\s*=\s*([\d.]+)/i, /nozzle diameter[^\d]*([\d.]+)/i]),
  ]);

  const notes: string[] = [];
  notes.push(`${source} G-code`);
  const printerModel = grabValue(head, [/;\s*printer_model\s*=\s*([^\n;]+)/i, /;\s*printer_model:\s*([^\n]+)/i]);
  if (printerModel) notes.push(`Sliced for ${printerModel}`);
  const infill = grabValue(head, [/;\s*fill_density\s*=\s*([^\s;]+)/i, /infill[^\d]*([\d.]+)\s*%/i]);
  if (infill) notes.push(`Infill ${infill}`);
  const supports = grabValue(head, [/;\s*support_material\s*=\s*(\d)/i]);
  if (supports === '1') notes.push('Supports enabled');
  if (/spiral_vase\s*=\s*1/i.test(head)) notes.push('Vase mode');
  if (filamentGrams && filamentGrams.length > 1) notes.push(`${filamentGrams.length} filaments detected`);

  return {
    fileName: '',
    partName: '',
    source,
    grams: Math.round(grams * 10) / 10,
    seconds,
    layerHeight,
    nozzle,
    material,
    notes,
    filamentGrams,
  };
}

async function parse3mf(file: File): Promise<ParsedSlicerFile> {
  const zip = await JSZip.loadAsync(file);
  const names = Object.keys(zip.files);
  const result: ParsedSlicerFile = {
    fileName: file.name,
    partName: '',
    source: '3MF',
    grams: 0,
    seconds: 0,
    layerHeight: null,
    nozzle: null,
    material: 'PLA',
    notes: [],
  };

  const sliceInfo = zip.file(names.find((n) => /slice_info\.config$/i.test(n)) ?? '');
  if (sliceInfo) {
    const xml = await sliceInfo.async('string');
    const prediction = xml.match(/key="prediction"\s+value="(\d+)"/i);
    if (prediction) result.seconds = parseInt(prediction[1], 10);
    const weight = xml.match(/key="weight"\s+value="([\d.]+)"/i);
    if (weight) result.grams = parseFloat(weight[1]);
    const used = [...xml.matchAll(/<filament[^>]*used_g="([\d.]+)"[^>]*>/gi)].map((m) => parseFloat(m[1]));
    if (used.length) {
      result.filamentGrams = used;
      result.grams = used.reduce((a, b) => a + b, 0);
    }
    const type = xml.match(/<filament[^>]*type="([^"]+)"/i);
    if (type) result.material = normalizeMaterial(type[1]);
    if (result.grams || result.seconds) result.notes.push('Metadata/slice_info.config');
  }

  const projectFile = zip.file(names.find((n) => /project_settings\.config$/i.test(n)) ?? '');
  if (projectFile) {
    try {
      const raw = JSON.parse(await projectFile.async('string')) as Record<string, unknown>;
      const lh = Number(Array.isArray(raw.layer_height) ? raw.layer_height[0] : raw.layer_height);
      if (Number.isFinite(lh)) result.layerHeight = lh;
      const nd = raw.nozzle_diameter;
      const nozzle = Number(Array.isArray(nd) ? nd[0] : nd);
      if (Number.isFinite(nozzle)) result.nozzle = nozzle;
      const ft = raw.filament_type;
      const resin = raw.resin_type;
      const firstType = Array.isArray(ft) ? ft[0] : ft;
      if (typeof firstType === 'string') result.material = normalizeMaterial(firstType);
      else if (typeof resin === 'string') result.material = 'Resin';
      result.notes.push('Bambu/Orca project settings');
    } catch {
      /* malformed project settings are non-fatal */
    }
  }

  if (!result.grams || !result.seconds) {
    const gcodeName = names.find((n) => /\.gcode$/i.test(n));
    if (gcodeName) {
      const gcodeFile = zip.file(gcodeName);
      if (gcodeFile) {
        const text = await gcodeFile.async('string');
        const parsed = parseCommentBlock(text);
        result.grams = result.grams || parsed.grams;
        result.seconds = result.seconds || parsed.seconds;
        result.layerHeight = result.layerHeight ?? parsed.layerHeight;
        result.nozzle = result.nozzle ?? parsed.nozzle;
        if (parsed.material !== 'PLA' || result.material === 'PLA') result.material = parsed.material;
        result.source = parsed.source !== 'Slicer' ? parsed.source : '3MF';
        result.notes.push(...parsed.notes);
      }
    }
  }

  if (!result.notes.length) result.notes.push('3MF archive parsed');
  return result;
}

export async function parseSlicerFile(file: File): Promise<ParsedSlicerFile> {
  if (file.size > 120 * 1024 * 1024) {
    throw new Error('File is larger than 120 MB. Export a smaller plate or paste values manually.');
  }
  const cleanName = file.name
    .replace(/\.(gcode|gco|g|3mf)$/i, '')
    .replace(/[_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/\.3mf$/i.test(file.name)) {
    const parsed = await parse3mf(file);
    parsed.fileName = file.name;
    parsed.partName = cleanName || 'Untitled part';
    if (!parsed.seconds && !parsed.grams) parsed.notes.push('No slicer metadata found — enter values manually');
    return parsed;
  }

  const text = await file.slice(0, 3 * 1024 * 1024).text();
  const parsed = parseCommentBlock(text);
  parsed.fileName = file.name;
  parsed.partName = cleanName || 'Untitled part';
  if (!parsed.grams) parsed.notes.push('No filament weight in header');
  if (!parsed.seconds) parsed.notes.push('No print time in header');
  return parsed;
}

export function estimateFromVolume(
  volumeCm3: number,
  infillPct: number,
  material = 'PLA',
): { grams: number; hours: number } {
  const density = FIRST_LAYER_DENSITY[normalizeMaterial(material)] ?? 1.24;
  const solid = Math.max(0, volumeCm3) * density;
  const effective = solid * (0.25 + Math.max(0, Math.min(100, infillPct)) / 100 * 0.75);
  const grams = Math.round(effective * 10) / 10;
  const hours = Math.round((grams / 18) * 10) / 10;
  return { grams, hours };
}
