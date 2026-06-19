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

export interface CreditLineItemPreview extends QuoteLineItem {
  key: string;
  roomName: string;
  catalogItemId: string;
  catalogName: string;
}

export function creditLineKey(
  roomName: string,
  catalogItemId: string,
  category: string,
): string {
  return `${roomName}|${catalogItemId}|${category}`;
}

export function buildCreditLineItemsForGroups(
  groups: { roomName: string; catalogItemId: string; quantity: number }[],
  input: Pick<
    QuoteEstimateInput,
    'storageMonths' | 'storageType'
  >,
  catalog: CatalogItemPricing[],
  rates: typeof PRICING_RATES = PRICING_RATES,
): CreditLineItemPreview[] {
  const catalogMap = new Map(catalog.map((c) => [c.id, c]));
  const lineItems: CreditLineItemPreview[] = [];

  const storageMultiplier =
    input.storageType === StorageType.PREMIUM_CLIMATE
      ? rates.storagePremiumMultiplier
      : input.storageType === StorageType.SHORT_TERM
        ? rates.storageShortTermMultiplier
        : 1;

  for (const group of groups) {
    if (group.quantity < 1) continue;
    const cat = catalogMap.get(group.catalogItemId);
    if (!cat) continue;

    const pickupAmt = cat.pickupFee * group.quantity;
    const installAmt = cat.installFee * group.quantity;
    const storageAmt =
      cat.storageFeeMonthly *
      group.quantity *
      input.storageMonths *
      storageMultiplier;

    lineItems.push({
      key: creditLineKey(group.roomName, group.catalogItemId, 'Handling'),
      roomName: group.roomName,
      catalogItemId: group.catalogItemId,
      catalogName: cat.name,
      category: 'Handling',
      description: `${group.roomName}: ${cat.name} — pickup & receiving`,
      quantity: group.quantity,
      unitAmount: cat.pickupFee,
      amount: pickupAmt,
    });

    if (input.storageMonths > 0) {
      lineItems.push({
        key: creditLineKey(group.roomName, group.catalogItemId, 'Storage'),
        roomName: group.roomName,
        catalogItemId: group.catalogItemId,
        catalogName: cat.name,
        category: 'Storage',
        description: `${group.roomName}: ${cat.name} — ${input.storageMonths} mo storage`,
        quantity: group.quantity,
        unitAmount:
          cat.storageFeeMonthly * input.storageMonths * storageMultiplier,
        amount: storageAmt,
      });
    }

    lineItems.push({
      key: creditLineKey(group.roomName, group.catalogItemId, 'Installation'),
      roomName: group.roomName,
      catalogItemId: group.catalogItemId,
      catalogName: cat.name,
      category: 'Installation',
      description: `${group.roomName}: ${cat.name} — delivery & placement`,
      quantity: group.quantity,
      unitAmount: cat.installFee,
      amount: installAmt,
    });
  }

  return lineItems;
}
