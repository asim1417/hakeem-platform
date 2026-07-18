// اعتماد الوكلاء — يُجري بوابة المطابقة على كل مانيفست، وعند الاجتياز يختم الاعتماد في الملف.
// يُشغَّل: `npm run agents:approve`. يكتب approval.status=approved + الحالات المجتازة + الختم.
import { readFileSync, writeFileSync } from "node:fs";
import { approveAgent } from "@/lib/agent-runtime/live/approval";
import type { AgentManifest } from "@/lib/agent-runtime/live/manifests";

const AGENTS = ["commercial-litigator", "insolvency-practitioner", "judge-aide"];
const STAMP = new Date().toISOString();

(async () => {
  let failed = 0;
  for (const name of AGENTS) {
    const path = `agents/${name}/manifest.json`;
    const m = JSON.parse(readFileSync(path, "utf8")) as AgentManifest;
    const r = await approveAgent(m);

    const line = (g: { id: string; pass: boolean }) => `${g.pass ? "✓" : "✗"} ${g.id}`;
    console.log(`\n${r.agentId}`);
    console.log("  المحرّك: " + r.engineGate.map(line).join("  "));
    console.log("  الوكيل: " + (r.agentGate.length ? r.agentGate.map(line).join("  ") : "— بلا أدوار فرعية"));

    if (!r.approved) {
      console.log("  ⟶ لم يُعتمد (إخفاق في المطابقة).");
      failed++;
      continue;
    }
    m.approval = {
      status: "approved",
      approvedBy: "conformance-gate",
      approvedAt: STAMP,
      conformanceTestsPassed: r.conformanceTestsPassed,
      agentConformanceTestsPassed: r.agentConformanceTestsPassed,
    } as AgentManifest["approval"];
    writeFileSync(path, JSON.stringify(m, null, 2) + "\n", "utf8");
    console.log(`  ⟶ اعتُمِد ✅ (HLS: ${r.conformanceTestsPassed.length}/6 · حالات موقف: ${r.agentConformanceTestsPassed.length})`);
  }

  console.log(`\n${AGENTS.length - failed}/${AGENTS.length} معتمد`);
  process.exit(failed ? 1 : 0);
})();
