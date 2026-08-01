// مسجّل بنيويّ خفيف — المخطط السيادي §23. سطرٌ JSON لكل حدث مع correlationId اختياريّ.
// لا يستبدل console الحاليّ؛ يوفّر مسارًا بنيويًّا للأحداث المهمّة.

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  correlationId?: string;
  [key: string]: unknown;
}

/** يبني سطر سجلّ بنيويّ. ts يُمرَّر من المستدعي لتفادي Date.now في النواة النقيّة. */
export function structuredLog(level: LogLevel, message: string, ts: string, fields: LogFields = {}): string {
  return JSON.stringify({ level, message, ts, ...fields });
}

/** يكتب السطر إلى console بالمستوى المناسب. */
export function emitLog(level: LogLevel, message: string, ts: string, fields: LogFields = {}): void {
  const line = structuredLog(level, message, ts, fields);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
