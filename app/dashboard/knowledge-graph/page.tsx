import { requirePagePermission } from "@/lib/modules/auth/session";
import { getEmbeddingStatus } from "@/lib/modules/knowledge-graph/embeddings";
import {
  getRelationsForEntity,
  hydrateRelations,
  listRelations,
  type HydratedRelation,
} from "@/lib/modules/knowledge-graph/relations";

export const dynamic = "force-dynamic";

const RELATION_LABELS: Record<string, string> = {
  SUPPORTS: "يدعم",
  CONTRADICTS: "يعارض",
  INTERPRETS: "يفسّر",
  IMPLEMENTS: "ينفّذ",
  SUPERSEDES: "يَنسخ",
  RELATED_TO: "متعلّق بـ",
};
const TYPE_LABELS: Record<string, string> = {
  article: "مادة",
  ruling: "حكم",
  principle: "مبدأ",
  system: "نظام",
};

export default async function KnowledgeGraphPage({
  searchParams,
}: {
  searchParams: { articleId?: string };
}) {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const articleId = searchParams.articleId?.trim();
  let relations: HydratedRelation[] = [];
  let embStatus: Awaited<ReturnType<typeof getEmbeddingStatus>> | null = null;
  let dbReady = true;

  try {
    const raw = articleId
      ? await getRelationsForEntity("article", articleId)
      : await listRelations({ limit: 50 });
    relations = await hydrateRelations(raw);
    embStatus = await getEmbeddingStatus();
  } catch {
    dbReady = false;
  }

  return (
    <div dir="rtl">
      <p className="text-sm font-semibold text-gold">الرسم المعرفي القانوني</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">شبكة العلاقات القانونية</h1>
      <p className="mt-3 max-w-3xl leading-8 text-ink">
        تعرض هذه الصفحة علاقات المواد بالأحكام والمبادئ، ونوع كل علاقة ودرجة الثقة فيها، إلى جانب مدى تغطية البحث الدلالي بالمعنى.
      </p>

      {!dbReady && (
        <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-800">
          ⚠ شبكة العلاقات القانونية غير متاحة حاليًا. سيتم تفعيلها فور اكتمال تجهيز البيانات، وستظهر العلاقات هنا تلقائيًا.
        </div>
      )}

      {dbReady && (
        <div className="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-7 text-blue-800">
          تُشتق العلاقات تلقائيًا من الروابط القائمة بين المواد والأحكام، ومن المبادئ المستخرجة من الأحكام. إن ظهرت القائمة فارغة رغم وجود الأحكام، فالعلاقات لم تُولَّد بعد وستظهر فور تجهيزها من البيانات.
        </div>
      )}

      {/* حالة المتجهات */}
      {embStatus && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="إجمالي المتجهات" value={embStatus.totalEmbeddings} />
          <Stat label="تغطية المواد" value={`${embStatus.coverage.articles}%`} />
          <Stat label="تغطية الأحكام" value={`${embStatus.coverage.rulings}%`} />
          <Stat label="تغطية المبادئ" value={`${embStatus.coverage.principles}%`} />
        </div>
      )}

      {/* تصفية بعلاقات مادة */}
      <form className="mt-6 flex flex-wrap items-end gap-2" action="/dashboard/knowledge-graph">
        <label className="text-sm text-muted">
          عرض علاقات مادة محدّدة:
          <input
            name="articleId"
            defaultValue={articleId ?? ""}
            placeholder="أدخل معرّف المادة"
            className="ms-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <button type="submit" className="rounded-md bg-olive px-4 py-1.5 text-sm text-white">
          عرض
        </button>
        {articleId && (
          <a href="/dashboard/knowledge-graph" className="text-sm text-muted underline">
            إلغاء التصفية
          </a>
        )}
      </form>

      {/* جدول العلاقات */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-right text-sm">
          <thead className="bg-surface text-muted">
            <tr>
              <th className="px-3 py-2">المصدر</th>
              <th className="px-3 py-2">العلاقة</th>
              <th className="px-3 py-2">الهدف</th>
              <th className="px-3 py-2">درجة الثقة</th>
            </tr>
          </thead>
          <tbody>
            {relations.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted">
                  لا توجد علاقات لعرضها{articleId ? " لهذه المادة" : ""}.
                </td>
              </tr>
            ) : (
              relations.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <Badge type={r.source.type} /> {r.source.label}
                  </td>
                  <td className="px-3 py-2 font-medium text-olive">
                    {RELATION_LABELS[r.relation] ?? r.relation}
                  </td>
                  <td className="px-3 py-2">
                    <Badge type={r.target.type} /> {r.target.label}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.strength.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-ivory p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold text-olive tabular-nums">{value}</div>
    </div>
  );
}

function Badge({ type }: { type: string }) {
  return (
    <span className="me-1 rounded bg-gold/10 px-1.5 py-0.5 text-xs text-gold">
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}
