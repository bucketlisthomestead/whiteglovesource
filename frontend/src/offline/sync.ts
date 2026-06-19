import { syncBatch } from '../api/client';
import { addToSyncQueue, getSyncQueue, removeFromSyncQueue } from './db';
import type { PieceEventForm, SyncMutation } from '../types';

export function generateMutationId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function queuePieceEvent(
  pieceId: string,
  data: PieceEventForm,
  verifiedBy?: string,
) {
  const mutation: SyncMutation = {
    clientMutationId: generateMutationId(),
    type: 'piece_event',
    payload: {
      pieceId,
      stage: data.stage,
      condition: data.condition,
      location: data.location,
      notes: data.notes,
      verifiedBy,
      photoUrl: data.photoUrl,
      photoBase64: data.photoBase64,
      photoMilestone: data.photoMilestone,
    },
    createdAt: new Date().toISOString(),
  };
  await addToSyncQueue(mutation);
  return mutation;
}

export async function processSyncQueue(): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const queue = await getSyncQueue();
  if (!queue.length) return { synced: 0, failed: 0 };

  try {
    const result = await syncBatch(queue);
    let synced = 0;
    let failed = 0;

    for (const r of result.results) {
      if (r.success) {
        await removeFromSyncQueue(r.clientMutationId);
        synced++;
      } else {
        failed++;
      }
    }
    return { synced, failed };
  } catch {
    return { synced: 0, failed: queue.length };
  }
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(onSync?: (result: { synced: number; failed: number }) => void) {
  const run = async () => {
    const result = await processSyncQueue();
    if (result.synced > 0 || result.failed > 0) onSync?.(result);
  };

  window.addEventListener('online', run);
  if (!syncInterval) syncInterval = setInterval(run, 30000);
  run();
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
