/**
 * تنظيف ملفات مؤقتة لمنصة الوثائق.
 * dry-run افتراضيًا.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDocumentLimits } from "@/lib/modules/documents/document-limits";
import { logDocumentEvent, newCorrelationId } from "@/lib/modules/observability/document-logger";
import { incDocumentMetric } from "@/lib/modules/observability/metrics";

export type CleanupResult = {
  scanned: number;
  eligible: number;
  deleted: number;
  skipped: number;
  failed: number;
  bytesFreed: number;
};

function safeTempRoot(): string {
  return path.join(os.tmpdir(), "hakeem-url-");
}

function isPathInsideTemp(candidate: string): boolean {
  const root = path.resolve(os.tmpdir());
  const resolved = path.resolve(candidate);
  return resolved === root || resolved.startsWith(root + path.sep);
}

export async function cleanupTempDocumentFiles(opts: {
  apply: boolean;
  now?: Date;
  processingPaths?: Set<string>;
}): Promise<CleanupResult> {
  const limits = getDocumentLimits();
  const maxAgeMs = limits.tempFileMaxAgeMinutes * 60_000;
  const now = opts.now ?? new Date();
  const correlationId = newCorrelationId();
  const tmp = os.tmpdir();
  const entries = await fs.readdir(tmp, { withFileTypes: true });
  const result: CleanupResult = { scanned: 0, eligible: 0, deleted: 0, skipped: 0, failed: 0, bytesFreed: 0 };

  for (const ent of entries) {
    if (!ent.name.startsWith("hakeem-url-")) continue;
    const dir = path.join(tmp, ent.name);
    result.scanned += 1;
    if (!isPathInsideTemp(dir)) {
      result.skipped += 1;
      continue;
    }
    // لا تتبع symlinks خارج temp
    try {
      const st = await fs.lstat(dir);
      if (st.isSymbolicLink()) {
        result.skipped += 1;
        continue;
      }
      if (!st.isDirectory()) {
        result.skipped += 1;
        continue;
      }
      const age = now.getTime() - st.mtimeMs;
      if (age < maxAgeMs) {
        result.skipped += 1;
        continue;
      }
      if (opts.processingPaths?.has(dir)) {
        result.skipped += 1;
        continue;
      }
      result.eligible += 1;
      if (!opts.apply) continue;

      // احسب الحجم قبل الحذف
      let bytes = 0;
      try {
        const files = await fs.readdir(dir);
        for (const f of files) {
          const fp = path.join(dir, f);
          const fst = await fs.lstat(fp);
          if (fst.isSymbolicLink()) continue;
          if (fst.isFile()) bytes += fst.size;
        }
        await fs.rm(dir, { recursive: true, force: true });
        result.deleted += 1;
        result.bytesFreed += bytes;
      } catch {
        result.failed += 1;
      }
    } catch {
      result.failed += 1;
    }
  }

  logDocumentEvent({
    event: "document_temp_cleanup",
    correlationId,
    status: opts.apply ? "applied" : "dry-run",
    bytes: result.bytesFreed,
    // أعداد فقط
    scanned: result.scanned,
    eligible: result.eligible,
    deleted: result.deleted,
    skipped: result.skipped,
    failed: result.failed
  });
  incDocumentMetric("document_temp_cleanup_total", { status: opts.apply ? "applied" : "dry_run" });
  void createHash; // keep crypto import used if tree-shaken oddly
  void safeTempRoot;
  return result;
}
