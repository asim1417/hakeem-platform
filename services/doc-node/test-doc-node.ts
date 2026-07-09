// اختبارات خادم Node — حتمية بلا شبكة. تُشغَّل بـ: npm run test:doc-node
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// عزل بيانات الاختبار في مجلّد مؤقّت قبل استيراد المخزن (ديناميكياً داخل main)
process.env.DOC_NODE_DATA = path.join(os.tmpdir(), "hakeem-doc-node-test-" + process.pid);

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}
async function acheck(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

async function main() {
  const { parseMultipart } = await import("./multipart");
  const { providersStatus, providersDetail, runEngine } = await import("./engines");
  const { startJob, getJob } = await import("./jobs");

  // ── multipart ──
  check("multipart: يفصل الحقول والملفات (آمن ثنائياً)", () => {
    const b = "X";
    const payload = Buffer.concat([
      Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="provider"\r\n\r\nlocal\r\n`),
      Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="files"; filename="a.txt"\r\n\r\n`),
      Buffer.from("محتوى الملف"),
      Buffer.from(`\r\n--${b}--\r\n`)
    ]);
    const parts = parseMultipart(payload, `multipart/form-data; boundary=${b}`);
    const prov = parts.find((p) => p.name === "provider");
    const file = parts.find((p) => p.filename === "a.txt");
    assert.equal(prov?.data.toString("utf-8"), "local");
    assert.equal(file?.data.toString("utf-8"), "محتوى الملف");
  });

  // ── سجلّ المحرّكات ──
  check("المحرّكات: local متاح دائماً، gemini/qari حسب البيئة", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.QARI_ENDPOINT;
    const st = providersStatus();
    assert.equal(st.local, true);
    assert.equal(st.gemini, false);
    assert.equal(st.qari, false);
    const detail = providersDetail();
    assert.ok(detail.find((d) => d.name === "qari" && d.needs_gpu));
  });

  // ── المُوزّع: نصّ محلّي عبر الدماغ الموحّد ──
  await acheck("المُوزّع: يستخرج نصّاً محلياً", async () => {
    const out = await runEngine("local", "flash", "note.txt", new TextEncoder().encode("حكم قضائي"));
    assert.ok(out.text.includes("حكم قضائي"));
  });

  await acheck("المُوزّع: صورة بلا مزوّد بعيد → رسالة واضحة لا فشل صامت", async () => {
    const out = await runEngine("local", "flash", "scan.png", new Uint8Array([1, 2, 3]));
    assert.ok(/Gemini|QARI/.test(out.kind));
  });

  // ── دورة حياة المهمّة (خلفية + تخزين على القرص) ──
  await acheck("المهمّة: تُنشأ وتُعالَج وتُخزَّن نتيجتها", async () => {
    const job = await startJob([{ name: "a.txt", data: new TextEncoder().encode("نصّ أول") }], "local", "flash");
    assert.equal(job.total, 1);
    let done: Awaited<ReturnType<typeof getJob>> = null;
    for (let i = 0; i < 100; i += 1) {
      done = await getJob(job.id, true);
      if (done && done.status === "done") break;
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.ok(done, "المهمّة موجودة");
    assert.equal(done!.status, "done");
    assert.equal(done!.files[0].status, "done");
    assert.ok((done!.files[0].text ?? "").includes("نصّ أول"));
  });

  await acheck("المهمّة: الحالة بلا نصّ لا تُسرّب المحتوى", async () => {
    const job = await startJob([{ name: "b.txt", data: new TextEncoder().encode("سرّي") }], "local", "flash");
    for (let i = 0; i < 100; i += 1) {
      const j = await getJob(job.id, true);
      if (j && j.status === "done") break;
      await new Promise((r) => setTimeout(r, 20));
    }
    const noText = await getJob(job.id, false);
    assert.equal(noText!.files[0].text, null);
  });

  await fs.rm(process.env.DOC_NODE_DATA!, { recursive: true, force: true }).catch(() => undefined);
  console.log(`\nكل اختبارات خادم Node ناجحة (${passed})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
