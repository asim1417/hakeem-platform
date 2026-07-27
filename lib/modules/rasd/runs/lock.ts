import { prisma } from "@/lib/prisma";

interface MemoryLock {
  runId: string;
  expiresAt: number;
}

interface RasdRunLockRecord {
  expiresAt: Date;
}

interface RasdRunLockDelegate {
  findUnique(args: { where: { lockKey: string } }): Promise<RasdRunLockRecord | null>;
  create(args: { data: { lockKey: string; runId: string; holder?: string; expiresAt: Date } }): Promise<unknown>;
  updateMany(args: {
    where: { lockKey: string; expiresAt?: { lte: Date } };
    data: { runId: string; holder?: string; acquiredAt: Date; expiresAt: Date };
  }): Promise<{ count: number }>;
  upsert(args: {
    where: { lockKey: string };
    create: { lockKey: string; runId: string; holder?: string; expiresAt: Date };
    update: { runId: string; holder?: string; acquiredAt: Date; expiresAt: Date };
  }): Promise<unknown>;
  delete(args: { where: { lockKey: string } }): Promise<unknown>;
  deleteMany(args: { where: { lockKey: string; runId?: string } }): Promise<unknown>;
}

function getRasdRunLockDelegate(): RasdRunLockDelegate | undefined {
  const candidate = prisma as unknown as { rasdRunLock?: RasdRunLockDelegate };
  return candidate.rasdRunLock;
}

const memoryLocks = new Map<string, MemoryLock>();

function dbDisabled(): boolean {
  return process.env.RASD_MEMORY_ONLY === "true" || process.env.RASD_MEMORY_ONLY === "1" || !process.env.DATABASE_URL;
}

function nowPlus(ttlMs: number): Date {
  return new Date(Date.now() + ttlMs);
}

function acquireMemoryLock(key: string, runId: string, ttlMs: number): boolean {
  const existing = memoryLocks.get(key);
  if (existing && existing.expiresAt > Date.now()) return false;
  memoryLocks.set(key, { runId, expiresAt: Date.now() + ttlMs });
  return true;
}

function releaseMemoryLock(key: string, runId?: string): void {
  const existing = memoryLocks.get(key);
  if (!runId || existing?.runId === runId) memoryLocks.delete(key);
}

export async function acquireRunLock(key: string, runId: string, ttlMs: number): Promise<boolean> {
  if (dbDisabled()) return acquireMemoryLock(key, runId, ttlMs);
  try {
    const delegate = getRasdRunLockDelegate();
    if (!delegate) return acquireMemoryLock(key, runId, ttlMs);

    const holder = process.pid ? `pid:${process.pid}` : undefined;
    const expiresAt = nowPlus(ttlMs);
    const existing = await delegate.findUnique({ where: { lockKey: key } });
    if (existing && existing.expiresAt > new Date()) return false;

    if (existing) {
      const updated = await delegate.updateMany({
        where: { lockKey: key, expiresAt: { lte: new Date() } },
        data: {
          runId,
          holder,
          acquiredAt: new Date(),
          expiresAt
        }
      });
      return updated.count > 0;
    }

    await delegate.create({
      data: {
        lockKey: key,
        runId,
        holder,
        expiresAt
      }
    });
    return true;
  } catch {
    return false;
  }
}

export async function releaseRunLock(key: string, runId?: string): Promise<void> {
  if (dbDisabled()) {
    releaseMemoryLock(key, runId);
    return;
  }
  try {
    const delegate = getRasdRunLockDelegate();
    if (delegate) {
      await delegate.deleteMany({ where: { lockKey: key, ...(runId ? { runId } : {}) } });
    }
  } catch {
    releaseMemoryLock(key, runId);
  }
  releaseMemoryLock(key, runId);
}
