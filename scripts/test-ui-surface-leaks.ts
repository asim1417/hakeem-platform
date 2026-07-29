/**
 * مسح تسريبات ظاهرة في واجهات المستخدم — أكواد/أسرار/مفردات مطوّر.
 * تشغيل: npx tsx scripts/test-ui-surface-leaks.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts|jsx|js|html|css)$/.test(name)) acc.push(p);
  }
  return acc;
}

// ── Forbidden patterns in user-facing TSX (components + app pages) ──
const forbiddenInUi = [
  { re: /Qalam-1703!/, label: "default owner password" },
  { re: /aasemalfarsi@gmail\.com/, label: "owner email hardcoded" },
  { re: /المستخدم التجريبي/, label: "demo user label" },
  { re: /setPassword\("Qalam/, label: "password autofill" },
  { re: /AI_PROVIDER=openai/, label: "env dump in UI" },
  { re: /OPENAI_API_KEY/, label: "API key name in UI" },
  { re: /x-vercel-error.*\$\{/, label: "vercel error in user message" },
  { re: /JSON\.stringify\(data,\s*null,\s*2\)/, label: "raw JSON dump" },
];

const uiRoots = [join(root, "components"), join(root, "app")];
const uiFiles = uiRoots.flatMap((d) => walk(d)).filter((f) => /\.tsx$/.test(f));

for (const file of uiFiles) {
  const rel = file.slice(root.length + 1);
  // Admin AI settings intentionally mention sk- placeholders — skip that file for key patterns
  const src = read(rel);
  for (const { re, label } of forbiddenInUi) {
    if (rel.includes("AiSettingsManager") && /OPENAI_API_KEY|sk-/.test(label)) continue;
    if (rel.includes("admin/") && label === "API key name in UI") continue;
    assert.doesNotMatch(src, re, `${rel} must not contain ${label}`);
  }
}

// LoginForm sanitized
const login = read("components/LoginForm.tsx");
assert.doesNotMatch(login, /aasemalfarsi/);
assert.doesNotMatch(login, /OWNER_EMAIL/);
assert.doesNotMatch(login, /magicUrl \?/);

// ensure-owner API no email leak
const ensure = read("app/api/auth/ensure-owner/route.ts");
assert.doesNotMatch(ensure, /aasemalfarsi/);

// OTP never reveals in production
const otp = read("lib/modules/otp/phone-otp.ts");
assert.match(otp, /NODE_ENV === "production"\) return false/);

// Health no clerk/moyasar status
const health = read("app/api/health/route.ts");
assert.doesNotMatch(health, /moyasar/);
assert.doesNotMatch(health, /isClerkConfigured/);

// Prototype HTML is stub
const proto = read("public/original-hakeem/hakim1111.html");
assert.ok(proto.length < 5000, "prototype HTML must be stub, not full app");
assert.match(proto, /noindex/);
assert.doesNotMatch(proto, /sk-ant-|localhost:11434|apiKey/);

// AppShell friendly labels
const shell = read("components/AppShell.tsx");
assert.match(shell, /مستخدم/);
assert.doesNotMatch(shell, /المستخدم التجريبي/);

// Documents landing no DOC_SERVICE_URL href
const docs = read("app/documents/page.tsx");
assert.doesNotMatch(docs, /DOC_SERVICE_URL/);
assert.doesNotMatch(docs, /Tesseract/);
assert.doesNotMatch(docs, /AES-GCM/);

// No raw TODO: in end-user workspaces
for (const rel of ["components/TrainingWorkspace.tsx", "components/AttachmentsManager.tsx"]) {
  assert.doesNotMatch(read(rel), /\bTODO:/, `${rel} must not show TODO to users`);
}

console.log(`test-ui-surface-leaks: OK (${uiFiles.length} UI files scanned)`);
