import { createServer } from "http";
import { AGENT_VERSION, loadIdentity } from "../identity";

export type AgentUiState = {
  connected: boolean;
  displayName: string;
  agentId: string | null;
  sources: Record<string, string | null>;
  lastRun: string | null;
  currentJob: string | null;
  documents: number;
  lastError: string | null;
  paused: boolean;
  cloudBaseUrl: string | null;
};

let state: AgentUiState = {
  connected: false,
  displayName: "غير مقترن",
  agentId: null,
  sources: { BOE: null, NCAR: null, UQN: null },
  lastRun: null,
  currentJob: null,
  documents: 0,
  lastError: null,
  paused: false,
  cloudBaseUrl: null
};

export function updateUiState(patch: Partial<AgentUiState>): void {
  state = { ...state, ...patch };
}

export function getUiState(): AgentUiState {
  return state;
}

/** Localhost-only status UI — not exposed publicly; no inbound from internet required for cloud jobs. */
export function startLocalStatusServer(port = Number(process.env.HAKEEM_RASD_UI_PORT || 8788)): void {
  const identity = loadIdentity();
  if (identity) {
    updateUiState({
      displayName: identity.displayName,
      agentId: identity.agentId,
      cloudBaseUrl: identity.cloudBaseUrl,
      connected: true
    });
  }

  const server = createServer((req, res) => {
    if (req.url === "/pause" && req.method === "POST") {
      updateUiState({ paused: true });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ paused: true }));
      return;
    }
    if (req.url === "/resume" && req.method === "POST") {
      updateUiState({ paused: false });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ paused: false }));
      return;
    }
    const s = getUiState();
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>جسر رصد حكيم</title>
<style>body{font-family:Tahoma,sans-serif;background:#F7F2EA;color:#0E3435;margin:2rem}card{display:block;background:#fff;border:1px solid rgba(14,52,53,.1);border-radius:.75rem;padding:1.25rem;margin:.75rem 0}button{margin-left:.5rem;padding:.5rem 1rem}</style></head><body>
<h1>جسر رصد حكيم المحلي</h1>
<p>الإصدار ${AGENT_VERSION}</p>
<card><b>الاتصال بحكيم:</b> ${s.connected ? "متصل" : "غير متصل"}</card>
<card><b>الجهاز:</b> ${s.displayName}<br/><b>المعرّف:</b> ${s.agentId ?? "—"}</card>
<card><b>BOE:</b> ${s.sources.BOE ?? "—"} · <b>NCAR:</b> ${s.sources.NCAR ?? "—"} · <b>UQN:</b> ${s.sources.UQN ?? "—"}</card>
<card><b>التشغيل الحالي:</b> ${s.currentJob ?? "لا يوجد"}<br/><b>آخر تشغيل:</b> ${s.lastRun ?? "—"}<br/><b>وثائق:</b> ${s.documents}</card>
<card><b>خطأ أخير:</b> ${s.lastError ?? "لا يوجد"}</card>
<button onclick="fetch('/pause',{method:'POST'})">إيقاف مؤقت</button>
<button onclick="fetch('/resume',{method:'POST'})">استئناف</button>
${s.cloudBaseUrl ? `<p><a href="${s.cloudBaseUrl}/admin/rasd/agents" target="_blank">فتح لوحة حكيم</a></p>` : ""}
</body></html>`;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(JSON.stringify({ message: "local_ui_listening", port, bind: "127.0.0.1" }));
  });
}
