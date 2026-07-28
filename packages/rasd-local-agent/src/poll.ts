import { requireIdentity, signedFetch } from "./cloud";
import { executeJob, uploadResult, type SignedJob } from "./execute";
import { getUiState, updateUiState } from "./ui/status-server";
import { AGENT_VERSION } from "./identity";

export async function heartbeatLoop(signal: { stopped: boolean }): Promise<void> {
  const identity = requireIdentity();
  while (!signal.stopped) {
    if (getUiState().paused) {
      await sleep(2000);
      continue;
    }
    try {
      const res = await signedFetch(identity, "POST", "/api/rasd/agent/heartbeat", {
        version: AGENT_VERSION,
        egressCountry: getUiState().sources ? undefined : undefined
      });
      const json = (await res.json()) as { status?: string; pollAfterMs?: number };
      updateUiState({ connected: res.ok, lastError: res.ok ? null : JSON.stringify(json) });
      await claimAndRun();
      await sleep(json.pollAfterMs ?? 5000);
    } catch (error) {
      updateUiState({ connected: false, lastError: error instanceof Error ? error.message : String(error) });
      await sleep(5000);
    }
  }
}

async function claimAndRun(): Promise<void> {
  if (getUiState().paused) return;
  const identity = requireIdentity();
  const res = await signedFetch(identity, "POST", "/api/rasd/agent/jobs/claim", {});
  const json = (await res.json()) as { job?: SignedJob | null };
  if (!json.job) return;
  updateUiState({ currentJob: json.job.jobId });
  try {
    const result = await executeJob(json.job);
    const upload = await uploadResult(result);
    const docs = Array.isArray(result.documents) ? result.documents.length : 0;
    const sources: Record<string, string | null> = { ...getUiState().sources };
    for (const s of result.sourceSummaries as Array<{ sourceCode: string; healthClass?: string }>) {
      sources[s.sourceCode] = s.healthClass ?? null;
    }
    updateUiState({
      currentJob: null,
      lastRun: new Date().toISOString(),
      documents: getUiState().documents + docs,
      sources,
      lastError: null
    });
    console.log(JSON.stringify({ message: "job_finished", upload }));
  } catch (error) {
    updateUiState({
      currentJob: null,
      lastError: error instanceof Error ? error.message : String(error)
    });
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
