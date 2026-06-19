import { Repository } from 'typeorm';
import { Piece } from '../entities/piece.entity';
import { PieceStagePhoto } from '../entities/piece-stage-photo.entity';
import { Signoff } from '../entities/signoff.entity';
import { PieceStage, ProjectPhase } from '../common/enums';
import {
  PhotoMilestone,
  SignoffType,
  SignerRole,
  STAGE_TO_PHOTO_MILESTONE,
} from '../common/signoff';
import { getDemoPhotoUrl, getMilestonePhotoUrl } from './demo-photos';

const STAGE_ORDER: PieceStage[] = [
  PieceStage.IDENTIFIED,
  PieceStage.SCHEDULED_PICKUP,
  PieceStage.RECEIVED,
  PieceStage.INSPECTED,
  PieceStage.STORED,
  PieceStage.STAGED,
  PieceStage.SCHEDULED_INSTALL,
  PieceStage.IN_TRANSIT,
  PieceStage.DELIVERED,
  PieceStage.INSTALLED,
];

function stageIndex(stage: PieceStage) {
  return STAGE_ORDER.indexOf(stage);
}

function piecePastMilestone(piece: Piece, milestone: PhotoMilestone) {
  const targetStage =
    milestone === PhotoMilestone.PICKUP
      ? PieceStage.INSPECTED
      : milestone === PhotoMilestone.DELIVERY
        ? PieceStage.DELIVERED
        : PieceStage.INSTALLED;
  return stageIndex(piece.currentStage) >= stageIndex(targetStage);
}

export async function seedDemoSignoffs(
  pieceRepo: Repository<Piece>,
  stagePhotoRepo: Repository<PieceStagePhoto>,
  signoffRepo: Repository<Signoff>,
  projectId: string,
) {
  const existing = await signoffRepo.count({ where: { projectId } });
  if (existing > 0) return;

  const pieces = await pieceRepo.find({ where: { projectId } });

  for (const piece of pieces) {
    const basePhoto = getDemoPhotoUrl(piece.name);
    if (!basePhoto) continue;

    for (const milestone of Object.values(PhotoMilestone)) {
      if (!piecePastMilestone(piece, milestone)) continue;

      const photoUrl = getMilestonePhotoUrl(piece.name, milestone) || basePhoto;
      await stagePhotoRepo.save(
        stagePhotoRepo.create({
          pieceId: piece.id,
          milestone,
          photoUrl,
          capturedBy: 'WGS Team',
          notes:
            milestone === PhotoMilestone.PICKUP
              ? 'Condition documented at receiving'
              : milestone === PhotoMilestone.DELIVERY
                ? 'Delivered to property — documented'
                : 'Final placement verified',
        }),
      );
    }
  }

  await signoffRepo.save(
    signoffRepo.create({
      projectId,
      signoffType: SignoffType.INVENTORY,
      signerRole: SignerRole.DESIGNER,
      signerName: 'Sarah Whitfield',
      phase: ProjectPhase.PLANNING,
      notes: 'Inventory manifest and staging plan approved',
    }),
  );

  await signoffRepo.save(
    signoffRepo.create({
      projectId,
      signoffType: SignoffType.INVENTORY,
      signerRole: SignerRole.DESIGNER,
      signerName: 'Sarah Whitfield',
      phase: ProjectPhase.PICKUP_STORAGE,
      notes: 'Pickup & storage inventory verified',
    }),
  );

  const samplePieces = pieces.slice(0, 4);
  for (const piece of samplePieces) {
    if (piecePastMilestone(piece, PhotoMilestone.PICKUP)) {
      await signoffRepo.save(
        signoffRepo.create({
          projectId,
          pieceId: piece.id,
          signoffType: SignoffType.MILESTONE,
          signerRole: SignerRole.DESIGNER,
          signerName: 'Sarah Whitfield',
          milestone: PhotoMilestone.PICKUP,
        }),
      );
    }
    if (piecePastMilestone(piece, PhotoMilestone.DELIVERY)) {
      await signoffRepo.save(
        signoffRepo.create({
          projectId,
          pieceId: piece.id,
          signoffType: SignoffType.MILESTONE,
          signerRole: SignerRole.DESIGNER,
          signerName: 'Sarah Whitfield',
          milestone: PhotoMilestone.DELIVERY,
        }),
      );
    }
  }

  const installedPiece = pieces.find(
    (p) => p.currentStage === PieceStage.INSTALLED,
  );
  if (installedPiece) {
    await signoffRepo.save(
      signoffRepo.create({
        projectId,
        pieceId: installedPiece.id,
        signoffType: SignoffType.MILESTONE,
        signerRole: SignerRole.CLIENT,
        signerName: 'James Morrison',
        milestone: PhotoMilestone.INSTALL,
        notes: 'Placement approved on site',
      }),
    );
  }
}

/** Backfill stage photos from existing piece events when signoffs already exist */
export async function backfillStagePhotosFromEvents(
  pieceRepo: Repository<Piece>,
  stagePhotoRepo: Repository<PieceStagePhoto>,
  projectId: string,
) {
  const pieces = await pieceRepo.find({
    where: { projectId },
    relations: { events: true },
  });

  for (const piece of pieces) {
    for (const event of piece.events || []) {
      const milestone = STAGE_TO_PHOTO_MILESTONE[event.stage];
      if (!milestone || !event.photoUrl) continue;

      const existing = await stagePhotoRepo.findOne({
        where: { pieceId: piece.id, milestone },
      });
      if (existing) continue;

      await stagePhotoRepo.save(
        stagePhotoRepo.create({
          pieceId: piece.id,
          milestone,
          photoUrl: event.photoUrl,
          capturedBy: event.verifiedBy,
          notes: event.notes,
        }),
      );
    }
  }
}
