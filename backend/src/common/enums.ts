export enum ProjectStatus {
  PLANNING = 'planning',
  PICKUP_STORAGE = 'pickup_storage',
  INSTALLATION = 'installation',
  COMPLETE = 'complete',
}

export enum ProjectPhase {
  PLANNING = 'planning',
  PICKUP_STORAGE = 'pickup_storage',
  INSTALLATION = 'installation',
}

export enum PhasePaymentStatus {
  NOT_DUE = 'not_due',
  DUE = 'due',
  CAPTURED = 'captured',
}

export enum PieceStage {
  IDENTIFIED = 'identified',
  SCHEDULED_PICKUP = 'scheduled_pickup',
  RECEIVED = 'received',
  INSPECTED = 'inspected',
  STORED = 'stored',
  STAGED = 'staged',
  SCHEDULED_INSTALL = 'scheduled_install',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  INSTALLED = 'installed',
}

export enum InstallDestination {
  SHOWROOM = 'showroom',
  FINAL_SITE = 'final_site',
}

export enum JobType {
  PICKUP = 'pickup',
  STORAGE_INTAKE = 'storage_intake',
  WAREHOUSE_STAGING = 'warehouse_staging',
  SHOWROOM_INSTALL = 'showroom_install',
  FINAL_INSTALL = 'final_install',
  DELIVERY = 'delivery',
}

export enum JobStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETE = 'complete',
  CANCELLED = 'cancelled',
}

export enum CrewRole {
  DRIVER = 'driver',
  MOVER = 'mover',
  LEAD = 'lead',
  INSTALLER = 'installer',
  WAREHOUSE = 'warehouse',
}

export enum ConditionRating {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  DAMAGED = 'damaged',
  NEEDS_REPAIR = 'needs_repair',
}

export enum QuoteStatus {
  LEAD = 'lead',
  PENDING = 'pending',
  REVIEWING = 'reviewing',
  QUOTED = 'quoted',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

export enum ChangeOrderType {
  ADDITION = 'addition',
  REDUCTION = 'reduction',
}

export enum StorageType {
  STANDARD_CLIMATE = 'standard_climate',
  PREMIUM_CLIMATE = 'premium_climate',
  SHORT_TERM = 'short_term',
}

export enum PieceCatalogCategory {
  SEATING = 'seating',
  TABLES = 'tables',
  BEDDING = 'bedding',
  STORAGE = 'storage',
  LIGHTING = 'lighting',
  RUGS = 'rugs',
  SPECIALTY = 'specialty',
}

export const PHASE_ORDER: ProjectPhase[] = [
  ProjectPhase.PLANNING,
  ProjectPhase.PICKUP_STORAGE,
  ProjectPhase.INSTALLATION,
];

export const PHASE_LABELS: Record<ProjectPhase, string> = {
  [ProjectPhase.PLANNING]: 'Planning & Staging',
  [ProjectPhase.PICKUP_STORAGE]: 'Pickup & Storage',
  [ProjectPhase.INSTALLATION]: 'Installation',
};

export const PHASE_DESCRIPTIONS: Record<ProjectPhase, string> = {
  [ProjectPhase.PLANNING]:
    'Pieces identified, rooms assigned, and staging plan documented before any pickups.',
  [ProjectPhase.PICKUP_STORAGE]:
    'Crews pick up from vendor and client locations, verify condition, and place in storage.',
  [ProjectPhase.INSTALLATION]:
    'Pieces delivered and installed at the showroom or final client location on schedule.',
};

export const PHASE_PAYMENT_STATUS_LABELS: Record<PhasePaymentStatus, string> = {
  [PhasePaymentStatus.NOT_DUE]: 'Not due',
  [PhasePaymentStatus.DUE]: 'Due',
  [PhasePaymentStatus.CAPTURED]: 'Captured',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.PLANNING]: 'Phase 1 — Planning',
  [ProjectStatus.PICKUP_STORAGE]: 'Phase 2 — Pickup & Storage',
  [ProjectStatus.INSTALLATION]: 'Phase 3 — Installation',
  [ProjectStatus.COMPLETE]: 'Complete',
};

export const STATUS_TO_PHASE: Record<ProjectStatus, ProjectPhase | null> = {
  [ProjectStatus.PLANNING]: ProjectPhase.PLANNING,
  [ProjectStatus.PICKUP_STORAGE]: ProjectPhase.PICKUP_STORAGE,
  [ProjectStatus.INSTALLATION]: ProjectPhase.INSTALLATION,
  [ProjectStatus.COMPLETE]: null,
};

export const STAGE_LABELS: Record<PieceStage, string> = {
  [PieceStage.IDENTIFIED]: 'Identified',
  [PieceStage.SCHEDULED_PICKUP]: 'Pickup Scheduled',
  [PieceStage.RECEIVED]: 'Received',
  [PieceStage.INSPECTED]: 'Inspected',
  [PieceStage.STORED]: 'In Storage',
  [PieceStage.STAGED]: 'Staged',
  [PieceStage.SCHEDULED_INSTALL]: 'Install Scheduled',
  [PieceStage.IN_TRANSIT]: 'In Transit',
  [PieceStage.DELIVERED]: 'Delivered',
  [PieceStage.INSTALLED]: 'Installed',
};

export const STAGE_PHASE: Record<PieceStage, ProjectPhase> = {
  [PieceStage.IDENTIFIED]: ProjectPhase.PLANNING,
  [PieceStage.SCHEDULED_PICKUP]: ProjectPhase.PLANNING,
  [PieceStage.RECEIVED]: ProjectPhase.PICKUP_STORAGE,
  [PieceStage.INSPECTED]: ProjectPhase.PICKUP_STORAGE,
  [PieceStage.STORED]: ProjectPhase.PICKUP_STORAGE,
  [PieceStage.STAGED]: ProjectPhase.PICKUP_STORAGE,
  [PieceStage.SCHEDULED_INSTALL]: ProjectPhase.INSTALLATION,
  [PieceStage.IN_TRANSIT]: ProjectPhase.INSTALLATION,
  [PieceStage.DELIVERED]: ProjectPhase.INSTALLATION,
  [PieceStage.INSTALLED]: ProjectPhase.INSTALLATION,
};

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  [JobType.PICKUP]: 'Pickup Run',
  [JobType.STORAGE_INTAKE]: 'Storage Intake & Verify',
  [JobType.WAREHOUSE_STAGING]: 'Warehouse Staging',
  [JobType.SHOWROOM_INSTALL]: 'Showroom Installation',
  [JobType.FINAL_INSTALL]: 'Final Site Installation',
  [JobType.DELIVERY]: 'Delivery',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  [JobStatus.SCHEDULED]: 'Scheduled',
  [JobStatus.IN_PROGRESS]: 'In Progress',
  [JobStatus.COMPLETE]: 'Complete',
  [JobStatus.CANCELLED]: 'Cancelled',
};

export const CREW_ROLE_LABELS: Record<CrewRole, string> = {
  [CrewRole.DRIVER]: 'Driver',
  [CrewRole.MOVER]: 'Mover',
  [CrewRole.LEAD]: 'Crew Lead',
  [CrewRole.INSTALLER]: 'Installer',
  [CrewRole.WAREHOUSE]: 'Warehouse',
};

export const INSTALL_DEST_LABELS: Record<InstallDestination, string> = {
  [InstallDestination.SHOWROOM]: 'Showroom',
  [InstallDestination.FINAL_SITE]: 'Final Site',
};

export const CONDITION_LABELS: Record<ConditionRating, string> = {
  [ConditionRating.EXCELLENT]: 'Excellent',
  [ConditionRating.GOOD]: 'Good',
  [ConditionRating.FAIR]: 'Fair',
  [ConditionRating.DAMAGED]: 'Damaged',
  [ConditionRating.NEEDS_REPAIR]: 'Needs Repair',
};
