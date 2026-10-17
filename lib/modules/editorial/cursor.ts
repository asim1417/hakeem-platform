// مؤشر الترقيم بالمفتاح (ق٢٦): مفتاح ترتيب آخر عنصر معروض، مرمّزًا base64url.
// الصفحة التالية تبدأ بعد هذا المفتاح، فلا يُتخطى عنصر حين تخرج عناصر مقررة من القائمة بلا تحديث.
import { EditorialError } from "./types";

export type CursorKey = Array<string | number | boolean>;

export function encodeCursor(key: CursorKey): string {
  return Buffer.from(JSON.stringify(key), "utf8").toString("base64url");
}

/** يفك المؤشر ويتحقق من شكله (الأنواع بالترتيب)؛ غير الصالح = INVALID_INPUT. */
export type CursorSlot = "string" | "number" | "integer" | "boolean";

export function decodeCursor(raw: string, shape: ReadonlyArray<CursorSlot>): CursorKey {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    throw new EditorialError("INVALID_INPUT", "مؤشر الصفحة غير صالح.");
  }
  // «integer» يُمرَّر إلى ::int في SQL؛ الكسر أو الرقم الكبير يُرفض هنا (400) لا هناك (500).
  const fits = (v: unknown, slot: CursorSlot) =>
    slot === "integer" ? Number.isSafeInteger(v) && Math.abs(v as number) <= 2_147_483_647 : typeof v === slot;
  if (!Array.isArray(parsed) || parsed.length !== shape.length || parsed.some((v, i) => !fits(v, shape[i]))) {
    throw new EditorialError("INVALID_INPUT", "مؤشر الصفحة غير صالح.");
  }
  if (parsed.some((v) => typeof v === "number" && !Number.isFinite(v))) throw new EditorialError("INVALID_INPUT", "مؤشر الصفحة غير صالح.");
  return parsed as CursorKey;
}
