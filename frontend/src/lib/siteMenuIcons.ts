import {
  FolderOpen,
  Home,
  LogIn,
  Package,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  FolderOpen,
  LogIn,
  Package,
};

export function resolveSiteMenuIcon(name: string | undefined): LucideIcon {
  if (!name) return Package;
  return ICON_MAP[name] ?? Package;
}
