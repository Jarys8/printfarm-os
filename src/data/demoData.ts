import type {
  FarmSettings,
  FarmState,
  FilamentSpool,
  HardwareItem,
  LedgerEntry,
  MaintenanceLog,
  PrintOrder,
  Printer,
  ProductPreset,
} from '../types/farm';
import { computeQuote } from '../utils/calculations';
import { addDays, machineDepreciation, round, uid } from '../utils/format';

export const DEFAULT_SETTINGS: FarmSettings = {
  language: 'en',
  farmName: 'Kerf & Layer Studio',
  taxId: 'CZ 12345678',
  address: 'Průmyslová 14, 616 00 Brno, Czech Republic',
  logoMonogram: 'K&L',
  bankAccount: 'CZ65 0800 0000 1920 0014 5399',
  paymentUrl: 'https://pay.kerfandlayer.studio/farm',
  currency: 'USD',
  electricityRate: 0.28,
  laborRate: 28,
  failureBuffer: 10,
  taxRate: 8,
  defaultMarkup: 45,
  lowStockThreshold: 200,
  paymentTerms: '50% deposit to schedule production. Balance due before dispatch. Prices valid 30 days.',
};

const NOW = Date.now();
const iso = (offsetDays: number): string => addDays(new Date(), offsetDays).toISOString();

function monthDate(monthsAgo: number, day: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo, Math.min(day, 28));
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function makePrinters(): Printer[] {
  return [
    {
      id: 'p1',
      name: 'Bambu Lab P1S #01',
      model: 'Bambu Lab P1S',
      buildVolume: '256 × 256 × 256 mm',
      powerDrawW: 350,
      purchasePrice: 699,
      lifespanHours: 5000,
      nozzle: '0.4 mm hardened steel',
      totalHours: 412,
      status: 'printing',
      currentJob: {
        name: 'Articulated Dragon Batch',
        orderId: 'o2',
        endsAt: NOW + 1 * 3600_000 + 42 * 60_000,
        startedAt: NOW - 3 * 3600_000,
        hours: 1.7,
      },
      loadedSpoolId: 's1',
      maintenanceTasks: [
        { id: 't1a', label: 'Clean carbon rods & lubricate rails', intervalHours: 250, lastDoneHours: 180, lastDoneAt: iso(-9) },
        { id: 't1b', label: 'Replace nozzle / inspect hotend', intervalHours: 600, lastDoneHours: 420, lastDoneAt: iso(-24) },
        { id: 't1c', label: 'Check belt tension', intervalHours: 500, lastDoneHours: 300, lastDoneAt: iso(-31) },
        { id: 't1d', label: 'Clean build plate & AMS feed path', intervalHours: 50, lastDoneHours: 390, lastDoneAt: iso(-2) },
      ],
      notes: 'Primary production machine. AMS loaded with PETG Black, PLA Orange, ASA Gray, PAHT-CF.',
    },
    {
      id: 'p2',
      name: 'Prusa MK4S #02',
      model: 'Prusa MK4S',
      buildVolume: '250 × 210 × 220 mm',
      powerDrawW: 300,
      purchasePrice: 1099,
      lifespanHours: 6000,
      nozzle: '0.4 mm brass',
      totalHours: 185,
      status: 'idle',
      currentJob: null,
      loadedSpoolId: 's3',
      maintenanceTasks: [
        { id: 't2a', label: 'Lubricate linear rods', intervalHours: 250, lastDoneHours: 60, lastDoneAt: iso(-38) },
        { id: 't2b', label: 'Inspect belts and pulleys', intervalHours: 500, lastDoneHours: 60, lastDoneAt: iso(-38) },
        { id: 't2c', label: 'Replace nozzle', intervalHours: 600, lastDoneHours: 60, lastDoneAt: iso(-38) },
      ],
      notes: 'Detail machine — 0.4 mm brass for cosmetic surfaces.',
    },
    {
      id: 'p3',
      name: 'Voron 2.4 350mm #03',
      model: 'Voron 2.4 350',
      buildVolume: '350 × 350 × 330 mm',
      powerDrawW: 450,
      purchasePrice: 1450,
      lifespanHours: 7000,
      nozzle: '0.6 mm hardened steel',
      totalHours: 510,
      status: 'maintenance',
      currentJob: null,
      loadedSpoolId: 's4',
      maintenanceTasks: [
        { id: 't3a', label: 'Belt & rail service', intervalHours: 500, lastDoneHours: 10, lastDoneAt: iso(-84) },
        { id: 't3b', label: 'Lubricate Z lead screws', intervalHours: 250, lastDoneHours: 350, lastDoneAt: iso(-21) },
        { id: 't3c', label: 'Clean enclosure & filters', intervalHours: 100, lastDoneHours: 465, lastDoneAt: iso(-7) },
      ],
      notes: 'Large-format / ASA workhorse. Belt & rail service overdue.',
    },
  ];
}

function makeSpools(): FilamentSpool[] {
  return [
    {
      id: 's1',
      brand: 'Prusament',
      material: 'PETG',
      colorName: 'Jet Black',
      colorHex: '#111114',
      diameter: 1.75,
      totalGrams: 1000,
      remainingGrams: 780,
      costPerKg: 29.9,
      nozzleTemp: 240,
      bedTemp: 85,
      location: 'AMS Slot 1',
      tareWeightGrams: 190,
    },
    {
      id: 's2',
      brand: 'Bambu Lab',
      material: 'PLA',
      colorName: 'Basic Orange',
      colorHex: '#F97316',
      diameter: 1.75,
      totalGrams: 1000,
      remainingGrams: 420,
      costPerKg: 24.9,
      nozzleTemp: 220,
      bedTemp: 55,
      location: 'AMS Slot 2',
      tareWeightGrams: 185,
    },
    {
      id: 's3',
      brand: 'eSUN',
      material: 'PLA',
      colorName: 'PLA+ Matte White',
      colorHex: '#EDEDE8',
      diameter: 1.75,
      totalGrams: 1000,
      remainingGrams: 140,
      costPerKg: 19.9,
      nozzleTemp: 215,
      bedTemp: 60,
      location: 'Shelf A1',
      tareWeightGrams: 200,
    },
    {
      id: 's4',
      brand: 'Polymaker',
      material: 'ASA',
      colorName: 'Gray',
      colorHex: '#6B7280',
      diameter: 1.75,
      totalGrams: 1000,
      remainingGrams: 910,
      costPerKg: 34.9,
      nozzleTemp: 260,
      bedTemp: 100,
      location: 'Dryer Box',
      tareWeightGrams: 210,
    },
    {
      id: 's5',
      brand: 'Sunlu',
      material: 'TPU',
      colorName: '95A Cyan',
      colorHex: '#06B6D4',
      diameter: 1.75,
      totalGrams: 1000,
      remainingGrams: 650,
      costPerKg: 27.9,
      nozzleTemp: 230,
      bedTemp: 45,
      location: 'Shelf B2',
      tareWeightGrams: 205,
    },
    {
      id: 's6',
      brand: 'Bambu Lab',
      material: 'PA-CF',
      colorName: 'PAHT-CF Black',
      colorHex: '#1F2937',
      diameter: 1.75,
      totalGrams: 500,
      remainingGrams: 310,
      costPerKg: 79.9,
      nozzleTemp: 280,
      bedTemp: 90,
      location: 'AMS Slot 4',
      tareWeightGrams: 185,
    },
  ];
}

function makeHardware(): HardwareItem[] {
  return [
    { id: 'h1', name: 'Nozzle 0.4 mm hardened', category: 'Nozzles', quantity: 2, unit: 'pcs', lowStockThreshold: 3, unitCost: 18.5, location: 'Drawer 1' },
    { id: 'h2', name: 'Nozzle 0.6 mm hardened', category: 'Nozzles', quantity: 5, unit: 'pcs', lowStockThreshold: 2, unitCost: 19.9, location: 'Drawer 1' },
    { id: 'h3', name: 'Nozzle 0.2 mm detail', category: 'Nozzles', quantity: 1, unit: 'pcs', lowStockThreshold: 1, unitCost: 21.0, location: 'Drawer 1' },
    { id: 'h4', name: 'PEI textured build plate 256', category: 'Build Plates', quantity: 1, unit: 'pcs', lowStockThreshold: 2, unitCost: 34.0, location: 'Shelf C1' },
    { id: 'h5', name: 'Glue stick 90 g', category: 'Adhesives', quantity: 6, unit: 'pcs', lowStockThreshold: 2, unitCost: 3.2, location: 'Bin A' },
    { id: 'h6', name: 'Neodymium magnet 6×3 mm', category: 'Fasteners', quantity: 40, unit: 'pcs', lowStockThreshold: 20, unitCost: 0.18, location: 'Bin B' },
    { id: 'h7', name: 'Hex screw M3×8', category: 'Fasteners', quantity: 120, unit: 'pcs', lowStockThreshold: 50, unitCost: 0.05, location: 'Bin C' },
    { id: 'h8', name: 'Heat-set insert M3', category: 'Inserts', quantity: 25, unit: 'pcs', lowStockThreshold: 50, unitCost: 0.09, location: 'Bin D' },
    { id: 'h9', name: 'Shipping box 200×150×100', category: 'Packaging', quantity: 8, unit: 'pcs', lowStockThreshold: 10, unitCost: 1.4, location: 'Storage' },
  ];
}

interface OrderSeed {
  id: string;
  orderNumber: string;
  clientName: string;
  clientContact: string;
  partName: string;
  quantity: number;
  printedQty: number;
  status: PrintOrder['status'];
  dueOffset: number;
  createdAt: string;
  printerId: string | null;
  strain: { spoolId: string; grams: number };
  slicer: PrintOrder['slicer'];
  paymentStatus: PrintOrder['paymentStatus'];
  rush: boolean;
  volumeDiscountPct: number;
  hoursPerUnit: number;
  laborMinutes: number;
  hardwareCost: number;
  markup: number;
  notes: string;
}

function seedToOrder(seed: OrderSeed, spools: FilamentSpool[], printers: Printer[], settings: FarmSettings): PrintOrder {
  const spool = spools.find((s) => s.id === seed.strain.spoolId);
  const printer = printers.find((p) => p.id === seed.printerId) ?? null;
  const quote = computeQuote({
    quantity: seed.quantity,
    printTimeHours: seed.hoursPerUnit,
    filaments: [
      {
        spoolId: seed.strain.spoolId,
        label: spool ? `${spool.brand} ${spool.material} ${spool.colorName}` : 'Custom filament',
        grams: seed.strain.grams,
        costPerKg: spool?.costPerKg ?? 25,
      },
    ],
    wastePct: settings.failureBuffer,
    printer: printer
      ? { powerDrawW: printer.powerDrawW, depreciationPerHour: machineDepreciation(printer), name: printer.name }
      : null,
    electricityRate: settings.electricityRate,
    laborMinutes: seed.laborMinutes,
    laborRate: settings.laborRate,
    hardwareCost: seed.hardwareCost,
    markupPct: seed.markup,
    pricingMode: 'markup',
    rush: seed.rush,
    taxRate: settings.taxRate,
    volumeDiscountPct: seed.volumeDiscountPct,
  });

  return {
    id: seed.id,
    orderNumber: seed.orderNumber,
    clientName: seed.clientName,
    clientContact: seed.clientContact,
    partName: seed.partName,
    quantity: seed.quantity,
    printedQty: seed.printedQty,
    status: seed.status,
    dueDate: iso(seed.dueOffset),
    createdAt: seed.createdAt,
    printerId: seed.printerId,
    filaments: [seed.strain],
    slicer: seed.slicer,
    unitPrice: quote.unitPrice,
    totalPrice: quote.totalClient,
    paymentStatus: seed.paymentStatus,
    rush: seed.rush,
    volumeDiscountPct: seed.volumeDiscountPct,
    hoursPerUnit: seed.hoursPerUnit,
    laborMinutes: seed.laborMinutes,
    notes: seed.notes,
    costSnapshot: {
      unitCost: quote.unitCost,
      totalCost: quote.totalCost,
      profit: quote.profit,
      margin: quote.margin,
    },
  };
}

function makeOrders(spools: FilamentSpool[], printers: Printer[], settings: FarmSettings): PrintOrder[] {
  const seeds: OrderSeed[] = [
    {
      id: 'o1',
      orderNumber: 'PF-1042',
      clientName: 'Northline Studio',
      clientContact: 'ada@northline.studio',
      partName: 'Orbit Lamp Shade — Matte White',
      quantity: 6,
      printedQty: 0,
      status: 'queued',
      dueOffset: 5,
      createdAt: iso(-1),
      printerId: 'p2',
      strain: { spoolId: 's3', grams: 84 },
      slicer: { layerHeight: 0.2, infill: 15, nozzle: 0.4, material: 'PLA' },
      paymentStatus: 'deposit',
      rush: false,
      volumeDiscountPct: 5,
      hoursPerUnit: 2.4,
      laborMinutes: 10,
      hardwareCost: 0.6,
      markup: 45,
      notes: 'Matte white, seam at rear. Ship in two boxes with foam inserts.',
    },
    {
      id: 'o2',
      orderNumber: 'PF-1043',
      clientName: 'Hexforge Collectibles',
      clientContact: '+420 776 221 908',
      partName: 'Articulated Dragon Batch',
      quantity: 12,
      printedQty: 4,
      status: 'printing',
      dueOffset: 2,
      createdAt: iso(-3),
      printerId: 'p1',
      strain: { spoolId: 's1', grams: 142 },
      slicer: { layerHeight: 0.16, infill: 12, nozzle: 0.4, material: 'PETG' },
      paymentStatus: 'deposit',
      rush: true,
      volumeDiscountPct: 0,
      hoursPerUnit: 1.7,
      laborMinutes: 6,
      hardwareCost: 0.35,
      markup: 55,
      notes: 'Rush order for con pickup. Each dragon packed with care card.',
    },
    {
      id: 'o3',
      orderNumber: 'PF-1044',
      clientName: 'Aerolab GmbH',
      clientContact: 'procurement@aerolab.de',
      partName: 'Custom Drone Frame v4',
      quantity: 8,
      printedQty: 8,
      status: 'post_processing',
      dueOffset: 1,
      createdAt: iso(-6),
      printerId: 'p3',
      strain: { spoolId: 's6', grams: 46 },
      slicer: { layerHeight: 0.2, infill: 40, nozzle: 0.6, material: 'PA-CF' },
      paymentStatus: 'deposit',
      rush: false,
      volumeDiscountPct: 10,
      hoursPerUnit: 1.1,
      laborMinutes: 22,
      hardwareCost: 3.2,
      markup: 60,
      notes: 'Insert heat-set M3 × 8 per frame, torque to 0.4 Nm. Add inspection sheet.',
    },
    {
      id: 'o4',
      orderNumber: 'PF-1045',
      clientName: 'Meeple & Co',
      clientContact: 'orders@meeple.co',
      partName: 'Board Game Insert — Deluxe',
      quantity: 10,
      printedQty: 10,
      status: 'ready',
      dueOffset: 0,
      createdAt: iso(-9),
      printerId: 'p2',
      strain: { spoolId: 's4', grams: 118 },
      slicer: { layerHeight: 0.24, infill: 10, nozzle: 0.4, material: 'ASA' },
      paymentStatus: 'paid',
      rush: false,
      volumeDiscountPct: 12,
      hoursPerUnit: 3.2,
      laborMinutes: 14,
      hardwareCost: 1.1,
      markup: 50,
      notes: 'ASA for heat resistance in storage. Label each tray A–D.',
    },
  ];
  return seeds.map((seed) => seedToOrder(seed, spools, printers, settings));
}

function makePresets(): ProductPreset[] {
  return [
    {
      id: 'pr1',
      name: 'Articulated Dragon (Medium)',
      notes: 'Best-seller. 0.16 mm layers, PETG for flex hinges. Pack with care card.',
      quantity: 6,
      printTimeHours: 1.7,
      filamentGrams: 142,
      material: 'PETG',
      layerHeight: 0.16,
      infill: 12,
      nozzle: 0.4,
      laborMinutes: 6,
      hardwareCost: 0.35,
      markupPct: 55,
      spoolId: 's1',
    },
    {
      id: 'pr2',
      name: 'Orbit Lamp Shade 180 mm',
      notes: 'Matte PLA, 0.2 mm, seam at rear. Fits E27 socket with adapter ring.',
      quantity: 1,
      printTimeHours: 2.4,
      filamentGrams: 84,
      material: 'PLA',
      layerHeight: 0.2,
      infill: 15,
      nozzle: 0.4,
      laborMinutes: 10,
      hardwareCost: 0.6,
      markupPct: 45,
      spoolId: 's3',
    },
  ];
}

function makeMaintenanceLogs(): MaintenanceLog[] {
  return [
    { id: 'm1', printerId: 'p1', printerName: 'Bambu Lab P1S #01', taskLabel: 'Clean build plate & AMS feed path', hoursAt: 390, date: iso(-2) },
    { id: 'm2', printerId: 'p3', printerName: 'Voron 2.4 350mm #03', taskLabel: 'Lubricate Z lead screws', hoursAt: 200, date: iso(-21) },
    { id: 'm3', printerId: 'p2', printerName: 'Prusa MK4S #02', taskLabel: 'Lubricate linear rods', hoursAt: 60, date: iso(-38) },
  ];
}

function makeLedger(): LedgerEntry[] {
  const rows: Array<[number, number, string, number, number]> = [
    [0, 4, 'Orbit Lamp Shade × 6 — Northline Studio', 402, 168],
    [0, 11, 'Articulated Dragon × 10 — Hexforge', 518, 214],
    [1, 6, 'Hexforge wholesale dragons', 1240, 512],
    [1, 19, 'Aerolab drone frames × 8', 880, 346],
    [2, 3, 'Meeple & Co insert run', 940, 388],
    [2, 15, 'Custom keycaps — studio order', 620, 251],
    [3, 8, 'Trade fair display parts', 1490, 604],
    [3, 22, 'Northline lighting batch', 760, 298],
    [4, 5, 'Repair shop brackets', 540, 207],
    [4, 17, 'Etsy dragon restock', 810, 322],
    [5, 9, 'Aerolab prototype frames', 1080, 432],
    [5, 24, 'Board game inserts × 12', 640, 258],
  ];
  return rows.map(([monthsAgo, day, label, revenue, cost]) => ({
    id: uid('led'),
    date: monthDate(monthsAgo, day),
    label,
    revenue,
    cost,
    profit: revenue - cost,
    orderId: null,
  }));
}

export function buildDemoState(): FarmState {
  const settings = { ...DEFAULT_SETTINGS };
  const printers = makePrinters();
  const spools = makeSpools();
  return {
    version: 1,
    settings,
    theme: 'dark',
    printers,
    spools,
    hardware: makeHardware(),
    orders: makeOrders(spools, printers, settings),
    presets: makePresets(),
    maintenanceLogs: makeMaintenanceLogs(),
    ledger: makeLedger(),
    toasts: [],
  };
}

export function buildEmptyState(settings: FarmSettings = DEFAULT_SETTINGS): FarmState {
  return {
    version: 1,
    settings: { ...settings },
    theme: 'dark',
    printers: [],
    spools: [],
    hardware: [],
    orders: [],
    presets: [],
    maintenanceLogs: [],
    ledger: [],
    toasts: [],
  };
}

export const DEMO_QUANTITIES = {
  printers: 3,
  spools: 6,
  orders: 4,
  presets: 2,
  hardware: 9,
  roundedPrintHours: round(412, 0),
};
