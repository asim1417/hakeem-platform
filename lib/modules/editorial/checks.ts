import { z } from "zod";
import {
  ChangeInput,
  DeskConfig,
  DeskError,
  metadataSchema,
  normalizeIdentity,
} from "./contracts";
import { VERIFIED_STATUSES } from "../legal-core/verified-status";

const correctedSchema = z
  .object({
    article_number: z.number().int().positive().optional(),
    paragraph_label: z.string().min(1).optional(),
    effective_from_hijri: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    new_text: z.string().min(1).optional(),
    op_type: z.string().min(1).optional(),
    old_phrase: z.string().min(1).optional(),
    new_phrase: z.string().min(1).optional(),
    target_law_title: z.string().min(1).optional(),
  })
  .strict();
export function amendmentDecision(after: ChangeInput["after"]) {
  const { decision, ...rest } = after;
  const verdict = z
    .enum(["approved", "rejected", "approved_with_edit"])
    .parse(decision);
  const corrected = correctedSchema.parse(rest);
  if (verdict === "approved_with_edit" && !Object.keys(corrected).length)
    throw new DeskError(400, "الموافقة مع تصحيح تستلزم حقلًا مصححًا.");
  if (verdict !== "approved_with_edit" && Object.keys(corrected).length)
    throw new DeskError(400, "الحقول المصححة تتطلب قرار موافق مع تصحيح.");
  return {
    decision: verdict,
    corrected: {
      ...corrected,
      ...(corrected.effective_from_hijri
        ? {
            effective_from_gregorian: ummAlQuraDate(
              corrected.effective_from_hijri,
            ),
          }
        : {}),
    },
  };
}
function ummAlQuraDate(hijri: string) {
  const [year, month, day] = hijri.split("-").map(Number);
  if (
    year < 1356 ||
    year > 1500 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 30
  )
    throw new DeskError(400, "تاريخ هجري خارج نطاق التحقق بأم القرى.");
  const estimate = Math.floor(year * 0.970224 + 621.5774);
  const formatter = new Intl.DateTimeFormat(
    "en-US-u-ca-islamic-umalqura-nu-latn",
    { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" },
  );
  for (
    let value = Date.UTC(estimate - 1, 0, 1);
    value < Date.UTC(estimate + 2, 0, 1);
    value += 86400000
  ) {
    const parts = formatter.formatToParts(value);
    const read = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value);
    if (read("year") === year && read("month") === month && read("day") === day)
      return new Date(value).toISOString().slice(0, 10);
  }
  throw new DeskError(400, "تعذر التحقق من التاريخ الهجري.");
}
export function validatePayload(input: ChangeInput, config: DeskConfig) {
  const { op, targetType, after } = input;
  const required: Record<ChangeInput["op"], string> = {
    set_work_status: "work",
    update_metadata: "work",
    set_preamble: "work",
    create_work: "work",
    review_principle: "principle",
    review_amendment: "amendment",
    set_unit_text: "unit",
    review_ruling: "ruling",
    create_relation: "relation",
  };
  if (required[op] !== targetType)
    throw new DeskError(400, "العملية لا تطابق نوع الهدف.");
  if (op === "set_work_status")
    z.object({ status: z.enum(VERIFIED_STATUSES) })
      .strict()
      .parse(after);
  if (op === "set_preamble")
    z.object({
      preamble: z.string().min(1).max(200000),
      preambleRoyalDecree: z.string().optional(),
      preambleEffectiveFrom: z.string().date().optional(),
    })
      .strict()
      .parse(after);
  if (op === "update_metadata" || op === "create_work") {
    const m = metadataSchema.parse(after);
    if (!Object.keys(m).length) throw new DeskError(400, "التغيير فارغ.");
    if (m.documentKind && !config.documentKinds.includes(m.documentKind))
      throw new DeskError(400, "نوع الوثيقة غير مفعّل في الإعدادات.");
    if (m.instrumentKind && !config.instrumentKinds.includes(m.instrumentKind))
      throw new DeskError(400, "نوع أداة الإصدار غير مفعّل.");
    if (
      op === "create_work" &&
      (!m.officialName ||
        !m.instrumentKind ||
        !m.instrumentNumber ||
        !m.issuedOn)
    )
      throw new DeskError(
        400,
        "هوية الوثيقة تستلزم الاسم والأداة ورقمها وتاريخها.",
      );
  }
  if (op === "review_principle" || op === "review_ruling")
    z.object({ reviewStatus: z.enum(["reviewed", "rejected", "needs_review"]) })
      .strict()
      .parse(after);
  if (op === "review_amendment") amendmentDecision(after);
  if (op === "set_unit_text")
    z.object({
      body: z.string().min(1).max(200000),
      validFrom: z.string().date(),
    })
      .strict()
      .parse(after);
  if (op === "create_relation")
    z.object({
      sourceId: z.string().min(1),
      targetId: z.string().min(1),
      relation: z.literal("IMPLEMENTS"),
    })
      .strict()
      .refine((x) => x.sourceId !== x.targetId, "لا تربط الوثيقة بنفسها")
      .parse(after);
}
export type WorkIdentity = {
  name: string;
  instrument: string;
  date: string;
  aliases?: string[];
};
export function compareWorkIdentity(
  a: WorkIdentity,
  b: WorkIdentity,
): "exact" | "ambiguous" | "new" {
  const names = [b.name, ...(b.aliases ?? [])].map(normalizeIdentity);
  if (names.includes(normalizeIdentity(a.name)))
    return a.instrument &&
      a.date &&
      normalizeIdentity(a.instrument) === normalizeIdentity(b.instrument) &&
      a.date === b.date
      ? "exact"
      : "ambiguous";
  // Similar titles never authorize a merge; even one changed place name matters.
  const words = normalizeIdentity(a.name).split(" ");
  const other = new Set(normalizeIdentity(b.name).split(" "));
  return words.filter((w) => other.has(w)).length /
    Math.max(words.length, other.size) >=
    0.5
    ? "ambiguous"
    : "new";
}
