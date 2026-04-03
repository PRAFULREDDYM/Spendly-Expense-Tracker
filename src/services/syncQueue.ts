import { supabase } from '../lib/supabase';
import { db, initializeDB, type PendingWrite } from '../db/database';

export type SyncQueueExecutor = (write: PendingWrite) => Promise<void>;
export type SyncQueueHandlerMap = Partial<Record<PendingWrite['resource'], SyncQueueExecutor>>;
export type PendingWriteInput = Omit<PendingWrite, 'sequence'>;
export type LegacyPendingWriteInput = {
  operation: PendingWrite['operation'];
  table: 'expenses' | 'categories' | 'budgets';
  recordId: string;
  payload?: unknown;
};

const executors = new Map<PendingWrite['resource'], SyncQueueExecutor>();
let flushPromise: Promise<void> | null = null;

function emitQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sync-queue-changed'));
  }
}

async function getCurrentUserId() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return null;
    }
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

export function registerSyncQueueExecutor(nextExecutor: SyncQueueExecutor | SyncQueueHandlerMap, resource?: PendingWrite['resource']) {
  if (typeof nextExecutor === 'function') {
    if (!resource) {
      throw new Error('A resource key is required when registering a single sync executor.');
    }
    executors.set(resource, nextExecutor);
    return;
  }

  Object.entries(nextExecutor).forEach(([nextResource, handler]) => {
    if (handler) {
      executors.set(nextResource as PendingWrite['resource'], handler);
    }
  });
}

function getUserIdFromPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as { userId?: unknown; user_id?: unknown; record?: { userId?: unknown; user_id?: unknown } };
  const userId = record.userId ?? record.user_id ?? record.record?.userId ?? record.record?.user_id;
  return typeof userId === 'string' ? userId : null;
}

async function resolveQueueUserId(payload: unknown) {
  const currentUserId = await getCurrentUserId();
  if (currentUserId) {
    return currentUserId;
  }

  return getUserIdFromPayload(payload);
}

export async function enqueue(write: PendingWriteInput): Promise<number>;
export async function enqueue(operation: LegacyPendingWriteInput['operation'], table: LegacyPendingWriteInput['table'], recordId: string, payload?: LegacyPendingWriteInput['payload']): Promise<number>;
export async function enqueue(writeOrOperation: PendingWriteInput | LegacyPendingWriteInput['operation'], table?: LegacyPendingWriteInput['table'], recordId?: string, payload?: LegacyPendingWriteInput['payload']) {
  await initializeDB();

  const write: PendingWriteInput = typeof writeOrOperation === 'string'
    ? {
        userId: (await resolveQueueUserId(payload)) ?? 'local',
        resource: table === 'expenses' ? 'expense' : table === 'categories' ? 'category' : 'budget',
        operation: writeOrOperation,
        entityId: recordId ?? '',
        payload: (payload ?? null) as PendingWrite['payload'],
        createdAt: new Date().toISOString(),
      }
    : writeOrOperation;

  const key = await db.pending_writes.add(write);
  emitQueueChanged();
  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    void flushPendingWrites();
  }
  return key;
}

export async function flushPendingWrites() {
  if (flushPromise) {
    return flushPromise;
  }

  flushPromise = (async () => {
    await initializeDB();

    if (executors.size === 0) {
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return;
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return;
    }

    let pendingWrites = await db.pending_writes.where('userId').equals(userId).toArray();
    pendingWrites = pendingWrites.sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0));

    for (const write of pendingWrites) {
      if (write.sequence === undefined) {
        continue;
      }

      try {
        const executor = executors.get(write.resource);
        if (!executor) {
          console.warn('[SyncQueue] No executor registered for resource', write.resource);
          continue;
        }
        await executor(write);
        await db.pending_writes.delete(write.sequence);
        emitQueueChanged();
      } catch (error) {
        console.warn('[SyncQueue] Replay failed for pending write', write.sequence, error);
        break;
      }
    }
  })().finally(() => {
    flushPromise = null;
  });

  return flushPromise;
}

export async function pendingCount() {
  await initializeDB();
  const userId = await getCurrentUserId();
  if (userId) {
    return db.pending_writes.where('userId').equals(userId).count();
  }
  return db.pending_writes.count();
}

export async function clearPendingWrites() {
  await initializeDB();
  await db.pending_writes.clear();
  emitQueueChanged();
}

export interface SyncQueueApi {
  enqueue(write: PendingWriteInput): Promise<number>;
  enqueue(operation: LegacyPendingWriteInput['operation'], table: LegacyPendingWriteInput['table'], recordId: string, payload?: LegacyPendingWriteInput['payload']): Promise<number>;
  flush: typeof flushPendingWrites;
  pendingCount: typeof pendingCount;
  clear: typeof clearPendingWrites;
}

export const syncQueue: SyncQueueApi = {
  enqueue,
  flush: flushPendingWrites,
  pendingCount,
  clear: clearPendingWrites,
};
