"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import type { VisibleAuthProvider } from "@/lib/modules/auth/auth-providers";
import {
  HOME_AUTH_OPEN_EVENT,
  normalizeHomeAuthIntent,
  type HomeAuthMode,
} from "@/lib/modules/config/home-inline-auth";
import {
  armPendingAsk,
  completeHomeAuth,
  fetchHomeAuthUser,
  isHomeUserKnown,
  readHomeAuthIntent,
  setHomeAuthLauncherReady,
  type HomeAuthOpenRequest,
} from "@/components/home/home-auth-bus";

/** ما يمرّره الخادم للحوار: الوسائل المفعّلة فقط، بلا أسرار. */
export type HomeAuthConfig = {
  providers: VisibleAuthProvider[];
  identifierForm: boolean;
  publishableKey: string;
  hideDevelopmentMode: boolean;
};

export type HomeAuthDialogProps = {
  config: HomeAuthConfig;
  request: HomeAuthOpenRequest | null;
  onClose: () => void;
};

let dialogModule: Promise<ComponentType<HomeAuthDialogProps>> | null = null;
function loadDialog() {
  dialogModule ??= import("@/components/home/HomeAuthDialog").then((m) => m.HomeAuthDialog);
  return dialogModule;
}

function requestFromLink(a: HTMLAnchorElement): HomeAuthOpenRequest | null {
  const mode: HomeAuthMode = a.dataset.homeAuthMode === "sign-up" ? "sign-up" : "sign-in";
  const kind = a.dataset.homeAuth;
  const intent = normalizeHomeAuthIntent(kind === "navigate" ? { kind, next: a.dataset.homeAuthNext } : { kind });
  return intent ? { intent, mode, trigger: a } : null;
}

/**
 * يعترض روابط الدخول في الرئيسية (a[data-home-auth]) ويفتح الحوار بدل مغادرة الصفحة.
 * الروابط تبقى <a href> حقيقية: بلا JavaScript، أو بنقرة مع Ctrl/⌘، تعمل كما كانت.
 * حزمة الحوار تُحمَّل عند أول تفاعل (تمرير/تركيز/نقر) — لا Clerk في الحزمة الأولى.
 */
export function HomeAuthLauncher({ config }: { config: HomeAuthConfig }) {
  const [Dialog, setDialog] = useState<ComponentType<HomeAuthDialogProps> | null>(null);
  const [request, setRequest] = useState<HomeAuthOpenRequest | null>(null);

  const ensureDialog = useCallback(() => {
    void loadDialog()
      .then((C) => setDialog(() => C))
      .catch(() => {
        dialogModule = null;
      });
  }, []);

  useEffect(() => {
    setHomeAuthLauncherReady(true);

    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<HomeAuthOpenRequest>).detail;
      if (!detail) return;
      // كائن جديد لكل فتح — الحوار يعيد ضبط حالته عليه
      setRequest({ ...detail });
      ensureDialog();
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const a = target?.closest?.("a[data-home-auth]") as HTMLAnchorElement | null;
      if (!a) return;
      const req = requestFromLink(a);
      if (!req) return;
      event.preventDefault();
      if (isHomeUserKnown()) {
        // جلسة قائمة: الخدمة مباشرة، ودخول «عادي» إلى المنصة
        window.location.assign(req.intent.kind === "navigate" ? req.intent.next : "/dashboard");
        return;
      }
      window.dispatchEvent(new CustomEvent<HomeAuthOpenRequest>(HOME_AUTH_OPEN_EVENT, { detail: req }));
    };

    const prefetch = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest?.("a[data-home-auth]")) ensureDialog();
    };

    window.addEventListener(HOME_AUTH_OPEN_EVENT, onOpen);
    document.addEventListener("click", onClick);
    document.addEventListener("pointerover", prefetch, { passive: true });
    document.addEventListener("focusin", prefetch);

    // عودة من تحويل كامل (نافذة محجوبة أو بوابة Clerk): ننفّذ النيّة المحفوظة مرة واحدة.
    const url = new URL(window.location.href);
    if (url.searchParams.get("home_auth") === "1") {
      url.searchParams.delete("home_auth");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      const intent = readHomeAuthIntent();
      if (intent) {
        // قبل أي await: HomeInlineAsk قد يظهر مع أول ردّ /api/auth/me فيجد السؤال معلّمًا
        armPendingAsk(intent);
        void fetchHomeAuthUser().then((user) => {
          if (user) completeHomeAuth(intent, user);
        });
      }
    }

    return () => {
      setHomeAuthLauncherReady(false);
      window.removeEventListener(HOME_AUTH_OPEN_EVENT, onOpen);
      document.removeEventListener("click", onClick);
      document.removeEventListener("pointerover", prefetch);
      document.removeEventListener("focusin", prefetch);
    };
  }, [ensureDialog]);

  if (!Dialog) return null;
  return <Dialog config={config} request={request} onClose={() => setRequest(null)} />;
}
