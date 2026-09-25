import {
  extractCouncilDecisionRefs,
  normalizeHijriDate,
  normalizeInstrumentNumber,
} from "../lib/modules/legal-core/system-readiness";

let failed = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) console.log("✓", label);
  else { failed++; console.error("✗", label, detail ?? ""); }
}

check("تطبيع رقم عربي", normalizeInstrumentNumber("(٨٢٠)") === "820");
check("تطبيع تاريخ هجري", normalizeHijriDate("٢٤ / ١١ / ١٤٤٤هـ") === "24/11/1444");

const refs = extractCouncilDecisionRefs(
  "وبعد الاطلاع على قرار مجلس الوزراء رقم (٨٢٠) وتاريخ ٢٤ / ١١ / ١٤٤٤هـ. رسمنا بما هو آت:"
);
check("استخراج قرار مجلس الوزراء", refs.length === 1, refs);
check("رقم القرار 820", refs[0]?.number === "820", refs[0]);
check("تاريخ القرار", refs[0]?.hijriDate === "24/11/1444", refs[0]);

const noRef = extractCouncilDecisionRefs("بعون الله تعالى رسمنا بما هو آت");
check("لا يختلق مرجعاً", noRef.length === 0, noRef);

process.exit(failed ? 1 : 0);
