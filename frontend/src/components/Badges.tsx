import { STAGE_COLORS, CONDITION_COLORS, STAGE_LABELS, CONDITION_LABELS } from '../lib/labels';
import type { PieceStage, ConditionRating } from '../types';
import { Badge } from './Layout';

export function StageBadge({ stage }: { stage: PieceStage }) {
  return <Badge className={STAGE_COLORS[stage]}>{STAGE_LABELS[stage]}</Badge>;
}

export function ConditionBadge({ condition }: { condition: ConditionRating }) {
  return <Badge className={CONDITION_COLORS[condition]}>{CONDITION_LABELS[condition]}</Badge>;
}
