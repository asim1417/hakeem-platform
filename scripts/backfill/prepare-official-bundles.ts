/**
 * يحوّل لقطات NCAR/BOE الخام إلى حزم إدخال منظمة بلا كتابة على قاعدة البيانات.
 * لا يكتب حزمة إلا إذا طابق ملفاً نظاماً واحداً بوضوح ونجح splitOfficialSystemBundle.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { htmlToLegalText, splitOfficialSystemBundle } from "@/lib/modules/legal-core/official-bundle";

const sourceArg = (process.argv.find((a) => a.startsWith("--source="))?.split("=")[1] ?? "ncar").toLowerCase();
const SOURCE = sourceArg === "boe" ? "BOE" as const : "NCAR" as const;
const OVERWRITE = process.argv.includes("--overwrite");
const LIMIT = Math.max(1, Math.min(5000, Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "2000")));
const RAW_DIR = path.join(process.cwd(), "data/backfill/official-raw", SOURCE.toLowerCase());
const OUT_DIR = path.join(process.cwd(), "data/backfill/text");

type ManifestRow = { file?: string; url?: string; title?: string; sourceDocumentId?: string };

function readManifest(): Map<string, ManifestRow> {
  const m = new Map<string, ManifestRow>();
  const p = path.join(RAW_DIR, "manifest.jsonl");
  if (!fs.existsSync(p)) return m;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as ManifestRow;
      if (row.file) m.set(row.file, row);
    } catch { /* quarantine malformed manifest row by ignoring it */ }
  }
  return m;
}

function strongSystemMention(text: string, name: string): boolean {
  const i = text.lastIndexOf("\n" + name + "\n");
  if (i < 0) return false;
  const after = text.slice(i + name.length + 2, i + name.length + 160);
  return /(?:باب|الفصل|المادة)/u.test(after);
}

async function main() {
  if (!fs.existsSync(RAW_DIR)) {
    console.log("⏭️ لا يوجد مجلد خام: " + RAW_DIR);
    return;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = readManifest();
  const systems = await prisma.legalSystem.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const files = fs.readdirSync(RAW_DIR).filter((f) => /\.(html?|txt)$/i.test(f)).slice(0, LIMIT);

  const quarantine: Array<Record<string, unknown>> = [];
  let prepared = 0, skipped = 0;

  for (const file of files) {
    const full = path.join(RAW_DIR, file);
    const raw = fs.readFileSync(full, "utf8");
    const text = htmlToLegalText(raw);
    const candidates = systems.filter((s) => strongSystemMention(text, s.name));
    if (candidates.length !== 1) {
      quarantine.push({ file, reason: candidates.length ? "AMBIGUOUS_SYSTEM_MATCH" : "NO_SYSTEM_MATCH", candidates: candidates.map((s) => s.name) });
      continue;
    }

    const system = candidates[0];
    const row = manifest.get(file);
    const sourceUrl = row?.url;
    if (!sourceUrl) {
      quarantine.push({ file, system: system.name, reason: "SOURCE_URL_MISSING" });
      continue;
    }

    const split = splitOfficialSystemBundle({
      htmlOrText: raw,
      systemName: system.name,
      sourceUrl,
      sourceCode: SOURCE,
    });
    if (!split.ok) {
      quarantine.push({ file, system: system.name, reason: "BUNDLE_SPLIT_REVIEW", issues: split.issues });
      continue;
    }

    const out = path.join(OUT_DIR, system.id + ".json");
    if (fs.existsSync(out) && !OVERWRITE) {
      skipped++;
      console.log("↷ موجود: " + system.name);
      continue;
    }

    fs.writeFileSync(out, JSON.stringify({
      systemId: system.id,
      sourceSnapshot: { sourceCode: SOURCE, sourceUrl, rawFile: file },
      bundleIssues: split.issues,
      documents: split.documents,
    }, null, 2) + "\n", "utf8");
    prepared++;
    console.log("✓ " + system.name + " — " + split.documents.map((d) => d.docType).join(" + "));
  }

  const qPath = path.join(OUT_DIR, "_quarantine-" + SOURCE.toLowerCase() + ".json");
  fs.writeFileSync(qPath, JSON.stringify({ generatedAt: new Date().toISOString(), source: SOURCE, items: quarantine }, null, 2) + "\n", "utf8");

  console.log("\nraw=" + files.length + " · prepared=" + prepared + " · skipped=" + skipped + " · quarantine=" + quarantine.length);
  console.log("quarantine: " + qPath);
}

main()
  .catch((e) => { console.error("✗", e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect().catch(() => undefined));
