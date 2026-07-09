// طابور المهام الخلفية — يعالج على الخادم فيُغلق المستخدم الصفحة ويعود فيجد النتيجة.
//
// عمّالٌ متزامنون (async) بدرجة توازٍ محدودة، والتقاط الملفّ ذرّيٌّ (سنكرونيّ في تِكّة
// واحدة — Node أحادي الخيط). كل تحديث يُحفَظ على القرص، فالاستئناف بعد التعطّل مضمون.

import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  ensureDirs,
  newId,
  saveJob,
  loadJob,
  listJobs,
  pendingJobIds,
  uploadDirFor,
  type Job
} from "./store";
import { runEngine } from "./engines";

const CONCURRENCY = Math.max(1, Math.min(Number(process.env.JOBS_CONCURRENCY ?? "3") || 3, 8));

/** ذاكرة المهام النشِطة — مصدر الحقيقة أثناء التشغيل (يُحفَظ للقرص عند كل تغيير). */
const active = new Map<string, Job>();

async function persist(job: Job): Promise<void> {
  active.set(job.id, job);
  await saveJob(job);
}

export interface InputFile {
  name: string;
  data: Uint8Array;
}

/** ينشئ مهمّةً، يحفظ ملفاتها على القرص، ويطلق معالجتها. يعيد معرّف المهمّة فوراً. */
export async function startJob(files: InputFile[], provider = "local", model = "flash"): Promise<Job> {
  ensureDirs();
  const id = newId();
  const dir = uploadDirFor(id);
  await fs.mkdir(dir, { recursive: true });
  const job: Job = {
    id,
    provider,
    model,
    status: "queued",
    total: files.length,
    done: 0,
    created: Date.now(),
    files: []
  };
  for (let i = 0; i < files.length; i += 1) {
    const safe = path.basename(files[i].name || "file");
    const p = path.join(dir, `${String(i).padStart(3, "0")}_${safe}`);
    await fs.writeFile(p, files[i].data);
    job.files.push({ idx: i, name: files[i].name, path: p, status: "pending", kind: null, text: null, err: null });
  }
  await persist(job);
  // لا ننتظر الاكتمال — المعالجة في الخلفية
  void run(id);
  return job;
}

/** التقاطٌ ذرّي: أول ملفٍ pending يُعلَّم processing في تِكّةٍ واحدة (بلا await وسطها). */
function claim(job: Job): number | null {
  for (const f of job.files) {
    if (f.status === "pending") {
      f.status = "processing";
      return f.idx;
    }
  }
  return null;
}

async function worker(job: Job): Promise<void> {
  for (;;) {
    const idx = claim(job);
    if (idx === null) return;
    await saveJob(job); // ثبّت علامة processing
    const f = job.files[idx];
    try {
      const data = await fs.readFile(f.path);
      const { text, kind } = await runEngine(job.provider, job.model, f.name, new Uint8Array(data));
      const ok = Boolean((text || "").trim());
      f.status = ok ? "done" : "empty";
      f.kind = kind;
      f.text = text;
      f.err = null;
    } catch (e) {
      f.status = "error";
      f.err = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    } finally {
      job.done += 1;
      await persist(job);
      fs.rm(f.path, { force: true }).catch(() => undefined);
    }
  }
}

async function run(jobId: string): Promise<void> {
  let job = active.get(jobId) ?? (await loadJob(jobId));
  if (!job) return;
  // أعِد أي ملفٍ عالقٍ في processing (من تعطّلٍ سابق) إلى pending
  for (const f of job.files) if (f.status === "processing") f.status = "pending";
  job.status = "running";
  await persist(job);

  const pending = job.files.filter((f) => f.status === "pending").length;
  const pool = Math.max(1, Math.min(CONCURRENCY, pending || 1));
  await Promise.all(Array.from({ length: pool }, () => worker(job as Job)));

  job.status = "done";
  await persist(job);
}

export async function getJob(jobId: string, includeText = true): Promise<Job | null> {
  const job = active.get(jobId) ?? (await loadJob(jobId));
  if (!job) return null;
  if (includeText) return job;
  return { ...job, files: job.files.map((f) => ({ ...f, text: null })) };
}

export async function allJobs(limit = 50): Promise<Job[]> {
  return listJobs(limit);
}

/** عند الإقلاع: أعِد إطلاق المهام غير المكتملة. */
export async function resumePending(): Promise<void> {
  const ids = await pendingJobIds();
  for (const id of ids) void run(id);
}
