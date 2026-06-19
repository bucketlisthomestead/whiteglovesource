import { PieceStage, ProjectPhase } from './enums';

export enum PhotoMilestone {
  PICKUP = 'pickup',
  DELIVERY = 'delivery',
  INSTALL = 'install',
}

export enum SignoffType {
  PIECE = 'piece',
  INVENTORY = 'inventory',
  MILESTONE = 'milestone',
}

export enum SignerRole {
  DESIGNER = 'designer',
  CLIENT = 'client',
}

export const PHOTO_MILESTONE_LABELS: Record<PhotoMilestone, string> = {
  [PhotoMilestone.PICKUP]: 'Pickup',
  [PhotoMilestone.DELIVERY]: 'Delivery',
  [PhotoMilestone.INSTALL]: 'Install',
};

export const SIGNER_ROLE_LABELS: Record<SignerRole, string> = {
  [SignerRole.DESIGNER]: 'Designer',
  [SignerRole.CLIENT]: 'Client',
};

/** Required signoffs per inventory phase transition */
export const INVENTORY_SIGNOFF_REQUIREMENTS: {
  phase: ProjectPhase;
  roles: SignerRole[];
}[] = [
  { phase: ProjectPhase.PLANNING, roles: [SignerRole.DESIGNER] },
  {
    phase: ProjectPhase.PICKUP_STORAGE,
    roles: [SignerRole.DESIGNER, SignerRole.CLIENT],
  },
  {
    phase: ProjectPhase.INSTALLATION,
    roles: [SignerRole.DESIGNER, SignerRole.CLIENT],
  },
];

/** Required signoffs per photo milestone on each piece */
export const MILESTONE_SIGNOFF_REQUIREMENTS: {
  milestone: PhotoMilestone;
  roles: SignerRole[];
}[] = [
  { milestone: PhotoMilestone.PICKUP, roles: [SignerRole.DESIGNER] },
  {
    milestone: PhotoMilestone.DELIVERY,
    roles: [SignerRole.DESIGNER, SignerRole.CLIENT],
  },
  {
    milestone: PhotoMilestone.INSTALL,
    roles: [SignerRole.DESIGNER, SignerRole.CLIENT],
  },
];

/** Maps piece stage updates to a photo milestone when a photo is captured */
export const STAGE_TO_PHOTO_MILESTONE: Partial<
  Record<PieceStage, PhotoMilestone>
> = {
  [PieceStage.RECEIVED]: PhotoMilestone.PICKUP,
  [PieceStage.INSPECTED]: PhotoMilestone.PICKUP,
  [PieceStage.DELIVERED]: PhotoMilestone.DELIVERY,
  [PieceStage.IN_TRANSIT]: PhotoMilestone.DELIVERY,
  [PieceStage.INSTALLED]: PhotoMilestone.INSTALL,
};
