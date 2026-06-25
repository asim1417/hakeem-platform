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

/** هل في الملف ما يكفي لإنتاج تقرير (قصة فعلية + تصنيف)؟ «لا قضية = لا تقرير». */
export function isCaseSubstantive(cf: SimulationCaseFile): boolean {
  const factsLen = cf.facts.reduce((s, f) => s + f.text.length, 0);
  return cf.facts.length >= 2 && factsLen >= 70 && cf.track !== "UNKNOWN";
}

/**
 * درجة جاهزية القضية (0..100) — إشارة حتمية بحتة لبوابة عرض التقرير.
 * مُعايَرة بحيث كل قضية جوهرية (isCaseSubstantive) تبلغ ≥ 85 (لا انحدار):
 *   مسار معروف 35 + وقيعتان 25 + طول وقائع كافٍ 25 = 85.
 * وتزيد بإشارات إضافية (صفة الطرف، تعدّد الوقائع، تفصيل أوسع).
 */
export function caseReadinessScore(cf: SimulationCaseFile): number {
  const factsLen = cf.facts.reduce((s, f) => s + f.text.length, 0);
  let score = 0;
  if (cf.track !== "UNKNOWN") score += 35; // نوع النزاع محدّد
  if (cf.facts.length >= 2) score += 25; // وقيعتان على الأقل
  if (cf.facts.length >= 3) score += 10; // تفصيل أوسع
  if (factsLen >= 70) score += 25; // وقائع كافية الطول
  if (factsLen >= 140) score += 5; // وقائع مفصّلة
  if (cf.userRole && cf.userRole !== "UNKNOWN") score += 10; // صفة الطرف معروفة
  return Math.min(score, 100);
}
