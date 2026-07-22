// ─────────────────────────────────────────────────────────────────────────────
// /api/agents/[agentId]/chat — محادثةٌ حيّة مؤصَّلة لوكيلٍ مخصّص (بثّ NDJSON).
// الاسترجاع **مقيّدٌ بنطاق الوكيل** (scope.defaultSystems) عبر محرّك طبقة التشغيل نفسه،
// ثمّ يُصاغ ردٌّ نموذجيّ مستندٌ حصريًا لتلك المواد (لا اختلاق، لا خروج عن النطاق).
// سقوطٌ آمن إلى عرض المواد المؤصَّلة عند غياب مفتاح النموذج. جلسةٌ داخليّة، للقراءة فقط.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { getManifest } from "@/lib/agent-runtime/live/manifests";
import { createRunEngine } from "@/lib/agent-runtime/live/run-engine";
import { resolveAiConfig, streamWithConfig } from "@/lib/modules/ai/ai-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: { agentId: string } }): Promise<Response> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return new Response(JSON.stringify({ type: "error", message: "يلزم تسجيل الدخول." }), { status: 401, headers: { "Content-Type": "application/json; charset=utf-8" } });

  const m = getManifest(params.agentId);
  if (!m) return new Response(JSON.stringify({ type: "error", message: "وكيلٌ غير معروف." }), { status: 404, headers: { "Content-Type": "application/json; charset=utf-8" } });

  let body: { message?: string; history?: Array<{ role?: string; content?: string }>; subRoleId?: string } = {};
  try { body = await request.json(); } catch { /* تجاهل */ }
  const message = String(body?.message ?? "").trim().slice(0, 2000);
  if (!message) return new Response(JSON.stringify({ type: "error", message: "اكتب رسالتك أولًا." }), { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } });

  const scope = m.scope.defaultSystems;
  const subRole = body?.subRoleId ? (m.subRoles ?? []).find((sr) => sr.subRoleId === body.subRoleId) : undefined;
  const stanceAr = subRole?.stance ?? "محايد";
  const roleName = (m.practiceProfile.role || "").replace(/_/g, " ").trim();
  const history = (Array.isArray(body?.history) ? body.history : [])
    .filter((h) => (h?.role === "user" || h?.role === "assistant") && typeof h?.content === "string" && h.content.trim())
    .slice(-6)
    .map((h) => `${h.role === "user" ? "المستخدم" : "الوكيل"}: ${String(h.content).slice(0, 500)}`)
    .join("\n");

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
      try {
        // ① استرجاعٌ مقيّدٌ بنطاق الوكيل (المواد النافذة فقط تُقدَّم سندًا).
        const runEngine = createRunEngine({ limit: 12 });
        const er = await runEngine(message, scope).catch(() => ({ articles: [], scopeSystems: [] as string[] }));
        const live = er.articles.filter((a) => a.enforcement !== "لاغٍ").slice(0, 8);
        send({ type: "basis", sources: live.map((a) => ({ system: a.system, article: a.article, enforcement: a.enforcement })), scope });

        if (!live.length) {
          send({ type: "delta", text: "لا يوجد سندٌ نظاميٌّ نافذٌ مطابقٌ ضمن نطاق هذا الوكيل لسؤالك. جرّب إعادة صياغته، أو استخدم «اسأل حكيم» لبحثٍ أوسع عبر كلّ الأنظمة." });
          send({ type: "done" });
          return;
        }

        const groundingText = live
          .map((a, i) => `[${i + 1}] ${a.system} — المادة ${a.article} (${a.enforcement}):\n${a.text.slice(0, 500)}`)
          .join("\n\n");

        const cfg = await resolveAiConfig();
        // سقوطٌ حتميّ: لا مفتاح نموذج ⇒ عرض المواد المؤصَّلة مباشرةً (لا اختلاق).
        if (cfg.provider === "offline" || !cfg.apiKey) {
          send({ type: "delta", text: `المواد النظاميّة النافذة ضمن نطاق الوكيل المطابقة لسؤالك:\n\n${live.map((a) => `• ${a.system} — المادة ${a.article}`).join("\n")}\n\n(مزوّد النموذج غير مضبوطٍ حاليًّا؛ عُرضت المواد المؤصَّلة دون صياغةٍ تحليليّة.)` });
          send({ type: "done" });
          return;
        }

        const system = [
          `أنت «${m.displayName ?? roleName}» داخل منصّة حكيم — ${roleName || "معاونٌ قانونيّ"}، تكتب بالفصحى منضبطًا بالمصادر.`,
          `موقفك المهنيّ: ${stanceAr}. لا تُبدِ رأيًا شخصيًّا ولا تقرّر حكمًا نهائيًّا؛ حلّل وأرشِد للقاضي/المستخدم.`,
          "استند حصريًا للمواد المرفقة من نطاق الوكيل أدناه. لا تذكر مادةً ليست فيها، ولا رقم مادةٍ غير واردٍ في نصّها. إن لم تكفِ المواد فصرّح بذلك بدل الاختلاق.",
          "اكتب بالعربية بأسلوبٍ منظّمٍ ومختصر، واختم بتنبيهٍ مهنيّ.",
        ].join("\n");
        const userPrompt = [
          history ? `سياق المحادثة السابق:\n${history}\n` : "",
          `رسالة المستخدم:\n${message}`,
          `\nالمواد المتاحة من نطاق الوكيل (السند الوحيد المسموح):\n${groundingText}`,
          "\nقاعدة إلزامية: لا تستشهد إلا بالمواد أعلاه، ولا تخترع مواد أو أرقام مواد.",
        ].filter(Boolean).join("\n");

        let any = false;
        for await (const chunk of streamWithConfig(cfg, system, userPrompt, 1400)) {
          any = true;
          send({ type: "delta", text: chunk });
        }
        if (!any) send({ type: "delta", text: "تعذّر توليد ردٍّ نصيّ من النموذج؛ راجع المواد المؤصَّلة أعلاه." });
        send({ type: "done" });
      } catch {
        send({ type: "error", message: "تعذّر تنفيذ المحادثة حاليًا. أعد المحاولة." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}
