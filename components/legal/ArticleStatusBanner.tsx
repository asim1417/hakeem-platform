// شارة حالة المادة أعلى نصّها: أحمر «مادة ملغاة» للإلغاء الكامل، وكهرماني للإلغاء
// الجزئيّ/التعديل. لا يُحذف النصّ — يبقى معروضًا أسفل الشارة. يُعرض المعتمَد فقط (verified).

export interface ArticleAmendmentView {
  changeType: string; // amended | repealed | reinstated | corrected
  decreeRef?: string | null;
  hijriDate?: string | null;
  summary?: string | null;
  previousText?: string | null;
  newText?: string | null;
  reviewStatus?: string | null;
}

/** يزيل وسم [E#] من بداية الملخّص للعرض. */
function cleanSummary(s?: string | null): string {
  return String(s ?? "").replace(/^\[[^\]]+\]\s*/, "").trim();
}

export function ArticleStatusBanner({
  status,
  amendments,
}: {
  status?: string | null;
  amendments: ArticleAmendmentView[];
}) {
  const adopted = (amendments || []).filter((a) => a.reviewStatus === "verified");
  const isRepealed = String(status ?? "").trim() === "ملغاة";
  const repeals = adopted.filter((a) => a.changeType === "repealed");
  const amends = adopted.filter((a) => a.changeType === "amended");

  if (!isRepealed && repeals.length === 0 && amends.length === 0) return null;

  if (isRepealed) {
    const src = repeals[0];
    return (
      <div
        role="alert"
        className="mb-4 rounded-xl border-2 border-red-600 bg-red-50 p-4 text-red-900"
        style={{ borderColor: "#dc2626", background: "#fef2f2", color: "#7f1d1d" }}
      >
        <p className="text-base font-extrabold">⛔ مادة ملغاة</p>
        <p className="mt-1 text-sm leading-7">
          أُلغيت هذه المادة{src?.decreeRef ? ` بموجب المرسوم ${src.decreeRef}` : ""}
          {src?.hijriDate ? ` (${src.hijriDate}هـ)` : ""}. النصّ محفوظ أدناه للاطّلاع التاريخيّ فقط ولا يُعتدّ به ساريًا.
        </p>
        {src?.summary ? <p className="mt-2 text-xs leading-6 opacity-90">المستند: {cleanSummary(src.summary)}</p> : null}
      </div>
    );
  }

  // إلغاء جزئيّ أو تعديل بالإحلال — كهرمانيّ.
  const partial = repeals[0];
  const amend = amends[0];
  return (
    <div
      role="note"
      className="mb-4 rounded-xl border-2 p-4"
      style={{ borderColor: "#d97706", background: "#fffbeb", color: "#7c2d12" }}
    >
      <p className="text-base font-extrabold">
        {partial ? "⚠️ أُلغي جزء من هذه المادة" : "✏️ عُدّلت هذه المادة"}
      </p>
      {(partial || amend)?.decreeRef ? (
        <p className="mt-1 text-sm leading-7">
          بموجب المرسوم {(partial || amend)!.decreeRef}
          {(partial || amend)!.hijriDate ? ` (${(partial || amend)!.hijriDate}هـ)` : ""}.
        </p>
      ) : null}
      {partial?.previousText ? (
        <p className="mt-2 text-xs leading-6"><b>النصّ الملغى:</b> {partial.previousText}</p>
      ) : null}
      {amend?.newText ? (
        <p className="mt-2 text-xs leading-6"><b>النصّ الجديد:</b> {amend.newText}</p>
      ) : null}
      {(partial || amend)?.summary ? (
        <p className="mt-2 text-xs leading-6 opacity-90">المستند: {cleanSummary((partial || amend)!.summary)}</p>
      ) : null}
    </div>
  );
}
