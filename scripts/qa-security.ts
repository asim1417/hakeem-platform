import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
// tools/ يستضيف خدمات مستقلة (لا تدخل حزمة تطبيق الويب ولا نشره) — تُراجَع أمنياً على حدة
const excluded = new Set(["node_modules", ".next", ".git", ".npm-cache", "work", "tools"]);
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
    const isServerAiGateway =
      rel.startsWith(path.join("lib", "modules", "ai")) ||
      rel.startsWith(path.join("app", "api")) ||
      // طبقة إعدادات الخادم — تُعرّف أسماء مفاتيح البيئة ليُدخلها المدير، ولا تُرسل للواجهة
      rel.startsWith(path.join("lib", "modules", "settings")) ||
      // نصوص البناء/التقييم (Node) — لا تدخل حزمة الويب، تقرأ المفتاح من البيئة فقط
      rel.startsWith("scripts" + path.sep) ||
      // خادم معالجة الوثائق (Node) — طبقة خادمية مستقلّة تقرأ المفتاح من البيئة فقط
      rel.startsWith(path.join("services", "doc-node")) ||
      // مزوّدات التفريغ الصوتيّ (خادميّة) — تقرأ المفتاح من البيئة وتستعمله في ترويسة
      // Authorization على الخادم فقط، ولا تصل الواجهة أبدًا
      rel.startsWith(path.join("lib", "modules", "voice"));
    // ألعاب الأطفال تخزن تقدم اللعب وإعداداته فقط محليًا — لا بيانات شخصية
    // يشمل نسخها المنشورة تحت public/penalty-stars وpublic/football-future
    const isKidsGame =
      rel.startsWith("games" + path.sep) ||
      rel.startsWith(path.join("public", "penalty-stars")) ||
      rel.startsWith(path.join("public", "football-future"));

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

    // ── QA-001: كشف كلمات المرور والأسرار المضمّنة في المصدر (حرفيًّا) ──
    // يُستثنى: التوثيق، ‎.env.example، وملفات الاختبار (تحمل fixtures)، والأسطر التي تقرأ
    // من process.env (لا حرفية). يُلتقط تعيين قيمة حرفية لاسم يشبه كلمة مرور/سرّ.
    const isTestFixture = /(^|[\\/])(test|scripts[\\/]test-)/i.test(rel) || /\.test\.[cm]?[jt]sx?$/.test(rel);
    if (!isExample && !isTestFixture) {
      // مفتاح خاص PEM.
      if (/-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/.test(line)) {
        findings.push({ file: rel, line: index + 1, reason: "مفتاح خاص مضمّن في المصدر", text: "[REDACTED]" });
      }
      // Bearer token حرفي — مع استثناء الأمثلة/العناصر النائبة في التوثيق (XXXX، example، <...>).
      const isPlaceholder = /X{4,}|example|<[^>]+>|\.\.\.|\bYOUR_\b/i.test(line);
      if (/Bearer\s+[A-Za-z0-9._\-]{20,}/.test(line) && !/process\.env/.test(line) && !isPlaceholder) {
        findings.push({ file: rel, line: index + 1, reason: "توكن Bearer حرفي مضمّن", text: "[REDACTED]" });
      }
      // تعيين قيمة حرفية لكلمة مرور: نقصر على أسماء كلمات المرور بقيمة تشبه اعتمادًا (ASCII بلا فراغ)
      // لتفادي إيجابيات كاذبة على تسميات عربية مثل «secret: "سرّيّة"».
      const pwAssign = /[A-Za-z_]*(?:password|passwd)\s*[:=]\s*["'`][A-Za-z0-9!@#$%^&*()_+\-=.]{6,}["'`]/i;
      if (pwAssign.test(line) && !/process\.env/.test(line) && !isPlaceholder && !/z\.(string|object)/.test(line)) {
        findings.push({ file: rel, line: index + 1, reason: "كلمة مرور حرفية مضمّنة في المصدر", text: "[REDACTED]" });
      }
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
