import Link from "next/link";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { LegalPageHeader, LegalEmptyState } from "@/components/ui/legal";
import { listCaseRows } from "@/lib/modules/judicial-assistant/store";
import { STAGE_META } from "@/lib/modules/judicial-assistant/catalog";
import { CONFIDENTIALITY_LABEL, JURISDICTION_LABEL, formatDate } from "@/lib/modules/judicial-assistant/labels";
import { JaIcon } from "@/components/judicial-assistant/icons";
import { CreateCaseForm } from "@/components/judicial-assistant/CreateCaseForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "المعاون القضائيّ — قضاياي" };

export default async function JudicialCasesPage() {
  const user = await requirePagePermission("JUDICIAL_ASSISTANT_USE");
  const rows = await listCaseRows(user.id);

  return (
    <div className="ja">
      <LegalPageHeader
        eyebrow="المعاون القضائيّ"
        title="قضاياي"
        description="كلّ قضية مشروعٌ تملكه: أنشئه، أضِف مرفقاته، ثم شغّل الأعمال المؤصَّلة."
        actions={<Link href="/dashboard/judicial-assistant" className="btn btn-outline"><JaIcon name="assistant" size={16} /> لوحة القاضي</Link>}
      />

      <div className="ja-formactions"><CreateCaseForm /></div>

      {rows.length === 0 ? (
        <div className="card ja-panel">
          <LegalEmptyState title="لا قضايا بعد" description="أنشئ قضيتك الأولى وابدأ برفع مرفقاتها." />
        </div>
      ) : (
        <div className="ja-casegrid">
          {rows.map((c) => (
            <Link key={c.id} href={`/dashboard/judicial-assistant/cases/${c.id}`} className="card ja-casecard">
              <div className="ja-casecard__top">
                <span className="ja-casecard__ic"><JaIcon name="case" size={18} /></span>
                <span className="ja-stagepill">{STAGE_META[c.stage].label}</span>
              </div>
              <h3 className="ja-casecard__num">{c.caseNumber || c.subject}</h3>
              <p className="ja-casecard__subject">{c.subject}</p>
              <div className="ja-casecard__court">{c.court ?? "—"}</div>
              <div className="ja-tags">
                <span className="ja-chip">{JURISDICTION_LABEL[c.jurisdiction]}</span>
                <span className="ja-chip">{CONFIDENTIALITY_LABEL[c.confidentiality]}</span>
                <span className="ja-chip">{c.attachmentCount} مرفق</span>
                {c.nextHearing ? <span className="ja-chip">جلسة {formatDate(c.nextHearing)}</span> : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
