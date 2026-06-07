"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

/**
 * زر فتح/إغلاق القائمة الجانبية على الجوال.
 * يتحكّم في العنصرين #sidebar و #sidebar-overlay عبر صنف is-open،
 * دون إعادة هيكلة الـ AppShell (الذي يبقى Server Component).
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    sidebar?.classList.toggle("is-open", open);
    overlay?.classList.toggle("is-open", open);
    return () => {
      sidebar?.classList.remove("is-open");
      overlay?.classList.remove("is-open");
    };
  }, [open]);

  // إغلاق القائمة عند الضغط على الغطاء أو عند النقر على رابط داخل الـ sidebar
  useEffect(() => {
    if (!open) return;
    const overlay = document.getElementById("sidebar-overlay");
    const sidebar = document.getElementById("sidebar");
    const close = () => setOpen(false);
    overlay?.addEventListener("click", close);
    const links = sidebar?.querySelectorAll("a") ?? [];
    links.forEach((a) => a.addEventListener("click", close));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      overlay?.removeEventListener("click", close);
      links.forEach((a) => a.removeEventListener("click", close));
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <button
      type="button"
      className="mobile-menu-btn"
      aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
    >
      {open ? <X size={18} /> : <Menu size={18} />}
    </button>
  );
}
