// خادم معالجة الوثائق (Node) — http مدمج، بلا تبعيات خارجية.
//
// يعيد استخدام الدماغ الموحّد وسجلّ المحرّكات ومخزن المهام. يشغَّل بـ:
//   tsx services/doc-node/server.ts        (أو npm run doc-node)
// المنفذ من PORT (افتراضي 8090). البيانات في DOC_NODE_DATA.

import * as http from "node:http";
import { parseMultipart } from "./multipart";
import { providersStatus, providersDetail } from "./engines";
import { startJob, getJob, allJobs, resumePending, type InputFile } from "./jobs";

const PORT = Number(process.env.PORT ?? "8090");
const APP_PASSWORD = (process.env.APP_PASSWORD ?? "").trim();

function json(res: http.ServerResponse, code: number, body: unknown): void {
  const s = JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(s) });
  res.end(s);
}

function readBody(req: http.IncomingMessage, limitBytes = 200 * 1024 * 1024): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error("الحمولة أكبر من الحدّ"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** حارس كلمة المرور (اختياري عبر APP_PASSWORD) — عبر ترويسة x-app-password. */
function authorized(req: http.IncomingMessage): boolean {
  if (!APP_PASSWORD) return true;
  return (req.headers["x-app-password"] ?? "") === APP_PASSWORD;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const p = url.pathname;

    if (p === "/healthz") return json(res, 200, { status: "ok" });

    if (p === "/api/providers") {
      if (!authorized(req)) return json(res, 401, { error: "غير مُصرَّح" });
      return json(res, 200, { ...providersStatus(), detail: providersDetail() });
    }

    if (p === "/api/jobs" && req.method === "POST") {
      if (!authorized(req)) return json(res, 401, { error: "غير مُصرَّح" });
      const body = await readBody(req);
      const ct = req.headers["content-type"] ?? "";
      const parts = parseMultipart(body, ct);
      let provider = "local";
      let model = "flash";
      const files: InputFile[] = [];
      for (const part of parts) {
        if (part.name === "provider") provider = part.data.toString("utf-8").trim() || provider;
        else if (part.name === "model") model = part.data.toString("utf-8").trim() || model;
        else if (part.name === "files" || part.filename) {
          files.push({ name: part.filename ?? "file", data: new Uint8Array(part.data) });
        }
      }
      if (!files.length) return json(res, 400, { error: "لا ملفات" });
      const job = await startJob(files, provider, model);
      return json(res, 200, { job_id: job.id, total: job.total });
    }

    const jobMatch = /^\/api\/jobs\/([a-f0-9]+)$/.exec(p);
    if (jobMatch && req.method === "GET") {
      if (!authorized(req)) return json(res, 401, { error: "غير مُصرَّح" });
      const withText = url.searchParams.get("text") === "1";
      const job = await getJob(jobMatch[1], withText);
      if (!job) return json(res, 404, { error: "المهمّة غير موجودة" });
      return json(res, 200, job);
    }

    if (p === "/api/jobs" && req.method === "GET") {
      if (!authorized(req)) return json(res, 401, { error: "غير مُصرَّح" });
      return json(res, 200, { jobs: await allJobs(50) });
    }

    if (p === "/") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("خدمة معالجة الوثائق (Node) — استخدم /api/jobs و/api/providers و/healthz");
    }

    json(res, 404, { error: "غير موجود" });
  } catch (e) {
    json(res, 500, { error: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
  }
});

// عند الإقلاع: استأنف المهام غير المكتملة، ثم استمع.
resumePending()
  .catch(() => undefined)
  .finally(() => {
    server.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`خدمة معالجة الوثائق (Node) تعمل على المنفذ ${PORT}`);
    });
  });
