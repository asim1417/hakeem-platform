import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { getManifest } from "@/lib/agent-runtime/live/manifests";
import { AgentConsole, type ConsoleTool } from "@/components/agents/AgentConsole";
import { AgentChat } from "@/components/agents/AgentChat";
import { DeadlineCalculator } from "@/components/agents/DeadlineCalculator";

export const dynamic = "force-dynamic";

// صفحة الوكيل — محادثةٌ حيّة مؤصَّلة بنطاقه النظاميّ، مع أدواتٍ دقيقة داخل صفحته.
// كلّ مخرَجٍ مؤصَّلٌ بالمواد والأحكام الفعليّة، بلا اختلاق ولا خروجٍ عن النطاق.
const ENGINE_TOOL_UI: Record<string, ConsoleTool> = {
  exhaustive_scan: { id: "exhaustive_scan", label: "مسحٌ شامل للنطاق", fields: [] },
  read_article_in_context: { id: "read_article_in_context", label: "قراءة مادّة في سياقها", fields: ["articleNumber"] },
  read_chapter: { id: "read_chapter", label: "قراءة فصل", fields: ["chapter"] },
  trace_amendments: { id: "trace_amendments", label: "تتبّع تعديلات مادّة", fields: ["articleNumber"] },
  build_citation: { id: "build_citation", label: "بناء استناد رسميّ", fields: ["articleNumber"] },
  takhrij_hukm: { id: "takhrij_hukm", label: "تخريج حكم (مبادئ قضائية)", fields: ["query"] }
};

export default async function AgentConsolePage({ params }: { params: { agentId: string } }) {
  await requirePagePermission("LEGAL_CORE_VIEW");
  const m = getManifest(params.agentId);
  if (!m) notFound();

  const engineTools = Array.from(new Set(m.skills.flatMap((s) => s.engineTools)));
  const tools: ConsoleTool[] = [
    { id: "search", label: "بحثٌ مؤصَّل في النطاق", fields: ["query"] },
    ...(engineTools.includes("hijri_date_calc") ? [{ id: "احسب_المهلة", label: "حساب مهلة (هجريّ)", fields: ["deadline"] as ConsoleTool["fields"] }] : []),
    ...engineTools.filter((t) => ENGINE_TOOL_UI[t]).map((t) => ENGINE_TOOL_UI[t])
  ];
  const subRoles = (m.subRoles ?? []).map((sr) => ({ id: sr.subRoleId, label: sr.displayName ?? sr.subRoleId, stance: sr.stance }));

  return (
    <div dir="rtl" className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/dashboard/agents" className="text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--petrol)]">
          → كل الوكلاء
        </Link>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${m.approval.status === "approved" ? "border border-[rgba(26,92,65,0.3)] bg-[var(--emerald-soft)] text-[var(--emerald)]" : "border border-amber-300 bg-amber-50 text-amber-700"}`}>
          {m.approval.status === "approved" ? "معتمَد ✓" : "قيد الاعتماد"}
        </span>
      </div>

      <header className="hero mb-6">
        <p className="text-sm text-[var(--gold-pale)]">وكيلٌ متخصّص</p>
        <h1 className="t-display mt-2 text-2xl font-bold md:text-3xl">{m.displayName}</h1>
        <p className="mt-3 max-w-2xl leading-8 text-white/85">
          حاوِر الوكيل في تخصّصه — يحلّل وقائعك ويستند إلى المواد والأحكام الفعليّة في نطاقه، بلا اختلاقٍ ولا خروجٍ عن مجاله.
        </p>
      </header>

      {/* صندوق المحادثة الحيّ — مؤصَّلٌ بنطاق الوكيل، بثٌّ نموذجيّ حيّ كصندوق «اسأل حكيم». */}
      <div className="mb-6">
        <AgentChat
          agentId={m.agentId}
          displayName={m.displayName ?? m.agentId}
          scope={m.scope.defaultSystems}
          subRoles={subRoles}
        />
      </div>

      {/* حاسبة المهلة الحيّة — متضمَّنةٌ لدى الوكلاء الذين يملكون قدرة حساب المهلة (هجريّ). */}
      {engineTools.includes("hijri_date_calc") ? (
        <div className="mb-6">
          <DeadlineCalculator />
        </div>
      ) : null}

      {/* وحدة الأدوات الحتميّة (استدعاءٌ مباشرٌ لأدوات النطاق). */}
      <details className="ja-allworks">
        <summary className="ja-textbtn cursor-pointer">أدوات دقيقة (قراءة مادّة · فصل · تخريج · مهلة) ▾</summary>
        <div className="mt-3">
          <AgentConsole
            agentId={m.agentId}
            displayName={m.displayName ?? m.agentId}
            scope={m.scope.defaultSystems}
            subRoles={subRoles}
            tools={tools}
          />
        </div>
      </details>
    </div>
  );
}
