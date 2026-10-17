"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

const KBD_KEY = "hkm.desk.kbd";

/** تفضيل اختصارات لوحة المفاتيح محفوظ للمستخدم (ق١٣-٤)؛ التخزين قد يُمنع فيبقى الافتراضي مفعّلًا. */
export function useKbdPreference(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(KBD_KEY) === "0") setOn(false);
    } catch {
      // التخزين غير متاح: يبقى الافتراضي.
    }
  }, []);
  const update = useCallback((next: boolean) => {
    setOn(next);
    try {
      window.localStorage.setItem(KBD_KEY, next ? "1" : "0");
    } catch {
      // لا شيء.
    }
  }, []);
  return [on, update];
}

export interface DeskKeyHandlers {
  approve?: (id: string) => void;
  reject?: (id: string) => void;
  correct?: (id: string) => void;
  toggle?: (id: string) => void;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));
}

function visible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
}

/** علامة البطاقة التي اختارها المستخدم بنفسه (j/k أو نقرة فيها)، لا التي نُقل إليها التركيز برمجيًّا بعد قرار. */
const USER_FOCUS = "data-kbd-focus";

/**
 * اختصارات الطابور على حاوية الطابور لا على window (ق١٣): j/k تنقّل بين البطاقات، ولا التقاط للأسهم.
 * a/r/e/x أفعال لا رجعة فيها بعد المهلة، فلا تعمل إلا بثلاثة شروط معًا: تُتجاهل الضغطة المكررة (event.repeat)،
 * ويُعطّل المستهلك الاختصارات أثناء طلب سابق (enabled = false)، وتعمل على بطاقة اختارها المستخدم بنفسه وهي ظاهرة
 * (لا تركيز افتراضي: البطاقة التي نُقل إليها التركيز بعد قرار تحتاج j أو نقرة أولًا).
 */
export function useDeskKeys(container: RefObject<HTMLElement>, handlers: DeskKeyHandlers, enabled: boolean) {
  useEffect(() => {
    const root = container.current;
    if (!root || !enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const key = event.key.toLowerCase();
      if (!["j", "k", "a", "r", "e", "x"].includes(key)) return;
      const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-card]"));
      const active = document.activeElement as HTMLElement | null;
      const holder = active?.closest<HTMLElement>("[data-card]") ?? null;
      const index = holder ? cards.indexOf(holder) : -1;
      if (key === "j" || key === "k") {
        if (!cards.length) return;
        event.preventDefault();
        let next: number;
        if (index < 0) next = 0;
        // بطاقة مركّزة برمجيًّا (بعد قرار): j/k يثبّت الاختيار عليها أولًا ولا يتخطاها.
        else if (active === holder && holder?.hasAttribute(USER_FOCUS)) next = Math.min(Math.max(index + (key === "j" ? 1 : -1), 0), cards.length - 1);
        else next = index;
        const target = cards[next];
        target.setAttribute(USER_FOCUS, "");
        // تمرير فوري لا متحرك (globals.css يجعل التمرير ناعمًا): البطاقة ظاهرة فور الضغط، فيعمل الفعل التالي عليها.
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "nearest", behavior: "instant" });
        return;
      }
      // الأفعال على البطاقة المركّزة نفسها فقط، وقد اختارها المستخدم، وهي ظاهرة.
      if (!holder || active !== holder || !holder.hasAttribute(USER_FOCUS) || !visible(holder)) return;
      const id = holder.dataset.id;
      if (!id) return;
      const map: Record<string, ((id: string) => void) | undefined> = { a: handlers.approve, r: handlers.reject, e: handlers.correct, x: handlers.toggle };
      const fn = map[key];
      if (!fn) return;
      event.preventDefault();
      fn(id);
    };
    const onBlur = (event: FocusEvent) => (event.target as HTMLElement | null)?.removeAttribute?.(USER_FOCUS);
    // نقرة في جسم البطاقة (لا على زر أو رابط) تركّزها، وهو اختيار من المستخدم.
    const onPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest("a, button, input, select, textarea, label, summary")) return;
      target.closest<HTMLElement>("[data-card]")?.setAttribute(USER_FOCUS, "");
    };
    root.addEventListener("keydown", onKey);
    root.addEventListener("focusout", onBlur);
    root.addEventListener("pointerdown", onPointer);
    return () => {
      root.removeEventListener("keydown", onKey);
      root.removeEventListener("focusout", onBlur);
      root.removeEventListener("pointerdown", onPointer);
    };
  }, [container, enabled, handlers]);
}
