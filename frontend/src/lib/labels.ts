import type {
  ConditionRating,
  PieceStage,
  ProjectStatus,
  ProjectPhase,
  JobType,
  JobStatus,
  CrewRole,
  InstallDestination,
  PhotoMilestone,
  SignerRole,
  StorageType,
  PieceCatalogCategory,
  QuoteStatus,
} from '../types';

export const PHASE_ORDER: ProjectPhase[] = ['planning', 'pickup_storage', 'installation'];

export const PHASE_LABELS: Record<ProjectPhase, string> = {
  planning: 'Planning & Staging',
  pickup_storage: 'Pickup & Storage',
  installation: 'Installation',
};

export const PHASE_DESCRIPTIONS: Record<ProjectPhase, string> = {
  planning: 'Pieces identified, rooms assigned, and staging plan documented.',
  pickup_storage: 'Multi-location pickups, condition verification, and warehouse storage.',
  installation: 'Delivered and installed at showroom or final site on schedule.',
};

export const PHASE_PAYMENT_STATUS_LABELS: Record<
  import('../types').PhasePaymentStatus,
  string
> = {
  not_due: 'Not due',
  due: 'Due',
  captured: 'Captured',
};

export const PHASE_PAYMENT_STATUS_ORDER: import('../types').PhasePaymentStatus[] = [
  'not_due',
  'due',
  'captured',
];

export const STATUS_TO_PHASE: Record<ProjectStatus, ProjectPhase | null> = {
  planning: 'planning',
  pickup_storage: 'pickup_storage',
  installation: 'installation',
  complete: null,
};

export const STAGE_LABELS: Record<PieceStage, string> = {
  identified: 'Identified',
  scheduled_pickup: 'Pickup Scheduled',
  received: 'Received',
  inspected: 'Inspected',
  stored: 'In Storage',
  staged: 'Staged',
  scheduled_install: 'Install Scheduled',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  installed: 'Installed',
};

export const STAGE_PHASE: Record<PieceStage, ProjectPhase> = {
  identified: 'planning',
  scheduled_pickup: 'planning',
  received: 'pickup_storage',
  inspected: 'pickup_storage',
  stored: 'pickup_storage',
  staged: 'pickup_storage',
  scheduled_install: 'installation',
  in_transit: 'installation',
  delivered: 'installation',
  installed: 'installation',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Phase 1 — Planning',
  pickup_storage: 'Phase 2 — Pickup & Storage',
  installation: 'Phase 3 — Installation',
  complete: 'Complete',
};

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  'planning',
  'pickup_storage',
  'installation',
  'complete',
];

export function nextProjectStatus(current: ProjectStatus): ProjectStatus | null {
  const index = PROJECT_STATUS_ORDER.indexOf(current);
  if (index < 0 || index >= PROJECT_STATUS_ORDER.length - 1) return null;
  return PROJECT_STATUS_ORDER[index + 1];
}

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  pickup: 'Pickup Run',
  storage_intake: 'Storage Intake & Verify',
  warehouse_staging: 'Warehouse Staging',
  showroom_install: 'Showroom Installation',
  final_install: 'Final Site Installation',
  delivery: 'Delivery',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

export const CREW_ROLE_LABELS: Record<CrewRole, string> = {
  driver: 'Driver',
  mover: 'Mover',
  lead: 'Crew Lead',
  installer: 'Installer',
  warehouse: 'Warehouse',
};

export const INSTALL_DEST_LABELS: Record<InstallDestination, string> = {
  showroom: 'Showroom',
  final_site: 'Final Site',
};

export const CONDITION_LABELS: Record<ConditionRating, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  damaged: 'Damaged',
  needs_repair: 'Needs Repair',
};

export const STAGE_COLORS: Record<PieceStage, string> = {
  identified: 'bg-stone-100 text-stone-700',
  scheduled_pickup: 'bg-sky-100 text-sky-800',
  received: 'bg-slate-100 text-slate-700',
  inspected: 'bg-blue-100 text-blue-800',
  stored: 'bg-indigo-100 text-indigo-800',
  staged: 'bg-purple-100 text-purple-800',
  scheduled_install: 'bg-violet-100 text-violet-800',
  in_transit: 'bg-amber-100 text-amber-800',
  delivered: 'bg-orange-100 text-orange-800',
  installed: 'bg-emerald-100 text-emerald-800',
};

export const PHOTO_MILESTONE_LABELS: Record<PhotoMilestone, string> = {
  pickup: 'Pickup',
  delivery: 'Delivery',
  install: 'Install',
};

export const SIGNER_ROLE_LABELS: Record<SignerRole, string> = {
  designer: 'Designer',
  client: 'Client',
};

export const STAGE_TO_PHOTO_MILESTONE: Partial<Record<PieceStage, PhotoMilestone>> = {
  received: 'pickup',
  inspected: 'pickup',
  delivered: 'delivery',
  in_transit: 'delivery',
  installed: 'install',
};

export const INVENTORY_SIGNOFF_REQUIREMENTS: { phase: ProjectPhase; roles: SignerRole[] }[] = [
  { phase: 'planning', roles: ['designer'] },
  { phase: 'pickup_storage', roles: ['designer', 'client'] },
  { phase: 'installation', roles: ['designer', 'client'] },
];

export const MILESTONE_SIGNOFF_REQUIREMENTS: { milestone: PhotoMilestone; roles: SignerRole[] }[] = [
  { milestone: 'pickup', roles: ['designer'] },
  { milestone: 'delivery', roles: ['designer', 'client'] },
  { milestone: 'install', roles: ['designer', 'client'] },
];

export const CONDITION_COLORS: Record<ConditionRating, string> = {
  excellent: 'bg-emerald-100 text-emerald-800',
  good: 'bg-green-100 text-green-800',
  fair: 'bg-yellow-100 text-yellow-800',
  damaged: 'bg-red-100 text-red-800',
  needs_repair: 'bg-orange-100 text-orange-800',
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  scheduled: 'bg-sky-100 text-sky-800',
  in_progress: 'bg-amber-100 text-amber-800',
  complete: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-stone-100 text-stone-500',
};

/** Dashboard stat card tints — aligned with job/workflow status colors. */
export const DASHBOARD_STAT_TONES = {
  pending: {
    container: 'bg-sky-50 border-sky-200',
    label: 'text-sky-800/70',
    amount: 'text-sky-900',
  },
  inProgress: {
    container: 'bg-amber-50 border-amber-200',
    label: 'text-amber-800/70',
    amount: 'text-amber-900',
  },
  complete: {
    container: 'bg-emerald-50 border-emerald-200',
    label: 'text-emerald-800/70',
    amount: 'text-emerald-900',
  },
} as const;

export type DashboardStatTone = keyof typeof DASHBOARD_STAT_TONES;

export const SERVICE_TYPES = [
  'White-Glove Delivery',
  'Receiving & Inspection',
  'Climate-Controlled Storage',
  'On-Site Installation',
  'Full Project Management',
  'Other',
];

export const STORAGE_TYPE_LABELS: Record<StorageType, string> = {
  standard_climate: 'Standard Climate-Controlled',
  premium_climate: 'Premium Climate & Humidity',
  short_term: 'Short-Term (Under 30 Days)',
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  lead: 'Lead — in progress',
  pending: 'Pending review',
  reviewing: 'Under review',
  quoted: 'Quoted',
  accepted: 'Accepted',
  declined: 'Declined',
};

export const CATALOG_CATEGORY_LABELS: Record<PieceCatalogCategory, string> = {
  seating: 'Seating',
  tables: 'Tables',
  bedding: 'Bedding',
  storage: 'Storage & Casegoods',
  lighting: 'Lighting',
  rugs: 'Rugs',
  specialty: 'Specialty Items',
};

export function formatCurrency(value?: number) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function formatDate(date?: string) {
  if (!date) return '—';
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(time?: string) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
