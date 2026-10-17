"use client";
import { useState } from "react";
import { ChangeInput, DEFAULT_CONFIG } from "@/lib/modules/editorial/contracts";
import { VERIFIED_STATUSES } from "@/lib/modules/legal-core/verified-status";

export const FIELD_LABELS: Record<string, string> = {
  applicationOn: "تاريخ التطبيق",
  code: "رمز الوثيقة",
  externalIdentifier: "المعرف الرسمي الخارجي",
  officialName: "الاسم الرسمي",
  aliases: "الأسماء البديلة",
  documentKind: "نوع الوثيقة",
  instrumentKind: "أداة الإصدار",
  instrumentNumber: "رقم الأداة",
  issuer: "الجهة المصدرة",
  authorityBasis: "سند الاختصاص",
  domain: "المجال",
  issuedOn: "تاريخ الإصدار الميلادي",
  issuedHijri: "تاريخ الإصدار الهجري",
  publishedOn: "تاريخ النشر",
  effectiveOn: "تاريخ النفاذ",
  sourceUrl: "رابط المصدر الرسمي",
  publicationRef: "مرجع النشر",
  structure: "بنية الوثيقة",
  status: "الحالة القانونية",
  preamble: "نص الديباجة",
  preambleRoyalDecree: "أداة الديباجة",
  preambleEffectiveFrom: "تاريخ سريان الديباجة",
  reviewStatus: "حالة المراجعة",
  body: "النص",
  validFrom: "يسري من",
  sourceId: "معرف اللائحة",
  targetId: "معرف النظام",
  relation: "العلاقة",
};
const OPS: {
  value: ChangeInput["op"];
  label: string;
  target: ChangeInput["targetType"];
}[] = [
  { value: "set_work_status", label: "تغيير الحالة القانونية", target: "work" },
  { value: "update_metadata", label: "تحديث بطاقة الوثيقة", target: "work" },
  { value: "set_preamble", label: "إصدار جديد للديباجة", target: "work" },
  { value: "create_work", label: "إضافة وثيقة تنظيمية", target: "work" },
  { value: "create_relation", label: "ربط لائحة بنظام", target: "relation" },
  { value: "set_unit_text", label: "إصدار جديد لمادة", target: "unit" },
  { value: "review_ruling", label: "اقتراح مراجعة حكم", target: "ruling" },
];
export function ProposalForm({
  targetId,
  disabled,
  onSave,
  onClose,
}: {
  targetId?: string;
  disabled: boolean;
  onSave: (v: object) => Promise<void>;
  onClose: () => void;
}) {
  const [op, setOp] = useState<ChangeInput["op"]>("set_work_status");
  const [values, setValues] = useState<Record<string, string>>({
    status: "ساري",
  });
  const [key] = useState(() => crypto.randomUUID());
  const fields =
    op === "set_work_status"
      ? ["status"]
      : op === "set_preamble"
        ? ["preamble", "preambleRoyalDecree", "preambleEffectiveFrom"]
        : op === "set_unit_text"
          ? ["body", "validFrom"]
          : op === "review_ruling"
            ? ["reviewStatus"]
            : op === "create_relation"
              ? ["sourceId", "targetId"]
              : [
                  "officialName",
                  "aliases",
                  "documentKind",
                  "instrumentKind",
                  "instrumentNumber",
                  "issuer",
                  "authorityBasis",
                  "domain",
                  "issuedOn",
                  "issuedHijri",
                  "publishedOn",
                  "effectiveOn",
                  "applicationOn",
                  "code",
                  "externalIdentifier",
                  "sourceUrl",
                  "publicationRef",
                  "structure",
                ];
  const choices: Record<string, readonly string[]> = {
    status: VERIFIED_STATUSES,
    documentKind: DEFAULT_CONFIG.documentKinds,
    instrumentKind: DEFAULT_CONFIG.instrumentKinds,
    structure: ["articles", "clauses", "tables", "annexes", "mixed"],
    reviewStatus: ["reviewed", "rejected", "needs_review"],
  };
  return (
    <section className="desk-card">
      <div className="desk-row">
        <h2>إعداد تغيير جديد</h2>
        <button className="desk-secondary" onClick={onClose}>
          إغلاق
        </button>
      </div>
      <p>
        يحفظ التغيير مسودة حتى اكتمال المراجعة والنشر. يبقى النص السابق محفوظًا.
      </p>
      <form
        className="desk-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const after: ChangeInput["after"] = {};
          for (const field of fields)
            if (values[field])
              after[field] =
                field === "aliases"
                  ? values[field].split(/[,،]/).map((s) => s.trim())
                  : values[field];
          if (op === "create_relation") after.relation = "IMPLEMENTS";
          await onSave({
            action: "propose",
            changes: [
              {
                title: f.get("title"),
                targetType: OPS.find((x) => x.value === op)!.target,
                targetId:
                  op === "create_work" || op === "create_relation"
                    ? key
                    : f.get("targetId"),
                op,
                after,
                evidenceInstrument: f.get("instrument"),
                evidenceUrl: f.get("url"),
                evidenceQuote: f.get("quote"),
                sourceRank: Number(f.get("rank")),
                idempotencyKey: key,
              },
            ],
          });
        }}
      >
        <div className="desk-grid">
          <label>
            عنوان التغيير
            <input name="title" required minLength={3} maxLength={250} />
          </label>
          <label>
            المهمة
            <select
              value={op}
              onChange={(e) => {
                setOp(e.target.value as ChangeInput["op"]);
                setValues({});
              }}
            >
              {OPS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          {op !== "create_work" && op !== "create_relation" && (
            <label>
              معرف العنصر
              <input name="targetId" defaultValue={targetId} required />
            </label>
          )}
        </div>
        <div className="desk-grid">
          {fields.map((field) => (
            <label key={field}>
              {FIELD_LABELS[field]}
              {["body", "preamble"].includes(field) ? (
                <textarea
                  rows={8}
                  value={values[field] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field]: e.target.value }))
                  }
                />
              ) : choices[field] ? (
                <>
                  <input
                    list={`choices-${field}`}
                    value={values[field] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field]: e.target.value }))
                    }
                  />
                  <datalist id={`choices-${field}`}>
                    {choices[field].map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </>
              ) : (
                <input
                  type={/[Oo]n$|From$/.test(field) ? "date" : "text"}
                  value={values[field] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field]: e.target.value }))
                  }
                />
              )}
            </label>
          ))}
        </div>
        <fieldset className="desk-role">
          <legend>السند</legend>
          <div className="desk-grid">
            <label>
              الأداة أو مرجع المصدر
              <input required name="instrument" />
            </label>
            <label>
              رابط المصدر
              <input required type="url" name="url" />
            </label>
            <label>
              درجة المصدر (1 أعلى)
              <input
                required
                type="number"
                name="rank"
                min={1}
                max={10}
                defaultValue={1}
              />
            </label>
          </div>
          <label>
            الاقتباس الداعم
            <textarea
              required
              name="quote"
              minLength={2}
              maxLength={20000}
              rows={4}
            />
          </label>
        </fieldset>
        <button className="desk-primary" disabled={disabled}>
          حفظ المسودة
        </button>
      </form>
    </section>
  );
}
