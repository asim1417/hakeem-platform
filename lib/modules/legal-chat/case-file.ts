// ─────────────────────────────────────────────────────────────────────────────
// SimulationCaseEngine (الجزء الحتمي) — بناء ملف القضية الحيّ وتحديثه.
// Case Memory: كل معلومة مرتبطة بملف القضية الحالي مع مصدرها (provenance)،
// ولا تُخلط قضية بأخرى. الملف قابل للتحديث عبر دورات المحادثة.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  CaseFact,
  IntentResult,
  SimulationCaseFile,
} from "./types";
import { ROLE_LABELS, TRACK_LABELS } from "./taxonomy";

/** يبني عنواناً موجزاً لملف القضية من النيّة. */
function buildTitle(intent: IntentResult): string {
  const role = ROLE_LABELS[intent.userRole];
  const track = TRACK_LABELS[intent.track];
  return `${intent.disputeType} — ${track} (${role})`;
}

/** يقسّم الوقائع إلى جُمل لتغذية ملف القضية. */
function splitFacts(text: string): string[] {
  return (text || "")
    .split(/[.؟!\n،]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .slice(0, 12);
}

/** حالة الملف: جاهز إذا انتفت النواقص المؤثّرة. */
function deriveStatus(intent: IntentResult): SimulationCaseFile["status"] {
  const critical = intent.missingInfo.filter((m) => m.critical).length;
  if (critical === 0 && intent.confidence >= 0.8) return "READY";
  if (critical >= 2) return "DRAFT";
  return "INCOMPLETE";
}

/**
 * يُنشئ ملف قضية جديداً من نيّة المستخدم (أول رسالة جوهرية).
 */
export function buildCaseFileFromIntent(intent: IntentResult): SimulationCaseFile {
  const facts: CaseFact[] = splitFacts(intent.facts).map((text) => ({
    text,
    provenance: "USER_MESSAGE",
    materiality: "UNKNOWN",
  }));

  return {
    title: buildTitle(intent),
    userRole: intent.userRole,
    track: intent.track,
    disputeType: intent.disputeType,
    proceduralStage: intent.proceduralStage,
    status: deriveStatus(intent),
    summary: intent.intentSummary,
    claimValue: intent.claimValue,
    hasArbitrationClause: intent.hasArbitrationClause,
    parties: [],
    facts,
    claims: intent.claims,
    defenses: intent.defenses,
    evidence: [],
    missingInfo: intent.missingInfo,
  };
}

/**
 * يدمج نيّة جديدة في ملف قضية قائم (تحديث حيّ دون فقد ما سبق).
 * المعلومات الجديدة الصريحة تُحدّث الحقول، والوقائع الجديدة تُضاف دون تكرار.
 */
export function mergeIntentIntoCaseFile(
  existing: SimulationCaseFile,
  intent: IntentResult
): SimulationCaseFile {
  const merged: SimulationCaseFile = { ...existing };

  if (intent.userRole !== "UNKNOWN") merged.userRole = intent.userRole;
  if (intent.track !== "UNKNOWN") merged.track = intent.track;
  if (intent.proceduralStage !== "UNKNOWN") merged.proceduralStage = intent.proceduralStage;
  if (intent.disputeType && !intent.disputeType.includes("غير محدد")) merged.disputeType = intent.disputeType;
  if (intent.claimValue) merged.claimValue = intent.claimValue;
  if (intent.hasArbitrationClause !== null) merged.hasArbitrationClause = intent.hasArbitrationClause;
  if (intent.claims) merged.claims = intent.claims;
  if (intent.defenses) merged.defenses = intent.defenses;

  // أضف وقائع جديدة فقط (منع التكرار بالمطابقة النصية البسيطة).
  const seen = new Set(merged.facts.map((f) => f.text.trim()));
  for (const text of splitFacts(intent.facts)) {
    if (!seen.has(text)) {
      seen.add(text);
      merged.facts.push({ text, provenance: "USER_MESSAGE", materiality: "UNKNOWN" });
    }
  }

  // أعد احتساب النواقص والحالة على ضوء الملف المُحدَّث.
  merged.missingInfo = recomputeMissing(merged, intent);
  merged.status = merged.missingInfo.filter((m) => m.critical).length === 0 ? "READY" : "INCOMPLETE";
  merged.title = buildTitle({ ...intent, userRole: merged.userRole, track: merged.track, disputeType: merged.disputeType });
  return merged;
}

/** يعيد احتساب النواقص بالنظر لما اكتمل فعلاً في الملف. */
function recomputeMissing(file: SimulationCaseFile, intent: IntentResult): SimulationCaseFile["missingInfo"] {
  return intent.missingInfo.filter((m) => {
    if (m.key === "role") return file.userRole === "UNKNOWN";
    if (m.key === "track") return file.track === "UNKNOWN";
    if (m.key === "stage") return file.proceduralStage === "UNKNOWN";
    if (m.key === "facts") return file.facts.length < 2;
    if (m.key === "claims") return !file.claims;
    if (m.key === "arbitration") return file.hasArbitrationClause === null;
    return true;
  });
}
