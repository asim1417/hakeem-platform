import { LoaderCircle } from "lucide-react";

/**
 * هيكل تحميل المكتب (ح١٤، ق١٤-١) داخل غلاف الإدارة (layout.tsx): رأس المكتب وتنقله وثلاث بطاقات،
 * بنص ظاهر وaria-busy، بلا وميض ولا حركة شرائح.
 */
export default function EditorialDeskLoading() {
  return (
    <div data-desk="" className="pb-10" aria-busy="true">
      <span className="dk-skel h-[14px] w-40" />
      <span className="dk-skel mt-3 h-8 w-64 max-w-full" />
      <div className="dk-nav" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="dk-skel h-11 sm:w-28" />
        ))}
      </div>
      <p className="dk-loading" role="status">
        <LoaderCircle size={18} aria-hidden className="dk-spin" />
        <span>جارٍ تحميل مكتب التحرير…</span>
      </p>
      <div className="dk-list mt-4" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="dk-card grid gap-3">
            <span className="dk-skel h-5 w-3/5" />
            <span className="dk-skel h-4 w-2/5" />
            <span className="dk-skel h-20 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
