/**
 * HKM-023-B ب-٣ — عيّنة الـ20 لتأكيد التصنيف.
 *   --build <a.json> [<b.json> …]  يجمع نصوص العيّنة (مقروءة من الإنتاج بقراءة فقط، ولكل نص md5 من القاعدة)
 *                                   مع إشاراتها من reports/hkm-023-b-preamble-signals.txt (ناتج SQL على الإنتاج)
 *                                   ويكتب reports/hkm-023-b-preamble-sample.json.
 *   (بلا خيار)                      يكتب reports/hkm-023-b-preamble-sample.md من ملف JSON: التصنيف والسبب والإشارات
 *                                   وتفكيك القارئ ونص المقدمة كاملًا.
 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { parsePreamble } from "../../lib/modules/legal-core/preamble-parser";
import { classifyPreambleSignals, completenessLabel, SIGNAL_NAMES, type PreambleSignals } from "../../lib/modules/legal-core/preamble-signals";

const SIGNALS = "reports/hkm-023-b-preamble-signals.txt";
const OUT_JSON = "reports/hkm-023-b-preamble-sample.json";
const OUT_MD = "reports/hkm-023-b-preamble-sample.md";
const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");

type Sample = { id: string; name: string; md5: string; text: string; signals: PreambleSignals; length: number };

function loadSignals(): Map<string, { signals: PreambleSignals; length: number }> {
  const out = new Map<string, { signals: PreambleSignals; length: number }>();
  for (const line of fs.readFileSync(SIGNALS, "utf8").split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [id, , , len, ...rest] = line.split("|");
    out.set(id, { length: Number(len), signals: Object.fromEntries(SIGNAL_NAMES.map((k, i) => [k, Number(rest[i])])) as PreambleSignals });
  }
  return out;
}

function build(files: string[]) {
  const sig = loadSignals();
  const samples: Sample[] = [];
  for (const f of files) {
    for (const s of JSON.parse(fs.readFileSync(f, "utf8")) as Array<{ id: string; name: string; md5: string; text: string }>) {
      if (md5(s.text) !== s.md5) throw new Error(`النص غير مطابق لبصمة الإنتاج: ${s.id}`);
      const row = sig.get(s.id);
      if (!row) throw new Error(`لا إشارات لـ ${s.id}`);
      if (row.length !== s.text.length) throw new Error(`الطول مختلف: ${s.id}`);
      samples.push({ id: s.id, name: s.name, md5: s.md5, text: s.text, signals: row.signals, length: row.length });
    }
  }
  const doc = {
    note: "HKM-023-B ب-٣: عيّنة الـ20 لتأكيد التصنيف. النصوص نصوص تشريعية عامة مقروءة من الإنتاج (Neon misty-base-66693229/neondb) بـ SELECT فقط في 2026-10-17، ولكل نص md5 من القاعدة. الإشارات من reports/hkm-023-b-preamble-signals.txt (SQL على الإنتاج).",
    samples,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2) + "\n");
  console.log(`${samples.length} عيّنة → ${OUT_JSON}`);
}

function render() {
  const { samples } = JSON.parse(fs.readFileSync(OUT_JSON, "utf8")) as { samples: Sample[] };
  const order = { complete: 0, partial: 1, issuance_line: 2 } as const;
  const rows = samples
    .map((s) => ({ s, c: classifyPreambleSignals(s.signals, s.length), p: parsePreamble(s.text) }))
    .sort((a, b) => order[a.c.completeness] - order[b.c.completeness] || a.s.length - b.s.length);
  const lines: string[] = [];
  lines.push("# HKM-023-B — عيّنة الـ20 لتأكيد تصنيف المقدمات (ب-٣)", "");
  lines.push("المصدر: `legal_systems.preamble` في الإنتاج، قراءة فقط (SELECT) في 2026-10-17. لكل نص بصمة md5 من القاعدة تحقق منها السكربت قبل الكتابة.");
  lines.push("التصنيف من إشارات SQL على الإنتاج (`classifyPreambleSignals`)، وعمود «القارئ» من `parsePreamble` على النص نفسه للمقارنة.", "");
  lines.push("| # | المعرّف | الاسم | الطول | التصنيف | السبب | افتتاحية/استنادات/صيغة/بنود | القارئ (أدوات، بنود، إعادة تركيب) |");
  lines.push("|---|---|---|---|---|---|---|---|");
  rows.forEach(({ s, c, p }, i) => {
    const clauses = p.units.filter((u) => u.type === "operative_clause").length;
    lines.push(`| ${i + 1} | \`${s.id}\` | ${s.name} | ${s.length} | ${completenessLabel(c.completeness)} | ${c.reason}${c.bodyLeak ? " (+متن)" : ""} | ${s.signals.opening}/${s.signals.recital}/${s.signals.enacting}/${s.signals.clause} | ${p.instruments.length} أداة، ${clauses} بند، ${p.reconstructionOk ? "حرفية ✓" : "✗"}${p.completeness === c.completeness ? "" : `، القارئ: ${completenessLabel(p.completeness)}`} |`);
  });
  lines.push("");
  rows.forEach(({ s, c }, i) => {
    lines.push(`## ${i + 1}. ${s.name}`, "");
    lines.push(`- المعرّف: \`${s.id}\` — الطول ${s.length} — md5 \`${s.md5}\``);
    lines.push(`- التصنيف: **${completenessLabel(c.completeness)}** (${c.reason})`, "");
    lines.push("```text", s.text, "```", "");
  });
  fs.writeFileSync(OUT_MD, lines.join("\n"));
  console.log(`→ ${OUT_MD}`);
}

const i = process.argv.indexOf("--build");
if (i >= 0) build(process.argv.slice(i + 1));
else render();
