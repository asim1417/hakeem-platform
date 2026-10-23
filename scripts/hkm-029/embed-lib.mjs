/**
 * HKM-029/HKM-030 — أداة المتجهات المحصورة: دوال بلا قاعدة ولا شبكة (الاختيار، والقائمة المجمّدة، والبوابة، والتحقق).
 *
 * الاختيار (SELECTION_CTE) هو نفسه الذي تُجمَّد عليه القائمة بقراءة الإنتاج، حرفًا:
 *   - النص المضمَّن = النص الساري (HKM-030): أحدث unit_version.body بـ valid_from <= now() للمادة،
 *     وإلا legal_articles.content — توأم searchableText في lib/modules/legal-core/effective-text.ts.
 *   - stale: للمادة متجه فعّال (أحدث embedding_version، وإلا embeddings) بُني من نص غير نصها الساري.
 *   - missing: مادة (articleBis < 100) بلا أي متجه.
 *   قرار المالك 22/10/2026: «نفذها كلها» — كل القديمة والمفقودة.
 * نص التضمين في SQL مكافئ لـ buildEmbeddingText (حذف التطويل)؛ والبصمة المكتوبة تُحسب بالكود نفسه.
 *
 *   node scripts/hkm-029/embed-lib.mjs --print-summary-sql   ← يطبع SUMMARY_SQL حرفًا (للقراءة اليدوية ثم التجميد)
 */
import { pathToFileURL } from "node:url";
import { connectionTarget } from "./drift-lib.mjs";

export const EMBED_MODEL = "text-embedding-3-small";
export const EMBED_DIMS = 1536;
export const EMBED_BATCH = 96;
/** سقف حروف الطلب الواحد لواجهة التضمين (≈ 80 ألف رمز عربي)، دون سقف الواجهة (300 ألف رمز). */
export const EMBED_BATCH_CHARS = 200_000;
export const ISOLATED_EMBED_DATABASE = "hakeem_hkm029_embed_test";
export const MANIFEST_TASKS = ["HKM-029", "HKM-030"];

/** النص الساري للمادة a (نفس الصف في legal_articles): أحدث نسخة سارية، وإلا النص المحفوظ. */
const IN_FORCE_JOIN = `LEFT JOIN LATERAL (
    SELECT uv.body FROM unit_version uv
    WHERE uv.unit_id = a.id AND uv.valid_from <= now()
    ORDER BY uv.valid_from DESC LIMIT 1
  ) uv ON true`;
const IN_FORCE_BODY = `coalesce(uv.body, a.content)`;
const EMBED_TEXT = `concat_ws(E'\\n', nullif(coalesce(s.name, a."lawName"), ''), nullif(a.title, ''), nullif(${IN_FORCE_BODY}, ''))`;

export const SELECTION_CTE = `WITH a AS (
  SELECT a.id, a."lawName" AS law, a."articleNumber" AS n, a."articleBis" AS b,
         ${IN_FORCE_BODY} AS body,
         ${EMBED_TEXT} AS t
  FROM legal_articles a LEFT JOIN legal_systems s ON s.id = a."legalSystemId"
  ${IN_FORCE_JOIN}
  WHERE a."articleBis" < 100
),
h AS (
  SELECT a.*, encode(sha256(convert_to(left(replace(a.t, 'ـ', ''), 8000), 'UTF8')), 'hex') AS cur,
         encode(sha256(convert_to(left(a.t, 8000), 'UTF8')), 'hex') AS leg,
         encode(sha256(convert_to(left(replace(a.t, 'ـ', ''), 8000) || E'\\n' || 'text-embedding-3-small', 'UTF8')), 'hex') AS vfp
  FROM a
),
v AS (
  SELECT DISTINCT ON (owner_id) owner_id, content_hash FROM embedding_version
  WHERE owner_type = 'article' AND embedding IS NOT NULL ORDER BY owner_id, created_at DESC
),
st AS (
  SELECT h.id, h.law, h.n, h.b, h.body, h.t, h.vfp,
    CASE WHEN v.owner_id IS NOT NULL THEN (CASE WHEN v.content_hash = h.vfp THEN 'fresh' ELSE 'stale' END)
         WHEN e.owner_id IS NOT NULL THEN (CASE WHEN e.content_hash IN (h.cur, h.leg) THEN 'fresh' ELSE 'stale' END)
         ELSE 'missing' END AS status
  FROM h LEFT JOIN v ON v.owner_id = h.id
  LEFT JOIN embeddings e ON e.owner_id = h.id AND e.owner_type = 'article' AND e.embedding IS NOT NULL
),
sel AS (
  SELECT * FROM st WHERE status IN ('stale', 'missing')
)`;

export const SUMMARY_SQL = `${SELECTION_CTE}
SELECT (SELECT count(*) FROM sel)::int AS selected,
       (SELECT count(*) FROM sel WHERE status = 'stale')::int AS stale,
       (SELECT count(*) FROM sel WHERE status = 'missing')::int AS missing,
       (SELECT md5(string_agg(id, ',' ORDER BY id)) FROM sel) AS ids_md5,
       (SELECT md5(string_agg(id || ':' || md5(t), ',' ORDER BY id)) FROM sel) AS state_md5`;

/** صفوف المختارة بأجزاء نص التضمين (للكود؛ content = النص الساري) والبصمة المكافئة في SQL (للمقارنة فقط). */
export const ROWS_SQL = `${SELECTION_CTE}
SELECT sel.id, sel.law, sel.n, sel.b, sel.status, sel.vfp,
       coalesce(s.name, a."lawName") AS system_name, a.title, sel.body AS content
FROM sel JOIN legal_articles a ON a.id = sel.id LEFT JOIN legal_systems s ON s.id = a."legalSystemId"
ORDER BY sel.id`;

/** بصمة الحالة لمعرّفات بعينها داخل معاملة الكتابة (يجب أن تساوي state_md5 المجمّد). */
export const STATE_FOR_IDS_SQL = `SELECT count(*)::int AS n, md5(string_agg(a.id || ':' || md5(${EMBED_TEXT}), ',' ORDER BY a.id)) AS state_md5
FROM legal_articles a LEFT JOIN legal_systems s ON s.id = a."legalSystemId"
${IN_FORCE_JOIN}
WHERE a.id = ANY($1::text[])`;

export function assertEmbedManifest(m) {
  if (!m || !MANIFEST_TASKS.includes(m.task) || m.kind !== "embeddings") throw new Error("قائمة المتجهات غير صالحة");
  for (const k of ["selected", "stale", "missing"]) if (!Number.isInteger(m[k]) || m[k] < 0) throw new Error(`القائمة: ${k} غير صالح`);
  if (m.selected !== m.stale + m.missing) throw new Error("القائمة: العدد لا يساوي القديمة + المفقودة");
  if (m.selected < 1) throw new Error("القائمة فارغة");
  for (const k of ["ids_md5", "state_md5"]) if (!/^[0-9a-f]{32}$/.test(String(m[k] ?? ""))) throw new Error(`القائمة: ${k} غير صالح`);
  if (m.model !== EMBED_MODEL) throw new Error("القائمة: النموذج غير المسموح");
  return m;
}

/** يقارن ملخص الاختيار الحي بالقائمة المجمّدة. أي اختلاف يوقف الكل. */
export function assertSummaryMatches(manifest, live) {
  for (const k of ["selected", "stale", "missing", "ids_md5", "state_md5"]) {
    if (String(live?.[k]) !== String(manifest[k])) throw new Error(`توقف: الاختيار تغيّر منذ التجميد (${k})`);
  }
  return true;
}

/**
 * يبني قائمة مجمّدة من صف SUMMARY_SQL (المقروء يدويًا من الإنتاج) — HKM-030، بقرار المالك «نفذها كلها».
 * summary: { selected, stale, missing, ids_md5, state_md5 } (أرقام أو نصوص رقمية).
 */
export function buildEmbedManifest(summary, { chars = null, now = new Date(), source = null } = {}) {
  const num = (k) => {
    const v = summary?.[k];
    if (!/^\d+$/.test(String(v ?? ""))) throw new Error(`الملخص: ${k} غير صالح`);
    return Number(v);
  };
  const m = {
    task: "HKM-030",
    kind: "embeddings",
    model: EMBED_MODEL,
    frozen_at: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    source: source ?? "قراءة الإنتاج (Neon، للقراءة فقط) بـ SUMMARY_SQL في embed-lib.mjs: النص الساري (unit_version ثم content)، كل القديمة والمفقودة",
    approval: "المالك 22/10/2026: «نفذها كلها»",
    selected: num("selected"),
    stale: num("stale"),
    missing: num("missing"),
    ids_md5: String(summary?.ids_md5 ?? ""),
    state_md5: String(summary?.state_md5 ?? ""),
  };
  if (chars !== null) {
    if (!Number.isInteger(chars) || chars < 0) throw new Error("الملخص: chars غير صالح");
    m.chars = chars;
  }
  return assertEmbedManifest(m);
}

const isLocalHost = (h) => h === "127.0.0.1" || h === "localhost";
const isProductionHost = (h) => /^ep-icy-rice[a-z0-9-]*\.[a-z0-9.-]+\.neon\.tech$/.test(h);

/**
 * بوابة الهدف بالمضيف الفعلي كما يفهمه pg. production: مضيف ep-icy-rice…neon.tech وقاعدة neondb.
 * isolated: 127.0.0.1/localhost وقاعدة hakeem_hkm029_embed_test. الكتابة على الإنتاج بشروط البيئة والعدد.
 */
export function embedTargetGate(url, { apply = false, approvedRows = null, expected = null, env = process.env } = {}) {
  const { host, database } = connectionTarget(url);
  let target;
  if (isProductionHost(host) && database === "neondb") target = "production";
  else if (isLocalHost(host) && database === ISOLATED_EMBED_DATABASE) target = "isolated";
  else throw new Error("مرفوض: الهدف ليس الإنتاج ولا القاعدة المعزولة");
  if ((env.EMBEDDING_MODEL || EMBED_MODEL) !== EMBED_MODEL) throw new Error("مرفوض: النموذج المسموح text-embedding-3-small فقط");
  if (apply && target === "production") {
    if (env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") throw new Error("مرفوض: الكتابة على الإنتاج تحتاج CONFIRM_RUNTIME_DB_ALIGNMENT");
    if (approvedRows === null || approvedRows !== expected) throw new Error("مرفوض: العدد المعتمد لا يساوي القائمة المجمّدة");
  }
  return { target, host, database };
}

/** وسائط سطر الأوامر. --apply للكتابة، و--approved-rows العدد المعتمد. */
export function parseEmbedArgs(argv) {
  const i = argv.indexOf("--approved-rows");
  const raw = i >= 0 ? argv[i + 1] : null;
  const approvedRows = raw !== null && /^\d+$/.test(String(raw)) ? Number(raw) : null;
  const m = argv.indexOf("--manifest");
  return { apply: argv.includes("--apply"), approvedRows, manifest: m >= 0 ? argv[m + 1] : null };
}

/**
 * وسائط مسار backfill-embeddings.yml (فرع التشغيل): --target articles شرط؛ scope=all (--all) كتابة،
 * وscope=missing تجريب؛ و--limit هو العدد المعتمد.
 */
export function workflowArgsToRun(argv) {
  const t = argv.indexOf("--target");
  if (t < 0 || argv[t + 1] !== "articles") return null;
  const l = argv.indexOf("--limit");
  const raw = l >= 0 ? argv[l + 1] : null;
  const approvedRows = raw !== null && /^\d+$/.test(String(raw)) ? Number(raw) : null;
  return { apply: argv.includes("--all"), approvedRows };
}

/** كل متجه مصفوفة أرقام محدودة بطول 1536، والعدد يساوي المطلوب؛ وإلا لا كتابة. */
export function assertVectors(vectors, n, dims = EMBED_DIMS) {
  if (!Array.isArray(vectors) || vectors.length !== n) throw new Error(`توقف: المتجهات ${vectors?.length ?? 0} ≠ ${n}`);
  vectors.forEach((v, i) => {
    if (!Array.isArray(v) || v.length !== dims || !v.every((x) => typeof x === "number" && Number.isFinite(x))) {
      throw new Error(`توقف: متجه غير صالح في الموضع ${i}`);
    }
  });
  return true;
}

export const vectorLiteral = (v) => `[${v.join(",")}]`;

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * دفعات بسقفين: عدد العناصر وطول النص الكلي (عنصر واحد يتجاوز السقف يُرسل وحده).
 * items: [{ text }]. الترتيب محفوظ.
 */
export function chunkByChars(items, size = EMBED_BATCH, maxChars = EMBED_BATCH_CHARS) {
  const out = [];
  let cur = [];
  let chars = 0;
  for (const it of items) {
    const len = String(it.text ?? "").length;
    if (cur.length && (cur.length >= size || chars + len > maxChars)) {
      out.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(it);
    chars += len;
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * يعيد نداء دفعة فشل جزئيًا أو كليًا (null في المخرجات = فشل مزوّد بعد استنفاد محاولاته الداخلية
 * أو خطأ شبكة) بتراجع متزايد. يعيد المتجهات كما هي بعد آخر محاولة؛ والتحقق النهائي عند assertVectors.
 */
export async function embedWithRetry(embed, texts, { attempts = 3, baseDelayMs = 2000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let vectors = [];
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    vectors = await embed(texts);
    if (Array.isArray(vectors) && vectors.length === texts.length && vectors.every((v) => Array.isArray(v))) return vectors;
    if (attempt < attempts - 1) await sleep(baseDelayMs * 2 ** attempt);
  }
  return vectors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv.includes("--print-summary-sql")) {
  process.stdout.write(`${SUMMARY_SQL}\n`);
}
