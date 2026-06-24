import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, translate, type Locale } from "./dictionaries";

/** اللغة الحالية من الكوكي (تقع على العربية افتراضيًا). */
export function getLocale(): Locale {
  const raw = cookies().get(LOCALE_COOKIE)?.value as Locale | undefined;
  return raw && LOCALES.includes(raw) ? raw : DEFAULT_LOCALE;
}

/** مترجم جاهز للاستخدام في مكوّنات الخادم. */
export function getTranslator(): { locale: Locale; t: (key: string) => string } {
  const locale = getLocale();
  return { locale, t: (key: string) => translate(locale, key) };
}
