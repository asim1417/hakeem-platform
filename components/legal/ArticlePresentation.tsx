import type { DisplayedArticle, UnitVersionRecord } from "@/lib/modules/legal-core/verified-status";

function wordDiff(before: string, after: string): string {
  const a = before.split(/\s+/);
  const b = after.split(/\s+/);
  if (a.length > 800 || b.length > 800) return "";
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const parts: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      parts.push(a[i]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      parts.push(`[-${a[i]}-]`);
      i += 1;
    } else {
      parts.push(`[+${b[j]}+]`);
      j += 1;
    }
  }
  while (i < a.length) {
    parts.push(`[-${a[i]}-]`);
    i += 1;
  }
  while (j < b.length) {
    parts.push(`[+${b[j]}+]`);
    j += 1;
  }
  return parts.join(" ");
}

export function ArticlePresentation({
  view,
  versions,
  baseText,
}: {
  view: DisplayedArticle;
  versions: UnitVersionRecord[];
  baseText: string;
}) {
  return (
    <div className="mt-6">
      {view.unverifiedNotice ? (
        <p className="mb-3 text-sm text-muted">{view.unverifiedNotice}</p>
      ) : null}
      {view.badge ? (
        <div role="alert" className="mb-4 rounded-xl border-2 border-red-600 bg-red-50 p-4 text-red-900">
          <p className="text-base font-extrabold">{view.badge}</p>
          {view.badgeDetail ? <p className="mt-1 text-sm leading-7">{view.badgeDetail}</p> : null}
        </div>
      ) : null}
      {view.pendingNotice ? (
        <div role="note" className="mb-4 rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-amber-950">
          <p className="text-sm font-bold leading-7">{view.pendingNotice}</p>
        </div>
      ) : null}
      <div
        className="whitespace-pre-wrap rounded-xl border p-6 text-lg leading-9"
        style={view.faded
          ? { borderColor: "#dc2626", background: "#f8fafc", color: "#94a3b8" }
          : { borderColor: "rgba(198,151,99,0.25)", background: "var(--ivory)", color: "var(--navy)" }}
      >
        {view.text}
      </div>
      {view.amendmentLine ? <p className="mt-2 text-xs text-muted">{view.amendmentLine}</p> : null}
      <details className="mt-4 rounded-lg border border-[#C69763]/30 p-3 text-sm">
        <summary className="cursor-pointer font-semibold">النسخ السابقة</summary>
        <p className="mt-2 text-muted">الأصل المحفوظ يبقى في مكانه. الفترات تُحسب من تاريخ النسخة التالية.</p>
        <ul className="mt-3 space-y-3">
          <li>
            <p className="font-semibold">النص الأصلي</p>
            <p className="whitespace-pre-wrap leading-7">{baseText}</p>
          </li>
          {versions.map((v, idx) => {
            const prev = idx === 0 ? baseText : versions[idx - 1].body;
            const diff = wordDiff(prev, v.body);
            return (
              <li key={v.id} className="border-t border-black/5 pt-3">
                <p className="font-semibold">من {v.validFrom.slice(0, 10)}{v.evidenceInstrument ? ` — ${v.evidenceInstrument}` : ""}</p>
                <p className="whitespace-pre-wrap leading-7">{v.body}</p>
                {diff ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs">إظهار الفروق</summary>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-6">{diff}</p>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}

export function AsOfForm({ asOf }: { asOf?: string }) {
  return (
    <form className="mt-4 flex flex-wrap items-end gap-2 text-sm" method="get">
      <label className="flex flex-col gap-1">
        <span>كما في تاريخ</span>
        <input name="asOf" type="date" defaultValue={asOf ?? ""} className="rounded border px-2 py-1" />
      </label>
      <button type="submit" className="rounded bg-[var(--navy)] px-3 py-1 text-white">عرض</button>
    </form>
  );
}
