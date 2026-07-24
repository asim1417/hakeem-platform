import { notFound } from "next/navigation";
import { isBuiltinPageEnabled } from "@/lib/modules/site/site-store";
import type { BuiltinPageKey } from "@/lib/modules/site/defaults";

/** إيقاف صفحة عامة مدمجة دون كسر المسارات الأخرى. */
export async function assertBuiltinPageEnabled(key: BuiltinPageKey): Promise<void> {
  const enabled = await isBuiltinPageEnabled(key);
  if (!enabled) notFound();
}
