"use client";

import { HOME_ASK_PENDING_RUN_KEY } from "@/lib/modules/config/ask-first-home";
import {
  HOME_AUTH_CHANGED_EVENT,
  HOME_AUTH_INTENT_KEY,
  HOME_AUTH_OPEN_EVENT,
  parseHomeAuthIntent,
  serializeHomeAuthIntent,
  type HomeAuthIntent,
  type HomeAuthMode,
} from "@/lib/modules/config/home-inline-auth";

export type HomeAuthOpenRequest = {
  intent: HomeAuthIntent;
  mode: HomeAuthMode;
  /** العنصر الذي فتح الحوار — يعود إليه التركيز عند الإغلاق */
  trigger?: HTMLElement | null;
};

export type HomeAuthUser = { id: string; name: string | null; email: string | null };

let launcherReady = false;
let knownUser = false;

/** HomeAuthActions يعلن وجود جلسة — روابط الخدمات تذهب مباشرة بدل فتح الحوار. */
export function markHomeUserKnown() {
  knownUser = true;
}

export function isHomeUserKnown(): boolean {
  return knownUser;
}

/** يسجّله HomeAuthLauncher عند التركيب — غيابه (الراية مطفأة) يعني السلوك السابق. */
export function setHomeAuthLauncherReady(ready: boolean) {
  launcherReady = ready;
}

/**
 * يفتح حوار الدخول في الصفحة الرئيسية. يعيد false إن لم يكن الحوار متاحًا
 * (الراية مطفأة أو خارج الرئيسية) ليكمل المستدعي بسلوكه السابق.
 */
export function openHomeAuth(request: HomeAuthOpenRequest): boolean {
  if (typeof window === "undefined" || !launcherReady) return false;
  saveHomeAuthIntent(request.intent);
  window.dispatchEvent(new CustomEvent<HomeAuthOpenRequest>(HOME_AUTH_OPEN_EVENT, { detail: request }));
  return true;
}

export function saveHomeAuthIntent(intent: HomeAuthIntent) {
  try {
    sessionStorage.setItem(HOME_AUTH_INTENT_KEY, serializeHomeAuthIntent(intent));
  } catch {
    /* التخزين غير متاح — النيّة تبقى في الذاكرة للحوار الحالي */
  }
}

export function readHomeAuthIntent(): HomeAuthIntent | null {
  try {
    return parseHomeAuthIntent(sessionStorage.getItem(HOME_AUTH_INTENT_KEY));
  } catch {
    return null;
  }
}

export function clearHomeAuthIntent() {
  try {
    sessionStorage.removeItem(HOME_AUTH_INTENT_KEY);
  } catch {
    /* تجاهل */
  }
}

/**
 * قبل مغادرة الصفحة (نافذة محجوبة / بوابة Clerk): سؤال محفوظ يُنفَّذ مرة بعد العودة.
 * يُضبط هنا لا عند فتح الحوار — إغلاق الحوار دون دخول لا يترك تشغيلًا معلّقًا.
 */
export function armPendingAsk(intent: HomeAuthIntent) {
  if (intent.kind !== "ask") return;
  try {
    sessionStorage.setItem(HOME_ASK_PENDING_RUN_KEY, "1");
  } catch {
    /* تجاهل */
  }
}

/** /api/auth/me — المستخدم الحالي من hakeem_session، أو null. */
export async function fetchHomeAuthUser(): Promise<HomeAuthUser | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      user?: { id?: string; name?: string | null; email?: string | null } | null;
      isGuest?: boolean;
    };
    if (!data?.user?.id || data.isGuest) return null;
    return { id: data.user.id, name: data.user.name ?? null, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

/**
 * بعد ثبوت الجلسة: ينفّذ النيّة مرة واحدة دون إعادة تحميل.
 * ask ← يُعلَّم السؤال للتنفيذ ثم يُعلن الدخول فيظهر HomeInlineAsk وينفّذه.
 * navigate ← انتقال مباشر للخدمة. login ← نبقى في الرئيسية ويتحدّث الشريط.
 * يعيد true إن كان سيحدث انتقال للصفحة.
 */
export function completeHomeAuth(intent: HomeAuthIntent, user: HomeAuthUser): boolean {
  knownUser = true;
  clearHomeAuthIntent();
  armPendingAsk(intent);
  window.dispatchEvent(new CustomEvent<HomeAuthUser>(HOME_AUTH_CHANGED_EVENT, { detail: user }));
  if (intent.kind === "navigate") {
    window.location.assign(intent.next);
    return true;
  }
  return false;
}
