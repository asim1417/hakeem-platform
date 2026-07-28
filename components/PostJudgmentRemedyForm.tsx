"use client";

import { useState } from "react";

type RemedyKind = "appeal" | "cassation" | "reconsideration";

type RemedyConfig = {
  kind: RemedyKind;
  apiKind: string;
  title: string;
  description: string;
  reasonLabel: string;
  reasonHint: string;
  // أسبابٌ مؤصَّلة (منقولة كاملةً من النسخة القديمة): عنوانٌ + وصفٌ + المرجع النظاميّ.
  reasons: Array<{ label: string; desc: string; ref: string }>;
  // مسار المراحل الكامل (منقول من appeal-timeline / مسار النقض والالتماس).
  stages: Array<{ title: string; note?: string }>;
  // خيارات الطلب في هذا المسار (select).
  requests: string[];
  // حقولٌ إضافيّة (تاريخ التسلّم/العلم، مواضع المخالفة…).
  extraFields: Array<{ key: string; label: string; placeholder: string }>;
  // مواد اللائحة المرجعيّة (side card).
  refMaterials: Array<{ article: string; note: string }>;
  // ملاحظاتٌ وشروطٌ مسبقة ومُهَل.
  notes: string[];
  // احتساب مدّة الاعتراض (القبول الشكلي) — منقول من computeAppealDeadline.
  deadline?: { days: number; label: string; ref: string };
};

const configs: Record<RemedyKind, RemedyConfig> = {
  appeal: {
    kind: "appeal",
    apiKind: "استئناف",
    title: "لائحة الاستئناف",
    description: "طريق اعتراضٍ عاديّ يُراجع الحكم من حيث الوقائع والتسبيب وتطبيق النظام. دائرة الاستئناف تُحيل للحكم الابتدائيّ ولا تُعيد سرد الوقائع.",
    reasonLabel: "أسباب الطعن بالاستئناف",
    reasonHint: "اختر أسباب طعنك — يجب أن يكون لكلّ سببٍ مستندٌ في وقائع القضية وإلا رُدّ شكلًا.",
    reasons: [
      { label: "خطأ في تطبيق النظام أو تفسيره", desc: "المحكمة طبّقت نصًّا نظاميًّا خاطئًا أو فسّرته تفسيرًا مغايرًا للثابت قضاءً", ref: "نظام المعاملات المدنية / نظام المحاكم التجارية" },
      { label: "خطأ في تقدير الأدلة", desc: "أُغفل دليلٌ جوهريّ أو أُعطي دليلٌ ثقلًا لا يستحقّه وفق نظام الإثبات", ref: "نظام الإثبات" },
      { label: "قصور في التسبيب", desc: "الحكم خلا من الرد على دفعٍ جوهريّ أو التسبيب الكافي لإلغاء طلب", ref: "نظام المحاكم التجارية — التسبيب" },
      { label: "مخالفة مبدأ المواجهة", desc: "بُنيَ الحكم على وقائع أو أدلّة لم يُتَح للطرف الآخر مناقشتها", ref: "نظام المرافعات الشرعية" },
      { label: "الحكم بما لم يُطلب", desc: "تجاوز الحكم نطاق الطلبات المقدَّمة خلافًا لنظام المرافعات م/97", ref: "نظام المرافعات الشرعية م/97" },
      { label: "دليل جديد لم يكن متاحًا", desc: "ظهر دليلٌ جوهريّ لم يكن بالإمكان تقديمه أمام الدرجة الأولى لسببٍ قاهر (م/21: لا تُقبل الأدلّة التي كان ممكنًا تقديمها ابتداءً)", ref: "لائحة الاعتراض م/21" }
    ],
    stages: [
      { title: "نافذة الاستئناف", note: "30 يومًا" },
      { title: "تقديم الطعن", note: "أسباب الاستئناف" },
      { title: "المراجعة القضائية", note: "تحليل الأسباب" },
      { title: "حكم الاستئناف", note: "تأييد / تعديل / إلغاء" }
    ],
    requests: [
      "إلغاء الحكم الابتدائي والقضاء في الموضوع (م/32)",
      "تعديل الحكم وزيادة المبلغ المحكوم به",
      "تعديل الحكم وتخفيض المبلغ المحكوم به",
      "إلغاء الحكم وإعادة القضية للمحكمة الابتدائية (في حالات م/34 الحصرية)",
      "تأييد الحكم مع تصحيح التسبيب فقط (م/18)"
    ],
    extraFields: [
      { key: "reasonsDetail", label: "تفصيل أسباب الطعن", placeholder: "اشرح بالتفصيل كيف أخطأت المحكمة الابتدائية في كلّ سببٍ اخترته، مع الإشارة إلى الصفحة أو الفقرة في الحكم المطعون فيه…" }
    ],
    deadline: { days: 30, label: "تاريخ تسلّم صك الحكم (م/7)", ref: "م/7 وم/36" },
    refMaterials: [
      { article: "م/7", note: "بدء مدّة الاعتراض من تسلّم صك الحكم" },
      { article: "م/11", note: "طلب وقف التنفيذ خلال مدّة الاعتراض فقط" },
      { article: "م/18", note: "تأييد الحكم مع تصحيح التسبيب" },
      { article: "م/21", note: "لا تُقبل أدلّة كان ممكنًا تقديمها ابتداءً" },
      { article: "م/28", note: "غياب المستأنف 60 يومًا دون طلب سير ⇒ سقوط الحق" },
      { article: "م/32", note: "إلغاء والقضاء في الموضوع" },
      { article: "م/34", note: "حالات الإلغاء والإعادة الحصرية" }
    ],
    notes: [
      "تبدأ مدّة الاعتراض من اليوم التالي لتسلّم صك الحكم (م/7)، ومدّتها 30 يومًا.",
      "طلب وقف التنفيذ يكون خلال مدّة الاعتراض فقط (م/11).",
      "غياب المستأنف 60 يومًا دون طلب سيرٍ يُسقط حقّ الاستئناف (م/28)."
    ]
  },
  cassation: {
    kind: "cassation",
    apiKind: "نقض",
    title: "طلب النقض أمام المحكمة العليا",
    description: "طريق اعتراضٍ أمام المحكمة العليا يركّز على الأسباب النظاميّة المؤثّرة في الحكم، ولا يُعدّ إعادة نظرٍ كاملة في موضوع النزاع (م/40-47 لائحة الاعتراض).",
    reasonLabel: "سبب النقض — وفق م/193 من نظام المحاكم التجارية",
    reasonHint: "أسباب النقض حصريّة — لا تقبل المحكمة العليا إلا هذه الأسباب.",
    reasons: [
      { label: "مخالفة مبدأ قضائي صادر من المحكمة العليا — م/40", desc: "الحكم خالف مبدأً أخذت به المحكمة العليا في قضايا سابقة — يُعدّ بحكم مخالفة النظام", ref: "لائحة الاعتراض م/40" },
      { label: "مخالفة نصّ نظاميّ صريح — م/193 فقرة 1", desc: "الحكم خالف حكمًا نظاميًّا واجب التطبيق تطبيقًا مباشرًا على محلّ النزاع", ref: "نظام المحاكم التجارية م/193" },
      { label: "الخطأ في الاختصاص النوعيّ أو المكانيّ — م/46", desc: "الحكم صدر من جهةٍ قضائيّة غير مختصّة نوعيًّا أو مكانيًّا — أثره: تعيين المحكمة المختصّة", ref: "لائحة الاعتراض م/46" }
    ],
    stages: [
      { title: "تقديم مذكرة النقض", note: "شروط م/42" },
      { title: "فحص القبول", note: "م/44 — الموعد والشروط" },
      { title: "المحكمة العليا", note: "الأسباب النظامية" },
      { title: "الفصل", note: "رفض / نقض / إحالة (م/45)" }
    ],
    requests: [
      "نقض الحكم والحكم في الموضوع (م/47)",
      "نقض الحكم وإحالته للدائرة التي أصدرته (م/45 فقرة 2)",
      "نقض الحكم لمخالفة الاختصاص وتعيين المحكمة المختصة (م/46)"
    ],
    extraFields: [
      { key: "location", label: "موضع المخالفة من الحكم", placeholder: "حدّد الفقرة أو الصفحة بدقّة — مثال: في الصفحة الثالثة من الحكم، في تسبيب الدائرة، جاء: «...» في حين أنّ المبدأ القضائي الصادر عن المحكمة العليا في القضية رقم (...) ينصّ على «...»" },
      { key: "effect", label: "وجه المخالفة وأثرها في منطوق الحكم — م/42", placeholder: "وضّح كيف أثّرت المخالفة في النتيجة النهائية — لو لم تقع المخالفة هل كان الحكم سيختلف؟" }
    ],
    refMaterials: [
      { article: "م/40", note: "مخالفة مبدأ قضائي = مخالفة النظام" },
      { article: "م/41", note: "لا سبب جديد لم يُبدَ في الاستئناف" },
      { article: "م/42", note: "شروط المذكرة — إلزامية" },
      { article: "م/44", note: "الرد إذا فات الموعد أو تخلّفت الشروط" },
      { article: "م/45", note: "الفصل: رفض أو نقض مع التسبيب" },
      { article: "م/46", note: "النقض لاختصاص: تعيين محكمة مختصة" },
      { article: "م/47", note: "الحكم في الموضوع: نطق علني" }
    ],
    deadline: { days: 30, label: "تاريخ تسلّم صك حكم الاستئناف", ref: "لائحة الاعتراض — يُرد لانقضاء الميعاد" },
    notes: [
      "شرطٌ مسبق — م/41: لا يُقبل في النقض سببٌ لم يُبدَ في الاستئناف وكان ممكنًا إبداؤه فيه.",
      "شروط مذكرة النقض — م/42 (إلزامية وإلا رُدّت تلقائيًّا): تحديد أسباب الاعتراض وموضعها بدقّة؛ بيان وجه المخالفة وأثرها في النتيجة؛ ما يُثبت سبق إبداء الأسباب في الاستئناف أو تعذّره.",
      "النقض ≠ الاستئناف: لا يُعيد محاكمة الوقائع، بل يقتصر على مراقبة صحّة تطبيق النظام والمبادئ القضائية."
    ]
  },
  reconsideration: {
    kind: "reconsideration",
    apiKind: "التماس إعادة نظر",
    title: "التماس إعادة النظر",
    description: "طريق اعتراضٍ غير عاديّ، مستقلٌّ عن الاستئناف والنقض، لا يُقبل إلا عند تحقّق سببٍ من أسبابه النظاميّة، ويُقدَّم لمحكمة الاستئناف التي أيّدت الحكم (م/48-59 لائحة الاعتراض).",
    reasonLabel: "حالات الالتماس المقبولة (م/200 من النظام)",
    reasonHint: "لا يُقبل الالتماس إلا عند تحقّق حالةٍ من الحالات النظاميّة الآتية.",
    reasons: [
      { label: "أ — تزوير ورقة أو شهادة زور (م/51-أ)", desc: "ثبت تزوير ورقةٍ بُني عليها الحكم أو صدر حكمٌ بأنّ الشهادة زور", ref: "لائحة الاعتراض م/51-أ" },
      { label: "ب — أوراق قاطعة تعذّر إبرازها (م/51-ب)", desc: "ظهرت أوراقٌ قاطعة في الدعوى كانت محتجزةً من الخصم أو تعذّر تقديمها", ref: "لائحة الاعتراض م/51-ب" },
      { label: "ج — غشّ من الخصم أثّر في الحكم (م/51-ج)", desc: "تبيّن أنّ الخصم استعمل طرقًا احتياليّة أدّت إلى الحكم", ref: "لائحة الاعتراض م/51-ج" },
      { label: "د — حكم بما لم يُطلب أو بأكثر مما طُلب (م/51-د)", desc: "تجاوز منطوق الحكم حدود الطلبات أو قضى بشيءٍ لم يُطلَب", ref: "لائحة الاعتراض م/51-د" },
      { label: "هـ — تناقض في منطوق الحكم (م/51-هـ)", desc: "تعارض أجزاء المنطوق بعضها مع بعض تعارضًا يتعذّر معه التنفيذ", ref: "لائحة الاعتراض م/51-هـ" },
      { label: "ز — عدم صحّة التمثيل في الدعوى (م/51-ز)", desc: "الملتمس لم يكن ممثَّلًا تمثيلًا صحيحًا في الدعوى", ref: "لائحة الاعتراض م/51-ز" },
      { label: "ح — سبب آخر مقرَّر نظامًا", desc: "أيّ سببٍ آخر من أسباب الالتماس المقرَّرة نظامًا — يُحدَّد في الوقائع أدناه", ref: "لائحة الاعتراض" }
    ],
    stages: [
      { title: "العلم بسبب الالتماس", note: "م/52 — بدء المدّة" },
      { title: "تقديم المذكرة", note: "شروط م/51" },
      { title: "فحص القبول", note: "خلال 20 يومًا (م/53)" },
      { title: "إعادة النظر", note: "رفض / نقض كلّي أو جزئي (م/59)" }
    ],
    requests: [
      "قبول الالتماس ونقض الحكم والحكم في الموضوع",
      "قبول الالتماس ونقض الحكم جزئيًّا",
      "قبول الالتماس وإعادة النظر في الدعوى مرافعةً"
    ],
    extraFields: [
      { key: "details", label: "الوقائع محلّ الالتماس وأثرها في الحكم (م/51-1)", placeholder: "حدّد الواقعة بدقّة وأثرها في الحكم — مثال: ثبت بالحكم الجزائي رقم (...) صدوره بتاريخ (...) أنّ الشاهد (فلان) حُكم عليه بشهادة الزور في هذه الدعوى، وقد بُني الحكم على تلك الشهادة…" },
      { key: "knowDate", label: "تاريخ العلم بسبب الالتماس (م/52)", placeholder: "مثال: ١٠ محرم ١٤٤٧هـ — تُحسب المدّة من تاريخ العلم لا من تاريخ الحكم" }
    ],
    refMaterials: [
      { article: "م/48", note: "تختصّ محكمة الاستئناف المؤيِّدة بنظره" },
      { article: "م/51", note: "شروط المذكرة والمرافقات الإلزامية" },
      { article: "م/53", note: "تفصل في القبول خلال 20 يومًا" },
      { article: "م/55", note: "إذا تخلّفت الشروط: عدم القبول تلقائيًّا" },
      { article: "م/58", note: "وقف التنفيذ عند قبول الالتماس" },
      { article: "م/59", note: "القضاء: رفض أو نقض كلّي أو جزئي" }
    ],
    notes: [
      "التماس إعادة النظر طريقٌ غير عاديّ، مستقلٌّ عن الاستئناف والنقض.",
      "تُحسب المدّة من تاريخ العلم بسبب الالتماس (م/52)، لا من تاريخ الحكم.",
      "يُقدَّم لمحكمة الاستئناف التي أيّدت الحكم (م/48)."
    ]
  }
};

export function PostJudgmentRemedyForm({ sessionId, remedyKind, disabled = false }: { sessionId: string; remedyKind: RemedyKind; disabled?: boolean }) {
  const config = configs[remedyKind];
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [request, setRequest] = useState<string>(config.requests[0] ?? "");
  const [notifyDate, setNotifyDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);

  // احتساب مدّة الاعتراض (القبول الشكلي) — منقول من computeAppealDeadline: تبقّى/انقضى مع الحالة.
  function deadlineStatus(): { ok: boolean; text: string } | null {
    if (!config.deadline || !notifyDate) return null;
    const start = new Date(notifyDate);
    if (Number.isNaN(start.getTime())) return null;
    const due = new Date(start);
    due.setDate(due.getDate() + config.deadline.days);
    const remaining = Math.ceil((due.getTime() - Date.now()) / 86400000);
    if (remaining >= 0) return { ok: true, text: `تبقّى ${remaining} يومًا على انتهاء ميعاد الاعتراض (المدّة ${config.deadline.days} يومًا من ${config.deadline.label}).` };
    return { ok: false, text: `انقضت مدّة الاعتراض بـ ${Math.abs(remaining)} يومًا — يُرَدّ الاعتراض شكلًا لانقضاء الميعاد (${config.deadline.ref}).` };
  }

  // 💡 اقتراح المواد المرجعيّة — يُدرج هيكلًا من مواد اللائحة وأسباب الطعن المختارة في حقل الصياغة،
  // ليبني عليه المتدرّب (منقول من زرّ الاقتراح في النسخة القديمة). المرجع النهائيّ يُؤصَّل من النواة.
  function suggestMaterials(fieldKey: string) {
    if (disabled) return;
    const chosen = config.reasons.filter((r) => selectedReasons.includes(r.label));
    const reasonLines = (chosen.length ? chosen : config.reasons.slice(0, 2)).map((r) => `• ${r.label} — ${r.ref}`);
    const materialLines = config.refMaterials.map((m) => `• ${m.article} — ${m.note}`);
    const scaffold = [
      "— المواد المرجعيّة المقترحة (إرشاديّة، تُصاغ وتُؤصَّل من النواة) —",
      ...reasonLines,
      "",
      "— مواد اللائحة ذات الصلة —",
      ...materialLines,
      "",
      "— بيان وجه المخالفة —",
      ""
    ].join("\n");
    setFields((current) => {
      const existing = current[fieldKey]?.trim();
      return { ...current, [fieldKey]: existing ? `${existing}\n\n${scaffold}` : scaffold };
    });
  }

  async function submit() {
    if (disabled) return;
    setBusy(true);
    setError("");
    setNotice("");
    setDraft("");
    try {
      const dl = deadlineStatus();
      const detailedReasons = [
        ...selectedReasons,
        ...config.extraFields.map((field) => (fields[field.key]?.trim() ? `${field.label}: ${fields[field.key]!.trim()}` : "")).filter(Boolean),
        request ? `الطلب: ${request}` : "",
        dl ? `الفصل في الشكل (مُلزم): ${dl.ok ? "قُدّم الاعتراض داخل الميعاد النظاميّ." : dl.text}` : ""
      ].filter(Boolean);
      const response = await fetch(`/api/simulations/${sessionId}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ kind: config.apiKind, reasons: detailedReasons })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر حفظ مسودة الاعتراض.");
      setDraft(payload.decision?.content ?? "");
      setNotice("تم حفظ المسودة في سجل قرارات المحاكاة.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ مسودة الاعتراض.");
    } finally {
      setBusy(false);
    }
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* المتصفّح قد يمنع النسخ */
    }
  }

  return (
    <section className="space-y-5" dir="rtl">
      {disabled ? (
        <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-5 text-center text-sm leading-7 text-[var(--navy)]">
          لا يمكن فتح مرحلة الاعتراض قبل صدور الحكم.
        </div>
      ) : null}

      <div className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--paper)] p-5 shadow-[var(--sh-xs)]">
        <p className="font-display-ar text-sm font-bold text-[var(--gold)]">مرحلة ما بعد الحكم</p>
        <h2 className="mt-1 font-judicial text-3xl font-bold text-[var(--navy)]">{config.title}</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">{config.description}</p>
      </div>

      {/* مسار المراحل الكامل (منقول من النسخة القديمة) */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory/60 p-2">
        {config.stages.map((stage, index) => (
          <div key={stage.title} className="flex flex-none items-center gap-1">
            <span className="whitespace-nowrap rounded-[var(--r-md)] bg-[var(--surface)] px-3 py-1.5 text-center text-[11px] font-semibold leading-4 text-[var(--navy)]">
              {index + 1}. {stage.title}
              {stage.note ? <span className="block text-[10px] font-normal text-[var(--ink-40)]">{stage.note}</span> : null}
            </span>
            {index < config.stages.length - 1 ? <span className="text-[var(--ink-40)]">←</span> : null}
          </div>
        ))}
      </div>

      <div className="grid w-full max-w-full gap-5 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5">
            <h3 className="font-display-ar text-lg font-bold text-[var(--navy)]">{config.reasonLabel}</h3>
            <p className="mt-1 text-xs leading-6 text-[var(--ink-60)]">{config.reasonHint}</p>
            <div className="mt-4 grid w-full max-w-full gap-3">
              {config.reasons.map((reason) => (
                <label key={reason.label} className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-start gap-3 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory/65 p-4">
                  <input
                    className="mt-1 h-5 w-5"
                    type="checkbox"
                    checked={selectedReasons.includes(reason.label)}
                    onChange={(event) => setSelectedReasons((current) => event.target.checked ? [...current, reason.label] : current.filter((item) => item !== reason.label))}
                    disabled={disabled}
                  />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="block text-sm font-semibold leading-7 text-[var(--navy)]">{reason.label}</span>
                    <span className="mt-0.5 block text-[12px] leading-6 text-[var(--ink-60)]">{reason.desc}</span>
                    <span className="mt-1 block text-[11px] font-semibold text-[var(--gold)]">المرجع النظاميّ (إرشاديّ): {reason.ref}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5">
            <h3 className="font-display-ar text-lg font-bold text-[var(--navy)]">تفاصيل الطلب</h3>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="font-display-ar text-sm font-bold text-[var(--navy)]">الطلب في هذا المسار</span>
                <select
                  className="mt-2 w-full rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--parchment)] p-3 outline-none focus:border-[var(--gold)]"
                  value={request}
                  onChange={(event) => setRequest(event.target.value)}
                  disabled={disabled}
                >
                  {config.requests.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              {config.deadline ? (
                <div className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-ivory/60 p-4">
                  <span className="font-display-ar text-sm font-bold text-[var(--navy)]">احتساب مدّة الاعتراض — القبول الشكلي</span>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <label className="min-w-[180px] flex-1">
                      <span className="block text-[11px] text-[var(--ink-60)]">{config.deadline.label}</span>
                      <input type="date" className="mt-1 w-full rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--paper)] p-2.5 outline-none focus:border-[var(--gold)]" value={notifyDate} onChange={(e) => setNotifyDate(e.target.value)} disabled={disabled} />
                    </label>
                    <span className="text-xs text-[var(--ink-60)]">المدّة: {config.deadline.days} يومًا</span>
                  </div>
                  {deadlineStatus() ? (
                    <p className={`mt-2 rounded-[var(--r-md)] px-3 py-2 text-xs font-semibold leading-6 ${deadlineStatus()!.ok ? "bg-[var(--emerald-soft)] text-[var(--emerald)]" : "bg-[var(--ruby-soft)] text-[var(--ruby)]"}`}>{deadlineStatus()!.text}</p>
                  ) : null}
                </div>
              ) : null}
              {config.extraFields.map((field, fieldIndex) => (
                <label key={field.key} className="block">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display-ar text-sm font-bold text-[var(--navy)]">{field.label}</span>
                    {fieldIndex === 0 ? (
                      <button
                        type="button"
                        onClick={() => suggestMaterials(field.key)}
                        disabled={disabled}
                        title="إدراج المواد المرجعيّة لهذا المسار كهيكلٍ للصياغة"
                        className="rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-2.5 py-1 text-[11px] font-semibold text-[var(--gold)] hover:opacity-90 disabled:opacity-50"
                      >
                        💡 اقترح المواد
                      </button>
                    ) : null}
                  </span>
                  <textarea
                    className="mt-2 min-h-[110px] w-full rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--parchment)] p-4 leading-8 outline-none focus:border-[var(--gold)]"
                    placeholder={field.placeholder}
                    value={fields[field.key] ?? ""}
                    onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
                    disabled={disabled}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        <aside className="min-w-0 space-y-4">
          {config.notes.length ? (
            <div className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-4 text-xs leading-7 text-[var(--navy)]">
              <p className="mb-1.5 font-display-ar font-bold">شروطٌ ومُهَل</p>
              <ul className="space-y-1.5">
                {config.notes.map((n, i) => <li key={i}>• {n}</li>)}
              </ul>
            </div>
          ) : null}

          <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-4">
            <p className="mb-2 font-display-ar text-sm font-bold text-[var(--navy)]">مواد اللائحة المرجعيّة</p>
            <div className="space-y-2">
              {config.refMaterials.map((m) => (
                <div key={m.article} className="text-xs leading-6 text-[var(--ink-60)]"><strong className="text-[var(--gold)]">{m.article}</strong> — {m.note}</div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-5 text-[var(--ink-40)]">المراجع إرشاديّة؛ والاستشهاد النهائيّ في المسودة يُسترجَع مؤصَّلًا من النواة.</p>
          </div>

          <button className="btn btn-gold w-full justify-center" type="button" onClick={() => void submit()} disabled={disabled || busy}>
            {busy ? "جار توليد المسودة..." : `توليد مسودة ${config.title}`}
          </button>
          {notice ? <div className="rounded-[var(--r-md)] border border-[rgba(26,92,65,.25)] bg-[var(--emerald-soft)] p-4 text-sm text-[var(--emerald)]">{notice}</div> : null}
          {error ? <div className="rounded-[var(--r-md)] border border-[rgba(140,34,51,.25)] bg-[var(--ruby-soft)] p-4 text-sm text-[var(--ruby)]">{error}</div> : null}
          {draft ? (
            <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--parchment)] p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display-ar text-base font-bold text-[var(--navy)]">المسودة المحفوظة</h3>
                <button type="button" onClick={() => void copyDraft()} className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--paper)] px-3 py-1 text-[11px] font-semibold text-[var(--ink-60)] hover:border-[var(--gold)]">{copied ? "نُسخ" : "نسخ"}</button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap font-judicial text-lg leading-9 text-[var(--ink)]">{draft}</pre>
            </div>
          ) : null}
          <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory/60 p-4">
            <p className="mb-2 text-xs font-semibold text-[var(--ink-60)]">تصدير لوائح الاعتراض</p>
            <div className="flex flex-wrap gap-2">
              <a href={`/api/simulations/${sessionId}/export?type=objection&format=pdf`} className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)] hover:border-[var(--gold)]">PDF</a>
              <a href={`/api/simulations/${sessionId}/export?type=objection&format=docx`} className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)] hover:border-[var(--gold)]">Word</a>
              <a href={`/api/simulations/${sessionId}/export?type=objection&format=html`} target="_blank" rel="noreferrer" className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)] hover:border-[var(--gold)]">HTML</a>
              <a href={`/api/simulations/${sessionId}/export?type=objection&format=txt`} className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)] hover:border-[var(--gold)]">TXT</a>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
