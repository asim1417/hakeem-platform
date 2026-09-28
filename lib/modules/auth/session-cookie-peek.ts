/**
 * قراءة خفيفة لدور الجلسة من كوكي hakeem_session داخل Edge middleware.
 * للتوجيه فقط (مثل / → /admin للسوبر) — لا اعتماد أمني؛ الحماية تبقى في الصفحات.
 * لا يتحقق من التوقيع هنا لتجنّب crypto في Edge؛ إن انتهت الصلاحية يُتجاهل.
 */
export function peekSessionRole(cookieValue?: string | null): string | null {
  if (!cookieValue) return null;
  const body = cookieValue.split(".")[0];
  if (!body) return null;
  try {
    const json = JSON.parse(base64UrlToUtf8(body)) as { role?: unknown; exp?: unknown; userId?: unknown };
    if (!json?.userId || typeof json.exp !== "number" || json.exp < Date.now()) return null;
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

/** وجهة مساحة العمل لصاحب الجلسة من دور الكوكي (قبل أي رسم). */
export function workspaceHomeFromSessionCookie(
  cookieValue: string | undefined | null,
  opts?: { superPanelEnabled?: boolean }
): "/admin" | "/dashboard" {
  const role = peekSessionRole(cookieValue);
  const superOn = opts?.superPanelEnabled !== false;
  if (superOn && role === "SUPER_ADMIN") return "/admin";
  return "/dashboard";
}

function base64UrlToUtf8(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
