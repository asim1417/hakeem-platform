import type { HijriGregorianDate, InstrumentMetadata } from "../types";
import { normalizeForCompare } from "./arabic";
import { easternToWesternDigits } from "./numbers";

const HIJRI_DATE = /([0-9٠-٩۰-۹]{1,2})\s*[\/\-]\s*([0-9٠-٩۰-۹]{1,2})\s*[\/\-]\s*([0-9٠-٩۰-۹]{3,4})\s*هـ?/u;
const GREGORIAN_DATE = /([0-9٠-٩۰-۹]{1,2})\s*[\/\-]\s*([0-9٠-٩۰-۹]{1,2})\s*[\/\-]\s*([0-9٠-٩۰-۹]{4})\s*م?/u;
const ISO_DATE = /([12][0-9]{3})-([01][0-9])-([0-3][0-9])/u;

const MONTHS_AR: Record<string, number> = {
  يناير: 1,
  فبراير: 2,
  مارس: 3,
  ابريل: 4,
  أبريل: 4,
  مايو: 5,
  يونيو: 6,
  يونيه: 6,
  يوليو: 7,
  يوليه: 7,
  اغسطس: 8,
  أغسطس: 8,
  سبتمبر: 9,
  اكتوبر: 10,
  أكتوبر: 10,
  نوفمبر: 11,
  ديسمبر: 12
};

function pad2(value: string): string {
  return value.padStart(2, "0");
}

function normalizeDateParts(day: string, month: string, year: string): string {
  return `${pad2(easternToWesternDigits(day))}/${pad2(easternToWesternDigits(month))}/${easternToWesternDigits(year)}`;
}

function dateFromDmy(day: string, month: string, year: string): Date | undefined {
  const westernDay = Number(easternToWesternDigits(day));
  const westernMonth = Number(easternToWesternDigits(month));
  const westernYear = Number(easternToWesternDigits(year));
  if (!westernDay || !westernMonth || !westernYear || westernMonth > 12 || westernDay > 31) return undefined;
  return new Date(Date.UTC(westernYear, westernMonth - 1, westernDay));
}

export function parseHijriGregorianDate(text: string): HijriGregorianDate | undefined {
  const normalized = easternToWesternDigits(text);
  const iso = normalized.match(ISO_DATE);
  if (iso) {
    return { raw: iso[0], gregorian: iso[0], date: new Date(`${iso[0]}T00:00:00.000Z`) };
  }

  const hijriMatches = [...normalized.matchAll(new RegExp(HIJRI_DATE.source, "gu"))];
  const gregorianMatches = [...normalized.matchAll(new RegExp(GREGORIAN_DATE.source, "gu"))];
  const hijri = hijriMatches.find((match) => /هـ|ه/.test(match[0]));
  const gregorian = gregorianMatches.find((match) => /م/.test(match[0])) ?? gregorianMatches.find((match) => match[3]?.length === 4);

  const monthName = normalized.match(/([0-9]{1,2})\s+([\u0621-\u064A]+)\s+([12][0-9]{3})/u);
  if (!gregorian && monthName) {
    const month = MONTHS_AR[monthName[2] ?? ""];
    if (month) {
      const date = dateFromDmy(monthName[1] ?? "", String(month), monthName[3] ?? "");
      return {
        raw: monthName[0],
        gregorian: `${pad2(monthName[1] ?? "")}/${pad2(String(month))}/${monthName[3] ?? ""}`,
        date
      };
    }
  }

  if (!hijri && !gregorian) return undefined;

  return {
    raw: [hijri?.[0], gregorian?.[0]].filter(Boolean).join(" / "),
    hijri: hijri ? normalizeDateParts(hijri[1] ?? "", hijri[2] ?? "", hijri[3] ?? "") : undefined,
    gregorian: gregorian ? normalizeDateParts(gregorian[1] ?? "", gregorian[2] ?? "", gregorian[3] ?? "") : undefined,
    date: gregorian ? dateFromDmy(gregorian[1] ?? "", gregorian[2] ?? "", gregorian[3] ?? "") : undefined
  };
}

export function normalizeInstrumentNumber(value: string): string {
  const normalized = easternToWesternDigits(value)
    .replace(/رقم/gu, "")
    .replace(/\s+/g, "")
    .replace(/[\\-]+/g, "/")
    .replace(/م(?=[0-9])/u, "م/")
    .replace(/\/+/g, "/")
    .trim();

  return normalized.replace(/^م\/?([0-9]+)$/u, "م/$1");
}

export function extractInstrument(text: string): InstrumentMetadata | undefined {
  const normalized = easternToWesternDigits(text);
  const instrumentPattern =
    /(مرسوم\s+ملكي|أمر\s+ملكي|قرار\s+مجلس\s+الوزراء|قرار\s+وزاري|قرار)\s*(?:رقم)?\s*([أ-يA-Za-z]?\s*\/?\s*[0-9]+(?:\s*\/\s*[0-9]+)?)?(?:\s*(?:و)?\s*تاريخ\s*([^،.\n]+))?/u;
  const match = normalized.match(instrumentPattern);
  if (!match) return undefined;

  const type = match[1]?.trim();
  const number = match[2]?.trim();
  const dateRaw = match[3]?.trim();
  const parsedDate = dateRaw ? parseHijriGregorianDate(dateRaw) : undefined;

  return {
    type,
    number,
    normalizedNumber: number ? normalizeInstrumentNumber(number) : undefined,
    dateRaw,
    dateHijri: parsedDate?.hijri,
    dateGregorian: parsedDate?.gregorian
  };
}

export function normalizeDateForIdentity(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = parseHijriGregorianDate(value);
  return parsed?.gregorian ?? parsed?.hijri ?? normalizeForCompare(value);
}
