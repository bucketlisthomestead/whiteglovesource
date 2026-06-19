import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project, Piece, PieceEvent, SyncMutation } from '../types';

interface WgdsDB extends DBSchema {
  projects: { key: string; value: Project & { cachedAt: string } };
  pieces: { key: string; value: Piece & { events?: PieceEvent[]; cachedAt: string } };
  syncQueue: { key: string; value: SyncMutation };
  demoState: { key: string; value: { key: string; project: Project; savedAt: string } };
}

let dbPromise: Promise<IDBPDatabase<WgdsDB>> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<WgdsDB>('wgds-offline', 3, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pieces')) {
          db.createObjectStore('pieces', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'clientMutationId' });
        }
        if (!db.objectStoreNames.contains('demoState')) {
          db.createObjectStore('demoState', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function cacheProject(project: Project) {
  const db = await getDb();
  await db.put('projects', { ...project, cachedAt: new Date().toISOString() });
  for (const piece of project.pieces ?? []) {
    await db.put('pieces', { ...piece, projectId: project.id, cachedAt: new Date().toISOString() });
  }
}

export async function getCachedProject(id: string) {
  const db = await getDb();
  return db.get('projects', id);
}

export async function getCachedDemoProject() {
  const db = await getDb();
  const all = await db.getAll('projects');
  return all.find((p) => p.isDemo) ?? null;
}

export async function getCachedPiece(id: string) {
  const db = await getDb();
  return db.get('pieces', id);
}

export async function updateCachedPiece(piece: Piece) {
  const db = await getDb();
  const existing = await db.get('pieces', piece.id);
  await db.put('pieces', {
    ...existing,
    ...piece,
    cachedAt: new Date().toISOString(),
  });
}

export async function addToSyncQueue(mutation: SyncMutation) {
  const db = await getDb();
  await db.put('syncQueue', mutation);
}

export async function getSyncQueue() {
  const db = await getDb();
  return db.getAll('syncQueue');
}

export async function removeFromSyncQueue(clientMutationId: string) {
  const db = await getDb();
  await db.delete('syncQueue', clientMutationId);
}

export async function getPendingSyncCount() {
  const queue = await getSyncQueue();
  return queue.length;
}
