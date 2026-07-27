"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

type AgentRow = {
  id: string;
  displayName: string;
  platform: string;
  version: string;
  status: string;
  presence: string;
  lastSeenAt: string | null;
  lastEgressCountry: string | null;
  egressVerifiedAt: string | null;
  boeHealth: string | null;
  ncarHealth: string | null;
  uqnHealth: string | null;
  isDefault: boolean;
  approvedSources: string[];
};

type PairingPayload = {
  code: string;
  expiresAt: string;
  pairingUrl: string;
};

export function RasdAgentsClient() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [pairing, setPairing] = useState<PairingPayload | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [jobType, setJobType] = useState("SOURCE_HEALTH_CHECK");
  const [limit, setLimit] = useState(10);
  const [dryRun, setDryRun] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const res = await fetch("/api/admin/rasd/agents");
      const json = await res.json();
      if (res.ok) {
        setAgents(json.agents ?? []);
        if (!selectedAgentId && json.agents?.[0]?.id) setSelectedAgentId(json.agents[0].id);
      } else setMessage(json.message || json.errorCode || "تعذر تحميل الوكلاء");
    });
  }, [selectedAgentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function createPairing() {
    startTransition(async () => {
      const res = await fetch("/api/admin/rasd/agents/pairing", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.message || "فشل إنشاء رمز الاقتران");
        return;
      }
      setPairing({ code: json.code, expiresAt: json.expiresAt, pairingUrl: json.pairingUrl });
      setMessage("رمز اقتران لمرة واحدة — صالح حتى 10 دقائق.");
    });
  }

  function runJob() {
    startTransition(async () => {
      const agent = agents.find((a) => a.id === selectedAgentId);
      if (!agent) {
        setMessage("اختر جهاز رصد");
        return;
      }
      const res = await fetch("/api/admin/rasd/agents/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgentId,
          type: jobType,
          sourceCodes: ["BOE", "NCAR", "UQN"],
          limit,
          dryRun
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.errorCode || json.message || "فشل إنشاء المهمة");
        return;
      }
      setMessage(`تم إنشاء المهمة ${json.jobId}. ينفّذها الوكيل المحلي عند السحب. auto-apply=false`);
      refresh();
    });
  }

  function patchAgent(body: Record<string, unknown>) {
    startTransition(async () => {
      const res = await fetch("/api/admin/rasd/agents", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!res.ok) setMessage(json.errorCode || json.message || "فشل التحديث");
      else refresh();
    });
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={createPairing}
          className="rounded-md bg-[#0E3435] px-4 py-2 text-sm font-semibold text-[#F7F2EA]"
          disabled={pending}
        >
          إضافة جهاز رصد داخل السعودية
        </button>
        <button type="button" onClick={refresh} className="rounded-md border border-[rgba(14,52,53,0.2)] px-4 py-2 text-sm" disabled={pending}>
          تحديث
        </button>
      </div>

      {pairing ? (
        <div className="rounded-[0.75rem] border border-[#8B6914]/40 bg-[#FFF8E8] p-5">
          <p className="font-bold text-[#0E3435]">رمز الاقتران (مرة واحدة)</p>
          <p className="mt-2 font-mono text-3xl tracking-widest text-[#0E3435]">{pairing.code}</p>
          <p className="mt-2 text-sm text-[rgba(14,52,53,0.65)]">ينتهي: {new Date(pairing.expiresAt).toLocaleString("ar-SA")}</p>
          <p className="mt-1 text-xs text-[rgba(14,52,53,0.55)]">QR payload: {pairing.code}</p>
          <p className="mt-3 text-sm">يفتح المستخدم تطبيق جسر رصد حكيم المحلي ويُدخل الرمز. المفتاح الخاص لا يغادر الجهاز.</p>
        </div>
      ) : null}

      {message ? <p className="text-sm text-[#8B3A2A]">{message}</p> : null}

      <section id="downloads" className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-white p-5 text-sm leading-7">
        <h2 className="text-lg font-bold">التثبيت</h2>
        <p className="mt-2 text-[rgba(14,52,53,0.7)]">
          الحزم الموقّعة للمستخدم النهائي قيد التحضير. النسخة التقنية الحالية عبر حزمة المستودع
          <code className="mx-1">packages/rasd-local-agent</code>
          — بعد الاقتران الأول يعمل الوكيل كخدمة/واجهة محلية دون أوامر يومية.
        </p>
        <ul className="mt-2 list-disc pr-5">
          <li id="download-windows">Windows 10/11: شغّل الوكيل ثم ثبّته كخدمة اختيارية (انظر دليل التثبيت).</li>
          <li id="download-mac">macOS: تطبيق/LaunchAgent (توقيع Apple عند توفر الشهادة).</li>
          <li id="download-linux">Linux: systemd unit موثّق.</li>
        </ul>
        <p className="mt-2 text-xs text-[rgba(14,52,53,0.55)]">لا تُوصف الحزم غير الموقّعة بأنها جاهزة للمستخدم النهائي.</p>
      </section>

      <section className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-5">
        <h2 className="text-lg font-bold">تشغيل من اللوحة</h2>
        <p className="mt-1 text-sm text-[rgba(14,52,53,0.65)]">BOE/NCAR = LOCAL_REQUIRED — لا تنفيذ من Vercel. UQN يمكنه CLOUD أو LOCAL.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            الجهاز
            <select className="mt-1 w-full rounded border px-2 py-2" value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName} ({a.presence})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            نوع المهمة
            <select className="mt-1 w-full rounded border px-2 py-2" value={jobType} onChange={(e) => setJobType(e.target.value)}>
              <option value="SOURCE_HEALTH_CHECK">فحص اتصال المصادر</option>
              <option value="AGENT_SELF_TEST">اختبار ذاتي للوكيل</option>
              <option value="DISCOVER_DOCUMENTS">مسح تجريبي / اكتشاف</option>
              <option value="BASELINE_DRY_RUN">المسح التأسيسي (dry-run)</option>
              <option value="WEEKLY_SCAN">المسح الأسبوعي</option>
            </select>
          </label>
          <label className="text-sm">
            حد الوثائق
            <input type="number" min={1} max={50} className="mt-1 w-full rounded border px-2 py-2" value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          </label>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            dry-run (افتراضي ومُلزم قبل الاعتماد اليدوي)
          </label>
        </div>
        <button type="button" onClick={runJob} className="mt-4 rounded-md bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white" disabled={pending || !selectedAgentId}>
          تشغيل الآن
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">الأجهزة</h2>
        {agents.length === 0 ? <p className="text-sm text-[rgba(14,52,53,0.55)]">لا أجهزة بعد.</p> : null}
        {agents.map((agent) => (
          <article key={agent.id} className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-white p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold text-[#0E3435]">
                  {agent.displayName} {agent.isDefault ? "· افتراضي" : ""}
                </p>
                <p>
                  {agent.platform} · v{agent.version} · {agent.presence}
                </p>
                <p>
                  خروج: {agent.lastEgressCountry ?? "غير مُثبَّت"} {agent.egressVerifiedAt ? `· ${new Date(agent.egressVerifiedAt).toLocaleString("ar-SA")}` : ""}
                </p>
                <p>
                  BOE: {agent.boeHealth ?? "—"} · NCAR: {agent.ncarHealth ?? "—"} · UQN: {agent.uqnHealth ?? "—"}
                </p>
                <p className="text-xs text-[rgba(14,52,53,0.55)]">آخر ظهور: {agent.lastSeenAt ? new Date(agent.lastSeenAt).toLocaleString("ar-SA") : "—"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded border px-2 py-1" onClick={() => patchAgent({ agentId: agent.id, setDefault: true })}>
                  افتراضي
                </button>
                <button type="button" className="rounded border px-2 py-1" onClick={() => patchAgent(agent.status === "PAUSED" ? { agentId: agent.id, resume: true } : { agentId: agent.id, pause: true })}>
                  {agent.status === "PAUSED" ? "استئناف" : "إيقاف مؤقت"}
                </button>
                <button type="button" className="rounded border px-2 py-1 text-[#8B3A2A]" onClick={() => patchAgent({ agentId: agent.id, revoke: true })}>
                  سحب صلاحية
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      <p className="text-xs text-[rgba(14,52,53,0.55)]">
        للجدولة الأسبوعية (السبت 03:00 الرياض): يجب أن يبقى الجهاز Online وقت التنفيذ. لا تسقط المنصة إلى السحابة لمصادر LOCAL_REQUIRED.
      </p>
    </div>
  );
}
