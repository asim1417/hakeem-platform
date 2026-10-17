/**
 * اختبار ربط موصل حكيم بحسابات المستخدمين (بلا قاعدة: مخزن ذاكرة + اعتماديات مُحقنة).
 * يغطي: التصاريح، رمز التفويض لمرة واحدة، التدوير وكشف إعادة الاستعمال، الإلغاء، صاحب الطلب،
 * الباقات والرصيد وحدّ المعدّل، مسارات /oauth/authorize و/oauth/token و/mcp من طرفها إلى طرفها.
 * npx tsx scripts/test-mcp-account-linking.ts
 */
import assert from "node:assert/strict";

// لا محرّك Prisma محليًا: نتجاهل فقط خطأ تهيئة المحرّك المؤجَّل؛ أي رفض آخر يُفشل الاختبار.
process.on("unhandledRejection", (e) => {
  if ((e as { name?: string })?.name === "PrismaClientInitializationError") return;
  console.error(e);
  process.exit(1);
});

const SECRET = "test-mcp-token-secret-at-least-32-chars!!";
const SHARED = "hakeem-shared-key-32-characters-long";
process.env.MCP_TOKEN_SECRET = SECRET;
process.env.MCP_ACCOUNT_LINKING = "1";
process.env.HAKEEM_MCP_KEY = SHARED;
process.env.NEXT_PUBLIC_SITE_URL = "https://hakeemai.net";

async function main() {
  const tokens = await import("@/lib/mcp/grants/tokens");
  const service = await import("@/lib/mcp/grants/service");
  const { MemoryGrantStore } = await import("@/lib/mcp/grants/memory-store");
  const { setGrantStoreForTests } = await import("@/lib/mcp/grants/prisma-store");
  const principal = await import("@/lib/mcp/principal");
  const runner = await import("@/lib/mcp/tool-runner");
  const oauth = await import("@/lib/mcp/oauth");
  const { safeDashboardNext } = await import("@/lib/modules/auth/safe-next");
  const { generateApiKey } = await import("@/lib/modules/api-gateway/api-keys");
  const { mcpToolPolicy } = await import("@/config/mcp-tools");

  const origin = "https://hakeemai.net";
  const resource = `${origin}/mcp`;
  const redirect = "https://claude.ai/api/mcp/auth_callback";
  const clientId = "https://claude.ai/oauth/mcp-oauth-client-metadata";
  const verifier = "v".repeat(60);
  const pendingFor = (n = "nonce-1") => ({
    cid: clientId,
    ru: redirect,
    st: "state-1",
    cc: tokens.s256(verifier),
    res: resource,
    sc: "mcp:read",
    n,
    exp: tokens.nowSec() + 600,
  });

  // ── التصاريح ──
  {
    const t = tokens.signAccessToken(SECRET, { sub: "u1", gid: "g1", cid: "c1", aud: resource, exp: tokens.nowSec() + 60 });
    assert.equal(tokens.readAccessToken(SECRET, t)?.sub, "u1");
    assert.equal(tokens.readAccessToken("another-secret-of-32-characters-long!!", t), null, "سرّ آخر يُرفض");
    assert.equal(tokens.readAccessToken(SECRET, t, tokens.nowSec() + 120), null, "المنتهي يُرفض");
    const [p, body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), sub: "admin" })).toString("base64url");
    assert.equal(tokens.readAccessToken(SECRET, `${p}.${forged}.${sig}`), null, "العبث بالحمولة يُرفض");
    const pending = tokens.signPending(SECRET, pendingFor());
    assert.equal(tokens.readPending(SECRET, pending)?.n, "nonce-1");
    assert.equal(tokens.readAccessToken(SECRET, pending), null, "طلب معلّق لا يصلح تصريحًا");
    assert.equal(tokens.readPending(SECRET, t), null, "تصريح لا يصلح طلبًا معلّقًا");
  }

  // ── رمز التفويض والاستبدال ──
  const store = new MemoryGrantStore();
  const now = new Date();
  const code = await service.issueAuthorizationCode({ store, userId: "user-1", pending: pendingFor(), now });
  assert.ok(code.startsWith("hka_"));
  assert.ok(![...store.codes.keys()].includes(code), "الرمز الخام لا يُخزَّن");

  const exchange = (c: string, over: Partial<{ clientId: string; redirectUri: string; codeVerifier: string; now: Date }> = {}) =>
    service.exchangeAuthorizationCode({ store, secret: SECRET, code: c, clientId, redirectUri: redirect, codeVerifier: verifier, now, ...over });

  const wrongVerifierCode = await service.issueAuthorizationCode({ store, userId: "user-1", pending: pendingFor(), now });
  assert.deepEqual(await exchange(wrongVerifierCode, { codeVerifier: "w".repeat(60) }), { error: "invalid_grant" });
  const notBurned = await exchange(wrongVerifierCode);
  assert.ok(!("error" in notBurned), "رمز مسروق بلا verifier لا يُحرق: صاحبه يستبدله بعدها");
  // من لا يملك الـ verifier لا يستطيع إلغاء الربط بإعادة الرمز.
  assert.deepEqual(await exchange(wrongVerifierCode, { codeVerifier: "w".repeat(60) }), { error: "invalid_grant" });
  if ("error" in notBurned) throw new Error("unreachable");
  const notBurnedGid = tokens.readAccessToken(SECRET, notBurned.access_token)!.gid;
  assert.equal((await store.getGrant(notBurnedGid))?.revokedAt, null, "إعادة بلا verifier لا تلغي الربط");
  const wrongClientCode = await service.issueAuthorizationCode({ store, userId: "user-1", pending: pendingFor(), now });
  assert.deepEqual(await exchange(wrongClientCode, { clientId: "https://claude.ai/other" }), { error: "invalid_grant" });
  const expiredCode = await service.issueAuthorizationCode({ store, userId: "user-1", pending: pendingFor(), now });
  assert.deepEqual(await exchange(expiredCode, { now: new Date(now.getTime() + 6 * 60 * 1000) }), { error: "invalid_grant" });

  const issued = await exchange(code);
  assert.ok(!("error" in issued));
  if ("error" in issued) throw new Error("exchange failed");
  assert.equal(issued.token_type, "Bearer");
  assert.equal(issued.expires_in, 3600);
  const grantId = tokens.readAccessToken(SECRET, issued.access_token)!.gid;
  assert.equal((await store.getGrant(grantId))?.clientName, "Claude");

  // إعادة استعمال رمز التفويض تلغي الربط الصادر منه.
  assert.deepEqual(await exchange(code), { error: "invalid_grant" });
  assert.equal((await store.getGrant(grantId))?.revokedReason, "code_reuse");

  // ── ربط جديد، ثم التجديد والتدوير ──
  const code2 = await service.issueAuthorizationCode({ store, userId: "user-1", pending: pendingFor(), now });
  const pair = await exchange(code2);
  if ("error" in pair) throw new Error("exchange 2 failed");
  const gid2 = tokens.readAccessToken(SECRET, pair.access_token)!.gid;

  const audienceOk = (aud: string) => aud === resource;
  const verified = await service.verifyGrantAccessToken({ store, secret: SECRET, token: pair.access_token, audienceAccepted: audienceOk, now });
  assert.equal(verified?.userId, "user-1");
  assert.equal(
    await service.verifyGrantAccessToken({ store, secret: SECRET, token: pair.access_token, audienceAccepted: () => false, now }),
    null,
    "مورد مخالف يُرفض"
  );

  const t1 = new Date(now.getTime() + 10_000);
  const refreshed = await service.refreshAccessToken({ store, secret: SECRET, refreshToken: pair.refresh_token, clientId, now: t1 });
  if ("error" in refreshed) throw new Error("refresh failed");
  assert.notEqual(refreshed.refresh_token, pair.refresh_token, "رمز التجديد يُستبدل");

  // القديم داخل نافذة السماح: يُرفض دون إلغاء الربط (سباق مشروع).
  assert.deepEqual(
    await service.refreshAccessToken({ store, secret: SECRET, refreshToken: pair.refresh_token, now: new Date(t1.getTime() + 5_000) }),
    { error: "invalid_grant" }
  );
  assert.equal((await store.getGrant(gid2))?.revokedAt, null);
  // عميل آخر بالرمز الجديد يُرفض.
  assert.deepEqual(
    await service.refreshAccessToken({ store, secret: SECRET, refreshToken: refreshed.refresh_token, clientId: "https://claude.ai/x", now: t1 }),
    { error: "invalid_grant" }
  );
  // القديم بعد نافذة السماح: سرقة محتملة → إلغاء الربط كله.
  assert.deepEqual(
    await service.refreshAccessToken({ store, secret: SECRET, refreshToken: pair.refresh_token, now: new Date(t1.getTime() + 120_000) }),
    { error: "invalid_grant" }
  );
  assert.equal((await store.getGrant(gid2))?.revokedReason, "refresh_reuse");
  assert.deepEqual(
    await service.refreshAccessToken({ store, secret: SECRET, refreshToken: refreshed.refresh_token, now: new Date(t1.getTime() + 130_000) }),
    { error: "invalid_grant" },
    "بعد الإلغاء لا يعمل حتى الرمز الأحدث"
  );
  assert.equal(
    await service.verifyGrantAccessToken({ store, secret: SECRET, token: refreshed.access_token, audienceAccepted: audienceOk, now: t1 }),
    null,
    "الإلغاء يسري على تصريح الوصول فورًا"
  );

  // ── سلسلة الرموز: سارق يدوّر مرتين، ثم يعود الرمز الأول ← إلغاء الربط ──
  {
    const c = await service.issueAuthorizationCode({ store, userId: "user-1", pending: pendingFor(), now });
    const p1 = await exchange(c);
    if ("error" in p1) throw new Error("family exchange failed");
    const gid = tokens.readAccessToken(SECRET, p1.access_token)!.gid;
    const r2 = await service.refreshAccessToken({ store, secret: SECRET, refreshToken: p1.refresh_token, now: new Date(now.getTime() + 1_000) });
    if ("error" in r2) throw new Error("r2 failed");
    const r3 = await service.refreshAccessToken({ store, secret: SECRET, refreshToken: r2.refresh_token, now: new Date(now.getTime() + 2_000) });
    if ("error" in r3) throw new Error("r3 failed");
    assert.deepEqual(
      await service.refreshAccessToken({ store, secret: SECRET, refreshToken: p1.refresh_token, now: new Date(now.getTime() + 3_000) }),
      { error: "invalid_grant" }
    );
    assert.equal((await store.getGrant(gid))?.revokedReason, "refresh_reuse", "رمز أقدم من الأخير يُلغي السلسلة ولو داخل الدقيقة");
  }

  // ── الخمول وإعادة الربط والإلغاء من المستخدم ──
  const code3 = await service.issueAuthorizationCode({ store, userId: "user-1", pending: pendingFor(), now });
  const pair3 = await exchange(code3);
  if ("error" in pair3) throw new Error("exchange 3 failed");
  const gid3 = tokens.readAccessToken(SECRET, pair3.access_token)!.gid;
  const idle = await service.refreshAccessToken({ store, secret: SECRET, refreshToken: pair3.refresh_token, now: new Date(now.getTime() + 31 * 86400_000) });
  assert.deepEqual(idle, { error: "invalid_grant" });
  assert.equal((await store.getGrant(gid3))?.revokedReason, "idle");

  const code4 = await service.issueAuthorizationCode({ store, userId: "user-1", pending: pendingFor(), now });
  const pair4 = await exchange(code4);
  if ("error" in pair4) throw new Error("exchange 4 failed");
  const gid4 = tokens.readAccessToken(SECRET, pair4.access_token)!.gid;
  const code5 = await service.issueAuthorizationCode({ store, userId: "user-1", pending: pendingFor(), now });
  const pair5 = await exchange(code5);
  if ("error" in pair5) throw new Error("exchange 5 failed");
  assert.equal((await store.getGrant(gid4))?.revokedAt, null, "ربط ثانٍ من Claude (جهاز/حساب آخر) لا يلغي الأول");
  const gid5 = tokens.readAccessToken(SECRET, pair5.access_token)!.gid;
  assert.equal(await service.revokeGrant({ store, grantId: gid5, actor: { userId: "someone-else", isAdmin: false } }), false, "لا يلغي ربط غيره");
  assert.equal(await service.revokeGrant({ store, grantId: gid5, actor: { userId: "user-1", isAdmin: false } }), true);
  assert.equal((await store.getGrant(gid5))?.revokedReason, "user");

  // ── قوائم العملاء وأسماؤهم ──
  assert.equal(oauth.isAllowedRedirect("https://chatgpt.com/connector_platform_oauth_redirect"), true);
  assert.equal(oauth.isAllowedRedirect("https://chatgpt.com/connector/oauth/abc_123"), true);
  assert.equal(oauth.isAllowedRedirect("https://chatgpt.com/connector/oauth/abc?x=1"), false);
  assert.equal(oauth.isAllowedRedirect("https://chatgpt.com.evil.example/connector_platform_oauth_redirect"), false);
  assert.equal(oauth.isAllowedClientId("https://chatgpt.com/oauth/client.json"), true);
  assert.equal(service.clientDisplayName("https://chatgpt.com/connector_platform_oauth_redirect"), "ChatGPT");
  assert.equal(service.clientDisplayName("http://127.0.0.1:3000/callback"), "أداة محلية (مطوّر)");
  assert.equal(safeDashboardNext("/connect/authorize"), "/connect/authorize");
  assert.equal(safeDashboardNext("/connect/authorize?x=https://evil"), "/dashboard", "لا معاملات على وجهة الموافقة");

  // ── صاحب الطلب ──
  setGrantStoreForTests(store);
  const personal = generateApiKey();
  const users = new Map([["user-1", true], ["user-off", false]]);
  const keys = new Map([
    [personal.keyHash, { id: "k1", keyPrefix: personal.keyPrefix, scopes: ["mcp:read"], active: true, expiresAt: null, userId: "user-1", rateLimit: 30, lastUsedAt: null }],
  ]);
  principal.setPrincipalDepsForTests({
    isUserActive: async (id) => users.get(id) === true,
    findApiKeyByHash: async (h) => keys.get(h) ?? null,
    touchApiKey: async () => undefined,
  });
  const mcpReq = (headers: Record<string, string> = {}) => new Request(`${origin}/mcp`, { headers });

  const code6 = await service.issueAuthorizationCode({ store, userId: "user-1", pending: pendingFor(), now: new Date() });
  const pair6 = await service.exchangeAuthorizationCode({ store, secret: SECRET, code: code6, clientId, redirectUri: redirect, codeVerifier: verifier });
  if ("error" in pair6) throw new Error("exchange 6 failed");

  const asUser = await principal.verifyMcpRequest(mcpReq(), pair6.access_token);
  assert.equal(asUser?.extra.principal.kind, "user");
  assert.equal(asUser?.extra.principal.kind === "user" && asUser.extra.principal.via, "grant");

  const asShared = await principal.verifyMcpRequest(mcpReq(), SHARED);
  assert.equal(asShared?.extra.principal.kind, "internal");

  const asKey = await principal.verifyMcpRequest(mcpReq({ "x-api-key": personal.fullKey }));
  assert.equal(asKey?.extra.principal.kind === "user" && asKey.extra.principal.via, "api_key");

  keys.set(personal.keyHash, { ...keys.get(personal.keyHash)!, scopes: ["legal:read"] });
  assert.equal(await principal.verifyMcpRequest(mcpReq(), personal.fullKey), undefined, "مفتاح بلا mcp:read يُرفض");
  keys.set(personal.keyHash, { ...keys.get(personal.keyHash)!, scopes: ["mcp:read"], userId: "user-off" });
  assert.equal(await principal.verifyMcpRequest(mcpReq(), personal.fullKey), undefined, "صاحب موقوف يُرفض");
  keys.set(personal.keyHash, { ...keys.get(personal.keyHash)!, userId: "user-1" });
  assert.equal(await principal.verifyMcpRequest(mcpReq(), "hk2.garbage.sig"), undefined);
  assert.equal(await principal.verifyMcpRequest(mcpReq(), ""), undefined);

  // العلم مطفأ ← لا روابط حسابات ولا مفاتيح شخصية (تراجع نظيف بلا روابط حيّة مخفية).
  process.env.MCP_ACCOUNT_LINKING = "";
  assert.equal(await principal.verifyMcpRequest(mcpReq(), pair6.access_token), undefined);
  assert.equal(await principal.verifyMcpRequest(mcpReq(), personal.fullKey), undefined);
  assert.equal((await principal.verifyMcpRequest(mcpReq(), SHARED))?.extra.principal.kind, "internal", "المفتاح المشترك يبقى");
  process.env.MCP_ACCOUNT_LINKING = "1";

  // الأصل نفسه: Origin: null (سياسة no-referrer) مقبول فقط مع Sec-Fetch-Site من الموقع نفسه.
  const post = (h: Record<string, string>) => new Request(`${origin}/oauth/authorize`, { method: "POST", headers: h });
  assert.equal(oauth.isSameOriginPost(post({ origin })), true);
  assert.equal(oauth.isSameOriginPost(post({ origin: "https://evil.example" })), false);
  assert.equal(oauth.isSameOriginPost(post({ origin: "null", "sec-fetch-site": "same-origin" })), true);
  assert.equal(oauth.isSameOriginPost(post({ origin: "null", "sec-fetch-site": "cross-site" })), false);
  assert.equal(oauth.isSameOriginPost(post({ "sec-fetch-site": "cross-site" })), false);

  process.env.HAKEEM_MCP_SHARED_KEY_DISABLED = "1";
  assert.equal(await principal.verifyMcpRequest(mcpReq(), SHARED), undefined, "إيقاف المفتاح المشترك يسري");
  delete process.env.HAKEEM_MCP_SHARED_KEY_DISABLED;

  // ── الباقات والرصيد وحدّ المعدّل في غلاف الأدوات ──
  type Decision = import("@/lib/modules/billing/access-gate").AccessDecision;
  const calls: string[] = [];
  const audits: Array<Record<string, unknown>> = [];
  let paid = false;
  let allowCredits = true;
  let hits = 0;
  runner.setToolRunnerDepsForTests({
    hitWindow: async () => ++hits,
    planAllowsPaid: async () => paid,
    gate: async (_u, service) => {
      calls.push(`gate:${service}`);
      return (allowCredits
        ? { allowed: true, via: "usage", reservationId: "r1" }
        : { allowed: false, reason: "exhausted", message: "انتهى الرصيد" }) as Decision;
    },
    settle: async () => {
      calls.push("settle");
    },
    release: async () => {
      calls.push("release");
    },
    audit: async (e) => {
      audits.push(e as unknown as Record<string, unknown>);
    },
    siteUrl: () => origin,
  });
  const userCtx = { http: { authInfo: asUser } };
  const parse = (r: { content: Array<{ text: string }> }) => JSON.parse(r.content[0].text);

  assert.deepEqual(parse(await runner.runMcpTool("hakeem_get_article", userCtx, () => ({ id: "a1" }))), { id: "a1" });
  assert.deepEqual(calls, [], "أداة قراءة مجانية بلا حجز");

  assert.equal(parse(await runner.runMcpTool("hakeem_get_ruling", userCtx, () => "x")).error, "plan_required");
  paid = true;
  assert.equal(parse(await runner.runMcpTool("hakeem_get_ruling", userCtx, () => "x")), "x");

  calls.length = 0;
  assert.equal(parse(await runner.runMcpTool("hakeem_search", userCtx, () => [1])).length, 1);
  assert.deepEqual(calls, ["gate:HYBRID_SEARCH", "settle"], "البحث يُحجز ثم يُخصم بعد النجاح");

  calls.length = 0;
  const failed = parse(
    await runner.runMcpTool("hakeem_search", userCtx, () => {
      throw new Error("boom with secret query text");
    })
  );
  assert.equal(failed.error, "tool_error");
  assert.deepEqual(calls, ["gate:HYBRID_SEARCH", "release"], "الفشل يفك الحجز ولا يخصم");

  allowCredits = false;
  calls.length = 0;
  const exhausted = parse(await runner.runMcpTool("hakeem_research", userCtx, () => "never"));
  assert.equal(exhausted.error, "credits_exhausted");
  assert.equal(exhausted.upgrade_url, `${origin}/dashboard/billing`);
  allowCredits = true;

  hits = 10_000;
  assert.equal(parse(await runner.runMcpTool("hakeem_get_article", userCtx, () => "x")).error, "rate_limited");
  hits = 0;

  calls.length = 0;
  const internalCtx = { http: { authInfo: asShared } };
  assert.equal(parse(await runner.runMcpTool("hakeem_research", internalCtx, () => "team")), "team");
  assert.deepEqual(calls, [], "فريق أمان لا يمرّ بالرصيد");

  await new Promise((r) => setTimeout(r, 10));
  assert.ok(audits.length >= 6, "كل استدعاء يُسجَّل");
  assert.ok(audits.every((a) => !JSON.stringify(a).includes("secret query text")), "السجل لا يحمل نص الطلب");
  assert.ok(audits.some((a) => a.actorId === "user-1" && a.outcome === "ok"));
  assert.equal(mcpToolPolicy("unknown_future_tool").tier, "paid", "أداة غير مدرجة لا تُفتح مجانًا");

  // ── المسارات من طرفها إلى طرفها ──
  // /oauth/authorize ← كوكي موقّع وتحويل لشاشة الموافقة.
  const { GET: authorizeGET, POST: authorizePOST } = await import("@/app/oauth/authorize/route");
  const authUrl = new URL(`${origin}/oauth/authorize`);
  Object.entries({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirect,
    state: "s-route",
    code_challenge: tokens.s256(verifier),
    code_challenge_method: "S256",
    resource,
  }).forEach(([k, v]) => authUrl.searchParams.set(k, v));
  const authRes = await authorizeGET(new Request(authUrl));
  assert.equal(authRes.status, 303);
  assert.equal(authRes.headers.get("location"), `${origin}/connect/authorize`);
  const cookie = authRes.headers.get("set-cookie") ?? "";
  assert.ok(/hakeem_mcp_authz=hkp\./.test(cookie) && /HttpOnly/.test(cookie) && /Secure/.test(cookie) && /SameSite=Lax/.test(cookie));
  const cookieValue = cookie.split(";")[0].split("=").slice(1).join("=");
  assert.equal(tokens.readPending(SECRET, cookieValue)?.st, "s-route");
  const evilRedirect = new URL(authUrl);
  evilRedirect.searchParams.set("redirect_uri", "https://evil.example/cb");
  assert.notEqual((await authorizeGET(new Request(evilRedirect))).status, 303, "عنوان رجوع غير مسموح لا يبدأ الربط");
  assert.equal((await authorizePOST(new Request(`${origin}/oauth/authorize`, { method: "POST" }))).status, 410, "نموذج المفتاح القديم معطّل");

  // /oauth/token ← استبدال وتجديد بمخزن الذاكرة.
  const { POST: tokenPOST } = await import("@/app/oauth/token/route");
  const code7 = await service.issueAuthorizationCode({ store, userId: "user-1", pending: pendingFor(), now: new Date() });
  const form = (fields: Record<string, string>) =>
    new Request(`${origin}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields) });
  const tokRes = await tokenPOST(form({ grant_type: "authorization_code", code: code7, client_id: clientId, redirect_uri: redirect, code_verifier: verifier }));
  assert.equal(tokRes.status, 200);
  const tok = (await tokRes.json()) as { access_token: string; refresh_token: string };
  assert.ok(tok.access_token.startsWith("hk2.") && tok.refresh_token.startsWith("hkr_"));
  const refRes = await tokenPOST(form({ grant_type: "refresh_token", refresh_token: tok.refresh_token, client_id: clientId }));
  assert.equal(refRes.status, 200);
  const replay = await tokenPOST(form({ grant_type: "authorization_code", code: code7, client_id: clientId, redirect_uri: redirect, code_verifier: verifier }));
  assert.equal(replay.status, 400);
  process.env.MCP_ACCOUNT_LINKING = "";
  const refreshedTok = (await refRes.clone().json()) as { refresh_token: string };
  assert.equal(
    (await tokenPOST(form({ grant_type: "refresh_token", refresh_token: refreshedTok.refresh_token, client_id: clientId }))).status,
    400,
    "العلم مطفأ ← لا تجديد لروابط الحسابات"
  );
  process.env.MCP_ACCOUNT_LINKING = "1";

  // /mcp ← استدعاء أداة حقيقي يصل فيه صاحب الطلب إلى الغلاف.
  const fresh = await tokenPOST(
    form({
      grant_type: "authorization_code",
      code: await service.issueAuthorizationCode({ store, userId: "user-1", pending: pendingFor(), now: new Date() }),
      client_id: clientId,
      redirect_uri: redirect,
      code_verifier: verifier,
    })
  );
  const freshTok = (await fresh.json()) as { access_token: string };
  audits.length = 0;
  const { POST: mcpPOST } = await import("@/app/mcp/route");
  const rpc = (auth?: string) =>
    new Request(`${origin}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(auth ? { authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "hakeem_guide", arguments: {} } }),
    });
  assert.equal((await mcpPOST(rpc())).status, 401, "بلا تصريح ← 401");
  assert.equal((await mcpPOST(rpc("hk2.bad.token"))).status, 401);
  const ok = await mcpPOST(rpc(freshTok.access_token));
  const text = await ok.text();
  assert.equal(ok.status, 200, text.slice(0, 300));
  assert.ok(text.includes("hakeem") || text.includes("result"), text.slice(0, 300));
  await new Promise((r) => setTimeout(r, 20));
  const guideAudit = audits.find((a) => a.tool === "hakeem_guide");
  assert.equal(guideAudit?.principal, "user", `صاحب الطلب يصل للأداة: ${JSON.stringify(audits)}`);
  assert.equal(guideAudit?.actorId, "user-1");

  // إلغاء الربط ← /mcp يرفض التصريح نفسه فورًا.
  const freshGid = tokens.readAccessToken(SECRET, freshTok.access_token)!.gid;
  await service.revokeGrant({ store, grantId: freshGid, actor: { userId: "user-1", isAdmin: false } });
  assert.equal((await mcpPOST(rpc(freshTok.access_token))).status, 401, "الإلغاء يسري في الاستدعاء التالي");

  setGrantStoreForTests(null);
  principal.setPrincipalDepsForTests(null);
  runner.setToolRunnerDepsForTests(null);
  console.log("mcp account linking ok");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
