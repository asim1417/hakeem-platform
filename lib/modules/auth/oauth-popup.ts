"use client";

/**
 * رسائل التواصل بين النافذة المنبثقة للتوثيق والنافذة الرئيسية.
 */
export type OAuthPopupSuccessMessage = {
  type: "hakeem_oauth_success";
  /** clerk: عودة Microsoft/Apple من بوابة Clerk عبر /api/auth/claim-clerk-return */
  provider: "google" | "apple" | "microsoft" | "clerk";
  next: string;
};

export type OAuthPopupErrorMessage = {
  type: "hakeem_oauth_error";
  provider?: "google" | "apple" | "microsoft" | "clerk";
  error: string;
};

export type OAuthPopupMessage = OAuthPopupSuccessMessage | OAuthPopupErrorMessage;

export interface OpenOAuthPopupOptions {
  url: string;
  title?: string;
  width?: number;
  height?: number;
  onSuccess?: (payload: OAuthPopupSuccessMessage) => void;
  onError?: (payload: OAuthPopupErrorMessage) => void;
  onClose?: () => void;
}

/**
 * يفتح نافذة منبثقة لـ OAuth في منتصف الشاشة مع مراقبة الإغلاق والتواصل الآمن عبر postMessage.
 * يعيد true إذا فُتحت النافذة بنجاح، أو false إذا تم حظر النوافذ المنبثقة بالمتصفح.
 */
export function openOAuthPopup({
  url,
  title = "hakeem_oauth_popup",
  width = 520,
  height = 650,
  onSuccess,
  onError,
  onClose,
}: OpenOAuthPopupOptions): boolean {
  if (typeof window === "undefined") return false;

  // احتساب الإحداثيات لوضع النافذة المنبثقة بدقة في منتصف الشاشة الحالية
  const screenLeft = window.screenLeft ?? window.screenX ?? 0;
  const screenTop = window.screenTop ?? window.screenY ?? 0;
  const outerWidth = window.outerWidth ?? document.documentElement.clientWidth ?? 800;
  const outerHeight = window.outerHeight ?? document.documentElement.clientHeight ?? 600;

  const left = Math.max(0, Math.round(screenLeft + (outerWidth - width) / 2));
  const top = Math.max(0, Math.round(screenTop + (outerHeight - height) / 2));

  const features = [
    `width=${width}`,
    `height=${height}`,
    `top=${top}`,
    `left=${left}`,
    "status=no",
    "resizable=yes",
    "scrollbars=yes",
    "toolbar=no",
    "menubar=no",
    "location=yes",
  ].join(",");

  let popup: Window | null = null;
  try {
    popup = window.open(url, title, features);
  } catch {
    return false;
  }

  if (!popup || popup.closed || typeof popup.closed === "undefined") {
    return false;
  }

  popup.focus?.();

  let isCompleted = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  function cleanup() {
    window.removeEventListener("message", onMessage);
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function onMessage(event: MessageEvent) {
    // التأكد من تطابق مصدر الرسالة للأمان: الأصل نفسه، ومن النافذة التي فتحناها تحديدًا
    if (event.origin !== window.location.origin) return;
    if (event.source !== popup) return;

    const data = event.data as OAuthPopupMessage | undefined;
    if (!data || typeof data !== "object") return;

    if (data.type === "hakeem_oauth_success") {
      isCompleted = true;
      cleanup();
      try {
        if (popup && !popup.closed) popup.close();
      } catch {
        /* تجاهل */
      }
      onSuccess?.(data);
    } else if (data.type === "hakeem_oauth_error") {
      isCompleted = true;
      cleanup();
      try {
        if (popup && !popup.closed) popup.close();
      } catch {
        /* تجاهل */
      }
      onError?.(data);
    }
  }

  window.addEventListener("message", onMessage);

  // استطلاع دوري لاكتشاف قيام المستخدم بإغلاق النافذة يدويًا
  pollTimer = setInterval(() => {
    try {
      if (!popup || popup.closed) {
        cleanup();
        if (!isCompleted) {
          onClose?.();
        }
      }
    } catch {
      cleanup();
      if (!isCompleted) {
        onClose?.();
      }
    }
  }, 500);

  return true;
}
