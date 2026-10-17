import type { ChangeInput } from "./contracts";
import { DeskError } from "./contracts";
import { resolveIdentity } from "./identity";
import { hash, type Tx } from "./repository";
import { normalizeArabicText } from "../legal-core/arabic-morphology";

/** New identity and existing target edits are different operations; edits never insert duplicates. */
export async function assertIdentityForChange(
  tx: Tx,
  input: ChangeInput,
  before: unknown,
) {
  if (input.op === "create_work") {
    const match = await resolveIdentity(
      {
        type: "work",
        name: String(input.after.officialName),
        instrument: String(input.after.instrumentNumber),
        date: String(input.after.issuedOn),
      },
      tx,
    );
    if (match.status !== "new")
      throw new DeskError(
        409,
        `هوية ${match.status === "exact" ? "مطابقة" : "ملتبسة"}: ${match.candidates.map((c) => c.id).join("، ")}`,
      );
  }
  if (
    input.op === "set_unit_text" &&
    before &&
    typeof before === "object" &&
    "body" in before &&
    typeof before.body === "string"
  ) {
    if (
      hash(normalizeArabicText(before.body)) ===
      hash(normalizeArabicText(String(input.after.body)))
    )
      throw new DeskError(
        409,
        "النص مطابق للنسخة الموجودة؛ لا يُنشأ تغيير مكرر.",
      );
  }
}
