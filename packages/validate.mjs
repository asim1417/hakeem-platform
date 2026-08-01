#!/usr/bin/env node
// مُدقِّق حزم المجال/المؤسسة (§16) — مستقلّ، بلا تبعيات، للتشغيل في CI.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const SEMVER = /^\d+\.\d+\.\d+$/;
const ID_RE = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;
const KNOWN = [
  "packages/legal/domain.package.json",
  "packages/aman/institution.package.json",
];

let failures = 0;
for (const rel of KNOWN) {
  const abs = path.join(process.cwd(), rel);
  if (!existsSync(abs)) {
    console.error("✗", rel, "— غير موجود");
    failures++;
    continue;
  }
  let m;
  try {
    m = JSON.parse(readFileSync(abs, "utf8"));
  } catch (e) {
    console.error("✗", rel, "— JSON غير صالح:", e.message);
    failures++;
    continue;
  }
  const errors = [];
  for (const k of ["id", "name", "version", "schemaVersion", "publisher", "kind", "capabilities"]) {
    if (m[k] === undefined || m[k] === null || m[k] === "") errors.push(`حقل مفقود: ${k}`);
  }
  if (m.id && !ID_RE.test(m.id)) errors.push(`صيغة id غير صالحة: ${m.id}`);
  if (m.version && !SEMVER.test(m.version)) errors.push(`إصدار غير صالح: ${m.version}`);
  if (m.kind !== "domain" && m.kind !== "institution") errors.push(`kind غير صالح: ${m.kind}`);
  if (!Array.isArray(m.capabilities)) errors.push("capabilities يجب أن تكون مصفوفة");
  if (errors.length) {
    console.error("✗", rel);
    errors.forEach((e) => console.error("   -", e));
    failures += errors.length;
  } else {
    console.log("✓", rel, `— ${m.id}@${m.version} (${m.kind})`);
  }
}
if (failures) {
  console.error(`\nفشل التحقّق: ${failures} خطأ.`);
  process.exit(1);
}
console.log("\nحزم المجال/المؤسسة: كل التحقّقات ناجحة.");
