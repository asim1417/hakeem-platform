"use client";

import dynamic from "next/dynamic";

/**
 * يُحمَّل «العرض الحي» بعد اكتمال الصفحة (ssr: false)، وحتى تحميله يظهر إطار بمقاسه الثابت
 * فلا تقفز الصفحة (CLS = 0).
 */
export const HomeLiveDemoLazy = dynamic(() => import("@/components/home/HomeLiveDemo").then((m) => m.HomeLiveDemo), {
  ssr: false,
  loading: () => <div className="hk-demo hk-demo--placeholder" aria-hidden />,
});
