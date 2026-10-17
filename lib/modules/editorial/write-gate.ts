import { EditorialError } from "./types";

/**
 * بوابة الكتابة: بيئة Preview تستعمل قاعدة الإنتاج نفسها، فكل كتابة من اللوحة مقفلة
 * حتى يضبط المالك EDITORIAL_DESK_WRITE=1 بنفسه. غيابه = اللوحة للقراءة فقط.
 */
export function isEditorialWriteEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.EDITORIAL_DESK_WRITE === "1";
}

export const READ_ONLY_MESSAGE = "اللوحة للقراءة فقط: الكتابة مقفلة حتى يفعّلها المالك (EDITORIAL_DESK_WRITE).";

export function assertEditorialWriteEnabled(): void {
  if (!isEditorialWriteEnabled()) {
    throw new EditorialError("WRITE_DISABLED", READ_ONLY_MESSAGE);
  }
}
