import { CasesManager } from "@/components/CasesManager";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  await requirePagePermission("CONSULTATIONS_LIMITED");
  const cases = await prisma.caseFile
    .findMany({
      orderBy: { updatedAt: "desc" },
      take: 50
    })
    .then((items) =>
      items.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        ...parseSummary(item.summary)
      }))
    )
    .catch(() => []);

  return (
    <div>
      <p className="text-sm font-semibold text-gold">القضايا والمرفقات والبينات</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">ملفات القضايا</h1>
      <p className="mt-3 max-w-3xl leading-8 text-ink">
        أنشئ قضايا أولية واحفظها في قاعدة البيانات مع تسجيل العملية في سجل التدقيق.
      </p>
      <div className="mt-6">
        <CasesManager initialCases={cases} />
      </div>
    </div>
  );
}

function parseSummary(summary: string | null) {
  if (!summary) return {};
  try {
    return JSON.parse(summary) as Record<string, string>;
  } catch {
    return { factsSummary: summary };
  }
}
