import {
  Eye,
  Package,
  Shield,
  Truck,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export const ICON_MAP: Record<string, LucideIcon> = {
  Package,
  Warehouse,
  Truck,
  Wrench,
  Eye,
  Shield,
};

export function resolveSiteContentIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Package;
}
