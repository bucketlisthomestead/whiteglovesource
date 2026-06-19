import { StorageType } from './enums';

export const PRICING_RATES = {
  projectBaseFee: 350,
  mileRate: 3.5,
  additionalPickupSurcharge: 175,
  minimumQuote: 750,
  storagePremiumMultiplier: 1.35,
  storageShortTermMultiplier: 0.85,
};

export interface QuoteRoomItemInput {
  catalogItemId: string;
  quantity: number;
}

export interface QuoteRoomInput {
  name: string;
  items: QuoteRoomItemInput[];
}

export interface QuoteEstimateInput {
  rooms: QuoteRoomInput[];
  milesToStorage: number;
  milesToInstall: number;
  storageMonths: number;
  storageType: StorageType;
  pickupLocationCount: number;
}

export interface QuoteLineItem {
  category: string;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
}

export interface QuoteEstimateResult {
  lineItems: QuoteLineItem[];
  subtotalPieces: number;
  subtotalMileage: number;
  subtotalStorage: number;
  subtotalPickups: number;
  projectBaseFee: number;
  estimatedTotal: number;
  totalPieces: number;
  totalRooms: number;
  milesToStorage: number;
  milesToInstall: number;
  storageLocationId?: string | null;
  storageLocationName?: string | null;
  mileageNote?: string | null;
}

export interface CatalogItemPricing {
  id: string;
  name: string;
  category: string;
  pickupFee: number;
  storageFeeMonthly: number;
  installFee: number;
}

export function calculateQuoteEstimate(
  input: QuoteEstimateInput,
  catalog: CatalogItemPricing[],
  rates: typeof PRICING_RATES = PRICING_RATES,
): QuoteEstimateResult {
  const catalogMap = new Map(catalog.map((c) => [c.id, c]));
  const lineItems: QuoteLineItem[] = [];
  let subtotalPieces = 0;
  let subtotalStorage = 0;
  let totalPieces = 0;

  const storageMultiplier =
    input.storageType === StorageType.PREMIUM_CLIMATE
      ? rates.storagePremiumMultiplier
      : input.storageType === StorageType.SHORT_TERM
        ? rates.storageShortTermMultiplier
        : 1;

  for (const room of input.rooms) {
    for (const item of room.items) {
      if (item.quantity < 1) continue;
      const cat = catalogMap.get(item.catalogItemId);
      if (!cat) continue;

      totalPieces += item.quantity;
      const pickupAmt = cat.pickupFee * item.quantity;
      const installAmt = cat.installFee * item.quantity;
      const storageAmt =
        cat.storageFeeMonthly *
        item.quantity *
        input.storageMonths *
        storageMultiplier;

      subtotalPieces += pickupAmt + installAmt;
      subtotalStorage += storageAmt;

      lineItems.push({
        category: 'Handling',
        description: `${room.name}: ${cat.name} — pickup & receiving`,
        quantity: item.quantity,
        unitAmount: cat.pickupFee,
        amount: pickupAmt,
      });
      if (input.storageMonths > 0) {
        lineItems.push({
          category: 'Storage',
          description: `${room.name}: ${cat.name} — ${input.storageMonths} mo storage`,
          quantity: item.quantity,
          unitAmount:
            cat.storageFeeMonthly * input.storageMonths * storageMultiplier,
          amount: storageAmt,
        });
      }
      lineItems.push({
        category: 'Installation',
        description: `${room.name}: ${cat.name} — delivery & placement`,
        quantity: item.quantity,
        unitAmount: cat.installFee,
        amount: installAmt,
      });
    }
  }

  const subtotalMileage =
    input.milesToStorage * rates.mileRate +
    input.milesToInstall * rates.mileRate;

  if (input.milesToStorage > 0) {
    lineItems.push({
      category: 'Mileage',
      description: `Transport to storage (${input.milesToStorage} mi)`,
      quantity: input.milesToStorage,
      unitAmount: rates.mileRate,
      amount: input.milesToStorage * rates.mileRate,
    });
  }
  if (input.milesToInstall > 0) {
    lineItems.push({
      category: 'Mileage',
      description: `Transport to install site (${input.milesToInstall} mi)`,
      quantity: input.milesToInstall,
      unitAmount: rates.mileRate,
      amount: input.milesToInstall * rates.mileRate,
    });
  }

  const extraPickups = Math.max(0, input.pickupLocationCount - 1);
  const subtotalPickups = extraPickups * rates.additionalPickupSurcharge;
  if (extraPickups > 0) {
    lineItems.push({
      category: 'Logistics',
      description: `Additional pickup locations (${extraPickups})`,
      quantity: extraPickups,
      unitAmount: rates.additionalPickupSurcharge,
      amount: subtotalPickups,
    });
  }

  lineItems.unshift({
    category: 'Project',
    description: 'Project coordination & dispatch',
    quantity: 1,
    unitAmount: rates.projectBaseFee,
    amount: rates.projectBaseFee,
  });

  const rawTotal =
    rates.projectBaseFee +
    subtotalPieces +
    subtotalStorage +
    subtotalMileage +
    subtotalPickups;

  return {
    lineItems,
    subtotalPieces,
    subtotalMileage,
    subtotalStorage,
    subtotalPickups,
    projectBaseFee: rates.projectBaseFee,
    estimatedTotal: Math.max(rawTotal, rates.minimumQuote),
    totalPieces,
    totalRooms: input.rooms.length,
    milesToStorage: input.milesToStorage,
    milesToInstall: input.milesToInstall,
  };
}
