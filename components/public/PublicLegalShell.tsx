import Link from "next/link";
import type { ReactNode } from "react";

// غلاف عام للصفحات القابلة للفهرسة (بلا تسجيل دخول) — رأس وتذييل بسيطان متّسقان.
export function PublicLegalShell({ children, breadcrumb }: { children: ReactNode; breadcrumb?: ReactNode }) {
  return (
    <main dir="rtl" className="min-h-screen bg-[linear-gradient(180deg,var(--parchment),#F3EEE2)] text-[var(--navy)]">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-[#5C6E6B]">
          <Link href="/legal" className="font-semibold text-[var(--navy)] hover:underline">الأنظمة القانونية</Link>
          {breadcrumb ? <>{breadcrumb}</> : null}
          <Link href="/developers" className="ms-auto rounded-md border border-[#C69763]/40 px-3 py-1 text-xs font-semibold text-[var(--navy)] hover:bg-[#C69763]/10">
            واجهة المطوّرين (API)
          </Link>
        </nav>
        <div className="mt-6">{children}</div>
        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t border-line pt-6 text-sm text-muted">
          <Link href="/legal" className="hover:underline">فهرس الأنظمة</Link>
          <Link href="/api-docs" className="hover:underline">توثيق API</Link>
          <Link href="/terms" className="hover:underline">الشروط</Link>
          <Link href="/privacy" className="hover:underline">الخصوصية</Link>
          <span className="ms-auto">© منصّة حكيم — المعرفة القضائية السعودية</span>
        </footer>
      </div>
    </main>
  );
}

export function Crumb({ href, label }: { href?: string; label: string }) {
  return (
    <>
      <span aria-hidden className="text-[#CAD6D3]">/</span>
      {href ? (
        <Link href={href} className="hover:underline">{label}</Link>
      ) : (
        <span className="text-[var(--navy)]">{label}</span>
      )}
    </>
  );
}
