/**
 * HKM-023-B ب-٢: اختبارات قارئ المقدمة (بلا قاعدة).
 * - ثلاث عيّنات اصطناعية (مرسوم فقط، مرسوم + قرار مجلس الوزراء، أمر ملكي).
 * - ست عيّنات حقيقية مقروءة من الإنتاج بقراءة فقط (data/preamble-fixtures/hkm-023-b/production.json)،
 *   منها نص الهيئة لنظام الإثبات من law_card (بديل العيّنة التي لم يلصقها المالك).
 * لكل عيّنة: إعادة التركيب الحرفي، والأدوات وأنواعها، وعدد الاستنادات والبنود.
 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  composeLawCardText,
  parseInstrumentHeading,
  parsePreamble,
  reconstructPreamble,
  verifyTiling,
  type PreambleParse,
  type PreambleUnitType,
} from "../lib/modules/legal-core/preamble-parser";

let failed = 0;
let passed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (c) passed++;
  else failed++;
};
const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");

type Expect = {
  instruments: Array<{ kind: string | null; number?: string | null; dateHijri?: string | null; recitals: number; clauses: number; signed: boolean }>;
  completeness: "complete" | "partial" | "issuance_line";
  leading?: PreambleUnitType;
  trailing?: PreambleUnitType;
};

function check(name: string, text: string, exp: Expect): PreambleParse {
  const r = parsePreamble(text);
  ok(r.ok && r.reconstructionOk, `${name}: إعادة التركيب الحرفي (${text.length} حرفًا)`);
  ok(reconstructPreamble(r.units) === text && verifyTiling(text, r.units), `${name}: التبليط متصل ومجموعه = الأصل`);
  ok(r.instruments.length === exp.instruments.length, `${name}: عدد الأدوات ${r.instruments.length} (المتوقع ${exp.instruments.length})`);
  exp.instruments.forEach((e, i) => {
    const inst = r.instruments[i];
    const idx = i + 1;
    const units = r.units.filter((u) => u.instrumentIndex === idx);
    const rec = units.filter((u) => u.type === "recital").length;
    const cl = units.filter((u) => u.type === "operative_clause").length;
    const sig = units.some((u) => u.type === "signature");
    ok(inst?.kind === e.kind, `${name}: الأداة ${idx} نوعها ${inst?.kind} (المتوقع ${e.kind})`);
    if (e.number !== undefined) ok(inst?.number === e.number, `${name}: الأداة ${idx} رقمها ${inst?.number} (المتوقع ${e.number})`);
    if (e.dateHijri !== undefined) ok(inst?.dateHijri === e.dateHijri, `${name}: الأداة ${idx} تاريخها ${inst?.dateHijri} (المتوقع ${e.dateHijri})`);
    ok(rec === e.recitals, `${name}: الأداة ${idx} استنادات ${rec} (المتوقع ${e.recitals})`);
    ok(cl === e.clauses, `${name}: الأداة ${idx} بنود ${cl} (المتوقع ${e.clauses})`);
    ok(sig === e.signed, `${name}: الأداة ${idx} توقيع ${sig ? "موجود" : "غائب"}`);
    ok(units.filter((u) => u.type === "issuing_instrument").length === 1, `${name}: الأداة ${idx} لها وحدة أب واحدة`);
  });
  ok(r.completeness === exp.completeness, `${name}: التصنيف ${r.completeness} (المتوقع ${exp.completeness})`);
  const leaves = r.units.filter((u) => u.type !== "issuing_instrument");
  if (exp.leading) ok(leaves[0]?.type === exp.leading && leaves[0].instrumentIndex === null, `${name}: أول وحدة ${leaves[0]?.type} خارج الأدوات`);
  if (exp.trailing) ok(leaves[leaves.length - 1]?.type === exp.trailing && leaves[leaves.length - 1].instrumentIndex === null, `${name}: آخر وحدة ${leaves[leaves.length - 1]?.type} خارج الأدوات`);
  // البنود مرقّمة تصاعديًا داخل كل أداة، ومراسيها فريدة.
  const anchors = r.units.map((u) => u.anchor).filter(Boolean);
  ok(new Set(anchors).size === anchors.length, `${name}: المراسي فريدة (${anchors.length})`);
  return r;
}

// ── اصطناعية ──
const syn = JSON.parse(fs.readFileSync("data/preamble-fixtures/hkm-023-b/synthetic.json", "utf8")) as { samples: Array<{ id: string; text: string }> };
ok(syn.samples.every((s) => s.id.includes("اصطناعي") && s.text.includes("اصطناعي")), "B-2 العيّنات المصطنعة موسومة «اصطناعي» في المعرّف والنص");
const [s1, s2, s3] = syn.samples;

const r1 = check("B-2 اصطناعي مرسوم فقط", s1.text, {
  instruments: [{ kind: "royal_decree", number: "م/0", dateHijri: "1400/1/1", recitals: 2, clauses: 2, signed: true }],
  completeness: "complete",
  leading: "preamble_heading",
});
ok(
  r1.units.filter((u) => u.instrumentIndex === 1 && u.type !== "issuing_instrument").map((u) => u.type).join(",") ===
    "preamble_heading,preamble_heading,opening,recital,recital,enacting_formula,operative_clause,operative_clause,signature",
  "B-2 اصطناعي مرسوم فقط: تسلسل الوحدات (البسملة، العنوان، الافتتاحية، استنادان، الصيغة، بندان، التوقيع)",
);
const c2 = r1.units.find((u) => u.type === "operative_clause" && u.number === "2");
ok(c2?.anchor === "preamble-i1-clause-2" && c2.label === "ثانياً", "B-2 البند الثاني مرساته preamble-i1-clause-2 وتسميته «ثانياً»");

const r2 = check("B-2 اصطناعي مرسوم + قرار", s2.text, {
  instruments: [
    { kind: "royal_decree", number: null, recitals: 2, clauses: 2, signed: true },
    { kind: "cabinet_decision", number: "0", dateHijri: "1400/1/1", recitals: 2, clauses: 1, signed: true },
  ],
  completeness: "complete",
  trailing: "unclassified",
});
const unnumbered = r2.units.find((u) => u.instrumentIndex === 2 && u.type === "operative_clause");
ok(Boolean(unnumbered?.text.startsWith("الموافقة على النظام الاصطناعي الثاني")) && unnumbered?.number === "1", "B-2 المنطوق غير المرقّم بعد «يُقرر ما يلي» وحدة بند واحدة");
ok(r2.units.some((u) => u.type === "recital" && u.text.startsWith("بناءً على")), "B-2 الاستناد الملتصق بالافتتاحية بلا فاصل يُلتقط");
ok(r2.warnings.some((w) => w.includes("بعد التوقيع")), "B-2 سطر «النفاذ» الملحق يُحفظ وحدة غير مصنفة مع تنبيه");

check("B-2 اصطناعي أمر ملكي", s3.text, {
  instruments: [{ kind: "royal_order", number: "أ/0", dateHijri: "1400/1/1", recitals: 2, clauses: 2, signed: true }],
  completeness: "complete",
});

// ── حقيقية من الإنتاج ──
const prod = JSON.parse(fs.readFileSync("data/preamble-fixtures/hkm-023-b/production.json", "utf8")) as {
  samples: Array<{ id: string; source: { system_name: string; md5: string }; text?: string; text_file?: string }>;
  law_card_samples: Array<{ id: string; source: { composed_md5: string }; blocks: Array<{ kind: string; heading: string | null; text: string }> }>;
};
const textOf = (s: (typeof prod.samples)[number]) => s.text ?? fs.readFileSync(s.text_file as string, "utf8").trim();
for (const s of prod.samples) ok(md5(textOf(s)) === s.source.md5, `B-2 العيّنة الحقيقية «${s.source.system_name}» منقولة حرفيًا (md5 = الإنتاج)`);
for (const s of prod.samples) ok(textOf(s).length > 3000, `B-2 العيّنة «${s.source.system_name}» أطول من 3000 حرف`);
const byName = (n: string) => textOf(prod.samples.find((s) => s.source.system_name === n)!);

check("B-2 الإنتاج: نظام جمع التبرعات", byName("نظام جمع التبرعات"), {
  instruments: [
    { kind: "royal_decree", number: null, recitals: 5, clauses: 3, signed: true },
    { kind: "cabinet_decision", number: "116", dateHijri: "1446/2/2", recitals: 8, clauses: 3, signed: true },
  ],
  completeness: "complete",
  trailing: "unclassified",
});
check("B-2 الإنتاج: براءات الاختراع (أسطر ملتصقة)", byName(prod.samples[1].source.system_name), {
  instruments: [
    { kind: "royal_decree", number: null, recitals: 5, clauses: 3, signed: true },
    { kind: "cabinet_decision", number: "430", dateHijri: "1443/8/5", recitals: 6, clauses: 2, signed: true },
  ],
  completeness: "complete",
  trailing: "unclassified",
});
check("B-2 الإنتاج: نظام حقوق المؤلف (قرار وحده)", byName("نظام حقوق المؤلف"), {
  instruments: [{ kind: "cabinet_decision", number: "560", dateHijri: "1447/8/8", recitals: 7, clauses: 10, signed: true }],
  completeness: "complete",
  trailing: "unclassified",
});
const hosp = check("B-2 الإنتاج: تعميم بلا افتتاحية", byName("النظام الأساس لمستشفى الملك خالد التخصصي للعيون ومركز الأبحاث"), {
  instruments: [{ kind: "other", number: "28341", dateHijri: "1446/4/21", recitals: 1, clauses: 11, signed: true }],
  completeness: "partial",
  trailing: "unclassified",
});
ok(hosp.units.some((u) => u.type === "operative_clause" && u.number === "11" && u.label === "حادي عشر"), "B-2 «حادي عشر» بند رقمه 11");
const civil = check("B-2 الإنتاج: نظام المعاملات المدنية", byName("نظام المعاملات المدنية"), {
  instruments: [
    { kind: "royal_decree", number: "م/191", dateHijri: "1444/11/29", recitals: 5, clauses: 7, signed: true },
    { kind: "cabinet_decision", number: "820", dateHijri: "1444/11/24", recitals: 15, clauses: 9, signed: true },
  ],
  completeness: "complete",
  leading: "preamble_heading",
});
ok(civil.units.find((u) => u.anchor === "preamble-i1-clause-5")?.text.startsWith("خامساً: تسري أحكام نظام المعاملات المدنية على جميع الوقائع") === true, "B-2 البند خامسًا من المرسوم م/191 (الأثر الرجعي) وحدة مستقلة قابلة للإحالة");

const card = prod.law_card_samples[0];
const composed = composeLawCardText(card.blocks);
ok(md5(composed) === card.source.composed_md5, "B-2 تركيب كتل law_card لنظام الإثبات = md5 المحسوب في الإنتاج");
ok(composed.length > 4000 && !composed.includes("(الباب الأول)"), "B-2 التركيب يستبعد بداية المتن (law_title) وطوله أكثر من 4000 حرف");
const ithbat = check("B-2 الهيئة: نظام الإثبات (law_card)", composed, {
  instruments: [
    { kind: "royal_decree", number: "م/43", dateHijri: "1443/5/26", recitals: 5, clauses: 6, signed: true },
    { kind: "cabinet_decision", number: "283", dateHijri: "1443/5/24", recitals: 9, clauses: 5, signed: true },
  ],
  completeness: "complete",
  leading: "preamble_heading",
  trailing: "preamble_heading",
});
ok(ithbat.units.find((u) => u.anchor === "preamble-i1-clause-5")?.text.startsWith("خامساً: أنّ كل إجراء من إجراءات الإثبات") === true, "B-2 البند خامسًا من م/43 (بقاء الإجراء الصحيح) مرساته preamble-i1-clause-5");

// ── الرفض عند اختلال التركيب ──
const broken = { ...ithbat, units: ithbat.units.map((u, i) => (i === 3 ? { ...u, text: u.text.slice(1) } : u)) };
ok(!verifyTiling(composed, broken.units), "B-2 حذف محرف من وحدة يُسقط التبليط (يُرفض التفكيك)");
const swapped = ithbat.units.map((u) => (u.ordinal === 4 ? { ...u, ordinal: 5 } : u.ordinal === 5 ? { ...u, ordinal: 4 } : u));
ok(!verifyTiling(composed, swapped), "B-2 تبديل ترتيب وحدتين يُسقط التبليط");

// ── حالات حدّية ──
const empty = parsePreamble("");
ok(empty.ok && empty.units.length === 0 && empty.completeness === "issuance_line", "B-2 نص فارغ: لا وحدات");
const line = "أداة الإصدار:\nمرسوم ملكي رقم (12) بتاريخ 20 / 7 / 1379هـ\nتاريخ الإصدار (هجريّ): 1379-07-20";
const lr = parsePreamble(line);
ok(lr.ok && lr.completeness === "issuance_line", "B-2 سطر إصدار فقط يُصنف issuance_line ويُحفظ حرفيًا");
const h = parseInstrumentHeading("مرسوم ملكي رقم ( م/128 ) وتاريخ 1440/11/13هـ");
ok(h.kind === "royal_decree" && h.number === "م/128" && h.dateHijri === "1440/11/13", "B-2 عنوان الأداة: النوع والرقم والتاريخ");
const h2 = parseInstrumentHeading("قرار مجلس الوزراء رقم (٢٨٣) وتاريخ ٢٤ / ٥ / ١٤٤٣هـ");
ok(h2.kind === "cabinet_decision" && h2.number === "283" && h2.dateHijri === "1443/5/24", "B-2 عنوان الأداة بأرقام هندية وترتيب يوم/شهر/سنة");

console.log(`\n${passed} نجح، ${failed} فشل`);
process.exitCode = failed ? 1 : 0;
