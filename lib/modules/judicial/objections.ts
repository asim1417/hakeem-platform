// ─────────────────────────────────────────────────────────────────────────────
// §20 — بُناة الاعتراضات القضائيّة (Judicial Objection Builders)
//
// يبني هيكل لائحة الاعتراض حسب الطريق (استئناف/نقض/التماس إعادة النظر/منازعة تنفيذ):
// العناصر الشكليّة اللازمة + مدوّنة الأسباب المتاحة لذلك الطريق + فحص عدم خلط المصطلح.
// نقيّ وحتميّ (بلا نموذج): يُنتج قائمةَ التحقّق والهيكل — ويُفوّض النصّ للتوليد المؤصَّل.
// لا يختلق: العنصر غير المتوفّر يُعلَّم «ناقص»، ولا يُزعَم اكتمالُ لائحةٍ ناقصة.
// ─────────────────────────────────────────────────────────────────────────────

export type ObjectionRoute = "APPEAL" | "CASSATION" | "RECONSIDERATION" | "EXECUTION_DISPUTE";

export interface ObjectionRouteSpec {
  route: ObjectionRoute;
  labelAr: string;
  /** المصطلح الصحيح لفعل الاعتراض في هذا الطريق. */
  canonicalTermAr: string;
  /** مصطلحات الطرق الأخرى التي يُمنع خلطها (JG14). */
  foreignTermsAr: string[];
  /** العناصر الشكليّة اللازمة لصحّة اللائحة. */
  requiredElementsAr: string[];
  /** مدوّنة الأسباب المتاحة لهذا الطريق (لا تُلصَق كلّها — تُختار وتُؤصَّل). */
  groundsCatalogAr: string[];
}

const ROUTE_SPECS: Record<ObjectionRoute, ObjectionRouteSpec> = {
  APPEAL: {
    route: "APPEAL",
    labelAr: "استئناف",
    canonicalTermAr: "نستأنف",
    foreignTermsAr: ["نقض", "التماس إعادة النظر", "منازعة تنفيذ"],
    requiredElementsAr: [
      "بيانات الحكم المستأنَف (المحكمة، الدائرة، رقم القضية)",
      "تاريخ الحكم وتاريخ التبليغ",
      "إثبات وقوع الاستئناف داخل الميعاد النظاميّ",
      "أسباب الاعتراض (وقائع/تطبيق نظام)",
      "الطلبات الختاميّة (نقض الحكم/تعديله)",
    ],
    groundsCatalogAr: [
      "خطأ في تطبيق النظام أو تأويله",
      "مخالفة الثابت في الأوراق",
      "قصور في التسبيب",
      "إغفال دفعٍ جوهريّ",
      "خطأ في تقدير الأدلّة",
    ],
  },
  CASSATION: {
    route: "CASSATION",
    labelAr: "نقض",
    canonicalTermAr: "نلتمس نقض",
    foreignTermsAr: ["استئناف", "التماس إعادة النظر", "منازعة تنفيذ"],
    requiredElementsAr: [
      "بيانات الحكم المطعون فيه بالنقض",
      "تاريخ الحكم الاستئنافيّ وتاريخ التبليغ",
      "إثبات وقوع الطعن داخل ميعاد النقض",
      "أسباب النقض (مخالفة نظام/خطأ في التكييف/إخلال بحقّ الدفاع)",
      "الطلبات (نقض الحكم والإحالة أو الفصل)",
    ],
    groundsCatalogAr: [
      "مخالفة نصٍّ نظاميّ أو الخطأ في تطبيقه",
      "الخطأ في التكييف القانونيّ للواقعة",
      "الإخلال بحقّ الدفاع",
      "التناقض في الأسباب أو بين الأسباب والمنطوق",
      "الفصل في نزاعٍ خلافًا لحكمٍ سابقٍ حاز القطعيّة",
    ],
  },
  RECONSIDERATION: {
    route: "RECONSIDERATION",
    labelAr: "التماس إعادة النظر",
    canonicalTermAr: "نلتمس إعادة النظر",
    foreignTermsAr: ["استئناف", "نقض", "منازعة تنفيذ"],
    requiredElementsAr: [
      "بيانات الحكم الملتمَس إعادة النظر فيه",
      "تاريخ العلم بسبب الالتماس",
      "بيان سبب الالتماس النظاميّ (من أسبابٍ محدّدة حصرًا)",
      "ما يثبت توافر السبب (مستند/واقعة طارئة)",
      "الطلبات (إعادة النظر والحكم من جديد)",
    ],
    groundsCatalogAr: [
      "ظهور مستنداتٍ قاطعةٍ احتُجزت",
      "بناء الحكم على أوراقٍ ثبت تزويرها",
      "بناء الحكم على شهادةٍ قُضي بكذبها",
      "وقوع غشٍّ أثّر في الحكم",
      "القضاء بما لم يطلبه الخصوم أو بأكثر ممّا طلبوا",
    ],
  },
  EXECUTION_DISPUTE: {
    route: "EXECUTION_DISPUTE",
    labelAr: "منازعة تنفيذ",
    canonicalTermAr: "ننازع في التنفيذ",
    foreignTermsAr: ["استئناف", "نقض", "التماس إعادة النظر"],
    requiredElementsAr: [
      "بيانات السند التنفيذيّ وقاضي التنفيذ",
      "بيان إجراء التنفيذ المتنازَع فيه",
      "سبب المنازعة (موضوعيّ/إجرائيّ)",
      "ما يثبت المنازعة",
      "الطلبات (وقف التنفيذ/بطلان الإجراء)",
    ],
    groundsCatalogAr: [
      "انقضاء الحقّ الثابت بالسند (وفاء/إبراء/مقاصّة)",
      "بطلان إجراء التنفيذ لمخالفة النظام",
      "عدم قابليّة السند للتنفيذ الجبريّ",
      "منازعةٌ في مقدار المنفَّذ به",
      "الحجز على مالٍ لا يجوز الحجز عليه",
    ],
  },
};

export interface BuildObjectionInput {
  route: ObjectionRoute;
  /** عناصر متوفّرة فعلًا (نصوصٌ حرّة تُطابَق مع العناصر اللازمة). */
  providedElements?: string[];
  /** أسبابٌ اختارها المحامي (تُطابَق مع مدوّنة الطريق؛ خارجها يُعلَّم غير قياسيّ). */
  selectedGrounds?: string[];
  /** نصّ مسودّةٍ (اختياريّ) لفحص عدم خلط مصطلح الطريق (JG14). */
  draftText?: string;
}

export interface ObjectionElementCheck {
  elementAr: string;
  present: boolean;
}

export interface JudicialObjectionScaffold {
  route: ObjectionRoute;
  labelAr: string;
  canonicalTermAr: string;
  elements: ObjectionElementCheck[];
  missingElements: string[];
  /** الأسباب المطابِقة للمدوّنة. */
  recognizedGrounds: string[];
  /** الأسباب خارج المدوّنة — تحتاج تأصيلًا/مراجعة (لا تُعتمد آليًّا). */
  nonStandardGrounds: string[];
  /** مصطلحات طرقٍ أخرى ظهرت في المسودّة (خلط JG14) — يجب إزالتها. */
  routeTermConflicts: string[];
  /** جاهزٌ للإيداع؟ لا عناصر ناقصة ولا خلط مصطلح، وسببٌ معترَفٌ به واحدٌ على الأقلّ. */
  readyToFile: boolean;
}

function norm(s: string): string {
  return s.replace(/[ًٌٍَُِّْ]/g, "").replace(/[إأآ]/g, "ا").replace(/\s+/g, " ").trim();
}

/** يعيد مواصفة الطريق (للعرض/الاختبار). */
export function objectionRouteSpec(route: ObjectionRoute): ObjectionRouteSpec {
  return ROUTE_SPECS[route];
}

/**
 * §20 — يبني هيكل لائحة الاعتراض: يتحقّق من العناصر الشكليّة، ويصنّف الأسباب،
 * ويرصد خلط مصطلح الطريق. لا يكتب النصّ — يُنتج قائمةَ التحقّق للتوليد المؤصَّل.
 */
export function buildObjection(input: BuildObjectionInput): JudicialObjectionScaffold {
  const spec = ROUTE_SPECS[input.route];
  const provided = (input.providedElements ?? []).map(norm);
  const elements: ObjectionElementCheck[] = spec.requiredElementsAr.map((el) => {
    // العنصر متوفّر إن طابق أحدَ المدخلات بكلمةٍ مفتاحيّةٍ من عنوانه.
    const key = norm(el).split(" ").slice(0, 3).join(" ");
    const present = provided.some((p) => p.includes(key) || key.includes(p));
    return { elementAr: el, present };
  });
  const missingElements = elements.filter((e) => !e.present).map((e) => e.elementAr);

  const selected = input.selectedGrounds ?? [];
  const recognizedGrounds = selected.filter((g) =>
    spec.groundsCatalogAr.some((c) => norm(c).includes(norm(g)) || norm(g).includes(norm(c))),
  );
  const nonStandardGrounds = selected.filter((g) => !recognizedGrounds.includes(g));

  const text = input.draftText ?? "";
  const routeTermConflicts = spec.foreignTermsAr.filter((t) => text.includes(t));

  const readyToFile =
    missingElements.length === 0 && routeTermConflicts.length === 0 && recognizedGrounds.length >= 1;

  return {
    route: spec.route,
    labelAr: spec.labelAr,
    canonicalTermAr: spec.canonicalTermAr,
    elements,
    missingElements,
    recognizedGrounds,
    nonStandardGrounds,
    routeTermConflicts,
    readyToFile,
  };
}
