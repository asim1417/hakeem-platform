/**
 * 02-anchor-mining — استخراج عبارات المرسى المرشحة بالإحصاء المجمّع (قراءة فقط).
 *
 * حيث لم يعثر التقطيع بالقواعد على حدّ (الإجابة، الدعوى) أو حيث تختلف البنية (أحكام الهيئة
 * الدائمة)، تُعدّ العبارات المتكررة (٢–٤ كلمات مطبَّعة) بعدد الأحكام المختلفة التي وردت فيها.
 * لا يُخرج إلا عبارة تكررت في ≥ MIN_RULINGS حكمًا مختلفًا (صيغ إجرائية لا بيانات شخصية)،
 * بعد حجب الأسماء والأرقام. المستودع عام: لا نصوص ولا معرّفات.
 *
 * المخرج: reports/rulings-research/02-anchor-mining.data.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertReadOnly, openReadOnlyDb } from "../../lib/rulings/audit/readonly-db";
import { keyForm } from "../../lib/rulings/audit/lexicon";
import { maskPersonalData } from "../../lib/rulings/research/mask";
import { classifyCourt } from "../../lib/rulings/research/meta";
import { segmentRuling } from "../../lib/rulings/research/segment";

const OUT = path.join(process.cwd(), "reports/rulings-research/02-anchor-mining.data.json");
const MIN_RULINGS = 50;
const MIN_RULINGS_SUPREME = 30;
const BATCH = 1000;

function tokens(s: string): string[] {
  return keyForm(maskPersonalData(s))
    .replace(/[0-9٠-٩]+/g, "#")
    .replace(/[^ء-ي#\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** يضيف n-grams (٢–٤) من نافذة إلى عدّاد «عدد الأحكام» (مرة لكل حكم). */
function countGrams(counter: Map<string, number>, toks: string[], filter: (g: string[]) => boolean) {
  const seen = new Set<string>();
  for (let n = 2; n <= 4; n++) {
    for (let i = 0; i + n <= toks.length; i++) {
      const g = toks.slice(i, i + n);
      if (g.includes("#") || g.includes("[اسم]") || !filter(g)) continue;
      seen.add(g.join(" "));
    }
  }
  for (const g of seen) counter.set(g, (counter.get(g) ?? 0) + 1);
}

const top = (m: Map<string, number>, min: number, k = 80) =>
  [...m.entries()].filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1]).slice(0, k).map(([phrase, rulings]) => ({ phrase, rulings }));

const DEF_RE = /^(?:و?ال)?مدع(?:ي|ا)?\s*$|^عليه|^عليها/;

async function main() {
  const db = openReadOnlyDb();
  try {
    console.log(`🔒 قراءة فقط: ${await assertReadOnly(db)} — النقل: ${db.transport}`);
    const defense = new Map<string, number>();
    const claims = new Map<string, number>();
    const supremeStart = new Map<string, number>();
    const supremeMid = new Map<string, number>();
    let n = 0, noDefense = 0, noClaims = 0, supreme = 0;
    let last = "";
    for (;;) {
      const rows = await db.q<{ id: string; court: string | null; text: string }>(
        `SELECT id, court, "judgmentText" AS text FROM judicial_cases WHERE id > $1 ORDER BY id LIMIT ${BATCH}`, last);
      if (!rows.length) break;
      for (const r of rows) {
        n++;
        const seg = segmentRuling(r.text);
        const span = (t: string) => seg.segments.find((s) => s.type === t);
        if (classifyCourt(r.court) === "أخرى") {
          supreme++;
          const t = tokens(r.text);
          countGrams(supremeStart, t.slice(0, Math.ceil(t.length * 0.25)), () => true);
          countGrams(supremeMid, t.slice(Math.floor(t.length * 0.25), Math.floor(t.length * 0.85)), (g) => /^و|^ف|^ل/.test(g[0]));
          continue;
        }
        if (!seg.found.defense) {
          noDefense++;
          const c = span("claims");
          const end = span("reasons")?.start ?? span("disposition")?.start ?? r.text.length;
          const win = tokens(r.text.slice(c?.start ?? 0, end));
          // عبارات تذكر الطرف المدعى عليه أو وكيله (مرشحات بداية الإجابة).
          countGrams(defense, win, (g) => g.some((w) => /مدعي|مدعا|عليه|عليها|وكيل/.test(w)) && g.some((w) => DEF_RE.test(w) || /عليه|عليها/.test(w)));
        }
        if (!seg.found.claims) {
          noClaims++;
          const t = tokens(r.text);
          countGrams(claims, t.slice(0, Math.ceil(t.length * 0.3)), (g) => /^و|^ف|^ب|^ل|^ت|^ا/.test(g[0]));
        }
      }
      last = rows[rows.length - 1].id;
      process.stdout.write(`\r… ${n}`);
    }
    process.stdout.write("\n");
    const data = {
      measuredAt: new Date().toISOString(),
      rows: n,
      windows: { noDefense, noClaims, supreme },
      minRulings: { default: MIN_RULINGS, supreme: MIN_RULINGS_SUPREME },
      defenseCandidates: top(defense, MIN_RULINGS),
      claimsCandidates: top(claims, MIN_RULINGS),
      supremeOpeningPhrases: top(supremeStart, MIN_RULINGS_SUPREME),
      supremeBodyPhrases: top(supremeMid, MIN_RULINGS_SUPREME),
    };
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(data, null, 2));
    console.log(`✓ ${path.relative(process.cwd(), OUT)}`);
  } finally {
    await db.close();
  }
}

main().catch((e) => {
  console.error("فشل:", (e as Error).message);
  process.exitCode = 1;
});
