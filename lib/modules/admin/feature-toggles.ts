/**
 * إدارة FeatureToggle القائمة — بلا جداول جديدة.
 * تُستخدم لإظهار/إخفاء واجهات الخدمات دون تعطيل المحركات الخلفية.
 */
import "server-only";

import { prisma } from "@/lib/prisma";

export type ManagedToggle = {
  key: string;
  enabled: boolean;
  label: string;
  description: string;
  /** إن true: الراية تُخفي الواجهة فقط ولا توقف الخدمة الخلفية */
  uiOnly: boolean;
};

/** كتالوج معروف — يُنشأ في القاعدة عند أول قراءة إن غاب. */
export const TOGGLE_CATALOG: Array<Omit<ManagedToggle, "enabled">> = [
  {
    key: "ui.traditional_search",
    label: "واجهات البحث التقليدي",
    description: "إظهار/إخفاء واجهات البحث النصي من القائمة — المحرك الخلفي يبقى لخدمات الذكاء.",
    uiOnly: true,
  },
  {
    key: "ui.agents_nav",
    label: "قسم الوكلاء المتخصصين",
    description: "إظهار رابط الوكلاء في القائمة الجانبية.",
    uiOnly: true,
  },
  {
    key: "ui.documents_nav",
    label: "منصة المستندات",
    description: "إظهار رابط منصة المستندات في القائمة.",
    uiOnly: true,
  },
  {
    key: "ui.simulations_nav",
    label: "المحاكاة القضائية",
    description: "إظهار رابط المحاكاة في القائمة — دون إيقاف خدمة المحاكاة.",
    uiOnly: true,
  },
  {
    key: "ui.registration_open",
    label: "التسجيل العام",
    description: "إشارة تشغيلية لفتح/إغلاق دعوة التسجيل في الواجهة (المصادقة عبر Clerk).",
    uiOnly: true,
  },
  {
    key: "ui.responsive_ux_v2",
    label: "توافق الجوال والتنقل الموحّد",
    description:
      "أزرار رجوع/لوحة ومسار ملاحي محسّن. الإيقاف الطارئ أيضًا عبر RESPONSIVE_UX_V2=0 — لا يوقف الخدمات.",
    uiOnly: true,
  },
];

const DEFAULT_ENABLED: Record<string, boolean> = {
  "ui.traditional_search": false,
  "ui.agents_nav": true,
  "ui.documents_nav": true,
  "ui.simulations_nav": true,
  "ui.registration_open": true,
  "ui.responsive_ux_v2": true,
};

export async function ensureFeatureToggleDefaults(): Promise<void> {
  for (const item of TOGGLE_CATALOG) {
    await prisma.featureToggle
      .upsert({
        where: { key: item.key },
        create: { key: item.key, enabled: DEFAULT_ENABLED[item.key] ?? false },
        update: {},
      })
      .catch(() => undefined);
  }
}

export async function listFeatureToggles(): Promise<ManagedToggle[]> {
  await ensureFeatureToggleDefaults();
  const rows = await prisma.featureToggle.findMany({
    where: { key: { in: TOGGLE_CATALOG.map((t) => t.key) } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.enabled]));
  return TOGGLE_CATALOG.map((t) => ({
    ...t,
    enabled: byKey.get(t.key) ?? DEFAULT_ENABLED[t.key] ?? false,
  }));
}

export async function setFeatureToggle(key: string, enabled: boolean): Promise<ManagedToggle | null> {
  const meta = TOGGLE_CATALOG.find((t) => t.key === key);
  if (!meta) return null;
  const row = await prisma.featureToggle.upsert({
    where: { key },
    create: { key, enabled },
    update: { enabled },
  });
  return { ...meta, enabled: row.enabled };
}

export async function isFeatureEnabled(key: string, fallback = false): Promise<boolean> {
  try {
    const row = await prisma.featureToggle.findUnique({ where: { key }, select: { enabled: true } });
    if (!row) return DEFAULT_ENABLED[key] ?? fallback;
    return row.enabled;
  } catch {
    return DEFAULT_ENABLED[key] ?? fallback;
  }
}
