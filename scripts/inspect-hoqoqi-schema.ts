// مُفتّش بنية hoqoqi: يطبع أسماء أعمدة كلّ جدول من CREATE TABLE، ويُبرز الجداول/الأعمدة المرشّحة
// للديباجة/المرسوم — كي نضبط المستورد على البنية الحقيقيّة بلا تخمين. لا قاعدة بيانات، قراءة فقط.
//   npx tsx scripts/inspect-hoqoqi-schema.ts [ملف hoqoqi.sql(.zip)]
import path from "node:path";
import { readSqlFromZip, parseSqlInserts } from "./import-hoqoqi-sql";

async function main() {
  const file = path.resolve(process.argv[2] || "hoqoqi.sql.zip");
  const sql = await readSqlFromZip(file);

  // ① أعمدة كلّ جدول من CREATE TABLE.
  const createRe = /CREATE\s+TABLE\s+`?([A-Za-z0-9_]+)`?\s*\(([\s\S]*?)\)\s*(?:ENGINE|;)/gi;
  const tables: Array<{ name: string; cols: string[] }> = [];
  let m: RegExpExecArray | null;
  while ((m = createRe.exec(sql))) {
    const cols: string[] = [];
    for (const line of m[2].split("\n")) {
      if (/^\s*(PRIMARY|UNIQUE|KEY|CONSTRAINT|INDEX|FULLTEXT|FOREIGN)/i.test(line)) continue;
      const cm = line.match(/^\s*`([A-Za-z0-9_]+)`/);
      if (cm) cols.push(cm[1]);
    }
    tables.push({ name: m[1], cols });
  }

  // عدد صفوف الإدخال لكلّ جدول.
  const inserts = new Map<string, number>();
  for (const im of sql.matchAll(/INSERT\s+INTO\s+`?([A-Za-z0-9_]+)`?/gi)) {
    inserts.set(im[1], (inserts.get(im[1]) ?? 0) + 1);
  }

  console.log(`عدد الجداول: ${tables.length}\n`);
  console.log("=== كلّ الجداول وأعمدتها (وعدد عبارات الإدخال) ===");
  for (const t of tables) console.log(`\n• ${t.name}  [inserts=${inserts.get(t.name) ?? 0}]\n   ${t.cols.join(", ")}`);

  // ② مرشّحات الديباجة/المرسوم بالاسم أو بعمود.
  const kw = /preamble|preface|dibaj|decree|issuan|tool|amend|note|intro|header|mokad|mokaddima|mo2adima|deباجة/i;
  console.log("\n=== جداول/أعمدة مرشّحة (ديباجة/مرسوم/تعديل) ===");
  for (const t of tables) {
    const hit = t.cols.filter((c) => kw.test(c));
    if (kw.test(t.name) || hit.length) console.log(`• ${t.name} → ${hit.length ? hit.join(", ") : "(بالاسم)"}`);
  }

  // ③ عيّنة صفٍّ من الجداول المفتاحيّة (قيم مقتطعة) — لرؤية البيانات الفعليّة.
  const parsed = parseSqlInserts(sql);
  const sampleTables = ["laws", "laws_lang", "lang_laws", "tools_issuance_law", "amendment_articles_law"];
  console.log("\n=== عيّنة صفٍّ من الجداول المفتاحيّة ===");
  for (const t of sampleTables) {
    const rows = parsed.tables.get(t) ?? [];
    console.log(`\n• ${t} · صفوف مُحلَّلة=${rows.length}`);
    if (!rows.length) continue;
    const sample = Object.fromEntries(
      Object.entries(rows[0]).map(([k, v]) => [k, String(v ?? "").slice(0, 90)])
    );
    console.log(JSON.stringify(sample, null, 1));
  }

  // ④ تدقيق تغطية الديباجة السرديّة (law_preamble) عبر كلّ الأنظمة — إثباتٌ لما يحمله المصدر فعلًا،
  //    لا اعتمادًا على عيّنة صفٍّ واحد. يُجيب: كم نظامًا يحمل نصًّا سرديًّا كاملًا قبل المادة الأولى؟
  const langRows = [...(parsed.tables.get("laws_lang") ?? []), ...(parsed.tables.get("lang_laws") ?? [])];
  const field = (r: Record<string, unknown>, keys: string[]) => {
    const map = new Map(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v]));
    for (const k of keys) { const v = map.get(k.toLowerCase()); if (v != null && String(v).trim()) return String(v).trim(); }
    return "";
  };
  let withPreamble = 0, withKing = 0, withInstrument = 0;
  const preambleSamples: Array<{ len: number; text: string }> = [];
  for (const r of langRows) {
    const p = field(r, ["law_preamble", "preamble", "recitals", "intro_text"]);
    if (field(r, ["king_name", "king", "issuer_name"])) withKing++;
    if (p) { withPreamble++; if (preambleSamples.length < 5) preambleSamples.push({ len: p.length, text: p.slice(0, 220) }); }
  }
  for (const r of parsed.tables.get("law_issuance_tools") ?? []) {
    if (field(r, ["title", "text", "tool_title", "name", "content"])) withInstrument++;
  }
  console.log("\n=== تدقيق تغطية «ما قبل المادة الأولى» عبر كلّ الأنظمة (من المصدر مباشرةً) ===");
  console.log(`صفوف laws_lang المُحلَّلة: ${langRows.length}`);
  console.log(`أنظمة بـ law_preamble (نصّ سرديّ كامل) غير فارغ: ${withPreamble}`);
  console.log(`أنظمة بـ king_name غير فارغ: ${withKing}`);
  console.log(`صفوف أداة إصدار (law_issuance_tools) بعنوان غير فارغ: ${withInstrument}`);
  if (preambleSamples.length) {
    console.log("عيّنات law_preamble غير الفارغة:");
    preambleSamples.forEach((s, i) => console.log(`  [${i + 1}] (${s.len} حرفًا) «${s.text.replace(/\s+/g, " ")}…»`));
  } else {
    console.log("law_preamble فارغ في كلّ الصفوف — لكن نُتابع البحث في بقيّة الجداول قبل الحكم.");
  }

  // ⑤ مسحٌ شاملٌ للنصّ الخامّ كلّه عن عبارات الديباجة السرديّة — أينما كانت (مادّة، تعديل، أداة، أيّ عمود).
  //    هذا يتجاوز افتراض «العمود المعيَّن»: يبحث في كامل ملفّ SQL عن بصمات الديباجة الرسميّة السعوديّة.
  const markers = [
    "بعون الله", "بعد الاطلاع", "بعد الإطلاع", "وبعد الاطلاع", "رسمنا بما هو آت",
    "رسمنا بما هو آتٍ", "تقرر ما يلي", "قرر ما يلي", "المملكة العربية السعودية", "مجلس الوزراء"
  ];
  console.log("\n=== مسح كامل النصّ الخامّ عن بصمات الديباجة (أينما وُجدت) ===");
  for (const mk of markers) console.log(`  «${mk}» → ${sql.split(mk).length - 1} مرّة`);

  const insertAt = [...sql.matchAll(/INSERT\s+INTO\s+`?([A-Za-z0-9_]+)`?/gi)].map((m) => ({ i: m.index ?? 0, t: m[1] }));
  const tableOf = (pos: number) => { let name = "?"; for (const s of insertAt) { if (s.i <= pos) name = s.t; else break; } return name; };
  for (const strong of ["بعون الله", "رسمنا بما هو آت", "بعد الاطلاع"]) {
    let idx = sql.indexOf(strong), shown = 0;
    while (idx !== -1 && shown < 3) {
      console.log(`  ▸ «${strong}» في [${tableOf(idx)}]: «…${sql.slice(Math.max(0, idx - 20), idx + 150).replace(/\s+/g, " ")}…»`);
      idx = sql.indexOf(strong, idx + strong.length); shown++;
    }
  }

  // ⑥ فحص مواد law_articles_lang: هل الديباجة مخزَّنة كمادّةٍ (عنوانها ديباجة/مقدمة أو نصّها سرديّ)؟
  const artLang = parsed.tables.get("law_articles_lang") ?? [];
  const preLike = artLang.filter((r) => {
    const t = field(r, ["title"]); const x = field(r, ["text"]);
    return /ديباج|مقدم|تمهيد|توطئ|تصدير/.test(t) || /بعون الله|بعد الا?طلاع|رسمنا بما هو/.test(x);
  });
  console.log(`\n=== مواد شبيهة بالديباجة داخل law_articles_lang: ${preLike.length} من ${artLang.length} ===`);
  preLike.slice(0, 8).forEach((r, i) =>
    console.log(`  [${i + 1}] عنوان=«${field(r, ["title"]).slice(0, 70)}» نصّ=«${field(r, ["text"]).slice(0, 180).replace(/\s+/g, " ")}…»`)
  );

  // ⑦ فحصٌ موجَّه: أوّل ما هو مخزَّن عن نظامٍ بعينه (افتراضيًّا «الإثبات») — بترتيب وروده في المصدر حرفيًّا.
  const probe = (process.env.PROBE_LAW ?? "الإثبات").trim();
  const langAll = parsed.tables.get("laws_lang") ?? [];
  const matches = langAll.filter((r) => field(r, ["title"]).includes(probe));
  console.log(`\n=== فحص موجَّه: «${probe}» (مطابقات=${matches.length}) ===`);
  if (!matches.length) {
    const near = langAll.map((r) => field(r, ["title"])).filter((t) => /إثبات|اثبات/.test(t));
    console.log(near.length ? `عناوين مقاربة: ${near.slice(0, 10).join(" | ")}` : "لا عنوان مقارب.");
  }
  for (const target of matches.slice(0, 3)) {
    const lawId = field(target, ["law_id"]);
    console.log(`\n▼ law_id=${lawId} — العنوان: «${field(target, ["title"])}»`);
    console.log(`  king_name: ${field(target, ["king_name"]) || "(فارغ)"}`);
    const pre = field(target, ["law_preamble"]);
    console.log(`  law_preamble: ${pre ? `«${pre.slice(0, 400)}»` : "(فارغ)"}`);
    const base = (parsed.tables.get("laws") ?? []).find((r) => field(r, ["id"]) === lawId);
    if (base) console.log(`  تواريخ laws: هجري=${field(base, ["issuance_date_hj"]) || "-"} · ميلادي=${field(base, ["issuance_date_gr"]) || "-"}`);
    const tools = (parsed.tables.get("law_issuance_tools") ?? []).filter((r) => field(r, ["law_id"]) === lawId);
    console.log(`  أدوات الإصدار (${tools.length}) — النصّ الكامل بلا اقتطاع:`);
    tools.forEach((r, i) => { const t = field(r, ["title"]); console.log(`     [${i + 1}] (${t.length} حرفًا) «${t.replace(/\s+/g, " ")}»`); });
    const arts = (parsed.tables.get("law_articles") ?? []).filter((r) => field(r, ["law_id"]) === lawId);
    const langById = new Map((parsed.tables.get("law_articles_lang") ?? []).map((r) => [field(r, ["article_id"]), r]));
    console.log(`  عدد المواد=${arts.length} — أوّل ٤ مواد مخزَّنة (بترتيب المصدر):`);
    arts.slice(0, 4).forEach((a, i) => {
      const l = langById.get(field(a, ["id"]));
      console.log(`     #${i + 1} [article_id=${field(a, ["id"])}] عنوان=«${(l ? field(l, ["title"]) : "").slice(0, 90)}»`);
      console.log(`          نصّ=«${(l ? field(l, ["text"]) : "").slice(0, 320).replace(/\s+/g, " ")}…»`);
    });
  }

  // ⑧ هل يوجد نصّ مرسومٍ طويل في أيّ مكان؟ أطول قيمة law_issuance_tools.title في كلّ البيانات + توزيع الأطوال.
  const allTools = parsed.tables.get("law_issuance_tools") ?? [];
  const lens = allTools.map((r) => field(r, ["title"]).length).sort((a, b) => b - a);
  const longest = allTools.map((r) => field(r, ["title"])).sort((a, b) => b.length - a.length)[0] ?? "";
  const over = (n: number) => lens.filter((l) => l > n).length;
  console.log(`\n=== توزيع أطوال أداة الإصدار (law_issuance_tools.title) عبر كلّ الأنظمة ===`);
  console.log(`  إجمالي الأدوات=${allTools.length} · أطول قيمة=${lens[0] ?? 0} حرفًا · وسيط تقريبيّ=${lens[Math.floor(lens.length / 2)] ?? 0}`);
  console.log(`  أطول من 200 حرف: ${over(200)} · أطول من 500: ${over(500)} · أطول من 1000: ${over(1000)}`);
  console.log(`  أطول نصّ أداة إصدار في كلّ الملفّ: «${longest.replace(/\s+/g, " ").slice(0, 500)}»`);
}

void main().catch((e) => { console.error(e); process.exit(1); });
