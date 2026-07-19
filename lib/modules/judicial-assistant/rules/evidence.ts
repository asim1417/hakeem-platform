// ─────────────────────────────────────────────────────────────────────────────
// JS-010 — مصفوفة الإثبات (حتميّة، §16، §18.5).
// تُبنى حصريًّا من بيانات القضية نفسها (الوقائع وحالاتها وارتباطها بدليل) — بلا اختلاق ولا
// نموذج. لا تقرّر ثبوتًا نهائيًّا؛ تُظهر العبء والنقص والنتيجة الأوليّة، وتترك القرار للقاضي.
// ─────────────────────────────────────────────────────────────────────────────
import type { CaseFact, EvidenceMatrixResult, EvidenceMatrixRow, JudicialCase } from "../types";

/** اشتقاق عبء الإثبات من حالة الواقعة (منطقٌ عامّ، لا نصٌّ نظاميّ). */
function burdenFor(f: CaseFact): string {
  switch (f.status) {
    case "alleged":
      return "على مدّعيها";
    case "denied":
      return "على مدّعي الواقعة (أُنكرت)";
    case "unresolved":
      return "غير محدَّد — تحتاج تكييفًا";
    case "admitted":
      return "لا عبء (مُقرّة)";
    case "established":
      return "لا عبء (ثابتة)";
    default:
      return "—";
  }
}

function tentativeFor(f: CaseFact): EvidenceMatrixRow["tentative"] {
  if (f.status === "established" || f.status === "admitted") return "محسومة";
  if (f.status === "denied") return "محلّ نزاع";
  if (!f.hasEvidence) return "تحتاج دليلًا";
  return "قابلة للإثبات";
}

function noteFor(f: CaseFact): string {
  if (f.status === "admitted") return "أقرّ بها الخصم، فلا تحتاج إثباتًا.";
  if (f.status === "established") return "ثابتة بالبيّنة/الإقرار.";
  if (!f.hasEvidence) return "لا دليلٌ مرتبط — تبقى غير قابلةٍ للاعتماد حتى يُقدَّم دليل.";
  if (f.status === "denied") return "منكَرة ولها دليلٌ مرتبط — تُوزن البيّنة في المرافعة.";
  return "لها دليلٌ مرتبط — يُقيَّم مدى حجّيّته.";
}

/** يبني مصفوفة الإثبات للقضية من وقائعها. حتميّ، بلا نموذج. */
export function buildEvidenceMatrix(kase: JudicialCase): EvidenceMatrixResult {
  const rows: EvidenceMatrixRow[] = kase.facts.map((f) => ({
    factId: f.id,
    fact: f.text,
    status: f.status,
    burdenParty: burdenFor(f),
    hasEvidence: f.hasEvidence,
    tentative: tentativeFor(f),
    note: noteFor(f),
  }));

  const gaps = kase.facts
    .filter((f) => !f.hasEvidence && f.status !== "admitted" && f.status !== "established")
    .map((f) => f.text);

  return {
    serviceId: "JS-010",
    deterministic: true,
    rows,
    gaps,
    disclaimer:
      "نتيجةٌ أوليّة لا تقرّر ثبوتًا نهائيًّا. تُبنى من وقائع القضية وحالاتها فقط، وتُظهر النقص صراحةً. القرار للقاضي بعد وزن البيّنة.",
  };
}
