/**
 * HKM-028 / الأمر ٠٨ (المسار ٢): تصحيح ترقيم نظام المحاكم التجارية.
 * يولّد statements.json (التنفيذ) و rollback.json (التراجع)، كل منهما معاملة واحدة بحراس.
 *   npx tsx data/renumber/commercial-courts-2026-10-18/build.ts
 *
 * التشخيص (قراءة READ ONLY على الإنتاج 18/10/2026، مقابل لقطة الهيئة في boe.unit، 96 مادة):
 * - الصف 18 يجمع المادتين 18 و19 عند الهيئة، والصف 24 يجمع 25 و26 (عنوانا 19 و26 في الهيئة بلا «المادة»،
 *   فدُمجتا في الاستيراد القديم بما قبلهما).
 * - فانزاحت الصفوف 19–23 بواحد (نصوصها للمواد 20–24)، والصفوف 25–92 باثنين (نصوصها 27–94)، والصفان 93 و94
 *   نصّا 95 و96، وهما موجودتان صحيحتين في صفين أُضيفا في 04/06 (95 و96).
 * - العنوان رقمي مشتق من الرقم («المادة 77»)، والعدد الرسمي في أول سطر من المتن («المادة التاسعة والسبعون»)،
 *   فلم يكشفه تدقيق الترقيم الذي يقرأ العنوان وحده.
 * - ثلاثة جداول تابعة:
 *   • روابط الأحكام (legal_article_case_links، 14,519 رابطًا للنظام) رُبطت بالرقم: كل رابط يستشهد برقم صفه الحالي.
 *     الحكم يستشهد بالرقم الرسمي، فالرابط يتبع الرقم لا المعرّف: يُنقل إلى الصف الذي يحمل رقمه بعد التصحيح.
 *   • عقد الرسم (legal_graph_nodes، 96) مرقّمة، وحوافها من اللائحة التنفيذية تستشهد بالرقم الرسمي («المادة (العشرين)
 *     من النظام»)، فالعقدة تتبع الرقم: يُنقل معرّف مادتها إلى الصف الذي يحمل رقمها.
 *   • مواضع المكنز (legal_thesaurus_occurrences، 290) مقتطفة من متن الصف، فتتبع المعرّف: يُحدَّث رقمها المخزَّن.
 *
 * الخطة (لا يُعدَّل متن قائم):
 * - الصفوف 18 و24 و93 و94 تأخذ علامة الصف غير المادي (100) بأرقامها.
 * - الصفوف 19–23 تصير 20–24، والصفوف 25–92 تصير 27–94، ويُصحَّح عنوانها الرقمي إلى رقمها الجديد،
 *   ويُبنى search_norm بالعنوان الجديد في المعاملة نفسها (استبدال مقطع العنوان في رأسه، بحارس).
 * - تُدرج المواد 18 و19 و25 و26 من boe.unit داخل القاعدة (لا نسخ يدوي): المتن = عنوان الهيئة ثم نصها
 *   (بنسق بقية صفوف النظام)، و«المادة » تُسبق العنوانين اللذين خلت منهما، والعنوان رقمي كبقية النظام.
 *   الصفات (النظام، التصنيف، الفصل، الحالة) من صف القالب 17؛ الكلمات المفتاحية فارغة كالصفين 95 و96.
 * - تُنقل روابط الأحكام وعقد الرسم إلى صف رقمها، ويُحدَّث رقم مواضع المكنز، ويُسجَّل المصدر في legal_text_provenance
 *   (4 إدراج، 73 إعادة ترقيم، 4 صف غير مادي).
 * - بعده: 96 مادة متصلة من 1 إلى 96، وأول سطر كل مادة (أو عنوانها في 95 و96) يطابق عنوان الهيئة لرقمها.
 *
 * الحراس: بصمة النظام كله (المعرّف والرقم والدرجة وبصمات المتن والعنوان والفهرس لكل صف)، وبصمة وحدات الهيئة،
 * وبصمات الروابط والعقد والمواضع، وأن أول سطر كل صف منزاح يطابق عنوان الهيئة لرقمه الجديد، وأن الصفين المدموجين
 * يحويان نصّي مادتيهما، وأن 93 و94 يطابقان 95 و96 حرفًا، وبعد التنفيذ الاتصال والمطابقة وصحة search_norm
 * واتساق الروابط والعقد والمواضع. أي اختلاف يلغي المعاملة.
 *
 * التراجع (rollback.json): يشترط بصمات حالة ما بعد التنفيذ (من البروفة)، ويعكس كل خطوة، ويتحقق بعده أن بصمات
 * النظام والروابط والعقد والمواضع عادت إلى قيم ما قبل التنفيذ حرفًا.
 */
import { writeFileSync } from "node:fs";

const LAW = "نظام المحاكم التجارية";
const LAW_NORM = "نظام المحاكم التجاريه";
const BOE_LAW_ID = "boe26-4c65cd79392917c9508e2ff7";
const TEMPLATE = "cmpwi8w6601hnnxffzurbs0w9"; // المادة 17
const NON_ARTICLE = 100;
const INSERT_NUMBERS = [18, 19, 25, 26];
// بصمات ما قبل التنفيذ: قراءة الإنتاج 18/10/2026 نحو 04:05 بتوقيت الرياض (LSN 5/69E49AF8).
const BEFORE = {
  law: "358e1bbe5efc6eea997aefd2092a219f",
  boe: "bcc84d876543e77599fd032a93fe72d8",
  links: "fad8b54b4b4a015d0370a994288456c6:14519",
  nodes: "b89c81af6eb322c06eb8a6bf729839d7:96",
  occ: "c91bf302453468b27e20d8439eb1cd23:290",
};
// بصمات ما بعد التنفيذ: من البروفة على الفرع المعزول hkm028-cc-trial2-2026-10-18 (من الإنتاج عند LSN 5/69E4A0E0).
// حتمية: المعرّفات والأرقام والمتون والفهارس لا تتوقف على وقت التنفيذ. يشترطها التراجع.
const AFTER = {
  law: "7c225c26d70777ba0bcc82955d0b16b4",
  links: "719b8f5c168c7ec6dcfb74fb501405a3:14519",
  nodes: "15a43f0567898975b764ddd471c04644:96",
  occ: "c57c7c295fdabe961b7027515618fa6a:290",
};
const dir = "data/renumber/commercial-courts-2026-10-18";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const L = q(LAW);
const BOE = q(BOE_LAW_ID);
const guard = (name: string, cond: string) => `SELECT 1 / (CASE WHEN ${cond} THEN 1 ELSE 0 END) AS ${name}`;
/** تطبيع الحروف للمقارنة بالهيئة (كما في compare-with-boe.py): بلا تشكيل ولا ترقيم، وتوحيد الهمزات والياء والتاء. */
const letters = (x: string) =>
  `translate(regexp_replace(regexp_replace(${x}, '[\\u064B-\\u0652\\u0670\\u0640]', '', 'g'), '[^\\u0621-\\u064A0-9\\u0660-\\u0669]', '', 'g'), 'أإآٱىة', 'ااااية')`;
/** مكافئ SQL لـ normalizeArabicText (يطابق الكود في كل صفوف الإنتاج إلا رموزًا نادرة مثل «²»). */
const normSql = (x: string) =>
  `btrim(regexp_replace(regexp_replace(translate(regexp_replace(${x}, '[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640]', '', 'g'), 'أإآٱؤئةى', 'ااااويهي'), '[^[:alpha:][:digit:]\\u0660-\\u0669\\u06F0-\\u06F9[:space:]]', ' ', 'g'), '[[:space:]]+', ' ', 'g'))`;
const firstLine = (x: string) => `btrim(split_part(btrim(${x}), E'\\n', 1))`;
const afterFirstLine = (x: string) => `substr(btrim(${x}), length(split_part(btrim(${x}), E'\\n', 1)) + 1)`;
const boeHeading = (h: string) => `(CASE WHEN ${h} LIKE 'المادة%' THEN btrim(${h}) ELSE 'المادة ' || btrim(${h}) END)`;
/** أول رقم في نص الاستشهاد (أرقام عربية أو هندية). كل روابط النظام يستشهد أولها برقم صفه (14,519 من 14,519). */
const citedNumber = (x: string) => `(regexp_match(translate(coalesce(${x}, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '([0-9]+)'))[1]::int`;
/** بصمة النص المصدري كما في promote_uqn_2026_09.py (sha256 مقطوعة إلى 16). */
const sha16 = (x: string) => `left(encode(sha256(convert_to(${x}, 'UTF8')), 'hex'), 16)`;
const normPrefix = (n: string) => `${q(LAW_NORM)} || ' الماده ' || ${n} || ' '`;

const lawFp = `(SELECT md5(string_agg(id || ':' || "articleNumber" || ':' || "articleBis" || ':' || md5(content) || ':' || md5(title) || ':' || md5(search_norm), ',' ORDER BY "articleNumber", "articleBis", id)) FROM legal_articles WHERE "lawName" = ${L})`;
const boeFp = `(SELECT md5(string_agg(article_number || ':' || body_sha256 || ':' || coalesce(heading,''), ',' ORDER BY seq)) FROM boe.unit WHERE law_id = ${BOE})`;
const lawIds = `(SELECT id FROM legal_articles WHERE "lawName" = ${L})`;
const linksFp = `(SELECT md5(string_agg(k.id || ':' || k."articleId" || ':' || k."reviewStatus", ',' ORDER BY k.id)) || ':' || count(*) FROM legal_article_case_links k WHERE k."articleId" IN ${lawIds})`;
const nodesFp = `(SELECT md5(string_agg(g.id || ':' || g."articleId" || ':' || g.number, ',' ORDER BY g.id)) || ':' || count(*) FROM legal_graph_nodes g WHERE g.law = ${L})`;
const occFp = `(SELECT md5(string_agg(o.id || ':' || o.article_id || ':' || o.article_number, ',' ORDER BY o.id)) || ':' || count(*) FROM legal_thesaurus_occurrences o WHERE o.article_id IN ${lawIds})`;
const searchNormSql = (law: string, title: string, content: string, cls: string, chap: string) =>
  normSql(`concat_ws(E'\\n', nullif(${law},''), nullif(${title},''), nullif(${content},''), nullif(${cls},''), nullif(${chap},''))`);
const searchNormOf = (a: string) =>
  normSql(`concat_ws(E'\\n', nullif(${a}."lawName",''), nullif(${a}.title,''), nullif(${a}.content,''), nullif(array_to_string(${a}.keywords,' '),''), nullif(${a}.classification,''), nullif(${a}.chapter,''))`);

// اتساق التوابع (يُستعمل قبل التنفيذ وبعده وبعد التراجع): كل رابط على صف مادي يستشهد برقم صفه ولا رابط على صف غير مادي،
// وكل عقدة على صف مادي برقمه، وكل موضع مكنز على صف مادي برقمه.
const linksConsistent = `NOT EXISTS (SELECT 1 FROM legal_article_case_links k JOIN legal_articles a ON a.id = k."articleId" WHERE a."lawName" = ${L} AND (a."articleBis" <> 0 OR ${citedNumber('k."citedText"')} IS DISTINCT FROM a."articleNumber"))`;
const nodesConsistent = `NOT EXISTS (SELECT 1 FROM legal_graph_nodes g LEFT JOIN legal_articles a ON a.id = g."articleId" WHERE g.law = ${L} AND (a.id IS NULL OR a."lawName" <> ${L} OR a."articleBis" <> 0 OR a."articleNumber" <> g.number))`;
const occConsistent = `NOT EXISTS (SELECT 1 FROM legal_thesaurus_occurrences o JOIN legal_articles a ON a.id = o.article_id WHERE a."lawName" = ${L} AND a."articleBis" = 0 AND o.article_number IS DISTINCT FROM a."articleNumber")`;

// ═════════════ التنفيذ ═════════════
const s: string[] = [];
// ١. حالة البداية
s.push(guard("guard_law_fingerprint", `${lawFp} = ${q(BEFORE.law)}`));
s.push(guard("guard_boe_fingerprint", `${boeFp} = ${q(BEFORE.boe)}`));
s.push(guard("guard_links_fingerprint", `${linksFp} = ${q(BEFORE.links)}`));
s.push(guard("guard_nodes_fingerprint", `${nodesFp} = ${q(BEFORE.nodes)}`));
s.push(guard("guard_occ_fingerprint", `${occFp} = ${q(BEFORE.occ)}`));
s.push(guard("guard_template", `EXISTS (SELECT 1 FROM legal_articles WHERE id = ${q(TEMPLATE)} AND "lawName" = ${L} AND "articleNumber" = 17 AND "articleBis" = 0)`));
s.push(guard("guard_no_inserts_yet", `NOT EXISTS (SELECT 1 FROM legal_articles WHERE id LIKE 'hkm28-cc-%')`));
s.push(guard("guard_no_provenance_yet", `NOT EXISTS (SELECT 1 FROM legal_text_provenance WHERE entity_id IN ${lawIds} OR entity_id LIKE 'hkm28-cc-%')`));
s.push(guard("guard_links_consistent_before", linksConsistent));
s.push(guard("guard_nodes_consistent_before", nodesConsistent));
s.push(guard("guard_occ_consistent_before", occConsistent));

s.push(`CREATE TEMP TABLE cc_before ON COMMIT DROP AS SELECT id, md5(content) AS mc, keywords, classification, chapter, status, norm_addressee, norm_modality, norm_condition, norm_effect FROM legal_articles WHERE "lawName" = ${L}`);

// ٢. الخطة بالصيغة لا بقائمة منسوخة
s.push(
  `CREATE TEMP TABLE cc_plan ON COMMIT DROP AS SELECT id, "articleNumber" AS cur, CASE WHEN "articleNumber" BETWEEN 19 AND 23 THEN "articleNumber" + 1 WHEN "articleNumber" BETWEEN 25 AND 92 THEN "articleNumber" + 2 ELSE "articleNumber" END AS new_number, CASE WHEN "articleNumber" IN (18, 24, 93, 94) THEN ${NON_ARTICLE} ELSE 0 END AS new_bis FROM legal_articles WHERE "lawName" = ${L} AND "articleBis" = 0 AND "articleNumber" BETWEEN 18 AND 94`,
);
s.push(guard("guard_plan_size", `(SELECT count(*) FROM cc_plan) = 77 AND (SELECT count(*) FROM cc_plan WHERE new_bis = ${NON_ARTICLE}) = 4 AND (SELECT count(*) FROM cc_plan WHERE new_bis = 0 AND new_number <> cur) = 73`));
// كل صف منزاح: أول سطر من متنه = عنوان الهيئة لرقمه الجديد.
s.push(
  guard(
    "guard_shift_headings",
    `NOT EXISTS (SELECT 1 FROM cc_plan p JOIN legal_articles a ON a.id = p.id LEFT JOIN boe.unit u ON u.law_id = ${BOE} AND u.article_number = p.new_number WHERE p.new_bis = 0 AND p.new_number <> p.cur AND (u.article_number IS NULL OR ${firstLine("a.content")} <> ${boeHeading("u.heading")}))`,
  ),
);
// الصفان المدموجان يحويان نصّي مادتيهما عند الهيئة.
for (const [row, a, b] of [[18, 18, 19], [24, 25, 26]]) {
  s.push(
    guard(
      `guard_merged_${row}`,
      `(SELECT count(*) FROM legal_articles x JOIN boe.unit u ON u.law_id = ${BOE} AND u.article_number IN (${a}, ${b}) WHERE x."lawName" = ${L} AND x."articleBis" = 0 AND x."articleNumber" = ${row} AND position(${letters("u.body")} IN ${letters("x.content")}) > 0) = 2`,
    ),
  );
}
// 93 و94 نسختان من 95 و96 (المتن بعد سطر العنوان = نص الهيئة حرفًا)، و95 و96 القائمتان تطابقان الهيئة أيضًا.
for (const [row, boe] of [[93, 95], [94, 96], [95, 95], [96, 96]]) {
  const body = row >= 95 ? "x.content" : afterFirstLine("x.content");
  s.push(
    guard(
      `guard_dup_${row}`,
      `EXISTS (SELECT 1 FROM legal_articles x JOIN boe.unit u ON u.law_id = ${BOE} AND u.article_number = ${boe} WHERE x."lawName" = ${L} AND x."articleBis" = 0 AND x."articleNumber" = ${row} AND ${letters(body)} = ${letters("u.body")})`,
    ),
  );
}
// رأس الفهرس لكل صف منزاح «نظام المحاكم التجاريه الماده <الرقم> » (يُستبدل بالرقم الجديد).
s.push(
  guard(
    "guard_norm_prefix",
    `NOT EXISTS (SELECT 1 FROM cc_plan p JOIN legal_articles a ON a.id = p.id WHERE p.new_bis = 0 AND p.new_number <> p.cur AND (a.title <> 'المادة ' || p.cur OR left(a.search_norm, length(${normPrefix("p.cur")})) <> ${normPrefix("p.cur")}))`,
  ),
);
s.push(`CREATE TEMP TABLE cc_links_before ON COMMIT DROP AS SELECT k.id FROM legal_article_case_links k WHERE k."articleId" IN ${lawIds}`);

// ٣. التنفيذ: المواد
s.push(`UPDATE legal_articles a SET "articleBis" = p.new_bis, "updatedAt" = now() FROM cc_plan p WHERE a.id = p.id AND p.new_bis = ${NON_ARTICLE}`);
s.push(`UPDATE legal_articles a SET "articleNumber" = a."articleNumber" + 100000 FROM cc_plan p WHERE a.id = p.id AND p.new_bis = 0 AND p.new_number <> p.cur`);
s.push(
  `UPDATE legal_articles a SET "articleNumber" = p.new_number, title = 'المادة ' || p.new_number, search_norm = ${normPrefix("p.new_number")} || substr(a.search_norm, length(${normPrefix("p.cur")}) + 1), "updatedAt" = now() FROM cc_plan p WHERE a.id = p.id AND a."articleNumber" >= 100000`,
);
s.push(
  `INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, chapter, keywords, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm, norm_source) ` +
    `SELECT 'hkm28-cc-' || u.article_number, t."legalSystemId", t."lawName", t.classification, u.article_number, 0, 'المادة ' || u.article_number, ${boeHeading("u.heading")} || E'\\n' || btrim(u.body), t.chapter, ARRAY[]::text[], t."royalDecree", t."effectiveFrom", t.status, now(), now(), ` +
    searchNormSql("t.\"lawName\"", "'المادة ' || u.article_number", `${boeHeading("u.heading")} || E'\\n' || btrim(u.body)`, "t.classification", "t.chapter") +
    `, 'rule' FROM boe.unit u CROSS JOIN legal_articles t WHERE u.law_id = ${BOE} AND u.article_number IN (${INSERT_NUMBERS.join(", ")}) AND t.id = ${q(TEMPLATE)}`,
);

// ٤. التنفيذ: التوابع
// الروابط تتبع الرقم المستشهد به (= رقم صفها قبل التصحيح، بحارس الاتساق): تُنقل إلى الصف الذي يحمله الآن.
// لا تصادم عابر في (articleId, caseId, citedText): الروابط الباقية مؤقتًا على الصف الهدف تستشهد برقم آخر.
s.push(
  `UPDATE legal_article_case_links k SET "articleId" = t.id, "updatedAt" = now() FROM cc_plan p, legal_articles t WHERE k."articleId" = p.id AND t."lawName" = ${L} AND t."articleBis" = 0 AND t."articleNumber" = p.cur AND t.id <> p.id`,
);
// عقد الرسم تتبع رقمها (حواف اللائحة تستشهد بالرقم الرسمي): يُنقل معرّف مادتها إلى الصف الذي يحمل رقمها.
s.push(
  `UPDATE legal_graph_nodes g SET "articleId" = t.id FROM cc_plan p, legal_articles t WHERE g."articleId" = p.id AND g.law = ${L} AND t."lawName" = ${L} AND t."articleBis" = 0 AND t."articleNumber" = g.number AND t.id <> p.id`,
);
// مواضع المكنز مقتطفة من متن الصف فتتبع المعرّف: رقمها المخزَّن يصير رقم صفها الجديد.
s.push(`UPDATE legal_thesaurus_occurrences o SET article_number = p.new_number FROM cc_plan p WHERE o.article_id = p.id AND p.new_bis = 0 AND p.new_number <> p.cur`);
// المصدر: كل صف تغيّر يُسجَّل بمصدره الرسمي (نسق promote_uqn_2026_09.py: sha256 مقطوعة إلى 16).
const provCols = `(id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text, created_at)`;
s.push(
  `INSERT INTO legal_text_provenance ${provCols} SELECT replace(gen_random_uuid()::text, '-', ''), 'article', 'hkm28-cc-' || u.article_number, ${L}, u.article_number, 'boe', 'boe:' || b.guid || '#' || u.article_number, b.url, ${sha16("u.body")}, b.parsed_at::date, 'insert', NULL, now() FROM boe.unit u JOIN boe.law b ON b.id = u.law_id WHERE u.law_id = ${BOE} AND u.article_number IN (${INSERT_NUMBERS.join(", ")})`,
);
s.push(
  `INSERT INTO legal_text_provenance ${provCols} SELECT replace(gen_random_uuid()::text, '-', ''), 'article', p.id, ${L}, p.new_number, 'boe', 'boe:' || b.guid || '#' || u.article_number, b.url, ${sha16("u.body")}, b.parsed_at::date, 'renumber', 'المادة ' || p.cur, now() FROM cc_plan p JOIN boe.unit u ON u.law_id = ${BOE} AND u.article_number = p.new_number JOIN boe.law b ON b.id = u.law_id WHERE p.new_bis = 0 AND p.new_number <> p.cur`,
);
s.push(
  `INSERT INTO legal_text_provenance ${provCols} SELECT replace(gen_random_uuid()::text, '-', ''), 'article', p.id, ${L}, p.cur, 'boe', 'boe:' || b.guid || '#' || CASE p.cur WHEN 18 THEN '18+19' WHEN 24 THEN '25+26' WHEN 93 THEN '95' ELSE '96' END, b.url, ${sha16("a.content")}, b.parsed_at::date, 'non_article', NULL, now() FROM cc_plan p JOIN legal_articles a ON a.id = p.id CROSS JOIN boe.law b WHERE b.id = ${BOE} AND p.new_bis = ${NON_ARTICLE}`,
);

// ٥. بعد التنفيذ
s.push(guard("guard_inserted", `(SELECT count(*) FROM legal_articles WHERE id LIKE 'hkm28-cc-%' AND "lawName" = ${L}) = 4`));
s.push(
  guard(
    "guard_contiguous",
    `(SELECT count(*) FROM legal_articles WHERE "lawName" = ${L} AND "articleBis" = 0) = 96 AND (SELECT count(DISTINCT "articleNumber") FROM legal_articles WHERE "lawName" = ${L} AND "articleBis" = 0 AND "articleNumber" BETWEEN 1 AND 96) = 96 AND (SELECT count(*) FROM legal_articles WHERE "lawName" = ${L} AND "articleBis" = ${NON_ARTICLE}) = 4`,
  ),
);
// كل مادة: أول سطر متنها أو عنوانها = عنوان الهيئة لرقمها، ونصها يحوي نص الهيئة حرفًا.
s.push(
  guard(
    "guard_aligned_with_boe",
    `NOT EXISTS (SELECT 1 FROM legal_articles a LEFT JOIN boe.unit u ON u.law_id = ${BOE} AND u.article_number = a."articleNumber" WHERE a."lawName" = ${L} AND a."articleBis" = 0 AND (u.article_number IS NULL OR (${firstLine("a.content")} <> ${boeHeading("u.heading")} AND a.title <> ${boeHeading("u.heading")}) OR position(${letters("u.body")} IN ${letters("a.content")}) = 0))`,
  ),
);
// الفهرس صحيح لكل مادة في النظام (بمكافئ SQL للتطبيع).
s.push(guard("guard_search_norm", `NOT EXISTS (SELECT 1 FROM legal_articles a WHERE a."lawName" = ${L} AND a."articleBis" = 0 AND a.search_norm <> ${searchNormOf("a")})`));
// المتون والصفات القائمة لم تتغير: كل صف قديم بمعرّفه ومتنه وكلماته وتصنيفه وفصله وحالته ووسومه المعيارية.
s.push(
  guard(
    "guard_contents_unchanged",
    `(SELECT count(*) FROM legal_articles a JOIN cc_before b ON b.id = a.id WHERE a."lawName" = ${L} AND md5(a.content) = b.mc AND a.keywords IS NOT DISTINCT FROM b.keywords AND a.classification IS NOT DISTINCT FROM b.classification AND a.chapter IS NOT DISTINCT FROM b.chapter AND a.status = b.status AND a.norm_addressee IS NOT DISTINCT FROM b.norm_addressee AND a.norm_modality IS NOT DISTINCT FROM b.norm_modality AND a.norm_condition IS NOT DISTINCT FROM b.norm_condition AND a.norm_effect IS NOT DISTINCT FROM b.norm_effect) = 96 AND (SELECT count(*) FROM cc_before) = 96`,
  ),
);
s.push(guard("guard_links_consistent_after", linksConsistent));
s.push(
  guard(
    "guard_links_same_set",
    `(SELECT count(*) FROM legal_article_case_links k WHERE k."articleId" IN ${lawIds}) = (SELECT count(*) FROM cc_links_before) AND NOT EXISTS (SELECT 1 FROM cc_links_before c LEFT JOIN legal_article_case_links k ON k.id = c.id WHERE k."articleId" IS NULL OR k."articleId" NOT IN ${lawIds})`,
  ),
);
s.push(guard("guard_nodes_consistent_after", `${nodesConsistent} AND (SELECT count(*) FROM legal_graph_nodes WHERE law = ${L}) = 96 AND (SELECT count(DISTINCT "articleId") FROM legal_graph_nodes WHERE law = ${L}) = 96`));
s.push(guard("guard_occ_consistent_after", `${occConsistent} AND (SELECT count(*) FROM legal_thesaurus_occurrences WHERE article_id IN ${lawIds}) = 290`));
s.push(
  guard(
    "guard_provenance",
    `(SELECT count(*) FROM legal_text_provenance WHERE source = 'boe' AND entity_id IN ${lawIds}) = 81 AND (SELECT count(*) FROM legal_text_provenance WHERE source = 'boe' AND entity_id IN ${lawIds} AND action = 'insert') = 4 AND (SELECT count(*) FROM legal_text_provenance WHERE source = 'boe' AND entity_id IN ${lawIds} AND action = 'renumber') = 73`,
  ),
);
s.push(guard("guard_article_count", `(SELECT "articleCount" FROM legal_systems WHERE id = (SELECT "legalSystemId" FROM legal_articles WHERE id = ${q(TEMPLATE)})) = (SELECT count(*) FROM legal_articles WHERE "lawName" = ${L} AND "articleBis" < ${NON_ARTICLE})`));

writeFileSync(`${dir}/statements.json`, JSON.stringify(s, null, 1) + "\n");
console.log(`statements ${s.length}`);

// ═════════════ التراجع ═════════════
if (!AFTER.law || !AFTER.links || !AFTER.nodes || !AFTER.occ) {
  console.log("rollback: بصمات ما بعد التنفيذ غير مملوءة بعد (تُملأ من البروفة)؛ لم يُكتب rollback.json");
} else {
  const r: string[] = [];
  r.push(guard("guard_law_fingerprint_after", `${lawFp} = ${q(AFTER.law)}`));
  r.push(guard("guard_links_fingerprint_after", `${linksFp} = ${q(AFTER.links)}`));
  r.push(guard("guard_nodes_fingerprint_after", `${nodesFp} = ${q(AFTER.nodes)}`));
  r.push(guard("guard_occ_fingerprint_after", `${occFp} = ${q(AFTER.occ)}`));
  // صفوف المدى 18–94 بعد التنفيذ ورقمها قبله؛ المُدرجة بلا رقم سابق (تُحذف)، وغير المادية برقمها.
  r.push(
    `CREATE TEMP TABLE cc_undo ON COMMIT DROP AS SELECT id, "articleNumber" AS now_number, "articleBis" AS now_bis, CASE WHEN id LIKE 'hkm28-cc-%' THEN NULL WHEN "articleBis" = ${NON_ARTICLE} THEN "articleNumber" WHEN "articleNumber" BETWEEN 20 AND 24 THEN "articleNumber" - 1 WHEN "articleNumber" BETWEEN 27 AND 94 THEN "articleNumber" - 2 END AS old_number FROM legal_articles WHERE "lawName" = ${L} AND (("articleBis" = 0 AND "articleNumber" BETWEEN 18 AND 94) OR "articleBis" = ${NON_ARTICLE})`,
  );
  r.push(guard("guard_undo_size", `(SELECT count(*) FROM cc_undo) = 81 AND (SELECT count(*) FROM cc_undo WHERE old_number IS NULL) = 4 AND (SELECT count(DISTINCT old_number) FROM cc_undo) = 77`));
  // الروابط والعقد إلى الصف الذي حمل رقمها قبل التنفيذ.
  r.push(
    `UPDATE legal_article_case_links k SET "articleId" = u.id, "updatedAt" = now() FROM legal_articles c, cc_undo u WHERE k."articleId" = c.id AND c."lawName" = ${L} AND c."articleBis" = 0 AND c."articleNumber" BETWEEN 18 AND 94 AND u.old_number = c."articleNumber" AND u.id <> c.id`,
  );
  r.push(`UPDATE legal_graph_nodes g SET "articleId" = u.id FROM cc_undo u WHERE g.law = ${L} AND g.number BETWEEN 18 AND 94 AND u.old_number = g.number AND g."articleId" <> u.id`);
  r.push(`UPDATE legal_thesaurus_occurrences o SET article_number = u.old_number FROM cc_undo u WHERE o.article_id = u.id AND u.old_number IS NOT NULL AND o.article_number IS DISTINCT FROM u.old_number`);
  r.push(`DELETE FROM legal_text_provenance WHERE source = 'boe' AND action IN ('insert', 'renumber', 'non_article') AND entity_id IN (SELECT id FROM cc_undo)`);
  // المُدرجة لا يبقى عليها تابع قبل حذفها (المتجهات إن بُنيت لها لاحقًا تُحذف معها).
  r.push(`DELETE FROM embeddings WHERE owner_id LIKE 'hkm28-cc-%'`);
  r.push(
    guard(
      "guard_inserted_free",
      `NOT EXISTS (SELECT 1 FROM legal_article_case_links WHERE "articleId" LIKE 'hkm28-cc-%') AND NOT EXISTS (SELECT 1 FROM legal_graph_nodes WHERE "articleId" LIKE 'hkm28-cc-%') AND NOT EXISTS (SELECT 1 FROM article_versions WHERE article_id LIKE 'hkm28-cc-%') AND NOT EXISTS (SELECT 1 FROM article_amendments WHERE "articleId" LIKE 'hkm28-cc-%') AND NOT EXISTS (SELECT 1 FROM legal_thesaurus_occurrences WHERE article_id LIKE 'hkm28-cc-%') AND NOT EXISTS (SELECT 1 FROM legal_text_provenance WHERE entity_id LIKE 'hkm28-cc-%')`,
    ),
  );
  r.push(`DELETE FROM legal_articles WHERE id LIKE 'hkm28-cc-%' AND "lawName" = ${L}`);
  r.push(`UPDATE legal_articles a SET "articleNumber" = a."articleNumber" + 100000 FROM cc_undo u WHERE a.id = u.id AND u.now_bis = 0 AND u.old_number IS NOT NULL`);
  r.push(`UPDATE legal_articles a SET "articleBis" = 0, "updatedAt" = now() FROM cc_undo u WHERE a.id = u.id AND u.now_bis = ${NON_ARTICLE}`);
  r.push(
    `UPDATE legal_articles a SET "articleNumber" = u.old_number, title = 'المادة ' || u.old_number, search_norm = ${normPrefix("u.old_number")} || substr(a.search_norm, length(${normPrefix("u.now_number")}) + 1), "updatedAt" = now() FROM cc_undo u WHERE a.id = u.id AND a."articleNumber" >= 100000`,
  );
  // بعد التراجع: كل البصمات عادت إلى قيم ما قبل التنفيذ حرفًا.
  r.push(guard("guard_law_fingerprint_restored", `${lawFp} = ${q(BEFORE.law)}`));
  r.push(guard("guard_links_fingerprint_restored", `${linksFp} = ${q(BEFORE.links)}`));
  r.push(guard("guard_nodes_fingerprint_restored", `${nodesFp} = ${q(BEFORE.nodes)}`));
  r.push(guard("guard_occ_fingerprint_restored", `${occFp} = ${q(BEFORE.occ)}`));
  writeFileSync(`${dir}/rollback.json`, JSON.stringify(r, null, 1) + "\n");
  console.log(`rollback ${r.length}`);
}
