"use client";

import dynamic from "next/dynamic";
import { CenterSearch } from "@/components/CenterSearch";
import { isAskFirstHomeEnabled } from "@/lib/modules/config/ask-first-home";
import { isHomeInlineAskEnabled } from "@/lib/modules/config/home-inline-ask";

const HomeInlineAsk = dynamic(
  () =>
    import("@/components/home/HomeInlineAsk").then((m) => m.HomeInlineAsk),
  {
    ssr: false,
    loading: () => (
      <div className="center-search" aria-busy="true" aria-label="جارٍ تجهيز صندوق السؤال">
        <div className="cs-box">
          <span aria-hidden>⌕</span>
          <input
            disabled
            placeholder="اكتب الواقعة أو السؤال القانوني بتفاصيله…"
            aria-label="اكتب الواقعة أو السؤال القانوني"
          />
          <button type="button" disabled>
            اسأل حكيم
          </button>
        </div>
      </div>
    ),
  }
);

/**
 * سطح السؤال في الرئيسية: مضمّن عند تفعيل راية السؤال أو Ask-first، وإلا السلوك السابق (تحويل).
 */
export function HomeAskSurface() {
  const inline = isHomeInlineAskEnabled() || isAskFirstHomeEnabled();
  if (!inline) return <CenterSearch />;
  return <HomeInlineAsk />;
}
