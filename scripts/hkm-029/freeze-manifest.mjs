/**
 * HKM-030 — تجميد قائمة المتجهات من صف SUMMARY_SQL المقروء يدويًا من الإنتاج (للقراءة فقط).
 *
 *   node scripts/hkm-029/embed-lib.mjs --print-summary-sql            ← انسخ الاستعلام ونفّذه على الإنتاج قراءةً
 *   echo '{"selected":..,"stale":..,"missing":..,"ids_md5":"..","state_md5":".."}' \
 *     | node scripts/hkm-029/freeze-manifest.mjs [--chars <n>] [--out <ملف>]
 *
 * يكتب scripts/hkm-029/embed-manifest.json (task HKM-030) بعد التحقق بـ assertEmbedManifest. لا قاعدة ولا شبكة.
 * الملخص قد يكون كائنًا أو مصفوفة بصف واحد أو {rows:[...]} كما تُخرجه أدوات SQL.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { SUMMARY_SQL, buildEmbedManifest } from "./embed-lib.mjs";

export const DEFAULT_OUT = new URL("./embed-manifest.json", import.meta.url);

export function parseFreezeArgs(argv) {
  const at = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : null;
  };
  const rawChars = at("--chars");
  if (rawChars !== null && !/^\d+$/.test(String(rawChars))) throw new Error("--chars يجب أن يكون عددًا صحيحًا");
  return { chars: rawChars === null ? null : Number(rawChars), out: at("--out"), printSql: argv.includes("--print-summary-sql") };
}

/** يقبل الكائن مباشرة، أو مصفوفة بصف واحد، أو {rows:[صف]}. */
export function summaryFromInput(text) {
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error("المدخل ليس JSON صالحًا");
  }
  if (j && Array.isArray(j.rows)) j = j.rows;
  if (Array.isArray(j)) {
    if (j.length !== 1) throw new Error(`الملخص يجب أن يكون صفًا واحدًا (وجد ${j.length})`);
    j = j[0];
  }
  if (!j || typeof j !== "object") throw new Error("الملخص ليس كائنًا");
  return j;
}

export function main(argv = process.argv.slice(2), stdin = () => readFileSync(0, "utf8")) {
  const args = parseFreezeArgs(argv);
  if (args.printSql) {
    process.stdout.write(`${SUMMARY_SQL}\n`);
    return null;
  }
  const manifest = buildEmbedManifest(summaryFromInput(stdin()), { chars: args.chars });
  const out = args.out ? pathToFileURL(args.out) : DEFAULT_OUT;
  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ frozen: manifest.selected, stale: manifest.stale, missing: manifest.missing, ids_md5: manifest.ids_md5, state_md5: manifest.state_md5 }));
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "فشل");
    process.exit(1);
  }
}
