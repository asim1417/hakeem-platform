// بطاقة النظام و«نص النظام» — على ترتيب هيئة الخبراء:
//   البطاقة: نبذة عن النظام، الاسم، تاريخ الإصدار، تاريخ النشر، الحالة، أدوات إصدار النظام، التصنيف.
//   ثم «نص النظام»: العنوان، السنة، البسملة، نص المرسوم، نص قرار مجلس الوزراء، عنوان النظام، ثم المواد.
// لا يعرض إلا ما له مصدر: الحقل الغائب يُحذف ولا يُخمَّن. الحالة من سجل التحقق وحده.
import type { LawCardBlock, LawCardRecord } from "@/lib/modules/legal-core/verification-read";

const INSTRUMENT_LABEL: Record<string, string> = {
  royal_decree: "مرسوم ملكي",
  cabinet_decision: "قرار مجلس الوزراء",
  royal_order: "أمر ملكي",
};

function dateLine(hijri: string | null, gregorian: string | null): string | null {
  if (!hijri && !gregorian) return null;
  const g = gregorian ? gregorian.split("-").reverse().join("/") : null;
  return [hijri ? `${hijri} هـ` : null, g ? `الموافق: ${g} م` : null].filter(Boolean).join(" ");
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-black/5 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm font-bold text-[#A9793F]">{label}</dt>
      <dd className="leading-7 text-[var(--navy)]">{children}</dd>
    </div>
  );
}

export function LawCardPanel({
  name,
  card,
  statusLabel,
  statusTone,
  statusDetail,
  fallbackInstruments,
  archiveNotice,
}: {
  name: string;
  card: LawCardRecord | null;
  statusLabel: string;
  statusTone: "ok" | "retired" | "pending" | "unverified";
  statusDetail?: string | null;
  fallbackInstruments: string[];
  archiveNotice?: { label: string; href: string | null } | null;
}) {
  const issued = card ? dateLine(card.issuedHijri, card.issuedGregorian) : null;
  const published = card ? dateLine(card.publishedHijri, card.publishedGregorian) : null;
  const instruments = card?.instruments.length ? card.instruments.map((i) => i.text) : fallbackInstruments;
  const tone =
    statusTone === "retired"
      ? "bg-red-50 text-red-800 border-red-300"
      : statusTone === "pending"
        ? "bg-amber-50 text-amber-900 border-amber-300"
        : statusTone === "unverified"
          ? "bg-slate-50 text-slate-600 border-slate-300"
          : "bg-emerald-50 text-emerald-800 border-emerald-300";
  return (
    <section aria-label="بطاقة النظام" className="mt-6 rounded-xl border border-[#C69763]/30 bg-ivory p-5">
      <h2 className="text-lg font-bold text-[var(--navy)]">بطاقة النظام</h2>
      {card?.categoryPath.length ? (
        <p className="mt-1 text-sm text-muted">{card.categoryPath.join(" › ")}</p>
      ) : null}
      {archiveNotice ? (
        <p role="note" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm leading-7 text-amber-950">
          {archiveNotice.label}
          {archiveNotice.href ? (
            <>
              {" "}
              <a className="font-bold underline" href={archiveNotice.href}>النسخة السارية</a>
            </>
          ) : null}
        </p>
      ) : null}
      {card?.summary ? (
        <div className="mt-4">
          <h3 className="text-base font-bold text-[var(--navy)]">نبذة عن النظام</h3>
          <p className="mt-2 whitespace-pre-line leading-8 text-[var(--navy)]">{card.summary}</p>
        </div>
      ) : null}
      <dl className="mt-3">
        <Row label="الاسم">{card?.officialName || name}</Row>
        {issued ? <Row label="تاريخ الإصدار">{issued}</Row> : null}
        {published ? <Row label="تاريخ النشر">{published}</Row> : null}
        <Row label="الحالة">
          <span className={`inline-block rounded border px-2 py-0.5 text-sm font-bold ${tone}`}>{statusLabel}</span>
          {statusDetail ? <span className="mr-2 text-sm text-muted">{statusDetail}</span> : null}
        </Row>
        {instruments.length ? (
          <Row label="أدوات إصدار النظام">
            <ul className="space-y-1">
              {instruments.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Row>
        ) : null}
      </dl>
      {card ? (
        <p className="mt-3 text-xs text-muted">
          المصدر: <a className="underline" href={card.sourceUrl}>{card.sourceName}</a>
          {card.retrievedOn ? ` · قُرئ في ${card.retrievedOn}` : ""}
        </p>
      ) : null}
    </section>
  );
}

/** كتل ما قبل المواد بترتيب المصدر. النص حرفي. */
export function LawTextBlocks({ blocks }: { blocks: LawCardBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        if (b.kind === "title" || b.kind === "law_title") {
          return (
            <p key={i} className="text-center text-xl font-extrabold text-[var(--navy)]">
              {b.text}
            </p>
          );
        }
        if (b.kind === "year") {
          return (
            <p key={i} className="-mt-2 text-center text-sm font-bold text-[#A9793F]">
              {b.text}
            </p>
          );
        }
        if (b.kind === "basmala") {
          return (
            <p key={i} className="text-center font-bold text-[var(--navy)]">
              {b.text}
            </p>
          );
        }
        return (
          <div key={i} className="rounded-lg border border-[#C69763]/20 bg-white/60 p-4">
            {b.heading ? (
              <p className="text-center font-bold text-[var(--navy)]" data-kind={INSTRUMENT_LABEL[b.kind] ?? b.kind}>
                {b.heading}
              </p>
            ) : null}
            <p className="mt-2 whitespace-pre-line leading-8 text-[var(--navy)]">{b.text.replace(/^\n+/, "")}</p>
          </div>
        );
      })}
    </div>
  );
}
