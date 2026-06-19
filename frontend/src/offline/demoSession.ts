import { getDb } from './db';
import type { Project } from '../types';

const SESSION_KEY = 'session';
const BASELINE_KEY = 'baseline';

interface DemoStateRecord {
  key: string;
  project: Project;
  savedAt: string;
}

function isValidProject(project: unknown): project is Project {
  if (!project || typeof project !== 'object') return false;
  const p = project as Project;
  return !!p.id && Array.isArray(p.pieces) && Array.isArray(p.rooms);
}

async function getDemoRecord(key: string): Promise<DemoStateRecord | undefined> {
  try {
    const db = await getDb();
    return db.get('demoState', key);
  } catch {
    return undefined;
  }
}

async function putDemoRecord(key: string, project: Project) {
  try {
    const db = await getDb();
    await db.put('demoState', {
      key,
      project,
      savedAt: new Date().toISOString(),
    });
  } catch {
    // Local persistence unavailable — demo still works from API
  }
}

export async function hasDemoSession(): Promise<boolean> {
  const record = await getDemoRecord(SESSION_KEY);
  return isValidProject(record?.project);
}

/** Load demo project — uses local session if present, otherwise fetches and seeds baseline. */
export async function loadDemoProject(
  fetchFresh: () => Promise<Project>,
): Promise<{ project: Project; fromSession: boolean }> {
  const session = await getDemoRecord(SESSION_KEY);
  if (isValidProject(session?.project)) {
    return { project: session.project, fromSession: true };
  }

  const fresh = await fetchFresh();
  await putDemoRecord(BASELINE_KEY, fresh);
  await putDemoRecord(SESSION_KEY, fresh);
  return { project: fresh, fromSession: false };
}

export async function saveDemoSession(project: Project) {
  if (!isValidProject(project)) return;
  await putDemoRecord(SESSION_KEY, project);
}

/** Reset demo to server seed — replaces local session and baseline. */
export async function resetDemoProject(
  fetchFresh: () => Promise<Project>,
): Promise<Project> {
  const fresh = await fetchFresh();
  await putDemoRecord(BASELINE_KEY, fresh);
  await putDemoRecord(SESSION_KEY, fresh);
  return fresh;
}

export async function clearDemoSession() {
  try {
    const db = await getDb();
    await db.delete('demoState', SESSION_KEY);
    await db.delete('demoState', BASELINE_KEY);
  } catch {
    // ignore
  }
}
