"use client";

import dynamic from "next/dynamic";
import { CenterSearch } from "@/components/CenterSearch";
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
          <input disabled placeholder="اطرح واقعتك أو سؤالك القانوني…" aria-label="اطرح واقعتك أو سؤالك القانوني" />
          <button type="button" disabled>
            اسأل
          </button>
        </div>
      </div>
    ),
  }
);

/**
 * سطح السؤال في الرئيسية: مضمّن عند تفعيل الراية، وإلا السلوك السابق (تحويل).
 */
export function HomeAskSurface() {
  if (!isHomeInlineAskEnabled()) return <CenterSearch />;
  return <HomeInlineAsk />;
}
