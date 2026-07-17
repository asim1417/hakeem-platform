import Link from "next/link";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { LegalPageHeader, LegalAlert } from "@/components/ui/legal";
import { LegalChatWorkspace, type WorkspaceConfig } from "@/components/legal-chat/LegalChatWorkspace";
import { MODE_CONFIGS, SEARCH_STRENGTH_CONFIGS, PROMPT_LIBRARY } from "@/lib/modules/legal-chat/modes";
import { TRAINING_DISCLAIMER } from "@/lib/modules/legal-chat/drafting-style-engine";

export const dynamic = "force-dynamic";

export default async function LegalChatPage() {
  const user = await requirePagePermission("LEGAL_CORE_VIEW");

  const config: WorkspaceConfig = {
    modes: Object.values(MODE_CONFIGS).map((m) => ({ value: m.mode, label: m.label, description: m.description })),
    strengths: Object.values(SEARCH_STRENGTH_CONFIGS).map((s) => ({ value: s.strength, label: s.label, description: s.description })),
    prompts: PROMPT_LIBRARY,
    greeting: user?.name ? `أهلاً ${user.name} — منصة العمل القضائية` : "منصة العمل القضائية الذكية",
    disclaimer:
      "حكيم يفهم أولاً ويعرض فهمه قبل أي مخرج، ويستند حصراً للنواة القانونية الموثّقة ولا يختلق مواد. المخرجات محاكاة تدريبية وليست حكماً أو رأياً نهائياً.",
  };

  return (
    <div dir="rtl">
      <LegalPageHeader
        eyebrow="شات قضائي ذكي · Legal AI Workspace"
        title="المحاكاة القضائية"
        description="مساحة عمل قضائية ذكية: تفهم قضيتك بلغتك، تعرض فهمها وتأخذ موافقتك، تبني ملف القضية، تطبّق منطق الإجراءات السعودية، ثم تصوغ بمنهج قضائي مُسنَد — مع منع الهلوسة ومراجعة بشرية."
      />
      <div className="mt-5">
        <LegalAlert tone="warning">{TRAINING_DISCLAIMER}</LegalAlert>
      </div>

      {/* توحيد: «محادثة» سريعة صارت وضعًا داخل «اسأل حكيم» (استدعاء وكيل واحد لكل دور). */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[var(--r-md)] border border-[var(--gold)] bg-[var(--gold-ghost)] px-3 py-2 text-sm text-[var(--navy)]">
        <span>💬 جديد: «محادثة» قانونية سريعة متعدّدة الأدوار صارت وضعًا داخل «اسأل حكيم».</span>
        <Link href="/dashboard/ask" className="font-semibold underline">
          جرّبها في اسأل حكيم ←
        </Link>
      </div>
      <div className="mt-5">
        <LegalChatWorkspace config={config} />
      </div>
    </div>
  );
}
