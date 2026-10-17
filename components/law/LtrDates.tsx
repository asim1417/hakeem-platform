import { Fragment } from "react";

// التاريخ الميلادي 2021-06-01 بعد حرف عربي ينقلب (قاعدة W2 في ثنائية الاتجاه: يصير رقمًا عربيًا فتنفصل الشرطات)،
// فيُعزل كل تاريخ بـ <bdi dir="ltr"> مع nowrap (§٥). النص نفسه لا يتغير.
export function LtrDates({ text }: { text: string }) {
  const parts = text.split(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <bdi dir="ltr" className="hnum" key={i}>
            {p}
          </bdi>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
