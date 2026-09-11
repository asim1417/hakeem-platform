import { createHash } from 'node:crypto';

/**
 * بصمة نص الوحدة — أساس فحص التقادم وكشف التغيير الصامت في المصدر.
 *
 * مبدأ حاكم: التطبيع للبصمة يزيل ما لا يُرى فقط (محارف الاتجاه، الصفرية، التطويل، تكرار الفراغ).
 * ولا يُزال التشكيل ولا يُوحَّد رسم الهمزة؛ لأن تغييرهما في المصدر تغييرٌ في النص المنشور،
 * وهو بالضبط ما نريد كشفه لا إخفاءه.
 */

const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const TATWEEL = /\u0640/g;

export function normalizeForHash(text: string): string {
  return text
    .normalize('NFC')
    .replace(INVISIBLE, '')
    .replace(TATWEEL, '')
    .replace(/[ \t\u00A0]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

export function contentHash(text: string): string {
  return createHash('sha256').update(normalizeForHash(text), 'utf8').digest('hex').slice(0, 32);
}

/** يقارن بصمتين ويعيد هل تغيّر النص فعلًا */
export function hasChanged(previousHash: string, currentText: string): boolean {
  return previousHash !== contentHash(currentText);
}
