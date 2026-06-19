export type ProjectLayoutId = 'classic' | 'operations' | 'admin' | 'compact';

export type ProjectTabId =
  | 'inventory'
  | 'plan'
  | 'schedule'
  | 'changes'
  | 'contract'
  | 'audit';

export interface ProjectLayoutPreset {
  id: ProjectLayoutId;
  label: string;
  description: string;
  tabs: { id: ProjectTabId; label: string }[];
  headerMode: 'full' | 'compact' | 'tiered';
  timelineMode: 'full' | 'compact' | 'hidden-on-contract';
  timelineOnTabs: ProjectTabId[] | 'all';
  inventoryOrder: 'classic' | 'operations';
  scopeOnTab: 'plan' | 'changes';
  scheduleOnTab: 'schedule' | 'plan';
  showPhaseStatCards: boolean;
  defaultCollapsed: {
    headerDetails: boolean;
    headerPricing: boolean;
    headerDocuments: boolean;
    labels: boolean;
    signoffs: boolean;
  };
}

export const PROJECT_LAYOUT_PRESETS: Record<ProjectLayoutId, ProjectLayoutPreset> = {
  classic: {
    id: 'classic',
    label: 'Classic',
    description: 'Full project header, timeline on every tab, scope tools on Staging Plan.',
    tabs: [
      { id: 'inventory', label: 'Inventory' },
      { id: 'plan', label: 'Staging Plan' },
      { id: 'schedule', label: 'Crew Schedule' },
      { id: 'contract', label: 'Contract' },
      { id: 'audit', label: 'Record & Audit' },
    ],
    headerMode: 'full',
    timelineMode: 'full',
    timelineOnTabs: 'all',
    inventoryOrder: 'classic',
    scopeOnTab: 'plan',
    scheduleOnTab: 'schedule',
    showPhaseStatCards: true,
    defaultCollapsed: {
      headerDetails: false,
      headerPricing: false,
      headerDocuments: false,
      labels: false,
      signoffs: false,
    },
  },
  operations: {
    id: 'operations',
    label: 'Operations',
    description: 'Inventory first — piece list up top, labels and signoffs collapsed.',
    tabs: [
      { id: 'inventory', label: 'Inventory' },
      { id: 'plan', label: 'Staging Plan' },
      { id: 'schedule', label: 'Crew Schedule' },
      { id: 'contract', label: 'Contract' },
      { id: 'audit', label: 'Record & Audit' },
    ],
    headerMode: 'compact',
    timelineMode: 'compact',
    timelineOnTabs: 'all',
    inventoryOrder: 'operations',
    scopeOnTab: 'plan',
    scheduleOnTab: 'schedule',
    showPhaseStatCards: false,
    defaultCollapsed: {
      headerDetails: true,
      headerPricing: true,
      headerDocuments: true,
      labels: true,
      signoffs: true,
    },
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    description: 'Dedicated Changes tab, tiered header, timeline only on inventory and plan.',
    tabs: [
      { id: 'inventory', label: 'Inventory' },
      { id: 'plan', label: 'Plan & Logistics' },
      { id: 'schedule', label: 'Crew Schedule' },
      { id: 'changes', label: 'Scope Changes' },
      { id: 'contract', label: 'Contract' },
      { id: 'audit', label: 'Activity' },
    ],
    headerMode: 'tiered',
    timelineMode: 'full',
    timelineOnTabs: ['inventory', 'plan', 'changes'],
    inventoryOrder: 'operations',
    scopeOnTab: 'changes',
    scheduleOnTab: 'schedule',
    showPhaseStatCards: false,
    defaultCollapsed: {
      headerDetails: true,
      headerPricing: true,
      headerDocuments: false,
      labels: true,
      signoffs: false,
    },
  },
  compact: {
    id: 'compact',
    label: 'Compact',
    description: 'Minimal chrome — slim timeline, schedule merged into plan, fewer tabs.',
    tabs: [
      { id: 'inventory', label: 'Inventory' },
      { id: 'plan', label: 'Plan' },
      { id: 'contract', label: 'Contract' },
      { id: 'audit', label: 'Activity' },
    ],
    headerMode: 'compact',
    timelineMode: 'compact',
    timelineOnTabs: ['inventory', 'plan'],
    inventoryOrder: 'operations',
    scopeOnTab: 'plan',
    scheduleOnTab: 'plan',
    showPhaseStatCards: false,
    defaultCollapsed: {
      headerDetails: true,
      headerPricing: true,
      headerDocuments: true,
      labels: true,
      signoffs: true,
    },
  },
};

export const PROJECT_LAYOUT_IDS = Object.keys(PROJECT_LAYOUT_PRESETS) as ProjectLayoutId[];

const STORAGE_KEY = 'wgds_project_layout_v1';

export function layoutStorageKey(userId?: string | null): string {
  return userId ? `${STORAGE_KEY}:${userId}` : `${STORAGE_KEY}:guest`;
}

export function getStoredProjectLayout(userId?: string | null): ProjectLayoutId {
  try {
    const raw = localStorage.getItem(layoutStorageKey(userId));
    if (raw && raw in PROJECT_LAYOUT_PRESETS) return raw as ProjectLayoutId;
  } catch {
    /* ignore */
  }
  return 'classic';
}

export function setStoredProjectLayout(
  layoutId: ProjectLayoutId,
  userId?: string | null,
): void {
  try {
    localStorage.setItem(layoutStorageKey(userId), layoutId);
  } catch {
    /* ignore */
  }
}

export function shouldShowTimeline(
  preset: ProjectLayoutPreset,
  activeTab: ProjectTabId,
): boolean {
  if (preset.timelineOnTabs === 'all') return true;
  return preset.timelineOnTabs.includes(activeTab);
}

export function visibleTabs(
  preset: ProjectLayoutPreset,
  options: { isDemo: boolean; hasUser: boolean },
): ProjectLayoutPreset['tabs'] {
  const staffOnly: ProjectTabId[] = ['contract', 'audit', 'changes'];
  return preset.tabs.filter((tab) => {
    if (options.isDemo && staffOnly.includes(tab.id)) return false;
    if (!options.hasUser && staffOnly.includes(tab.id)) return false;
    return true;
  });
}
