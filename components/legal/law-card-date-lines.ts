// سطرا «تاريخ الإصدار» و«تاريخ النشر» في بطاقة النظام (LawCardPanel، صفحة /legal/<slug>). نقي، مختبر في
// scripts/test-law-card-dates.ts. HKM-063: تاريخ البطاقة النائب (1 محرم، أو 1440/03/21 رفع الهيئة) مجهول فلا يُعرض.
// HKM-064: والإصدار المجهول (أو بلا بطاقة) يسقط إلى مصادر صفحة /law نفسها (pickIssuedDate): وحدات المقدمة ← legal_system_issuance.
import { cardDatePlaceholders, pickIssuedDate, type CardDates, type IssuedDateFallbacks } from "../../lib/modules/legal-core/law-card-dates";

/**
 * «1443/05/26 هـ الموافق: 30/12/2021 م»، أو null إن لم يوجد التاريخان.
 * HKM-064: الهجري من legal_system_issuance يأتي بـ«هـ» ملصقة («16/3/1444هـ»)؛ تُحذف قبل إضافتها فلا تتكرر.
 */
export function dateLine(hijri: string | null, gregorian: string | null): string | null {
  if (!hijri && !gregorian) return null;
  const g = gregorian ? gregorian.split("-").reverse().join("/") : null;
  const h = hijri ? hijri.trim().replace(/\s*هـ$/, "") : null;
  return [h ? `${h} هـ` : null, g ? `الموافق: ${g} م` : null].filter(Boolean).join(" ");
}

/** السطران المعروضان؛ null = لا يُعرض الصف (غائب أو نائب بلا مصدر تالٍ). fallbacks: مصادر الإصدار بعد البطاقة. */
export function lawCardDateLines(card: CardDates | null | undefined, fallbacks?: IssuedDateFallbacks | null): { issued: string | null; published: string | null } {
  const issued = pickIssuedDate(card, fallbacks);
  return {
    issued: issued.source ? dateLine(issued.hijri, issued.gregorian) : null,
    published: card && !cardDatePlaceholders(card).published ? dateLine(card.publishedHijri, card.publishedGregorian) : null,
  };
}

/** هل يلزم قراءة مصادر الإصدار التالية؟ (لا بطاقة، أو تاريخ إصدارها نائب أو غائب) */
export function needsIssuedFallback(card: CardDates | null | undefined): boolean {
  return pickIssuedDate(card, null).source === null;
}
