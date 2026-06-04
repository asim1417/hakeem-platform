"use client";

import { useState } from "react";
import { BookmarkPlus, Check } from "lucide-react";

export function LegalFavoriteButton({ label = "إضافة للمفضلة" }: { label?: string }) {
  const [saved, setSaved] = useState(false);

  return (
    <button
      className={saved ? "btn btn-primary" : "btn btn-outline"}
      type="button"
      onClick={() => setSaved(true)}
      title="حفظ دائم للمفضلة يحتاج جدولًا مستقلًا لاحقًا."
    >
      {saved ? <Check size={16} /> : <BookmarkPlus size={16} />}
      {saved ? "تم تجهيزها للمفضلة" : label}
    </button>
  );
}
