/**
 * 05-segment-model-dryrun — تقدير كلفة إكمال التقطيع بالنموذج، تشغيلًا جافًّا للقراءة فقط.
 * لا يستدعي أي نموذج ولا يكتب شيئًا. المخرج أعداد فقط: reports/rulings-research/05-segment-model.data.json
 *
 * ما سيُرسل (حين يُعتمد): للحكم الذي لم تكتمل حدوده بالقواعد (needsModel)، **منطقة الحدّ المفقود وحدها**
 * لا الحكم كله، محجوبة البيانات الشخصية:
 *   • الأسباب المفقودة: من بداية الإجابة (أو الدعوى) إلى بداية المنطوق.
 *   • الدعوى المفقودة: من أول النص إلى أول مرسى لاحق.
 *   • المنطوق المفقود: آخر ٤٠٪ من النص.
 * ويُطلب من النموذج اقتباس أول كلمات الحدّ حرفيًّا، فيُتحقق منه بالبحث في النص (لا إزاحات من النموذج).
 * المنطقة الواحدة مسقوفة بـ REGION_CAP حرفًا (أولها وآخرها)، ويُعدّ ما قُصّ.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertReadOnly, openReadOnlyDb } from "../../lib/rulings/audit/readonly-db";
import { SEGMENT_EXTRACTOR_VERSION } from "../../lib/rulings/research/segment";
import { boundaryRegions, type Missing } from "../../lib/rulings/research/segment-store";
import { redactPII } from "../../lib/modules/legal-core/rulings-search";

const OUT = path.join(process.cwd(), "reports/rulings-research/05-segment-model.data.json");
const BATCH = 500;
const REGION_CAP = Number(process.env.REGION_CAP || 12000);
const PROMPT_TOKENS = 600; // تعليمات ثابتة (مخبّأة بعد أول طلب)
const OUTPUT_TOKENS_PER_BOUNDARY = 80;
// الأسعار لكل مليون رمز (الدخل/الخرج) من مرجع Claude API المحدَّث 2026-10-06؛ Batch API بنصف السعر.
const MODELS = {
  "claude-haiku-4-5": { in: 1.0, out: 5.0 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
  "claude-sonnet-5-5": { in: 2.0, out: 10.0 },
} as const;
const CHARS_PER_TOKEN = [1.5, 2.0, 3.0]; // نطاق تقديري للعربية؛ يُضبط بـ count_tokens قبل التنفيذ

async function main() {
  const db = openReadOnlyDb();
  try {
    console.log(`🔒 قراءة فقط: ${await assertReadOnly(db)} — النقل: ${db.transport}`);
    const t = { rulings: 0, needsModel: 0, regions: { claims: 0, reasons: 0, disposition: 0 } as Record<Missing, number>, chars: 0, capped: 0 };
    let last = "";
    for (;;) {
      const rows = await db.q<{ id: string; text: string | null }>(
        `SELECT id, "judgmentText" AS text FROM judicial_cases WHERE id > $1 ORDER BY id LIMIT ${BATCH}`, last);
      if (!rows.length) break;
      for (const r of rows) {
        t.rulings++;
        const text = r.text ?? "";
        const regions = boundaryRegions(text);
        if (!regions.length) continue;
        t.needsModel++;
        for (const g of regions) {
          t.regions[g.missing]++;
          let len = redactPII(text.slice(g.start, g.end)).length;
          if (len > REGION_CAP) {
            t.capped++;
            len = REGION_CAP;
          }
          t.chars += len;
        }
      }
      last = rows[rows.length - 1].id;
      process.stdout.write(`\r… ${t.rulings}`);
    }
    process.stdout.write("\n");
    const regionsTotal = t.regions.claims + t.regions.reasons + t.regions.disposition;
    const estimate = CHARS_PER_TOKEN.map((ratio) => {
      const inTok = Math.round(t.chars / ratio) + t.needsModel * PROMPT_TOKENS;
      const outTok = regionsTotal * OUTPUT_TOKENS_PER_BOUNDARY;
      const usd = Object.fromEntries(Object.entries(MODELS).map(([m, p]) => {
        const full = (inTok / 1e6) * p.in + (outTok / 1e6) * p.out;
        return [m, { standard: Math.round(full * 100) / 100, batch: Math.round(full * 50) / 100 }];
      }));
      return { charsPerToken: ratio, inputTokens: inTok, outputTokens: outTok, usd };
    });
    const data = {
      measuredAt: new Date().toISOString(), mode: "dry-run (no model calls)", segmentVersion: SEGMENT_EXTRACTOR_VERSION,
      rulings: t.rulings, needsModel: t.needsModel, needsModelPct: Math.round((t.needsModel / Math.max(1, t.rulings)) * 10000) / 100,
      regions: t.regions, calls: t.needsModel, regionChars: t.chars, regionsCappedAt: { cap: REGION_CAP, count: t.capped },
      estimate,
      note: "التكلفة بلا تخبئة التعليمات الثابتة؛ التخبئة تخفّضها قليلًا. عدد الرموز يُقاس بـ count_tokens قبل أي تنفيذ.",
    };
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
    console.log(JSON.stringify({ needsModel: data.needsModel, regions: data.regions, estimate }));
  } finally {
    await db.close();
  }
}

main().catch((e) => {
  console.error("فشل:", (e as Error).message);
  process.exitCode = 1;
});
