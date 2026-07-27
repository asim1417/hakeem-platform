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
  upsert(args: {
    where: { lockKey: string };
    create: { lockKey: string; runId: string; holder?: string; expiresAt: Date };
    update: { runId: string; holder?: string; acquiredAt: Date; expiresAt: Date };
  }): Promise<unknown>;
  delete(args: { where: { lockKey: string } }): Promise<unknown>;
}

function getRasdRunLockDelegate(): RasdRunLockDelegate | undefined {
  const candidate = prisma as unknown as { rasdRunLock?: RasdRunLockDelegate };
  return candidate.rasdRunLock;
}

const memoryLocks = new Map<string, MemoryLock>();

function nowPlus(ttlMs: number): Date {
  return new Date(Date.now() + ttlMs);
}

function acquireMemoryLock(key: string, runId: string, ttlMs: number): boolean {
  const existing = memoryLocks.get(key);
  if (existing && existing.expiresAt > Date.now()) return false;
  memoryLocks.set(key, { runId, expiresAt: Date.now() + ttlMs });
  return true;
}

export async function acquireRunLock(key: string, runId: string, ttlMs: number): Promise<boolean> {
  try {
    const delegate = getRasdRunLockDelegate();
    if (!delegate) return acquireMemoryLock(key, runId, ttlMs);

    const existing = await delegate.findUnique({ where: { lockKey: key } });
    if (existing && existing.expiresAt > new Date()) return false;

    await delegate.upsert({
      where: { lockKey: key },
      create: {
        lockKey: key,
        runId,
        holder: process.pid ? `pid:${process.pid}` : undefined,
        expiresAt: nowPlus(ttlMs)
      },
      update: {
        runId,
        holder: process.pid ? `pid:${process.pid}` : undefined,
        acquiredAt: new Date(),
        expiresAt: nowPlus(ttlMs)
      }
    });
    return true;
  } catch {
    return acquireMemoryLock(key, runId, ttlMs);
  }
}

export async function releaseRunLock(key: string): Promise<void> {
  try {
    const delegate = getRasdRunLockDelegate();
    if (delegate) await delegate.delete({ where: { lockKey: key } });
  } catch {
    memoryLocks.delete(key);
  }
  memoryLocks.delete(key);
}
