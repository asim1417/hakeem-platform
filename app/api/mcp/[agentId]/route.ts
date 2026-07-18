// ─────────────────────────────────────────────────────────────────────────────
// /api/mcp/[agentId] — مدخل تسليم الوكلاء المخصّصين (طبقة MCP).
//   • المصادقة: مفتاح API (نطاق legal:read) أو جلسة داخلية — عبر بوّابة النواة القائمة.
//   • قيد النطاق إلزاميّ: كل استرجاعٍ مقيّدٌ بـ scope.defaultSystems للوكيل.
//   • الحرّاس البرمجيّة تعمل على نتيجة المحرّك الفعليّة (تأريض/نطاق/نفاذ/اختلاق/موقف).
// GET: كتالوج أدوات الوكيل. POST: استدعاء أداة. للقراءة فقط. لا يلمس الأمن ولا نواة الترتيب.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { requireLegalReadAccess } from "@/lib/modules/api-gateway/gateway-auth";
import {
  getManifest,
  validateManifest,
  stanceFromArabic,
} from "@/lib/agent-runtime/live/manifests";
import { createRunEngine } from "@/lib/agent-runtime/live/run-engine";
import { composeGrounded } from "@/lib/agent-runtime/live/compose";
import { handleSearch, isForbiddenCell, type TaskMode } from "@/lib/agent-runtime/pipeline/searchRoute";
import { computeDeadline, type HDate } from "@/lib/agent-runtime/tools/hijriDateCalc";
import type { Stance } from "@/lib/agent-runtime/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MCP_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, x-api-key, Content-Type",
  "Access-Control-Max-Age": "86400",
};
const cors = (res: NextResponse): NextResponse => {
  for (const [k, v] of Object.entries(MCP_CORS)) res.headers.set(k, v);
  return res;
};
const json = (body: unknown, status = 200) => cors(NextResponse.json(body, { status }));

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: MCP_CORS });
}

const TASK_MODES: TaskMode[] = ["ask", "consultation", "chat", "analyze-case", "action-plan", "verdict-estimate"];
const isTaskMode = (v: unknown): v is TaskMode => typeof v === "string" && TASK_MODES.includes(v as TaskMode);
const isDeadlineTool = (t: string) => /مهل|hijri|deadline/i.test(t) || t === "hijri_date_calc";
const isHDate = (v: unknown): v is HDate =>
  !!v && typeof v === "object" &&
  typeof (v as HDate).year === "number" && typeof (v as HDate).month === "number" && typeof (v as HDate).day === "number";

export async function GET(request: NextRequest, { params }: { params: { agentId: string } }): Promise<NextResponse> {
  const gate = await requireLegalReadAccess(request);
  if (gate.response) return cors(gate.response);

  const m = getManifest(params.agentId);
  if (!m) return json({ ok: false, error: "وكيلٌ غير معروف." }, 404);
  const errs = validateManifest(m);

  return json({
    ok: true,
    agent: {
      agentId: m.agentId,
      displayName: m.displayName,
      version: m.version,
      role: m.practiceProfile.role,
      scope: m.scope.defaultSystems,
      approval: m.approval.status,
      approved: m.approval.status === "approved",
      valid: errs.length === 0,
      validationErrors: errs,
      subRoles: (m.subRoles ?? []).map((sr) => ({ subRoleId: sr.subRoleId, displayName: sr.displayName, stance: sr.stance })),
      tools: [
        ...(m.mcp?.exposedTools ?? []),
        ...(m.skills.some((s) => s.engineTools.includes("hijri_date_calc")) ? ["احسب_المهلة"] : []),
      ],
      note: m.approval.status === "approved" ? undefined : "الوكيل قيد الاعتماد (تجريبيّ) — لم يجتز بوابة المطابقة بعد.",
    },
  });
}

export async function POST(request: NextRequest, { params }: { params: { agentId: string } }): Promise<NextResponse> {
  const gate = await requireLegalReadAccess(request);
  if (gate.response) return cors(gate.response);

  const m = getManifest(params.agentId);
  if (!m) return json({ ok: false, error: "وكيلٌ غير معروف." }, 404);
  if (validateManifest(m).length) return json({ ok: false, error: "مانيفست الوكيل غير مطابقٍ للمخطط." }, 500);

  let body: { tool?: string; subRoleId?: string; taskMode?: string; input?: Record<string, unknown> } = {};
  try {
    body = await request.json();
  } catch {
    /* تجاهل */
  }
  const tool = String(body?.tool ?? "").trim();
  if (!tool) return json({ ok: false, error: "اسم الأداة مطلوب (tool)." }, 400);

  // الموقف: من الدور الفرعيّ المختار إن وُجد، وإلا محايد.
  const subRole = body?.subRoleId ? (m.subRoles ?? []).find((sr) => sr.subRoleId === body.subRoleId) : undefined;
  if (body?.subRoleId && !subRole) return json({ ok: false, error: "دورٌ فرعيّ غير معروف." }, 400);
  const stance: Stance = subRole ? stanceFromArabic(subRole.stance) : "neutral";
  const roleKey = m.practiceProfile.role === "باحث_قانوني" ? "researcher" : undefined;

  // ── أداة المهلة الحتميّة (hijri_date_calc) ──
  if (isDeadlineTool(tool)) {
    if (!m.skills.some((s) => s.engineTools.includes("hijri_date_calc"))) {
      return json({ ok: false, error: "هذا الوكيل لا يكشف أداة حساب المهلة." }, 400);
    }
    const notify = body?.input?.notifyHijri;
    const periodDays = Number(body?.input?.periodDays);
    if (!isHDate(notify) || !Number.isFinite(periodDays)) {
      return json({ ok: false, error: "مدخلات المهلة: notifyHijri:{year,month,day} و periodDays (عدد)." }, 400);
    }
    const r = computeDeadline(notify, periodDays);
    return json({
      ok: true, tool: "احسب_المهلة", kind: "deadline",
      result: {
        start: r.start, periodDays: r.periodDays, dueHijri: r.due, dueGregorian: r.dueGregorian,
        note: "جمع الأيام دقيقٌ (JDN). قد يخالف أم القرى الرسميّ بيوم لمهلةٍ مُلزِمة.",
      },
    });
  }

  // ── أداة البحث المقيّد بالنطاق (تمرّ بالحرّاس على نتيجة المحرّك الفعليّة) ──
  const query = String(body?.input?.query ?? "").trim().slice(0, 500);
  if (!query) return json({ ok: false, error: "مدخل البحث مطلوب (input.query)." }, 400);
  const taskMode: TaskMode = isTaskMode(body?.taskMode) ? body.taskMode : "ask";

  // بوّابة الخلية المحرّمة (موقف × نمط) قبل أي استرجاع.
  if (isForbiddenCell(stance, taskMode, roleKey)) {
    return json({ ok: false, status: "blocked", reason: `النمط «${taskMode}» محظورٌ لهذا الموقف.`, suggestion: "analyze-case" }, 200);
  }

  const result = await handleSearch(
    { query, scope: m.scope.defaultSystems, stance, taskMode, roleKey },
    { runEngine: createRunEngine(), compose: composeGrounded }
  );

  if (result.status === "blocked") {
    return json({ ok: false, status: "blocked", reason: result.reason, suggestion: result.suggestion });
  }
  if (result.status === "rejected") {
    return json({ ok: false, status: "rejected", rejects: result.verdict.rejects }, 422);
  }
  return json({
    ok: true, tool, kind: "search", status: "ok",
    answer: {
      title: result.answer.title,
      sections: result.answer.sections,
      sources: result.answer.sources,
      scope: result.answer.scope,
    },
  });
}
