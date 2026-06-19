import type { Project, Piece, PieceEventForm, PhotoMilestone, ProjectPhase } from '../types';
import { STAGE_PHASE } from '../lib/labels';
import { STAGE_TO_PHOTO_MILESTONE } from '../lib/labels';

export function recalcProjectStats(project: Project): Project {
  const pieces = project.pieces ?? [];
  const rooms = project.rooms ?? [];

  const stageSummary = pieces.reduce(
    (acc, piece) => {
      acc[piece.currentStage] = (acc[piece.currentStage] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const phaseSummary = pieces.reduce(
    (acc, piece) => {
      const phase = STAGE_PHASE[piece.currentStage];
      acc[phase] = (acc[phase] || 0) + 1;
      return acc;
    },
    {} as Record<ProjectPhase, number>,
  );

  return {
    ...project,
    stats: {
      ...project.stats,
      totalPieces: pieces.length,
      totalRooms: rooms.length,
      stageSummary,
      phaseSummary,
    },
  };
}

export function applyDemoPieceUpdate(
  piece: Piece,
  form: PieceEventForm,
  capturedBy?: string,
): Piece {
  const photoMilestone =
    form.photoMilestone || STAGE_TO_PHOTO_MILESTONE[form.stage];
  const photoUrl = form.photoUrl || form.photoBase64;

  let stagePhotos = [...(piece.stagePhotos || [])];
  if (photoMilestone && photoUrl) {
    const idx = stagePhotos.findIndex((p) => p.milestone === photoMilestone);
    const entry = {
      id: idx >= 0 ? stagePhotos[idx].id : crypto.randomUUID(),
      pieceId: piece.id,
      milestone: photoMilestone as PhotoMilestone,
      photoUrl,
      capturedBy,
      notes: form.notes,
      capturedAt: new Date().toISOString(),
    };
    if (idx >= 0) stagePhotos[idx] = entry;
    else stagePhotos.push(entry);
  }

  return {
    ...piece,
    currentStage: form.stage,
    currentCondition: form.condition,
    currentLocation: form.location,
    photoUrl: photoUrl || piece.photoUrl,
    stagePhotos,
  };
}
