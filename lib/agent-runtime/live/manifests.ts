// ─────────────────────────────────────────────────────────────────────────────
// سجلّ المانيفستات — يحمّل حزمة الوكلاء (agents/*/manifest.json) ويكشفها للتشغيل.
// التحقّق نقيٌّ (بلا تبعية خارجية): يعكس ثوابت المخطط الحرجة للاعتماد الحيّ.
// ─────────────────────────────────────────────────────────────────────────────
import commercialLitigator from "@/agents/commercial-litigator/manifest.json";
import insolvencyPractitioner from "@/agents/insolvency-practitioner/manifest.json";
import judgeAide from "@/agents/judge-aide/manifest.json";
import type { Stance } from "../types";

export type EngineTool =
  | "legal_research" | "read_article" | "read_article_in_context" | "read_chapter"
  | "takhrij_hukm" | "trace_amendments" | "link_bylaw" | "build_citation"
  | "exhaustive_scan" | "hijri_date_calc";

export interface AgentSkill { skillId: string; path: string; engineTools: EngineTool[]; }
export interface AgentSubRole {
  subRoleId: string;
  displayName?: string;
  stance: string;             // موقف الممارس بالعربية (محايد/منازِع_مدين/…)
  skills: string[];
  outputTemplates?: string[];
  stanceGuard: { rule?: string; forbids: string[]; conformanceTest: string };
}
export interface AgentManifest {
  agentId: string;
  displayName?: string;
  version: string;
  owner: { orgId: string; contactEmail: string };
  practiceProfile: { role: string; audience: string[]; defaultDepth: string; dialect?: string };
  scope: { defaultSystems: string[]; expandable: boolean };
  skills: AgentSkill[];
  subRoles?: AgentSubRole[];
  outputTemplates: { templateId: string; structure: string[] }[];
  mcp?: { endpoint?: string; authMethod?: string; exposedTools?: string[] };
  hlsCompliance: Record<string, boolean>;
  approval: { status: string; conformanceTestsPassed: string[]; agentConformanceTestsPassed?: string[] };
}

// الحزمة المدمجة (تُقرأ عند البناء عبر resolveJsonModule).
const MANIFESTS = [
  commercialLitigator,
  insolvencyPractitioner,
  judgeAide,
] as unknown as AgentManifest[];

const BY_ID = new Map<string, AgentManifest>(MANIFESTS.map((m) => [m.agentId, m]));

export function listManifests(): AgentManifest[] {
  return [...MANIFESTS];
}
export function getManifest(agentId: string): AgentManifest | null {
  return BY_ID.get(agentId) ?? null;
}

// ثوابت HLS-001 غير القابلة للتخصيص — قيمها true إلزاميًا.
const HLS_KEYS = [
  "grounding", "enforcementCheck", "scopeBinding",
  "coverageGate", "noPersonalOpinion", "explicitAbstention",
] as const;

/** تحقّقٌ نقيّ يعكس ثوابت المخطط الحرجة — يُرجِع قائمة مخالفات (فارغة = سليم). */
export function validateManifest(m: AgentManifest): string[] {
  const errs: string[] = [];
  if (!/^[a-z0-9-]+$/.test(m.agentId || "")) errs.push("agentId: صيغة غير صحيحة");
  if (!/^\d+\.\d+\.\d+$/.test(m.version || "")) errs.push("version: صيغة غير صحيحة");
  if (!m.owner?.orgId) errs.push("owner.orgId مفقود");
  if (!m.scope?.defaultSystems?.length) errs.push("scope.defaultSystems فارغ");
  if (!m.skills?.length) errs.push("skills فارغ");

  // HLS-001: كل الثوابت true.
  for (const k of HLS_KEYS) {
    if (m.hlsCompliance?.[k] !== true) errs.push(`hlsCompliance.${k} يجب أن يكون true`);
  }

  // اتّساق الأدوار الفرعية: مهاراتها subset من المجمع، وحارسها يحمل حالة مطابقة.
  const skillIds = new Set(m.skills.map((s) => s.skillId));
  const tplIds = new Set(m.outputTemplates.map((t) => t.templateId));
  for (const sr of m.subRoles ?? []) {
    for (const s of sr.skills) if (!skillIds.has(s)) errs.push(`subRole ${sr.subRoleId}: مهارة خارج المجمع «${s}»`);
    for (const t of sr.outputTemplates ?? []) if (!tplIds.has(t)) errs.push(`subRole ${sr.subRoleId}: قالب مجهول «${t}»`);
    if (!sr.stanceGuard?.conformanceTest) errs.push(`subRole ${sr.subRoleId}: stanceGuard.conformanceTest مفقود`);
  }
  return errs;
}

/** خريطة الموقف العربيّ (المخطط) → موقف الحرّاس البرمجيّة (types.Stance). */
export function stanceFromArabic(ar: string): Stance {
  switch (ar) {
    case "منازِع_مدين": return "advocate_debtor";
    case "منازِع_دائن": return "advocate_creditor";
    case "خبير": return "expert";
    case "مشرف": return "supervisor";
    case "محايد":
    default: return "neutral";
  }
}
