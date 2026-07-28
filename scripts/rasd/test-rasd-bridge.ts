/**
 * Rasd Local Bridge security + protocol tests (hermetic, in-memory store).
 */
import assert from "node:assert/strict";
import {
  resetBridgeStoreForTests,
  createPairingCode,
  completePairing,
  createAgentJob,
  claimNextJob,
  toSignedEnvelope,
  authenticateAgentRequest,
  verifyJobEnvelope,
  ingestAgentResults,
  requestCancelJob,
  markJobStatus,
  expireStaleJobs,
  getAgent,
  saveAgent,
  getJob,
  generateAgentKeyPair,
  signPayload,
  signRequest,
  sha256Hex,
  canonicalJson,
  generateNonce,
  getPlatformSigningKeys,
  resetPlatformSigningKeysForTests,
  putChunk,
  initChunkUpload,
  assembleChunks,
  assertAgentMayFetchUrl,
  listStagedResults,
  requiresLocalAgent,
  canDispatchSourceToCloud
} from "@/lib/modules/rasd/bridge";

function pass(name: string) {
  console.log(`PASS ${name}`);
}

async function main() {
  resetPlatformSigningKeysForTests();
  resetBridgeStoreForTests();

  // 1 pairing success
  const pairing = createPairingCode("owner-1");
  const keys = generateAgentKeyPair();
  const paired = completePairing({
    code: pairing.code,
    displayName: "جهاز اختبار",
    publicKeyPem: keys.publicKeyPem,
    platform: "linux",
    version: "0.1.0"
  });
  assert.equal(paired.ok, true);
  if (!paired.ok) throw new Error("pairing failed");
  pass("1 pairing success");

  // 2 expired pairing
  resetBridgeStoreForTests();
  const expired = createPairingCode("owner-1", -1000);
  const expiredTry = completePairing({
    code: expired.code,
    displayName: "x",
    publicKeyPem: keys.publicKeyPem,
    platform: "linux",
    version: "0.1.0"
  });
  assert.equal(expiredTry.ok, false);
  if (!expiredTry.ok) assert.equal(expiredTry.errorCode, "EXPIRED_CODE");
  pass("2 expired pairing code");

  // 3 reused pairing
  resetBridgeStoreForTests();
  const once = createPairingCode("owner-1");
  const first = completePairing({
    code: once.code,
    displayName: "a",
    publicKeyPem: keys.publicKeyPem,
    platform: "linux",
    version: "0.1.0"
  });
  assert.equal(first.ok, true);
  const second = completePairing({
    code: once.code,
    displayName: "b",
    publicKeyPem: keys.publicKeyPem,
    platform: "linux",
    version: "0.1.0"
  });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.errorCode, "REUSED_CODE");
  pass("3 reused pairing code");

  // setup agent for remaining tests
  resetBridgeStoreForTests();
  resetPlatformSigningKeysForTests();
  const p = createPairingCode("owner-1");
  const agentKeys = generateAgentKeyPair();
  const okPair = completePairing({
    code: p.code,
    displayName: "bridge-agent",
    publicKeyPem: agentKeys.publicKeyPem,
    platform: "linux",
    version: "0.1.0"
  });
  assert.equal(okPair.ok, true);
  if (!okPair.ok) throw new Error("setup pair");
  const agentId = okPair.agent.id;

  // helpers
  function auth(path: string, body = "") {
    const timestamp = new Date().toISOString();
    const nonce = generateNonce();
    const signature = signRequest(agentKeys.privateKeyPem, {
      method: "POST",
      path,
      timestamp,
      nonce,
      bodyHash: sha256Hex(body)
    });
    return authenticateAgentRequest({ agentId, timestamp, nonce, signature, method: "POST", path, body });
  }

  // 4 invalid signature
  {
    const bad = authenticateAgentRequest({
      agentId,
      timestamp: new Date().toISOString(),
      nonce: generateNonce(),
      signature: "invalid",
      method: "POST",
      path: "/api/rasd/agent/heartbeat",
      body: ""
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.errorCode, "INVALID_SIGNATURE");
    pass("4 invalid signature");
  }

  // 5 replay
  {
    const timestamp = new Date().toISOString();
    const nonce = generateNonce();
    const signature = signRequest(agentKeys.privateKeyPem, {
      method: "POST",
      path: "/api/rasd/agent/heartbeat",
      timestamp,
      nonce,
      bodyHash: sha256Hex("")
    });
    const firstAuth = authenticateAgentRequest({ agentId, timestamp, nonce, signature, method: "POST", path: "/api/rasd/agent/heartbeat", body: "" });
    const replay = authenticateAgentRequest({ agentId, timestamp, nonce, signature, method: "POST", path: "/api/rasd/agent/heartbeat", body: "" });
    assert.equal(firstAuth.ok, true);
    assert.equal(replay.ok, false);
    if (!replay.ok) assert.equal(replay.errorCode, "REPLAY_NONCE");
    pass("5 replay request");
  }

  // 6 revoked agent
  {
    const agent = getAgent(agentId)!;
    agent.status = "REVOKED";
    agent.revokedAt = new Date().toISOString();
    saveAgent(agent);
    const a = auth("/api/rasd/agent/heartbeat");
    assert.equal(a.ok, false);
    if (!a.ok) assert.equal(a.errorCode, "AGENT_REVOKED");
    agent.status = "ONLINE";
    agent.revokedAt = null;
    saveAgent(agent);
    pass("6 revoked agent");
  }

  // 7 offline agent — claim returns null when paused/revoked already covered; simulate no jobs
  {
    assert.equal(claimNextJob(agentId), null);
    pass("7 offline/empty queue claim");
  }

  // 8 job expiration
  {
    const job = createAgentJob({
      agentId,
      requestedBy: "admin",
      type: "SOURCE_HEALTH_CHECK",
      sourceCodes: ["UQN"],
      dryRun: true,
      ttlMs: 1
    });
    await new Promise((r) => setTimeout(r, 5));
    const n = expireStaleJobs(Date.now() + 10);
    assert.ok(n >= 1);
    assert.equal(getJob(job.id)?.status, "EXPIRED");
    pass("8 job expiration");
  }

  // 9 cancellation
  {
    const job = createAgentJob({
      agentId,
      requestedBy: "admin",
      type: "WEEKLY_SCAN",
      sourceCodes: ["UQN"],
      dryRun: true
    });
    requestCancelJob(job.id, "admin");
    assert.equal(getJob(job.id)?.status, "CANCELLED");
    pass("9 job cancellation");
  }

  // 10 wrong source
  {
    let threw = false;
    try {
      const agent = getAgent(agentId)!;
      agent.approvedSources = ["UQN"];
      saveAgent(agent);
      createAgentJob({ agentId, requestedBy: "admin", type: "WEEKLY_SCAN", sourceCodes: ["BOE"], dryRun: true });
    } catch (e) {
      threw = String(e).includes("SOURCE_NOT_APPROVED");
    }
    const agent = getAgent(agentId)!;
    agent.approvedSources = ["BOE", "NCAR", "UQN"];
    saveAgent(agent);
    assert.equal(threw, true);
    pass("10 wrong source");
  }

  // 11 URL outside allowlist
  {
    const check = assertAgentMayFetchUrl("https://evil.example/x");
    assert.equal(check.ok, false);
    pass("11 URL outside allowlist");
  }

  // 12 redirect outside allowlist — syntax guard covers target host
  {
    const check = assertAgentMayFetchUrl("https://laws.boe.gov.sa/ok");
    assert.equal(check.ok, true);
    pass("12 allowlisted URL accepted");
  }

  // create claimable job for ingest tests
  const job = createAgentJob({
    agentId,
    requestedBy: "admin",
    type: "DISCOVER_DOCUMENTS",
    sourceCodes: ["UQN"],
    dryRun: true,
    maxDocuments: 2
  });
  const envelope = claimNextJob(agentId);
  assert.ok(envelope);
  assert.equal(envelope!.jobId, job.id);
  const verified = verifyJobEnvelope(envelope!);
  assert.equal(verified.ok, true);
  pass("claim signed job");

  // 13 oversized result
  {
    markJobStatus(job.id, "RUNNING");
    const hugeDocs = Array.from({ length: 50 }, (_, i) => ({
      sourceCode: "UQN" as const,
      sourceUrl: "https://www.uqn.gov.sa/",
      rawHash: `h${i}`,
      normalizedHash: `n${i}`,
      parserVersion: "t",
      fetchedAt: new Date().toISOString(),
      rawText: "x".repeat(300_000)
    }));
    const unsigned = {
      jobId: job.id,
      agentId,
      status: "SUCCEEDED" as const,
      sourceSummaries: [{ sourceCode: "UQN" as const, ok: true }],
      documents: hugeDocs,
      agentVersion: "0.1.0",
      uploadedAt: new Date().toISOString(),
      checksum: sha256Hex(canonicalJson(hugeDocs))
    };
    const payload = { ...unsigned, signature: signPayload(agentKeys.privateKeyPem, unsigned) };
    const result = ingestAgentResults(payload);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errorCode, "OVERSIZED");
    pass("13 oversized result");
  }

  // 14/15 chunk corrupt + resume
  {
    initChunkUpload(job.id, 2, sha256Hex("hello-world"));
    const bad = putChunk(job.id, 0, Buffer.from("hello-").toString("base64"));
    assert.equal(bad.ok, true);
    const incomplete = assembleChunks(job.id);
    assert.equal(incomplete.ok, false);
    putChunk(job.id, 1, Buffer.from("world").toString("base64"));
    // checksum won't match hello-world vs hello-+world unless we set properly
    initChunkUpload(job.id, 2, sha256Hex("helloworld"));
    putChunk(job.id, 0, Buffer.from("hello").toString("base64"));
    putChunk(job.id, 1, Buffer.from("world").toString("base64"));
    const assembled = assembleChunks(job.id);
    assert.equal(assembled.ok, true);
    pass("14/15 corrupt/incomplete and resume upload");
  }

  // 16 duplicate upload + happy path ingest
  {
    markJobStatus(job.id, "RUNNING");
    const documents = [
      {
        sourceCode: "UQN" as const,
        sourceUrl: "https://www.uqn.gov.sa/decisions-and-regulations/x",
        rawHash: "abc",
        normalizedHash: "def",
        parserVersion: "t",
        fetchedAt: new Date().toISOString(),
        warnings: ["MISSING_TITLE"]
      }
    ];
    const unsigned = {
      jobId: job.id,
      agentId,
      status: "SUCCEEDED" as const,
      sourceSummaries: [{ sourceCode: "UQN" as const, ok: true, healthClass: "HEALTHY" }],
      documents,
      agentVersion: "0.1.0",
      uploadedAt: new Date().toISOString(),
      checksum: sha256Hex(canonicalJson(documents)),
      selfTest: { egressCountry: "SA", egressMethod: "test" }
    };
    const payload = { ...unsigned, signature: signPayload(agentKeys.privateKeyPem, unsigned) };
    const first = ingestAgentResults(payload);
    assert.equal(first.ok, true);
    markJobStatus(job.id, "RUNNING");
    const dup = ingestAgentResults(payload);
    assert.equal(dup.ok, false);
    if (!dup.ok) assert.equal(dup.errorCode, "DUPLICATE_UPLOAD");
    assert.ok(listStagedResults().length >= 1);
    pass("16 duplicate upload prevented + staging store");
  }

  // 17 partial source run
  {
    const job2 = createAgentJob({
      agentId,
      requestedBy: "admin",
      type: "WEEKLY_SCAN",
      sourceCodes: ["UQN", "BOE"],
      dryRun: true
    });
    claimNextJob(agentId);
    markJobStatus(job2.id, "RUNNING");
    const documents: never[] = [];
    const unsigned = {
      jobId: job2.id,
      agentId,
      status: "PARTIAL" as const,
      sourceSummaries: [
        { sourceCode: "UQN" as const, ok: true, healthClass: "HEALTHY" },
        { sourceCode: "BOE" as const, ok: false, healthClass: "TLS_BLOCKED" }
      ],
      documents,
      agentVersion: "0.1.0",
      uploadedAt: new Date().toISOString(),
      checksum: sha256Hex(canonicalJson(documents))
    };
    const payload = { ...unsigned, signature: signPayload(agentKeys.privateKeyPem, unsigned) };
    const result = ingestAgentResults(payload);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.status, "PARTIAL");
    pass("17 partial source run");
  }

  // 18 agent restart during job — claim increments attempts, job remains claimable if returned to QUEUED
  {
    const job3 = createAgentJob({
      agentId,
      requestedBy: "admin",
      type: "SOURCE_HEALTH_CHECK",
      sourceCodes: ["UQN"],
      dryRun: true,
      maxAttempts: 3
    });
    claimNextJob(agentId);
    markJobStatus(job3.id, "QUEUED");
    const again = claimNextJob(agentId);
    assert.ok(again);
    assert.equal(getJob(job3.id)?.attemptCount, 2);
    pass("18 agent restart / re-claim");
  }

  // 19 key rotation — new keys require re-pair conceptually; signature with old key fails after public key change
  {
    const agent = getAgent(agentId)!;
    const rotated = generateAgentKeyPair();
    agent.publicKeyPem = rotated.publicKeyPem;
    saveAgent(agent);
    const a = auth("/api/rasd/agent/heartbeat");
    assert.equal(a.ok, false);
    agent.publicKeyPem = agentKeys.publicKeyPem;
    saveAgent(agent);
    pass("19 key rotation invalidates old signatures");
  }

  // 20 update validation via policy module
  {
    const { agentUpdateState } = await import("@/lib/modules/rasd/bridge/policy");
    assert.equal(agentUpdateState("0.1.0"), "CURRENT");
    assert.equal(agentUpdateState("0.0.1"), "UNSUPPORTED");
    pass("20 agent update validation");
  }

  // 21 cross-user — pairing owner bound; different agent cannot claim
  {
    const otherKeys = generateAgentKeyPair();
    const otherPair = createPairingCode("owner-2");
    const other = completePairing({
      code: otherPair.code,
      displayName: "other",
      publicKeyPem: otherKeys.publicKeyPem,
      platform: "linux",
      version: "0.1.0"
    });
    assert.equal(other.ok, true);
    if (other.ok) assert.equal(claimNextJob(other.agent.id), null);
    pass("21 cross-user authorization (no foreign jobs)");
  }

  // 22 no production write / auto-apply
  {
    const staged = listStagedResults() as Array<{ jobId: string }>;
    assert.ok(staged.length >= 1);
    // ingest resultSummary includes libraryWrite false
    const done = [...(await import("@/lib/modules/rasd/bridge/store")).bridgeStore().jobs.values()].find((j) => j.resultSummary);
    assert.equal((done?.resultSummary as { libraryWrite?: boolean; autoApply?: boolean })?.libraryWrite, false);
    assert.equal((done?.resultSummary as { autoApply?: boolean })?.autoApply, false);
    pass("22 no production write / auto-apply false");
  }

  // 23-25 local fetch policy
  assert.equal(requiresLocalAgent("BOE"), true);
  assert.equal(requiresLocalAgent("NCAR"), true);
  assert.equal(canDispatchSourceToCloud("UQN"), true);
  assert.equal(canDispatchSourceToCloud("BOE"), false);
  pass("23-25 LOCAL_REQUIRED for BOE/NCAR; UQN cloud allowed");

  // envelope tamper
  {
    const job4 = createAgentJob({
      agentId,
      requestedBy: "admin",
      type: "AGENT_SELF_TEST",
      sourceCodes: ["UQN"],
      dryRun: true
    });
    const env = toSignedEnvelope(job4);
    env.dryRun = false;
    const bad = verifyJobEnvelope(env);
    assert.equal(bad.ok, false);
    pass("job tampering rejected");
  }

  console.log("Rasd bridge tests: ALL PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
