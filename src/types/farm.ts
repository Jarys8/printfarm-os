export type Currency = 'USD' | 'EUR' | 'GBP' | 'CZK' | 'PLN';

export type FilamentMaterial = 'PLA' | 'PETG' | 'ASA' | 'ABS' | 'TPU' | 'PA-CF' | 'PC' | 'Resin';

export type PrinterStatus = 'printing' | 'idle' | 'bed_clearing' | 'maintenance';

export type PrinterTechnology = 'fdm' | 'resin';

export type OrderStatus = 'quote_sent' | 'queued' | 'printing' | 'post_processing' | 'ready';

export type PaymentStatus = 'unpaid' | 'deposit' | 'paid';

export type ThemeMode = 'dark' | 'light';

export type Language = 'en' | 'cs';

export interface MaintenanceTask {
  id: string;
  label: string;
  intervalHours: number;
  lastDoneHours: number;
  lastDoneAt?: string | null;
}

export interface MaintenanceLog {
  id: string;
  printerId: string;
  printerName: string;
  taskLabel: string;
  hoursAt: number;
  date: string;
  notes?: string;
}

export interface ActiveJob {
  name: string;
  orderId?: string | null;
  endsAt: number | null;
  startedAt: number;
  hours: number;
}

export interface Printer {
  id: string;
  technology?: PrinterTechnology;
  name: string;
  model: string;
  buildVolume: string;
  powerDrawW: number;
  purchasePrice: number;
  lifespanHours: number;
  nozzle: string;
  totalHours: number;
  status: PrinterStatus;
  currentJob?: ActiveJob | null;
  loadedSpoolId?: string | null;
  maintenanceTasks: MaintenanceTask[];
  notes?: string;
  acquiredAt?: string | null;
}

export interface FilamentSpool {
  id: string;
  brand: string;
  material: FilamentMaterial;
  colorName: string;
  colorHex: string;
  diameter: 1.75 | 2.85;
  totalGrams: number;
  remainingGrams: number;
  costPerKg: number;
  nozzleTemp: number;
  bedTemp: number;
  location: string;
  tareWeightGrams: number;
  notes?: string;
}

export interface HardwareItem {
  id: string;
  name: string;
  category: 'Nozzles' | 'Build Plates' | 'Fasteners' | 'Inserts' | 'Adhesives' | 'Packaging' | 'Electronics' | 'Other';
  quantity: number;
  unit: string;
  lowStockThreshold: number;
  unitCost: number;
  location?: string;
}

export interface OrderFilamentAllocation {
  spoolId: string;
  grams: number;
}

export interface SlicerSummary {
  layerHeight: number;
  infill: number;
  nozzle: number;
  material: string;
}

export interface OrderCostSnapshot {
  unitCost: number;
  totalCost: number;
  profit: number;
  margin: number;
}

export interface PrintOrder {
  id: string;
  orderNumber: string;
  clientName: string;
  clientContact: string;
  partName: string;
  quantity: number;
  printedQty: number;
  status: OrderStatus;
  dueDate: string;
  createdAt: string;
  printerId: string | null;
  filaments: OrderFilamentAllocation[];
  slicer: SlicerSummary;
  unitPrice: number;
  totalPrice: number;
  paymentStatus: PaymentStatus;
  rush: boolean;
  volumeDiscountPct: number;
  hoursPerUnit: number;
  laborMinutes: number;
  notes?: string;
  costSnapshot?: OrderCostSnapshot;
}

export interface ProductPreset {
  id: string;
  name: string;
  notes: string;
  quantity: number;
  printTimeHours: number;
  filamentGrams: number;
  material: string;
  layerHeight: number;
  infill: number;
  nozzle: number;
  laborMinutes: number;
  hardwareCost: number;
  markupPct: number;
  spoolId: string | null;
}

export interface LedgerEntry {
  id: string;
  date: string;
  label: string;
  orderId?: string | null;
  revenue: number;
  cost: number;
  profit: number;
}

export interface FarmSettings {
  language: Language;
  farmName: string;
  taxId: string;
  address: string;
  logoMonogram: string;
  bankAccount: string;
  paymentUrl: string;
  currency: Currency;
  electricityRate: number;
  laborRate: number;
  failureBuffer: number;
  taxRate: number;
  defaultMarkup: number;
  lowStockThreshold: number;
  paymentTerms: string;
}

export type ToastKind = 'success' | 'info' | 'warn' | 'error';

export interface Toast {
  id: string;
  message: string;
  detail?: string;
  kind: ToastKind;
}

export interface FarmState {
  version: number;
  settings: FarmSettings;
  theme: ThemeMode;
  printers: Printer[];
  spools: FilamentSpool[];
  hardware: HardwareItem[];
  orders: PrintOrder[];
  presets: ProductPreset[];
  maintenanceLogs: MaintenanceLog[];
  ledger: LedgerEntry[];
  toasts: Toast[];
}

export interface FilamentLine {
  spoolId?: string | null;
  label: string;
  grams: number;
  costPerKg: number;
}

export interface QuoteInput {
  quantity: number;
  printTimeHours: number;
  filaments: FilamentLine[];
  wastePct: number;
  printer: { powerDrawW: number; depreciationPerHour: number; name?: string } | null;
  electricityRate: number;
  laborMinutes: number;
  laborRate: number;
  hardwareCost: number;
  markupPct: number;
  pricingMode: 'markup' | 'margin';
  rush: boolean;
  taxRate: number;
  volumeDiscountPct: number;
}

export interface QuoteResult {
  quantity: number;
  gramsPerUnit: number;
  printMinutes: number;
  materialCost: number;
  electricityCost: number;
  machineCost: number;
  laborCost: number;
  hardwareCost: number;
  unitCost: number;
  rushFee: number;
  unitPrice: number;
  batchPrice: number;
  volumeDiscount: number;
  netRevenue: number;
  tax: number;
  totalClient: number;
  totalCost: number;
  profit: number;
  margin: number;
}
