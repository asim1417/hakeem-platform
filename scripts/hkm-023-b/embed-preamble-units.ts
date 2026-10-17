/**
 * HKM-023-B ع-١٤ — أمر تضمين وحدات المقدمة (تجريبي فقط).
 *
 * يقرأ preamble_unit_current داخل معاملة READ ONLY ويعدّ الوحدات التي لا متجه لها في embedding_version
 * (owner_type = 'preamble_unit'، content_hash = embeddingFingerprint(text_raw)) ويقدّر الرموز. لا يكتب شيئًا.
 * --apply مرفوض من هذا المسار (على نمط scripts/backfill-embedding-versions.ts): التضمين على الإنتاج تكلفة وكتابة،
 * يحتاج اعتماد المالك صراحة (ف١٠ + ف١٤)، وربط vector-provider بالنوع الجديد بعده.
 *
 * الاستعمال: DATABASE_URL=… npx tsx scripts/hkm-023-b/embed-preamble-units.ts [--types recital,operative_clause]
 */
import { EMBEDDING_MODEL_NAME, embeddingFingerprint } from "../../lib/modules/legal-core/embedding-fingerprint";
import { loadPg } from "./local-db";

const DEFAULT_TYPES = ["opening", "recital", "enacting_formula", "operative_clause"];

async function main() {
  if (process.argv.includes("--apply")) {
    console.error("التطبيق مرفوض من هذا المسار حتى موافقة صريحة من المالك على التضمين (تكلفة وكتابة). لم يُكتب شيء.");
    process.exitCode = 2;
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL غير معرّف (قراءة فقط).");
    process.exitCode = 1;
    return;
  }
  const i = process.argv.indexOf("--types");
  const types = i >= 0 ? String(process.argv[i + 1] ?? "").split(",").filter(Boolean) : DEFAULT_TYPES;
  const { Client } = await loadPg();
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const ro = await client.query("SELECT current_setting('transaction_read_only') AS ro");
    if (ro.rows[0]?.ro !== "on") throw new Error("المعاملة ليست للقراءة فقط؛ توقف");
    const units = (await client.query(
      `SELECT id, text_raw FROM preamble_unit_current WHERE unit_type = ANY($1::text[]) ORDER BY system_id, ordinal`,
      [types],
    )).rows as Array<{ id: string; text_raw: string }>;
    const have = new Set(
      ((await client.query(`SELECT owner_id, content_hash FROM embedding_version WHERE owner_type = 'preamble_unit'`)).rows as Array<{ owner_id: string; content_hash: string }>).map(
        (r) => `${r.owner_id}|${r.content_hash}`,
      ),
    );
    const todo = units.filter((u) => !have.has(`${u.id}|${embeddingFingerprint(u.text_raw)}`));
    const chars = todo.reduce((n, u) => n + u.text_raw.length, 0);
    await client.query("ROLLBACK");
    console.log(JSON.stringify({
      model: EMBEDDING_MODEL_NAME,
      owner_type: "preamble_unit",
      unit_types: types,
      units: units.length,
      missing: todo.length,
      chars,
      approx_tokens: Math.ceil(chars / 2.5),
      note: "تجريبي: لم يُكتب شيء. التطبيق يحتاج اعتماد المالك.",
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
