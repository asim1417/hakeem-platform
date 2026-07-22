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
export const maxDuration = 300;

/** يكشف التحيّة أو السؤال التعريفيّ (من أنت/ما تخصصك) — كي يتحاور الوكيل ويبيّن تخصصه بلا حاجة لسندٍ نظاميّ. */
function smalltalkOrMeta(q: string): "greeting" | "meta" | null {
  const t = q.replace(/[؟?.!،:]/g, " ").replace(/\s+/g, " ").trim();
  if (/^(السلام عليكم|سلام|مرحبا|أهلا|اهلا|هلا|صباح|مساء|كيف حالك|كيفك|هلا والله|هاي|hi|hello|hey)\b/i.test(t)) return "greeting";
  if (/(من أنت|من انت|ما تخصص|وش تخصص|ما هو تخصص|ماذا تفعل|وش تسوي|وش تعمل|ماذا تعمل|كيف تعمل|ما قدرات|قدراتك|ما نطاق|نطاقك|ما هي مهام|مهامك|بماذا تساعد|كيف تساعد|ما اسمك|عرّف بنفسك|عرف بنفسك|من تكون|وش انت)/.test(t)) return "meta";
  return null;
}

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
        // ⓪ تحيّةٌ أو سؤالٌ تعريفيّ: يتحاور الوكيل ويبيّن تخصصه ونطاقه وأدواره — بلا حاجة لسندٍ نظاميّ.
        const meta = smalltalkOrMeta(message);
        if (meta) {
          const roles = (m.subRoles ?? []).map((sr) => sr.displayName || sr.subRoleId).filter(Boolean);
          const scopeList = scope.map((s) => s.replace(/-/g, " ")).join(" · ");
          const intro = [
            meta === "greeting" ? "وعليكم السلام ورحمة الله وبركاته." : "",
            `أنا «${m.displayName ?? roleName}»${roleName ? ` — ${roleName}` : ""} داخل منصّة حكيم.`,
            `تخصّصي مقيّدٌ بنطاقٍ نظاميّ محدّد: ${scopeList}.`,
            roles.length ? `أعمل بأدوارٍ فرعيّة يمكنك اختيارها: ${roles.join(" · ")}.` : "",
            "أجيب مؤصَّلًا بمواد هذه الأنظمة النافذة حصريًّا — بلا اختلاقٍ ولا خروجٍ عن النطاق. اطرح مسألتك القانونيّة ضمن هذا النطاق لأحلّلها لك مستندًا للمواد، وما خرج عن نطاقي فوجِّهه إلى «اسأل حكيم» لبحثٍ أوسع.",
          ].filter(Boolean).join(" ");
          send({ type: "basis", sources: [], scope });
          for (const w of intro.split(/(\s+)/)) if (w) send({ type: "delta", text: w });
          send({ type: "done" });
          return;
        }

        // ① استرجاعٌ مقيّدٌ بنطاق الوكيل، مُرتّبٌ بالصلة (المواد النافذة فقط سندًا). مجموعةٌ أوسع
        //    (٤٠ مرشّحًا) ثمّ أفضل ١٠ صلةً — تأصيلٌ أقوى من لقطةٍ ضيّقة.
        const runEngine = createRunEngine({ limit: 40 });
        const er = await runEngine(message, scope).catch(() => ({ articles: [], scopeSystems: [] as string[] }));
        const live = er.articles.filter((a) => a.enforcement !== "لاغٍ").slice(0, 10);
        send({ type: "basis", sources: live.map((a) => ({ system: a.system, article: a.article, enforcement: a.enforcement })), scope });

        if (!live.length) {
          send({ type: "delta", text: "لا يوجد سندٌ نظاميٌّ نافذٌ مطابقٌ ضمن نطاق هذا الوكيل لسؤالك. جرّب إعادة صياغته، أو استخدم «اسأل حكيم» لبحثٍ أوسع عبر كلّ الأنظمة." });
          send({ type: "done" });
          return;
        }

        const groundingText = live
          .map((a, i) => `[${i + 1}] ${a.system} — المادة ${a.article} (${a.enforcement}):\n${a.text.slice(0, 700)}`)
          .join("\n\n");

        const cfg = await resolveAiConfig();
        // سقوطٌ حتميّ: لا مفتاح نموذج ⇒ عرض المواد المؤصَّلة مباشرةً (لا اختلاق).
        if (cfg.provider === "offline" || !cfg.apiKey) {
          send({ type: "delta", text: `المواد النظاميّة النافذة ضمن نطاق الوكيل المطابقة لسؤالك:\n\n${live.map((a) => `• ${a.system} — المادة ${a.article}`).join("\n")}\n\n(مزوّد النموذج غير مضبوطٍ حاليًّا؛ عُرضت المواد المؤصَّلة دون صياغةٍ تحليليّة.)` });
          send({ type: "done" });
          return;
        }

        const scopeList = scope.map((s) => s.replace(/-/g, " ")).join(" · ");
        const system = [
          `أنت «${m.displayName ?? roleName}» داخل منصّة حكيم — خبيرٌ ممارسٌ في: ${roleName || "القانون"}. تكتب بالفصحى منضبطًا بالمصادر، بعمق الخبير لا بإيجاز المُجمِل.`,
          `نطاق تخصصك النظاميّ: ${scopeList}. موقفك المهنيّ: ${stanceAr}. لا تُبدِ رأيًا شخصيًّا ولا تقرّر حكمًا نهائيًّا؛ حلّل بعمقٍ وأرشِد.`,
          "ابنِ التحليل بعمقٍ عمليّ: (١) تحرير المسألة وتكييفها، (٢) القاعدة النظاميّة الحاكمة من المواد المرفقة، (٣) التطبيق على وقائع السؤال، (٤) البدائل/المخاطر والترجيح، (٥) خلاصةٌ وتوصيةٌ عمليّة. استعمل عناوين Markdown وقوائم عند الحاجة.",
          "استند حصريًا للمواد المرفقة من نطاق الوكيل أدناه. لا تذكر مادةً ليست فيها، ولا رقم مادةٍ غير واردٍ في نصّها. إن لم تكفِ المواد لجانبٍ من الجواب فصرّح بذلك صراحةً بدل الاختلاق.",
          "اختم بتنبيهٍ مهنيّ مختصر أنّ المخرَج مسودّةٌ تحتاج مراجعة المختصّ.",
        ].join("\n");
        const userPrompt = [
          history ? `سياق المحادثة السابق:\n${history}\n` : "",
          `رسالة المستخدم:\n${message}`,
          `\nالمواد المتاحة من نطاق الوكيل (السند الوحيد المسموح):\n${groundingText}`,
          "\nقاعدة إلزامية: لا تستشهد إلا بالمواد أعلاه، ولا تخترع مواد أو أرقام مواد.",
        ].filter(Boolean).join("\n");

        // توليدٌ متعمّقٌ مفتوح: بحدّ النموذج الأقصى في كلّ نداء، ومواصلةٌ تلقائيّة إن اقتُطِع —
        // فيقدّم الوكيل تحليل الخبير كاملًا لا ردًّا مبتورًا.
        let any = false;
        let acc = "";
        let round = 0;
        for (;;) {
          const meta = { truncated: false };
          const roundUser = round === 0 ? userPrompt : `${userPrompt}\n\n— ما كُتب حتى الآن (تابع من حيث توقفت تمامًا، دون تكرار):\n${acc}`;
          let produced = false;
          for await (const chunk of streamWithConfig(cfg, system, roundUser, 6000, meta)) {
            any = true; produced = true; acc += chunk; send({ type: "delta", text: chunk });
          }
          round += 1;
          if (!meta.truncated || !produced || round >= 4) break;
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
