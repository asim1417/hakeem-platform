// مخزن المهام الدائم — بلا تبعيات (وحدات Node المدمجة فقط).
//
// يحفظ حالة كل مهمّة كملفّ JSON (كتابة ذرّية: tmp ثم rename)، وملفات الرفع على
// القرص. فإن أُعيد تشغيل الخادم تُقرأ المهام غير المكتملة من القرص وتُستأنف.
//
// Node أحادي الخيط: «العمّال» مهامٌ متزامنة (async) لا خيوط متوازية — فالتقاط ملفٍ
// (find pending → mark processing) يتمّ في «تِكّة» واحدة بلا await، فلا سباق أصلاً.

import { promises as fs } from "node:fs";
import { existsSync, mkdirSync } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";

export type FileStatus = "pending" | "processing" | "done" | "empty" | "error";
export type JobStatus = "queued" | "running" | "done";

export interface JobFile {
  idx: number;
  name: string;
  /** مسار الرفع على القرص — يُحذف بعد المعالجة. */
  path: string;
  status: FileStatus;
  kind: string | null;
  text: string | null;
  err: string | null;
}

export interface Job {
  id: string;
  provider: string;
  model: string;
  status: JobStatus;
  total: number;
  done: number;
  created: number;
  files: JobFile[];
}

const DATA_DIR = process.env.DOC_NODE_DATA || path.join(os.tmpdir(), "hakeem-doc-node");
const JOBS_DIR = path.join(DATA_DIR, "jobs");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

export function ensureDirs(): void {
  for (const d of [DATA_DIR, JOBS_DIR, UPLOAD_DIR]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

export function newId(): string {
  return crypto.randomBytes(8).toString("hex");
}

export function uploadDirFor(jobId: string): string {
  return path.join(UPLOAD_DIR, jobId);
}

function jobFilePath(jobId: string): string {
  return path.join(JOBS_DIR, jobId + ".json");
}

/** كتابة ذرّية: اكتب لملفٍ مؤقّت ثم أعِد تسميته (لا حالة نصف-مكتوبة عند التعطّل). */
export async function saveJob(job: Job): Promise<void> {
  ensureDirs();
  const target = jobFilePath(job.id);
  const tmp = target + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(job), "utf-8");
  await fs.rename(tmp, target);
}

export async function loadJob(jobId: string): Promise<Job | null> {
  try {
    const raw = await fs.readFile(jobFilePath(jobId), "utf-8");
    return JSON.parse(raw) as Job;
  } catch {
    return null;
  }
}

export async function listJobs(limit = 50): Promise<Job[]> {
  ensureDirs();
  let names: string[] = [];
  try {
    names = (await fs.readdir(JOBS_DIR)).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
  const jobs: Job[] = [];
  for (const n of names) {
    const j = await loadJob(n.replace(/\.json$/, ""));
    if (j) jobs.push(j);
  }
  jobs.sort((a, b) => b.created - a.created);
  return jobs.slice(0, limit);
}

/** كل معرّفات المهام التي لها ملفٌ غير منجز (pending) — للاستئناف عند الإقلاع. */
export async function pendingJobIds(): Promise<string[]> {
  const jobs = await listJobs(1000);
  return jobs.filter((j) => j.files.some((f) => f.status === "pending" || f.status === "processing")).map((j) => j.id);
}
