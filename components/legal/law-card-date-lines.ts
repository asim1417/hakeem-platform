// سطرا «تاريخ الإصدار» و«تاريخ النشر» في بطاقة النظام (LawCardPanel، صفحة /legal/<slug>). نقي، مختبر في
// scripts/test-law-card-dates.ts. HKM-063: تاريخ البطاقة النائب (1 محرم، أو 1440/03/21 رفع الهيئة) مجهول فلا يُعرض.
import { cardDatePlaceholders, type CardDates } from "../../lib/modules/legal-core/law-card-dates";

/** «1443/05/26 هـ الموافق: 30/12/2021 م»، أو null إن لم يوجد التاريخان. */
export function dateLine(hijri: string | null, gregorian: string | null): string | null {
  if (!hijri && !gregorian) return null;
  const g = gregorian ? gregorian.split("-").reverse().join("/") : null;
  return [hijri ? `${hijri} هـ` : null, g ? `الموافق: ${g} م` : null].filter(Boolean).join(" ");
}

/** السطران المعروضان من البطاقة؛ null = لا يُعرض الصف (غائب أو نائب). */
export function lawCardDateLines(card: CardDates | null | undefined): { issued: string | null; published: string | null } {
  if (!card) return { issued: null, published: null };
  const placeholder = cardDatePlaceholders(card);
  return {
    issued: placeholder.issued ? null : dateLine(card.issuedHijri, card.issuedGregorian),
    published: placeholder.published ? null : dateLine(card.publishedHijri, card.publishedGregorian),
  };
}
