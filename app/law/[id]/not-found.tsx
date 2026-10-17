import Link from "next/link";

export default function LawNotFound() {
  return (
    <div data-law dir="rtl" lang="ar">
      <div className="law-wrap" style={{ paddingTop: 48 }}>
        <main id="main" className="empty" role="main">
          <p>لم نجد نظامًا بهذا الرابط. ربما تغيّر الرابط أو كُتب خطأ.</p>
          <Link className="lbtn lbtn--primary" href="/legal">
            ابحث في الأنظمة
          </Link>
        </main>
      </div>
    </div>
  );
}
