// حراسة طلبات مسارات المكتب (ق-١٠): دوال نقية بلا Next ولا Prisma، تُختبر بلا خادم.
import { EditorialError } from "./types";

/** حد جسم الطلب لكل مسارات المكتب: 64 ك.ب. أكبر حمولة مشروعة (دفعة 50 تغييرًا بسندها) دونه بكثير. */
export const MAX_BODY_BYTES = 64 * 1024;

export const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * طلب الكتابة يُقبل إن جاء من أصل التطبيق نفسه: ترويسة Origin تساوي أصل الطلب،
 * أو مضيفها هو مضيف الطلب نفسه (Host أو X-Forwarded-Host خلف نطاق Vercel المخصص).
 * غياب Origin رفض: المتصفحات ترسلها في كل POST، وغيابها يعني عميلًا غير المتصفح أو طلبًا مزوّرًا.
 */
export function isSameOriginWrite(input: {
  origin: string | null;
  requestOrigin: string;
  host: string | null;
  forwardedHost: string | null;
}): boolean {
  const originHost = hostOf(input.origin);
  if (!originHost) return false;
  if (originHost === hostOf(input.requestOrigin)) return true;
  const hosts = [input.forwardedHost, input.host]
    .flatMap((h) => (h ? h.split(",") : []))
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return hosts.includes(originHost);
}

/** رفض مبكر بترويسة الطول قبل قراءة الجسم. */
export function assertContentLength(header: string | null): void {
  if (header === null || header === "") return;
  const length = Number(header);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    throw new EditorialError("PAYLOAD_TOO_LARGE", "حجم الطلب أكبر من المسموح (64 ك.ب).", { maxBytes: MAX_BODY_BYTES });
  }
}

/** يحلّل نص الجسم بعد قياس طوله الفعلي بالبايت (الترويسة قد تغيب أو تكذب). الجسم الفارغ = null. */
export function parseBodyText(text: string): unknown {
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    throw new EditorialError("PAYLOAD_TOO_LARGE", "حجم الطلب أكبر من المسموح (64 ك.ب).", { maxBytes: MAX_BODY_BYTES });
  }
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new EditorialError("INVALID_INPUT", "جسم الطلب ليس JSON صالحًا.");
  }
}

export interface DeskPreflightInput {
  authDisabled: boolean;
  method: string;
  origin: string | null;
  requestOrigin: string;
  host: string | null;
  forwardedHost: string | null;
  contentLength: string | null;
}

/**
 * الفحص الأول لكل طلب إلى /api/admin/legal قبل قراءة المستخدم (ق-١٠):
 * المصادقة المعطّلة ترفض المكتب كله (الضيف هناك SYSTEM_ADMIN بلا هوية)، وطلب الكتابة يلزمه أصل التطبيق
 * نفسه وحجم لا يتجاوز الحد. يعيد سبب الرفض أو null.
 */
export function deskPreflight(input: DeskPreflightInput): { status: number; code: string; message: string } | null {
  if (input.authDisabled) {
    return { status: 401, code: "UNAUTHENTICATED", message: "مكتب التحرير يتطلب تسجيل دخول حقيقيًّا؛ المصادقة معطّلة في هذه البيئة." };
  }
  if (WRITE_METHODS.has(input.method.toUpperCase())) {
    if (!isSameOriginWrite(input)) return { status: 403, code: "FORBIDDEN", message: "مصدر الطلب غير مسموح." };
    try {
      assertContentLength(input.contentLength);
    } catch (error) {
      if (error instanceof EditorialError) return { status: error.status, code: error.code, message: error.message };
      throw error;
    }
  }
  return null;
}
