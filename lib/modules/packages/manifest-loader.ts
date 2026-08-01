import "server-only";

// مُحمِّل حزم المجال/المؤسسة — المخطط السيادي §16.
// تعريفيّ فقط في هذه المرحلة: يقرأ ملفات manifest ويتحقّق منها دون اقتران تشغيليّ.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export interface PackageManifest {
  id: string;
  name: string;
  version: string;
  schemaVersion: string;
  publisher: string;
  kind: "domain" | "institution";
  capabilities: string[];
  permissions?: string[];
  dependencies?: string[];
  conflicts?: string[];
  compatibility?: Record<string, unknown>;
  entrypoints?: Record<string, string>;
  signatures?: unknown[];
  [key: string]: unknown;
}

const SEMVER = /^\d+\.\d+\.\d+$/;
const ID_RE = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;

/** الحزم المعروفة (مسارات نسبيّة لجذر المشروع). يُوسَّع عند إضافة مؤسسات/مجالات. */
export const KNOWN_PACKAGE_PATHS = ["packages/legal/domain.package.json"];

export function validateManifest(m: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const o = m as Record<string, unknown>;
  const need = (k: string) => {
    if (o[k] === undefined || o[k] === null || o[k] === "") errors.push(`حقل مفقود: ${k}`);
  };
  ["id", "name", "version", "schemaVersion", "publisher", "kind", "capabilities"].forEach(need);
  if (typeof o.id === "string" && !ID_RE.test(o.id)) errors.push(`صيغة id غير صالحة: ${o.id}`);
  if (typeof o.version === "string" && !SEMVER.test(o.version)) errors.push(`إصدار غير صالح: ${o.version}`);
  if (o.kind !== "domain" && o.kind !== "institution") errors.push(`kind غير صالح: ${String(o.kind)}`);
  if (!Array.isArray(o.capabilities)) errors.push("capabilities يجب أن تكون مصفوفة");
  return { ok: errors.length === 0, errors };
}

/** يقرأ ويتحقّق من كل الحزم المعروفة (دفاعيّ: يتخطّى المفقود). */
export function loadPackages(root = process.cwd()): Array<{
  path: string;
  manifest?: PackageManifest;
  ok: boolean;
  errors: string[];
}> {
  return KNOWN_PACKAGE_PATHS.map((rel) => {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) return { path: rel, ok: false, errors: ["الملف غير موجود"] };
    try {
      const parsed = JSON.parse(readFileSync(abs, "utf8")) as PackageManifest;
      const v = validateManifest(parsed);
      return { path: rel, manifest: parsed, ok: v.ok, errors: v.errors };
    } catch (e) {
      return { path: rel, ok: false, errors: [e instanceof Error ? e.message : "JSON غير صالح"] };
    }
  });
}
