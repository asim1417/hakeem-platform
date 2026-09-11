import type { EntityQuery, RawObservation } from "./core";
import { StaticDueDiligenceConnector } from "./connectors";

const now = () => new Date().toISOString();

/**
 * بيانات صناعية بحتة لا تمثل شركة أو واقعة حقيقية.
 * تُستخدم فقط لعرض دورة المنتج من البحث حتى التقرير دون اختلاق نتيجة في الوضع الحي.
 */
export function buildDemoConnectors(query: EntityQuery) {
  const entityName = query.name || "شركة المثال للتقنية المحدودة";
  const cr = query.commercialRegistration || "1010123456";
  const unified = query.unifiedNumber || "7001234567";
  const city = query.city || "الرياض";
  const fetchedAt = now();

  const observations: RawObservation[] = [
    {
      sourceKey: "demo_commerce",
      sourceRecordId: "demo-commerce-1",
      entityName,
      unifiedNumber: unified,
      commercialRegistration: cr,
      city,
      category: "corporate_identity",
      title: "هوية تجارية متطابقة — بيانات تجريبية",
      summary: "مثال صناعي يوضح كيفية إثبات تطابق الاسم والرقم الموحد والسجل التجاري.",
      sourceUrl: "https://example.com/hakeem-demo/commerce",
      fetchedAt,
      raw: { demo: true, status: "ACTIVE", activity: "تقنية المعلومات" },
    },
    {
      sourceKey: "demo_ip",
      sourceRecordId: "demo-ip-1",
      entityName,
      commercialRegistration: cr,
      city,
      category: "trademark",
      title: "علامة تجارية مسجلة — بيانات تجريبية",
      summary: "علامة صناعية لأغراض العرض فقط؛ لا تمثل تسجيلًا حقيقيًا لدى الهيئة.",
      sourceUrl: "https://example.com/hakeem-demo/ip/1",
      fetchedAt,
      occurredAt: "2025-06-01T00:00:00.000Z",
      raw: { demo: true, mark: "HAKEEM DEMO", class: "42", status: "REGISTERED" },
    },
    {
      sourceKey: "demo_ip",
      sourceRecordId: "demo-ip-2",
      entityName,
      commercialRegistration: cr,
      city,
      category: "trademark",
      title: "طلب علامة قيد الفحص — بيانات تجريبية",
      summary: "مثال صناعي لإظهار أكثر من أصل ملكية فكرية مرتبط بالكيان.",
      sourceUrl: "https://example.com/hakeem-demo/ip/2",
      fetchedAt,
      occurredAt: "2026-03-15T00:00:00.000Z",
      raw: { demo: true, mark: "AMAN DEMO", class: "45", status: "PENDING" },
    },
    {
      sourceKey: "demo_bankruptcy",
      sourceRecordId: "demo-bankruptcy-1",
      entityName,
      commercialRegistration: cr,
      city,
      category: "bankruptcy",
      title: "واقعة إفلاس منشورة — بيانات تجريبية",
      summary: "واقعة صناعية لا تخص أي شركة حقيقية، أضيفت فقط لإظهار أثر الدليل على Risk Score.",
      sourceUrl: "https://example.com/hakeem-demo/bankruptcy",
      fetchedAt,
      occurredAt: "2026-01-10T00:00:00.000Z",
      raw: { demo: true, procedure: "REORGANIZATION" },
    },
    {
      sourceKey: "demo_regulatory",
      sourceRecordId: "demo-reg-1",
      entityName,
      commercialRegistration: cr,
      city,
      category: "license_issue",
      title: "ملاحظة على ترخيص — بيانات تجريبية",
      summary: "مثال صناعي يوضح كيف تعرض المنصة ملاحظة تنظيمية مع مصدرها ودرجة تطابقها.",
      sourceUrl: "https://example.com/hakeem-demo/regulatory",
      fetchedAt,
      occurredAt: "2026-02-20T00:00:00.000Z",
      raw: { demo: true, status: "REVIEW_REQUIRED" },
    },
    {
      sourceKey: "demo_bankruptcy",
      sourceRecordId: "demo-conflict-1",
      entityName,
      commercialRegistration: "9999999999",
      city,
      category: "bankruptcy",
      title: "نتيجة متشابهة الاسم مستبعدة — بيانات تجريبية",
      summary: "تظهر في المستبعدات لأن رقم السجل مختلف، ولا تدخل في درجة المخاطر.",
      sourceUrl: "https://example.com/hakeem-demo/conflict",
      fetchedAt,
      raw: { demo: true, reason: "CR_CONFLICT" },
    },
  ];

  const bySource = new Map<string, RawObservation[]>();
  for (const item of observations) {
    const current = bySource.get(item.sourceKey) ?? [];
    current.push(item);
    bySource.set(item.sourceKey, current);
  }

  const sourceDefinitions = [
    { key: "demo_commerce", nameAr: "هوية المنشأة — تجريبي", authority: "بيانات حكيم الصناعية", accessType: "MANUAL" as const },
    { key: "demo_ip", nameAr: "الملكية الفكرية — تجريبي", authority: "بيانات حكيم الصناعية", accessType: "MANUAL" as const },
    { key: "demo_bankruptcy", nameAr: "الإفلاس — تجريبي", authority: "بيانات حكيم الصناعية", accessType: "MANUAL" as const },
    { key: "demo_regulatory", nameAr: "التراخيص والتنظيم — تجريبي", authority: "بيانات حكيم الصناعية", accessType: "MANUAL" as const },
  ];

  return sourceDefinitions.map(
    (source) =>
      new StaticDueDiligenceConnector(
        { ...source, status: "APPROVED", reliability: 0.5 },
        bySource.get(source.key) ?? []
      )
  );
}
