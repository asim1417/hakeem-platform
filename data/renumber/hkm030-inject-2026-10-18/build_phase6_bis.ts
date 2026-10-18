/**
 * HKM-030 المرحلة 6: إنشاء وحدات المواد المضافة «مكرر» المستبقاة من المرحلة 5 (بموافقة المالك 18/10/2026 «نعم»).
 *   npx tsx data/renumber/hkm030-inject-2026-10-18/build_phase6_bis.ts
 *
 * صف جديد في legal_articles لكل مادة (إدراج فقط، لا يُعدَّل صف قائم)، وسجل تحقق «ساري» يحمل سند الأداة.
 * النص مقتطع من لقطة صفحة الأداة في أم القرى (source_snapshots.json) بين علامتي الاقتباس، بتوحيد المسافات فقط،
 * ونقطة الختام بعد علامة الإغلاق كما في المرحلة 5. والعنوان «المادة (…)» بلفظ الترتيب الوارد في الأداة نفسها.
 * يتحقق حارس داخل القاعدة من بصمة كل مقطع في uqn_fix.source_snapshot قبل الإدراج.
 * حقول التصنيف والفصل والحالة تُنسخ من المادة الأصل (رقمها نفسه بلا «مكرر»).
 * التاريخ: تاريخ النشر في أم القرى (ترويسة الصفحة؛ مطابق لمحوّل hijri_converter)، كما في المرحلة 5.
 * غير مشمول: «الرابعة مكرر» في الحراسة الأمنية وبنك التصدير، و«العاشرة مكرر» في وثائق السفر: موجودة صفوفًا قائمة.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { buildSearchNorm } from "../../../lib/modules/legal-core/search-norm";

const OUT = "data/renumber/hkm030-inject-2026-10-18";
const SRC = JSON.parse(readFileSync("ingest/uqn-fix-2026-09-25/data/source_snapshots.json", "utf8")) as Record<string, string>;
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const md5 = (s: string) => createHash("md5").update(s).digest("hex");
const flat = (s: string) => s.replace(/\s+/g, " ").trim();
const url = (p: string) => `https://www.uqn.gov.sa/details?p=${p}`;

type Frag = { pos: number; len: number; text: string };
/** المقطع بعد علامة الفتح open حتى علامة الإغلاق close، بدءًا من المرساة anchor (فريدة في الصفحة). */
function cut(p: string, anchor: string, open: string, close: string): Frag {
  const s = SRC[url(p)];
  if (s.split(anchor).length !== 2) throw new Error(`anchor ${p}: ${anchor}`);
  const i = s.indexOf(open, s.indexOf(anchor)) + open.length;
  const j = s.indexOf(close, i);
  if (i < open.length || j < 0) throw new Error(`cut ${p}`);
  return { pos: i, len: j - i, text: s.slice(i, j) };
}
const span = (p: string, a: string, b: string): Frag => {
  const s = SRC[url(p)]; const i = s.indexOf(a); const j = s.indexOf(b, i);
  if (s.split(a).length !== 2 || j < 0) throw new Error(`span ${p}`);
  return { pos: i, len: j - i, text: s.slice(i, j) };
};

type Bis = { key: string; p: string; sibling: string; n: number; title: string; frags: Frag[]; ev: Frag; instrument: string; from: string; pub: string };
const M87 = "مرسوم ملكي رقم م/87 وتاريخ 1442/9/24هـ";
// م/87: المقدمة بين «…» ثم البنود (أ–ج) حتى ” الختامية؛ علامتا الاقتباس حدود لا نص.
const m87 = [cut("17601", "بالنص الآتي:", "«", "»"), cut("17601", "الآتية».", ".", "”")];
const m87ev = span("17601", "أولاً: الموافقة على إضافة مادة", "\nثانياً");
const B: Bis[] = [
  { key: "m272-36bis", p: "25139", sibling: "cmpzcvci30bsgvtrk1844m3mp", n: 36, title: "المادة (السادسة والثلاثون مكرر)",
    frags: [cut("25139", "\n14- إضافة مادة", 'بالنص الآتي: "', '"')], ev: span("25139", "\n14- إضافة مادة", "\nثانياً"),
    instrument: "المرسوم الملكي رقم م/272 وتاريخ 1445/12/4هـ", from: "2024-06-20", pub: "1445/12/14" },
  { key: "m118-ret-23bis", p: "19638", sibling: "cmpz806410cbx7b6wuej38oj2", n: 23, title: "المادة (الثالثة والعشرون مكرر)",
    frags: [cut("19638", "2– إضافة مادة ترتيبها", "“", "”")], ev: span("19638", "2– إضافة مادة ترتيبها", "ثانياً"),
    instrument: "المرسوم الملكي رقم م/118 وتاريخ 1443/11/16هـ", from: "2022-06-24", pub: "1443/11/25" },
  { key: "m45-60bis", p: "23816", sibling: "cmpz670zn0521cwg2s2rtzjmo", n: 60, title: "المادة (الستين مكرر)",
    frags: [cut("23816", "4- إضافة مادة إلى النظام", "«", "»")], ev: span("23816", "4- إضافة مادة إلى النظام", "ثانياً"),
    instrument: "مرسوم ملكي رقم م/45 وتاريخ 1445/3/10هـ", from: "2023-10-06", pub: "1445/3/21" },
  { key: "m87-civil-24bis", p: "17601", sibling: "cmpz8069a0cbz7b6wjskrlsjn", n: 24, title: "المادة (الرابعة والعشرين مكرر)",
    frags: m87, ev: m87ev, instrument: M87, from: "2021-05-14", pub: "1442/10/2" },
  { key: "m87-mil-23bis", p: "17601", sibling: "cmpz6qo0c0bvrcwg2b2cfs4fe", n: 23, title: "المادة (الثالثة والعشرين مكرر)",
    frags: m87, ev: m87ev, instrument: M87, from: "2021-05-14", pub: "1442/10/2" },
];

const sib = JSON.parse(readFileSync(`${OUT}/phase6_siblings.json`, "utf8")) as Record<string, { lawName: string; classification: string | null; chapter: string | null; keywords: string[] }>;
const st: string[] = [];
const plan: unknown[] = [];
const allFrags = new Map<string, Frag & { p: string }>();
for (const b of B) for (const f of [...b.frags, b.ev]) allFrags.set(`${b.p}@${f.pos}`, { ...f, p: b.p });
st.push(`SELECT 1/(CASE WHEN (SELECT count(*) FROM uqn_fix.source_snapshot s JOIN (VALUES ${[...allFrags.values()].map((f) => `(${q(url(f.p))},${f.pos},${f.len},${q(md5(f.text))})`).join(",")}) e(u,p,l,m) ON s.url=e.u AND md5(substr(s.body,e.p+1,e.l))=e.m)=${allFrags.size} THEN 1 ELSE 0 END) AS guard_snapshot`);
for (const b of B) {
  // المقطعان في م/87 يُوصلان بنقطة الختام الواردة بعد علامة الإغلاق «».» ثم مسافة.
  const content = (b.frags.length === 2 ? `${flat(b.frags[0].text)}. ${flat(b.frags[1].text.replace(/^\s*/, ""))}` : flat(b.frags[0].text)).normalize("NFC") + ".";
  const s = sib[b.sibling];
  const norm = buildSearchNorm({ lawName: s.lawName, title: b.title, content, keywords: s.keywords, classification: s.classification, chapter: s.chapter });
  const id = `hkm30a-${createHash("sha256").update(b.key).digest("hex").slice(0, 24)}`;
  const vid = `hkm30v-${createHash("sha256").update(`${id}@${b.from}@bis`).digest("hex").slice(0, 24)}`;
  const quote = `${flat(b.ev.text).slice(0, 560)}؛ نُشر في أم القرى ${b.pub}هـ؛ نافذ من ${b.from} (HKM-030 المرحلة 6)`.normalize("NFC");
  st.push(`INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, chapter, keywords, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm, norm_source) ` +
    `SELECT ${q(id)}, t."legalSystemId", t."lawName", t.classification, ${b.n}, 1, ${q(b.title)}, ${q(content)}, t.chapter, t.keywords, ${q(b.instrument)}, ${q(b.from)}, t.status, now(), now(), ${q(norm)}, 'rule' ` +
    `FROM legal_articles t WHERE t.id=${q(b.sibling)} AND t."articleNumber"=${b.n} AND t."articleBis"=0 AND t."lawName"=${q(s.lawName)} ` +
    `AND NOT EXISTS (SELECT 1 FROM legal_articles x WHERE x."legalSystemId"=t."legalSystemId" AND x."articleNumber"=${b.n} AND x."articleBis"=1)`);
  st.push(`INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at) ` +
    `SELECT ${q(vid)}, 'unit', ${q(id)}, 'ساري', ${q(b.instrument)}, ${q(url(b.p))}, ${q(quote)}, 'manual', 'hkm030-uqn-inject-2026-10-18', now() WHERE EXISTS (SELECT 1 FROM legal_articles WHERE id=${q(id)})`);
  plan.push({ id, vid, key: b.key, sibling: b.sibling, law: s.lawName, n: b.n, title: b.title, from: b.from, md5: md5(content), content, norm });
}
const ids = (plan as Array<{ id: string; vid: string }>);
st.push(`SELECT 1/(CASE WHEN (SELECT count(*) FROM legal_articles WHERE id IN (${ids.map((r) => q(r.id)).join(",")}))=${ids.length} AND (SELECT count(*) FROM verification WHERE id IN (${ids.map((r) => q(r.vid)).join(",")}))=${ids.length} THEN 1 ELSE 0 END) AS guard_after`);
st.push(`SELECT md5(string_agg(id||':'||md5(content)||':'||md5(search_norm), ',' ORDER BY id)) fp FROM legal_articles WHERE id IN (${ids.map((r) => q(r.id)).join(",")})`);
writeFileSync(`${OUT}/plan6_bis.json`, JSON.stringify(plan, null, 1) + "\n");
writeFileSync(`${OUT}/statements6_bis.json`, JSON.stringify(st, null, 1) + "\n");
const exp = md5((plan as Array<{ id: string; md5: string; norm: string }>).slice().sort((x, y) => (x.id < y.id ? -1 : 1)).map((r) => `${r.id}:${r.md5}:${md5(r.norm)}`).join(","));
console.log("units", ids.length, "statements", st.length, "expected fp", exp);
