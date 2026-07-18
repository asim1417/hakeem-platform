#!/usr/bin/env node
// تحقّق مانيفستات الوكلاء ضدّ ثوابت المخطط الحرجة — بلا تبعيات خارجية (Node built-ins).
// يُشغَّل من جذر المستودع: `node agents/validate.mjs`.
import { readFileSync } from "node:fs";

const AGENTS = ["commercial-litigator", "insolvency-practitioner", "judge-aide"];
const HLS_KEYS = ["grounding", "enforcementCheck", "scopeBinding", "coverageGate", "noPersonalOpinion", "explicitAbstention"];

function validate(m) {
  const e = [];
  if (!/^[a-z0-9-]+$/.test(m.agentId || "")) e.push("agentId غير صحيح");
  if (!/^\d+\.\d+\.\d+$/.test(m.version || "")) e.push("version غير صحيح");
  if (!m.owner?.orgId) e.push("owner.orgId مفقود");
  if (!m.owner?.contactEmail) e.push("owner.contactEmail مفقود");
  if (!(m.scope?.defaultSystems?.length > 0)) e.push("scope.defaultSystems فارغ");
  if (typeof m.scope?.expandable !== "boolean") e.push("scope.expandable مفقود");
  if (!(m.skills?.length > 0)) e.push("skills فارغ");
  if (!(m.outputTemplates?.length >= 0)) e.push("outputTemplates مفقود");
  for (const k of HLS_KEYS) if (m.hlsCompliance?.[k] !== true) e.push(`hlsCompliance.${k} ≠ true`);
  if (!m.approval?.status) e.push("approval.status مفقود");
  if (!Array.isArray(m.approval?.conformanceTestsPassed)) e.push("approval.conformanceTestsPassed مفقود");

  const skillIds = new Set((m.skills || []).map((s) => s.skillId));
  const tplIds = new Set((m.outputTemplates || []).map((t) => t.templateId));
  for (const sr of m.subRoles || []) {
    for (const s of sr.skills || []) if (!skillIds.has(s)) e.push(`subRole ${sr.subRoleId}: مهارة خارج المجمع «${s}»`);
    for (const t of sr.outputTemplates || []) if (!tplIds.has(t)) e.push(`subRole ${sr.subRoleId}: قالب مجهول «${t}»`);
    if (!sr.stanceGuard?.conformanceTest) e.push(`subRole ${sr.subRoleId}: stanceGuard.conformanceTest مفقود`);
    if (!(sr.stanceGuard?.forbids?.length > 0)) e.push(`subRole ${sr.subRoleId}: stanceGuard.forbids فارغ`);
  }
  return e;
}

let failed = 0;
for (const a of AGENTS) {
  const path = `agents/${a}/manifest.json`;
  let errs;
  try {
    errs = validate(JSON.parse(readFileSync(path, "utf8")));
  } catch (err) {
    errs = [`تعذّر القراءة/التحليل: ${err.message}`];
  }
  console.log(`${errs.length ? "FAIL" : "PASS"} :: ${path}`);
  for (const er of errs) console.log(`   - ${er}`);
  if (errs.length) failed++;
}
console.log(`\n${AGENTS.length - failed}/${AGENTS.length} صالح`);
process.exit(failed ? 1 : 0);
