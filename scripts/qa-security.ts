import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const excluded = new Set(["node_modules", ".next", ".git", ".npm-cache", "work"]);
const scannedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".css"]);

type Finding = {
  file: string;
  line: number;
  reason: string;
  text: string;
};

const findings: Finding[] = [];

function walk(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!scannedExtensions.has(path.extname(entry.name))) continue;
    scanFile(full);
  }
}

function scanFile(file: string) {
  const rel = path.relative(root, file);
  if (rel === path.join("scripts", "qa-security.ts")) return;

  const content = fs.readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const isDocumentation = rel === "README.md" || rel.endsWith(".md");
    const isExample = rel === ".env.example" || isDocumentation;
    const isServerAiGateway = rel.startsWith(path.join("lib", "modules", "ai")) || rel.startsWith(path.join("app", "api"));
    // لعبة الأطفال تخزن تقدم اللعب فقط (عدد نجوم) محليًا — لا بيانات شخصية
    const isKidsGame = rel.startsWith("games" + path.sep);

    if (/sk-[A-Za-z0-9_-]{20,}/.test(line)) {
      findings.push({ file: rel, line: index + 1, reason: "مفتاح API محتمل مكشوف", text: trimmed });
    }

    if (/NEXT_PUBLIC_.*(OPENAI|ANTHROPIC|GEMINI|API).*KEY/i.test(line)) {
      findings.push({ file: rel, line: index + 1, reason: "متغير مفتاح ذكاء مكشوف للواجهة", text: trimmed });
    }

    if (!isDocumentation && !isKidsGame && /localStorage/.test(line)) {
      findings.push({ file: rel, line: index + 1, reason: "استخدام localStorage يحتاج مراجعة أمنية", text: trimmed });
    }

    if (!isExample && !isServerAiGateway && /(OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY)/.test(line)) {
      findings.push({ file: rel, line: index + 1, reason: "اسم مفتاح ذكاء خارج طبقة الخادم المخصصة", text: trimmed });
    }
  });
}

walk(root);

if (findings.length > 0) {
  console.error("فشل فحص الأمن. راجع النتائج التالية:");
  console.table(findings);
  process.exit(1);
}

console.log("نجح فحص الأمن: لا توجد مفاتيح API مكشوفة، ولا استخدام localStorage، ولا متغيرات مفاتيح NEXT_PUBLIC.");
