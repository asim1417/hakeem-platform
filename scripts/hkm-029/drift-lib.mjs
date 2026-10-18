/**
 * HKM-029 — منطق نقي لانحراف فهارس المواد (بلا قاعدة ولا شبكة).
 * يصنّف الفرق بين search_norm المخزَّن والمتوقع، ويبني القائمة المجمّدة ويتحقق منها،
 * ويصنّف حالة المتجه وحالة مستند OpenSearch. لا يحمل نصوصًا في المخرجات.
 */
import { createHash } from "node:crypto";

export const CATEGORIES = ["shifted", "whitespace_only", "content_changed", "empty"];
/** النطاق الافتراضي للكتابة (الأمر ٠٨ §ب): whitespace_only لا تُكتب إلا بقرار المالك، و«الفارغ» من شأن HKM-002. */
export const DEFAULT_SCOPE = ["shifted", "content_changed"];

export const md5 = (s) => createHash("md5").update(String(s ?? ""), "utf8").digest("hex");
export const sha256 = (s) => createHash("sha256").update(String(s ?? ""), "utf8").digest("hex");
const collapse = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/**
 * يصنّف صفوف نظام واحد أو أكثر.
 * rows: [{ id, lawName, articleNumber, articleBis, stored, expected }]
 * يعيد المختلف فقط: { id, lawName, articleNumber, articleBis, category, matchesArticle? }.
 * shifted = المخزَّن يساوي الفهرس المتوقع لمادة أخرى في النظام نفسه (يُذكر رقمها).
 */
export function classifyDrift(rows) {
  const expectedByLaw = new Map();
  for (const r of rows) {
    if (!r.expected) continue;
    let m = expectedByLaw.get(r.lawName);
    if (!m) expectedByLaw.set(r.lawName, (m = new Map()));
    if (!m.has(r.expected)) m.set(r.expected, []);
    m.get(r.expected).push(r);
  }
  const out = [];
  for (const r of rows) {
    if (r.stored === r.expected) continue;
    const base = { id: r.id, lawName: r.lawName, articleNumber: r.articleNumber, articleBis: r.articleBis ?? 0 };
    if (r.stored === null || r.stored === undefined || r.stored === "") {
      out.push({ ...base, category: "empty" });
      continue;
    }
    if (collapse(r.stored) === collapse(r.expected)) {
      out.push({ ...base, category: "whitespace_only" });
      continue;
    }
    const other = (expectedByLaw.get(r.lawName)?.get(r.stored) ?? []).find((o) => o.id !== r.id);
    if (other) {
      out.push({ ...base, category: "shifted", matchesArticle: { number: other.articleNumber, bis: other.articleBis ?? 0, id: other.id } });
      continue;
    }
    out.push({ ...base, category: "content_changed" });
  }
  return out.sort((a, b) => a.lawName.localeCompare(b.lawName, "ar") || a.articleNumber - b.articleNumber || a.articleBis - b.articleBis);
}

/** أعداد لكل فئة ولكل نظام. */
export function summarizeDrift(drift) {
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  const byLaw = {};
  for (const d of drift) {
    byCategory[d.category] += 1;
    byLaw[d.lawName] ??= Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
    byLaw[d.lawName][d.category] += 1;
  }
  return { total: drift.length, byCategory, byLaw };
}

/**
 * بصمتا نص التضمين لمادة (content_hash في embeddings = sha256 لنص التضمين):
 * - current: مثل buildEmbeddingText في lib/modules/ai/embeddings.ts — الأجزاء بسطر، ثم redactPII
 *   (أول ما يفعله حذف التطويل)، ثم أول 8000 حرف. لا يستورد الكود هنا لأن سلسلة استيراده تُنشئ عميل Prisma.
 *   لا يكرر حجب البريد والهوية والجوال والآيبان؛ مادة فيها شيء منها (نادر في نصوص الأنظمة) قد تظهر قديمة
 *   فتُعاد فقط، بلا ضرر.
 * - legacy: النص نفسه بلا حذف التطويل (متجهات بُنيت قبل الحجب وما زالت تطابق النص).
 */
export function embeddingTextHashes({ systemName, title, content }) {
  const joined = [systemName, title, content].filter(Boolean).join("\n");
  return { current: sha256(joined.replace(/\u0640/g, "").slice(0, 8000)), legacy: sha256(joined.slice(0, 8000)) };
}

/** حالة متجه المادة: fresh (بصمة النص الحالي)، fresh_legacy (بصمة النص قبل الحجب)، stale، missing. */
export function vectorStatus(storedHash, currentHash, legacyHash) {
  if (!storedHash) return "missing";
  if (storedHash === currentHash) return "fresh";
  if (legacyHash && storedHash === legacyHash) return "fresh_legacy";
  return "stale";
}

/** حالة مستند OpenSearch مقابل الصف الحالي (العنوان والمتن والرقم). */
export function openSearchStatus(doc, row) {
  if (!doc) return "missing";
  const same = md5(`${doc.title ?? ""}\n${doc.content ?? ""}`) === md5(`${row.title ?? ""}\n${row.content ?? ""}`)
    && Number(doc.articleNumber) === Number(row.articleNumber);
  return same ? "fresh" : "stale";
}

/**
 * القائمة المجمّدة: صفوف الفئات المختارة بمعرّفها ونظامها ورقمها وmd5 المتن والفهرس الحالي. بلا نصوص.
 * rows: صفوف القاعدة { id, lawName, articleNumber, articleBis, content, search_norm }.
 */
export function buildManifest({ drift, rows, scope = DEFAULT_SCOPE, source, frozenAt }) {
  for (const c of scope) if (!CATEGORIES.includes(c)) throw new Error(`فئة غير معروفة: ${c}`);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const picked = drift.filter((d) => scope.includes(d.category));
  const manifest = {
    batch: "HKM-029",
    source,
    frozen_at: frozenAt,
    scope,
    expected_count: picked.length,
    rows: picked.map((d) => {
      const r = byId.get(d.id);
      if (!r) throw new Error("صف الانحراف غائب من الصفوف");
      return {
        id: d.id,
        lawName: d.lawName,
        articleNumber: d.articleNumber,
        articleBis: d.articleBis,
        content_md5: md5(r.content),
        search_norm_md5: r.search_norm === null || r.search_norm === undefined ? null : md5(r.search_norm),
        category: d.category,
      };
    }),
  };
  return assertManifest(manifest);
}

export function assertManifest(manifest) {
  if (!manifest || manifest.batch !== "HKM-029" || !Array.isArray(manifest.rows)) throw new Error("القائمة المجمّدة غير صالحة");
  if (!Number.isInteger(manifest.expected_count) || manifest.rows.length !== manifest.expected_count) {
    throw new Error("القائمة المجمّدة غير متسقة: العدد لا يطابق الصفوف");
  }
  const ids = manifest.rows.map((r) => r.id);
  if (new Set(ids).size !== ids.length) throw new Error("القائمة المجمّدة فيها معرّف مكرر");
  for (const r of manifest.rows) {
    if (!r.id || typeof r.lawName !== "string" || !Number.isInteger(r.articleNumber)) throw new Error("صف ناقص في القائمة المجمّدة");
    if (!/^[0-9a-f]{32}$/.test(r.content_md5 ?? "")) throw new Error("صف بلا md5 للمتن");
    if (r.search_norm_md5 !== null && !/^[0-9a-f]{32}$/.test(r.search_norm_md5 ?? "")) throw new Error("صف بلا md5 للفهرس");
    if (!CATEGORIES.includes(r.category)) throw new Error("صف بفئة غير معروفة");
    if (!manifest.scope.includes(r.category)) throw new Error("صف خارج نطاق القائمة");
  }
  return manifest;
}

/**
 * يقارن الصفوف المقفلة بالقائمة. أي اختلاف يرمي ويُلغى الكل:
 * العدد، أو معرّف غائب أو زائد، أو تغيّر النظام أو الرقم أو md5(content) أو md5(search_norm).
 * locked: [{ id, lawName, articleNumber, articleBis, content_md5, search_norm_md5 }]
 */
export function assertLockedRows(manifest, locked) {
  if (locked.length !== manifest.expected_count) throw new Error(`توقف: العدد ${locked.length} ≠ المتوقع ${manifest.expected_count}`);
  const byId = new Map(locked.map((r) => [r.id, r]));
  if (byId.size !== locked.length) throw new Error("توقف: معرّف مكرر في الصفوف المقفلة");
  for (const exp of manifest.rows) {
    const row = byId.get(exp.id);
    if (!row) throw new Error("توقف: معرّف غائب من القاعدة");
    if (row.lawName !== exp.lawName || Number(row.articleNumber) !== exp.articleNumber || Number(row.articleBis ?? 0) !== Number(exp.articleBis ?? 0)) {
      throw new Error("توقف: اسم النظام أو رقم المادة تغيّر");
    }
    if (row.content_md5 !== exp.content_md5) throw new Error("توقف: نص مادة مستهدفة تغيّر");
    if ((row.search_norm_md5 ?? null) !== exp.search_norm_md5) throw new Error("توقف: الفهرس المخزَّن تغيّر منذ التجميد");
  }
  return true;
}

/** معرّف الدفعة: sha256 للهدف والقاعدة وكل (معرّف، القديم، الجديد). */
export function ledgerBatchId(core) {
  const hash = createHash("sha256");
  hash.update(`${core.target}\0${core.database}\0`);
  for (const row of core.rows) hash.update(`${row.id}\0${row.old_search_norm ?? "\u0001NULL"}\0${row.new_search_norm}\n`);
  return hash.digest("hex");
}

/** تصنيف ما شوهد بعد التطبيق: confirmed (كله الجديد)، not_applied (كله القديم)، unconfirmed (غير ذلك). */
export function classifyObservation(ledger, observed) {
  const byId = new Map(observed.map((r) => [r.id, r]));
  let present = 0;
  let isNew = 0;
  let isOld = 0;
  let missing = 0;
  for (const exp of ledger.rows) {
    const found = byId.get(exp.id);
    if (!found || found.present === false) {
      missing += 1;
      continue;
    }
    present += 1;
    if (found.search_norm === exp.new_search_norm) isNew += 1;
    else if ((found.search_norm ?? null) === (exp.old_search_norm ?? null)) isOld += 1;
  }
  const complete = missing === 0 && present === ledger.expected_count && ledger.rows.length === ledger.expected_count;
  let outcome = "unconfirmed";
  if (complete && isNew === ledger.expected_count) outcome = "confirmed";
  else if (complete && isOld === ledger.expected_count) outcome = "not_applied";
  return { outcome, present, isNew, isOld, missing };
}

export function hostOf(url) {
  const afterAt = String(url).split("@").pop() ?? "";
  return afterAt.split("/")[0].split("?")[0].split(":")[0];
}

export const ISOLATED_DATABASE = "hakeem_hkm029";
export const PRODUCTION_DATABASE = "neondb";

/** يرفض أي هدف غير المعزول ما لم تُفتح بوابة الإنتاج بكل حراسها. لا يطبع سلسلة الاتصال. */
export function assertTarget(target, url, expectedCount, env = process.env) {
  const host = hostOf(url);
  if (target === "isolated") {
    if (host !== "127.0.0.1" && host !== "localhost") throw new Error("مرفوض: الهدف المعزول يقبل 127.0.0.1 أو localhost فقط");
    return;
  }
  if (target !== "production") throw new Error("مرفوض: الهدف غير معروف");
  const approved = env.HAKEEM_INJECT === "yes" && env.HAKEEM_INDEX_APPLY === "yes" && env.HAKEEM_APPROVED_ROWS === String(expectedCount);
  if (!approved || !host.includes("ep-icy-rice") || !host.endsWith(".neon.tech")) {
    throw new Error("مرفوض: تطبيق الإنتاج غير مفتوح. اعرض المراجعة أولًا، ثم اضبط الإذن والعدد المطابق للقائمة");
  }
}

export function assertDatabaseForTarget(target, database) {
  if (target === "isolated" && database === ISOLATED_DATABASE) return;
  if (target === "production" && database === PRODUCTION_DATABASE) return;
  throw new Error(`مرفوض: الهدف ${target} لا يطابق القاعدة ${database}`);
}
