/**
 * اقتراحات إجراءات مساندة مرتبطة بسياق السؤال — لا تُنفَّذ تلقائيًا.
 */

export type AskNextAction = {
  id: string;
  label: string;
  href?: string;
  kind: "link" | "case" | "workspace" | "library" | "space" | "documents";
};

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n));
}

export function suggestAskNextActions(question: string, answer: string | null): AskNextAction[] {
  const blob = `${question}\n${answer ?? ""}`.toLowerCase();
  const ar = `${question}\n${answer ?? ""}`;
  const actions: AskNextAction[] = [];

  actions.push({
    id: "case",
    label: "تحويل هذه المحادثة إلى قضية",
    kind: "case",
  });

  if (
    hasAny(ar, ["مستند", "عقد", "لائحة", "مذكرة", "وثيق", "مرفق"]) ||
    hasAny(blob, ["document", "contract"])
  ) {
    actions.push({
      id: "docs",
      label: "إرفاق مستند",
      href: "/documents",
      kind: "documents",
    });
  }

  if (
    hasAny(ar, ["مادة", "نظام", "لائحة", "نص", "بحث", "مصدر"]) ||
    hasAny(blob, ["article", "statute"])
  ) {
    actions.push({
      id: "library",
      label: "متابعة البحث في المكتبة",
      href: "/dashboard/legal-core",
      kind: "library",
    });
  }

  actions.push({
    id: "workspace",
    label: "فتح مساحة العمل الكاملة",
    kind: "workspace",
  });

  actions.push({
    id: "assistant",
    label: "فتح المعاون القضائي",
    href: "/dashboard/judicial-assistant",
    kind: "link",
  });

  actions.push({
    id: "space",
    label: "حفظ في مساحتي",
    href: "/dashboard/files",
    kind: "space",
  });

  // حد أقصى معقول في الواجهة
  return actions.slice(0, 4);
}
