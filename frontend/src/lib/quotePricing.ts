import type { PieceCatalogItem, StorageType } from '../types';
import { formatCurrency } from './labels';

export const PRICING_RATES = {
  projectBaseFee: 350,
  mileRate: 3.5,
  additionalPickupSurcharge: 175,
  minimumQuote: 750,
  storagePremiumMultiplier: 1.35,
  storageShortTermMultiplier: 0.85,
};

export function storageMultiplier(storageType: StorageType): number {
  if (storageType === 'premium_climate') return PRICING_RATES.storagePremiumMultiplier;
  if (storageType === 'short_term') return PRICING_RATES.storageShortTermMultiplier;
  return 1;
}

/** Per-piece total: pickup + storage for duration + install */
export function catalogPieceTotal(
  item: Pick<PieceCatalogItem, 'pickupFee' | 'storageFeeMonthly' | 'installFee'>,
  storageMonths: number,
  storageType: StorageType,
): number {
  const pickup = Number(item.pickupFee);
  const storage =
    Number(item.storageFeeMonthly) * storageMonths * storageMultiplier(storageType);
  const install = Number(item.installFee);
  return pickup + storage + install;
}

export function catalogPieceBreakdown(
  item: Pick<PieceCatalogItem, 'pickupFee' | 'storageFeeMonthly' | 'installFee'>,
  storageMonths: number,
  storageType: StorageType,
) {
  const pickup = Number(item.pickupFee);
  const storage =
    Number(item.storageFeeMonthly) * storageMonths * storageMultiplier(storageType);
  const install = Number(item.installFee);
  return { pickup, storage, install, total: pickup + storage + install };
}

export function formatCatalogPriceHint(
  item: PieceCatalogItem,
  storageMonths: number,
  storageType: StorageType,
): string {
  const { pickup, storage, install, total } = catalogPieceBreakdown(
    item,
    storageMonths,
    storageType,
  );
  if (storageMonths > 0) {
    return `${formatCurrency(total)}/pc (pickup ${formatCurrency(pickup)} · storage ${formatCurrency(storage)} · install ${formatCurrency(install)})`;
  }
  return `${formatCurrency(total)}/pc (pickup ${formatCurrency(pickup)} · install ${formatCurrency(install)})`;
}
