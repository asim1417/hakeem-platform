/**
 * HKM-028 / الأمر ٠٨ (المسار ٢): إصلاح ما بقي في نظام المحاكم التجارية بعد ترقيمه على الإنتاج في #773
 * (01:08 UTC، 18/10/2026، نقطة الاستعادة br-flat-hill-aqg5xjf0). يولّد statements.json وrollback.json.
 *   npx tsx data/renumber/commercial-courts-repair-2026-10-18/build.ts
 *
 * الحالة على الإنتاج (قراءة 01:35 UTC): 96 مادة متصلة تطابق عنوان الهيئة ونصها، لكن:
 * - روابط الأحكام (14,519) رُبطت عند الاستيراد بالرقم: أول رقم في نص الاستشهاد كان رقم الصف. #773 نقل الأرقام
 *   ولم ينقل الروابط، فصار 9,134 رابطًا يستشهد برقم غير رقم مادته (حكم يستشهد بالمادة 30 تحت المادة 32)،
 *   و25 رابطًا على الصفين غير الماديين 93 و94 (مخفية).
 * - عقد الرسم (96) مرقّمة وحواف اللائحة التنفيذية تستشهد بالرقم الرسمي؛ 76 عقدة على غير مادة رقمها.
 * - الصف 18 ما زال يحوي نص المادة 19 بعد نصه، والصف 25 يحوي نص 26؛ والمادتان 19 و26 أُدرجتا صفين مستقلين.
 *
 * الجزء أ (بلا متن): نقل كل رابط إلى المادة التي تحمل الرقم المستشهد به، وكل عقدة إلى المادة التي تحمل رقمها.
 * الجزء ب (كتابة متن، ف١١ بعيّنة): متن 18 و25 = عنوان الهيئة ثم نصها من boe.unit داخل القاعدة، والفهرس معه
 *   في الجملة نفسها (IDX-001)، والمتن السابق محفوظ حرفيًّا في legal_text_provenance (versioned_replace).
 * الحراس: بصمات النظام والروابط والعقد والمواضع والهيئة، وأن كل رابط يجد مادة برقمه، وأن متني 18 و25 يحويان نصّي
 * مادتيهما، وبعده الاتساق كله وبلوغ بصمات AFTER. أي اختلاف يلغي المعاملة. التراجع يشترط بصمات ما بعد التنفيذ ويعيد
 * البصمات الأربع حرفًا (لا updatedAt للروابط والصفين).
 */
import { writeFileSync } from "node:fs";

const LAW = "نظام المحاكم التجارية";
const BOE_LAW_ID = "boe26-4c65cd79392917c9508e2ff7";
const ROW18 = "cmpwi8wi001hpnxffezq8fvcq";
const ROW25 = "cmpwi8ymt01i1nxfflwry8fwb";
// بصمات ما قبل التنفيذ: قراءة الإنتاج 01:35 UTC (LSN 5/6A074000)، بعد #773؛ وبصمة الروابط بتعريفها الجديد (مع نص
// الاستشهاد) من قراءة الإنتاج 02:16 UTC (LSN 5/6A163918)، والبقية فيها مطابقة لقراءة 01:35.
const BEFORE = {
  law: "ba8a3c0c3fabd128b435ac1e1ada8d27",
  boe: "bcc84d876543e77599fd032a93fe72d8",
  links: "59b457ae8b31e76f9c72c1e31b304f08:14519",
  nodes: "b89c81af6eb322c06eb8a6bf729839d7:96",
  occ: "8a50f942d0358b372769c60910403f18:290",
};
// مواضع المكنز على الصفين 18 و25: 13، منها 7 مصطلحها من ذيل نصي 19 و26 فلا يبقى في المتن الجديد.
// تُترك ويُثبَّت عددها بحارس؛ تصحيحها مهمة متابعة بأداة موجّهة (لا أداة لاستخراج مكنز نظام واحد اليوم).
const OCC_ON_REPLACED = 13;
const OCC_STALE_AFTER_REPLACE = 7;
// بصمات ما بعد التنفيذ: من البروفة على الفرع المعزول hkm028-cc-repair-trial-2026-10-18 (br-quiet-wave-aq2o2t0h،
// من الإنتاج عند LSN 5/6A078A78)، وبصمة الروابط بتعريفها الجديد (مع نص الاستشهاد) من الفرع نفسه بعد التنفيذ.
// أكّدتها الجولة الثانية بالخطة الحالية على hkm028-cc-repair-trial-r2-2026-10-18 (br-purple-smoke-aq5by0mu، LSN 5/6A1639D8).
// حتمية: لا تتوقف على وقت التنفيذ. يشترطها التراجع، ويشترطها التنفيذ في آخره.
const AFTER = {
  law: "2107cff131551938dbe0582bf5d1bd90",
  links: "e881c97aeb327fc7458ce97ebd76bdc4:14519",
  nodes: "c50cdd6140d911967d89e2a1cfe2cb84:96",
  occ: "8a50f942d0358b372769c60910403f18:290",
};
const LINKS_TO_MOVE = 9159; // 9,134 على مواد برقم غير مستشهدها + 25 على الصفين غير الماديين 93 و94
const NODES_TO_MOVE = 76;
const dir = "data/renumber/commercial-courts-repair-2026-10-18";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const L = q(LAW);
const BOE = q(BOE_LAW_ID);
const guard = (name: string, cond: string) => `SELECT 1 / (CASE WHEN ${cond} THEN 1 ELSE 0 END) AS ${name}`;
const letters = (x: string) =>
  `translate(regexp_replace(regexp_replace(${x}, '[\\u064B-\\u0652\\u0670\\u0640]', '', 'g'), '[^\\u0621-\\u064A0-9\\u0660-\\u0669]', '', 'g'), 'أإآٱىة', 'ااااية')`;
const normSql = (x: string) =>
  `btrim(regexp_replace(regexp_replace(translate(regexp_replace(${x}, '[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640]', '', 'g'), 'أإآٱؤئةى', 'ااااويهي'), '[^[:alpha:][:digit:]\\u0660-\\u0669\\u06F0-\\u06F9[:space:]]', ' ', 'g'), '[[:space:]]+', ' ', 'g'))`;
const searchNormOf = (a: string, content: string) =>
  normSql(`concat_ws(E'\\n', nullif(${a}."lawName",''), nullif(${a}.title,''), nullif(${content},''), nullif(array_to_string(${a}.keywords,' '),''), nullif(${a}.classification,''), nullif(${a}.chapter,''))`);
const firstLine = (x: string) => `btrim(split_part(btrim(${x}), E'\\n', 1))`;
const boeHeading = (h: string) => `(CASE WHEN ${h} LIKE 'المادة%' THEN btrim(${h}) ELSE 'المادة ' || btrim(${h}) END)`;
const citedNumber = (x: string) => `(regexp_match(translate(coalesce(${x}, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '([0-9]+)'))[1]::int`;
const sha16 = (x: string) => `left(encode(sha256(convert_to(${x}, 'UTF8')), 'hex'), 16)`;
const lawIds = `(SELECT id FROM legal_articles WHERE "lawName" = ${L})`;
// md5(coalesce(...)) حتى لا يُسقط NULL صفًّا من البصمة بصمت.
const lawFp = `(SELECT md5(string_agg(id || ':' || "articleNumber" || ':' || "articleBis" || ':' || md5(content) || ':' || md5(title) || ':' || md5(coalesce(search_norm, '∅')), ',' ORDER BY "articleNumber", "articleBis", id)) FROM legal_articles WHERE "lawName" = ${L})`;
const boeFp = `(SELECT md5(string_agg(article_number || ':' || body_sha256 || ':' || coalesce(heading,''), ',' ORDER BY seq)) FROM boe.unit WHERE law_id = ${BOE})`;
// نص الاستشهاد داخل البصمة: تعديله يغيّر وجهة الرابط، فيرفض الحارس الأول التنفيذ.
const linksFp = `(SELECT md5(string_agg(k.id || ':' || k."articleId" || ':' || k."reviewStatus" || ':' || md5(coalesce(k."citedText", '')), ',' ORDER BY k.id)) || ':' || count(*) FROM legal_article_case_links k WHERE k."articleId" IN ${lawIds})`;
const nodesFp = `(SELECT md5(string_agg(g.id || ':' || g."articleId" || ':' || g.number, ',' ORDER BY g.id)) || ':' || count(*) FROM legal_graph_nodes g WHERE g.law = ${L})`;
const occFp = `(SELECT md5(string_agg(o.id || ':' || o.article_id || ':' || o.article_number, ',' ORDER BY o.id)) || ':' || count(*) FROM legal_thesaurus_occurrences o WHERE o.article_id IN ${lawIds})`;
const linksConsistent = `NOT EXISTS (SELECT 1 FROM legal_article_case_links k JOIN legal_articles a ON a.id = k."articleId" WHERE a."lawName" = ${L} AND (a."articleBis" <> 0 OR ${citedNumber('k."citedText"')} IS DISTINCT FROM a."articleNumber"))`;
const nodesConsistent = `NOT EXISTS (SELECT 1 FROM legal_graph_nodes g LEFT JOIN legal_articles a ON a.id = g."articleId" WHERE g.law = ${L} AND (a.id IS NULL OR a."lawName" <> ${L} OR a."articleBis" <> 0 OR a."articleNumber" <> g.number))`;
const aligned = `NOT EXISTS (SELECT 1 FROM legal_articles a LEFT JOIN boe.unit u ON u.law_id = ${BOE} AND u.article_number = a."articleNumber" WHERE a."lawName" = ${L} AND a."articleBis" = 0 AND (u.article_number IS NULL OR (${firstLine("a.content")} <> ${boeHeading("u.heading")} AND a.title <> ${boeHeading("u.heading")}) OR position(${letters("u.body")} IN ${letters("a.content")}) = 0))`;
const officialText = (u: string) => `${boeHeading(`${u}.heading`)} || E'\\n' || btrim(${u}.body)`;

const s: string[] = [];
// ٠. لقطة متسقة وقفل: REPEATABLE READ (أول جملة في المعاملة)، وقفل صفوف النظام وروابطها حتى التثبيت.
s.push(`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`);
s.push(`SELECT count(*) AS locked_articles FROM (SELECT id FROM legal_articles WHERE "lawName" = ${L} FOR UPDATE) x`);
s.push(`SELECT count(*) AS locked_links FROM (SELECT k.id FROM legal_article_case_links k WHERE k."articleId" IN ${lawIds} FOR UPDATE) x`);
// ١. حالة البداية
s.push(guard("guard_law_fingerprint", `${lawFp} = ${q(BEFORE.law)}`));
s.push(guard("guard_boe_fingerprint", `${boeFp} = ${q(BEFORE.boe)}`));
s.push(guard("guard_links_fingerprint", `${linksFp} = ${q(BEFORE.links)}`));
s.push(guard("guard_nodes_fingerprint", `${nodesFp} = ${q(BEFORE.nodes)}`));
s.push(guard("guard_occ_fingerprint", `${occFp} = ${q(BEFORE.occ)}`));
s.push(guard("guard_contiguous_before", `(SELECT count(*) FROM legal_articles WHERE "lawName" = ${L} AND "articleBis" = 0) = 96 AND (SELECT count(DISTINCT "articleNumber") FROM legal_articles WHERE "lawName" = ${L} AND "articleBis" = 0 AND "articleNumber" BETWEEN 1 AND 96) = 96`));
s.push(guard("guard_aligned_before", aligned));
// كل رابط يجد مادة برقمه المستشهد به.
s.push(guard("guard_links_resolvable", `NOT EXISTS (SELECT 1 FROM legal_article_case_links k WHERE k."articleId" IN ${lawIds} AND NOT EXISTS (SELECT 1 FROM legal_articles t WHERE t."lawName" = ${L} AND t."articleBis" = 0 AND t."articleNumber" = ${citedNumber('k."citedText"')}))`));
s.push(guard("guard_links_to_move", `(SELECT count(*) FROM legal_article_case_links k JOIN legal_articles a ON a.id = k."articleId" WHERE a."lawName" = ${L} AND (a."articleBis" <> 0 OR ${citedNumber('k."citedText"')} <> a."articleNumber")) = ${LINKS_TO_MOVE}`));
s.push(guard("guard_nodes_to_move", `(SELECT count(*) FROM legal_graph_nodes g LEFT JOIN legal_articles a ON a.id = g."articleId" WHERE g.law = ${L} AND (a."articleBis" <> 0 OR a."articleNumber" <> g.number)) = ${NODES_TO_MOVE}`));
// الصفان 18 و25 يحويان نصّي مادتيهما ونصّي 19 و26 معًا.
for (const [id, own, extra] of [[ROW18, 18, 19], [ROW25, 25, 26]] as const) {
  s.push(guard(`guard_merged_${own}`, `(SELECT count(*) FROM legal_articles x JOIN boe.unit u ON u.law_id = ${BOE} AND u.article_number IN (${own}, ${extra}) WHERE x.id = ${q(id)} AND x."lawName" = ${L} AND x."articleBis" = 0 AND x."articleNumber" = ${own} AND position(${letters("u.body")} IN ${letters("x.content")}) > 0) = 2`));
}
s.push(guard("guard_no_provenance_yet", `NOT EXISTS (SELECT 1 FROM legal_text_provenance WHERE entity_id IN ${lawIds} AND source = 'boe' AND action = 'versioned_replace')`));
// لا نسخة في unit_version للصفين (تُعرض قبل content لو وُجدت، فلا يظهر الاستبدال).
s.push(guard("guard_no_unit_versions", `NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id IN (${q(ROW18)}, ${q(ROW25)}))`));
// مواضع المكنز على الصفين: العدد ومن مصطلحه لا يبقى في المتن الرسمي الجديد (تُترك لإعادة استخراج المكنز).
s.push(guard("guard_occ_on_replaced", `(SELECT count(*) FROM legal_thesaurus_occurrences WHERE article_id IN (${q(ROW18)}, ${q(ROW25)})) = ${OCC_ON_REPLACED} AND (SELECT count(*) FROM legal_thesaurus_occurrences o JOIN legal_articles a ON a.id = o.article_id JOIN boe.unit u ON u.law_id = ${BOE} AND u.article_number = a."articleNumber" WHERE a.id IN (${q(ROW18)}, ${q(ROW25)}) AND position(o.occurrence_text IN ${officialText("u")}) = 0) = ${OCC_STALE_AFTER_REPLACE}`));
s.push(`CREATE TEMP TABLE cr_links_before ON COMMIT DROP AS SELECT k.id, k."articleId" FROM legal_article_case_links k WHERE k."articleId" IN ${lawIds}`);
s.push(`CREATE TEMP TABLE cr_before ON COMMIT DROP AS SELECT id, md5(content) AS mc, title, keywords, classification, chapter, status FROM legal_articles WHERE "lawName" = ${L}`);

// ٢. الجزء أ: الروابط والعقد إلى المادة التي تحمل الرقم. لا تصادم عابر في (articleId, caseId, citedText):
// الروابط الباقية مؤقتًا على الصف الهدف تستشهد برقم آخر، فنصها مختلف.
s.push(
  `UPDATE legal_article_case_links k SET "articleId" = t.id, "updatedAt" = now() FROM legal_articles a, legal_articles t WHERE k."articleId" = a.id AND a."lawName" = ${L} AND t."lawName" = ${L} AND t."articleBis" = 0 AND t."articleNumber" = ${citedNumber('k."citedText"')} AND t.id <> a.id`,
);
s.push(`UPDATE legal_graph_nodes g SET "articleId" = t.id FROM legal_articles t WHERE g.law = ${L} AND t."lawName" = ${L} AND t."articleBis" = 0 AND t."articleNumber" = g.number AND g."articleId" IS DISTINCT FROM t.id`);

// ٣. الجزء ب: المتن السابق محفوظ حرفيًّا قبل الاستبدال، ثم المتن الرسمي والفهرس في جملة واحدة.
s.push(
  `INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text, created_at) SELECT replace(gen_random_uuid()::text, '-', ''), 'article', a.id, ${L}, a."articleNumber", 'boe', 'boe:' || b.guid || '#' || u.article_number, b.url, ${sha16("u.body")}, b.parsed_at::date, 'versioned_replace', a.content, now() FROM legal_articles a JOIN boe.unit u ON u.law_id = ${BOE} AND u.article_number = a."articleNumber" JOIN boe.law b ON b.id = u.law_id WHERE a.id IN (${q(ROW18)}, ${q(ROW25)})`,
);
s.push(
  `UPDATE legal_articles a SET content = ${officialText("u")}, search_norm = ${searchNormOf("a", officialText("u"))}, "updatedAt" = now() FROM boe.unit u WHERE u.law_id = ${BOE} AND u.article_number = a."articleNumber" AND a.id IN (${q(ROW18)}, ${q(ROW25)})`,
);

// ٤. بعد التنفيذ
s.push(guard("guard_links_consistent_after", linksConsistent));
s.push(guard("guard_links_same_set", `(SELECT count(*) FROM legal_article_case_links k WHERE k."articleId" IN ${lawIds}) = (SELECT count(*) FROM cr_links_before) AND NOT EXISTS (SELECT 1 FROM cr_links_before c LEFT JOIN legal_article_case_links k ON k.id = c.id WHERE k."articleId" IS NULL OR k."articleId" NOT IN ${lawIds})`));
// العدد بمقارنة المعرّف قبل وبعد (لا بالوقت: updatedAt بدقة الملّي ثانية فيُقرَّب now() إليها).
s.push(guard("guard_links_moved", `(SELECT count(*) FROM legal_article_case_links k JOIN cr_links_before c ON c.id = k.id WHERE k."articleId" <> c."articleId") = ${LINKS_TO_MOVE}`));
s.push(guard("guard_nodes_consistent_after", `${nodesConsistent} AND (SELECT count(DISTINCT "articleId") FROM legal_graph_nodes WHERE law = ${L}) = 96`));
s.push(guard("guard_aligned_after", aligned));
s.push(guard("guard_no_duplicate_text", `NOT EXISTS (SELECT 1 FROM legal_articles a JOIN boe.unit u ON u.law_id = ${BOE} AND u.article_number <> a."articleNumber" AND length(u.body) > 40 WHERE a."lawName" = ${L} AND a."articleBis" = 0 AND position(${letters("u.body")} IN ${letters("a.content")}) > 0)`));
s.push(guard("guard_official_text", `(SELECT count(*) FROM legal_articles a JOIN boe.unit u ON u.law_id = ${BOE} AND u.article_number = a."articleNumber" WHERE a.id IN (${q(ROW18)}, ${q(ROW25)}) AND a.content = ${officialText("u")}) = 2`));
s.push(guard("guard_search_norm", `NOT EXISTS (SELECT 1 FROM legal_articles a WHERE a."lawName" = ${L} AND a."articleBis" = 0 AND a.search_norm <> ${searchNormOf("a", "a.content")})`));
s.push(guard("guard_others_unchanged", `(SELECT count(*) FROM legal_articles a JOIN cr_before b ON b.id = a.id WHERE a.id NOT IN (${q(ROW18)}, ${q(ROW25)}) AND md5(a.content) = b.mc AND a.title = b.title AND a.keywords IS NOT DISTINCT FROM b.keywords AND a.classification IS NOT DISTINCT FROM b.classification AND a.chapter IS NOT DISTINCT FROM b.chapter AND a.status = b.status) = (SELECT count(*) FROM cr_before) - 2 AND (SELECT count(*) FROM legal_articles a JOIN cr_before b ON b.id = a.id WHERE a.id IN (${q(ROW18)}, ${q(ROW25)}) AND a.title = b.title AND a.keywords IS NOT DISTINCT FROM b.keywords AND a.status = b.status) = 2`));
s.push(guard("guard_provenance", `(SELECT count(*) FROM legal_text_provenance p JOIN cr_before b ON b.id = p.entity_id WHERE p.source = 'boe' AND p.action = 'versioned_replace' AND md5(p.previous_text) = b.mc) = 2`));
s.push(guard("guard_occ_unchanged", `${occFp} = ${q(BEFORE.occ)}`));
// الحالة النهائية = ما بلغته البروفة حرفًا (وإلا يتعذّر التراجع المشروط بها).
s.push(guard("guard_law_fingerprint_is_after", `${lawFp} = ${q(AFTER.law)}`));
s.push(guard("guard_links_fingerprint_is_after", `${linksFp} = ${q(AFTER.links)}`));
s.push(guard("guard_nodes_fingerprint_is_after", `${nodesFp} = ${q(AFTER.nodes)}`));

writeFileSync(`${dir}/statements.json`, JSON.stringify(s, null, 1) + "\n");
console.log(`statements ${s.length}`);

// ═════════════ التراجع ═════════════
if (!AFTER.law) {
  console.log("rollback: بصمات ما بعد التنفيذ غير مملوءة بعد (تُملأ من البروفة)");
} else {
  const r: string[] = [];
  r.push(`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`);
  r.push(guard("guard_law_fingerprint_after", `${lawFp} = ${q(AFTER.law)}`));
  r.push(guard("guard_links_fingerprint_after", `${linksFp} = ${q(AFTER.links)}`));
  r.push(guard("guard_nodes_fingerprint_after", `${nodesFp} = ${q(AFTER.nodes)}`));
  r.push(guard("guard_occ_fingerprint_after", `${occFp} = ${q(AFTER.occ)}`));
  // المتن السابق من سجل المصدر حرفًا، والفهرس معه.
  r.push(
    `UPDATE legal_articles a SET content = p.previous_text, search_norm = ${searchNormOf("a", "p.previous_text")}, "updatedAt" = now() FROM legal_text_provenance p WHERE p.entity_id = a.id AND p.source = 'boe' AND p.action = 'versioned_replace' AND a.id IN (${q(ROW18)}, ${q(ROW25)})`,
  );
  r.push(`DELETE FROM legal_text_provenance WHERE source = 'boe' AND action = 'versioned_replace' AND entity_id IN (${q(ROW18)}, ${q(ROW25)})`);
  // الروابط والعقد إلى صفوفها قبل التنفيذ، أي الصف الذي كان رقمه c قبل #773. خريطة #773 (الآن ← قبل):
  // 20–25 ← 19–24، و27–94 ← 25–92، و93 و94 غير الماديين ← 93 و94، و19 و26 مُدرجتان، والبقية كما هي.
  r.push(
    `CREATE TEMP TABLE cr_old ON COMMIT DROP AS SELECT id, CASE WHEN "articleBis" = 100 THEN "articleNumber" WHEN "articleNumber" BETWEEN 20 AND 25 THEN "articleNumber" - 1 WHEN "articleNumber" BETWEEN 27 AND 94 THEN "articleNumber" - 2 WHEN "articleNumber" IN (19, 26) THEN NULL ELSE "articleNumber" END AS old_number FROM legal_articles WHERE "lawName" = ${L} AND "articleBis" IN (0, 100)`,
  );
  r.push(guard("guard_old_map", `(SELECT count(DISTINCT old_number) FROM cr_old) = 96 AND (SELECT count(*) FROM cr_old WHERE old_number IS NULL) = 2`));
  r.push(
    `UPDATE legal_article_case_links k SET "articleId" = o.id, "updatedAt" = now() FROM legal_articles a, cr_old o WHERE k."articleId" = a.id AND a."lawName" = ${L} AND o.old_number = ${citedNumber('k."citedText"')} AND o.id <> a.id`,
  );
  r.push(`UPDATE legal_graph_nodes g SET "articleId" = o.id FROM cr_old o WHERE g.law = ${L} AND o.old_number = g.number AND g."articleId" IS DISTINCT FROM o.id`);
  r.push(guard("guard_law_fingerprint_restored", `${lawFp} = ${q(BEFORE.law)}`));
  r.push(guard("guard_links_fingerprint_restored", `${linksFp} = ${q(BEFORE.links)}`));
  r.push(guard("guard_nodes_fingerprint_restored", `${nodesFp} = ${q(BEFORE.nodes)}`));
  r.push(guard("guard_occ_fingerprint_restored", `${occFp} = ${q(BEFORE.occ)}`));
  writeFileSync(`${dir}/rollback.json`, JSON.stringify(r, null, 1) + "\n");
  console.log(`rollback ${r.length}`);
}
