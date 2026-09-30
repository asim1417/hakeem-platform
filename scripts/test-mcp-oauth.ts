import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  authorizationServerMetadata,
  keysMatch,
  createAuthorizationCode,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  isAllowedClientId,
  isAllowedRedirect,
  mcpCredentialAccepted,
  mcpResourceUrl,
  mcpUnauthorized,
  protectedResourceMetadata,
  publicOrigin,
  s256,
} from "@/lib/mcp/oauth";
import { isMcpOauthPublicPath } from "@/lib/mcp/oauth-paths";

const secret = "hakeem-test-key-32-characters-long";
const origin = "https://hakeemai.net";
const resource = mcpResourceUrl(origin);
const redirect = "https://claude.ai/api/mcp/auth_callback";
const clientId = "https://claude.ai/oauth/mcp-oauth-client-metadata";
const verifier = "a".repeat(50);
const challenge = s256(verifier);

assert.equal(isAllowedRedirect(redirect), true);
assert.equal(isAllowedRedirect("http://127.0.0.1:3118/callback"), true);
assert.equal(isAllowedRedirect("https://evil.example/steal"), false);
assert.equal(isAllowedRedirect("http://localhost:9/callback?next=https://evil.example"), false);
assert.equal(keysMatch(`  ${secret}  `, secret), true);
assert.equal(keysMatch(`"${secret}"`, secret), true);
assert.equal(keysMatch(`HAKEEM_MCP_KEY=${secret}`, secret), true);
assert.equal(keysMatch(`Bearer ${secret}`, secret), true);
assert.equal(keysMatch("HAKEEM_MCP_KEY", secret), false);
assert.equal(isAllowedClientId(clientId), true);
assert.equal(isAllowedClientId("https://evil.example/client"), false);

const code = createAuthorizationCode({
  secret,
  clientId,
  redirectUri: redirect,
  codeChallenge: challenge,
  resource,
});
const issued = exchangeAuthorizationCode({
  secret,
  code,
  clientId,
  redirectUri: redirect,
  codeVerifier: verifier,
});
assert.ok(!("error" in issued));
if ("error" in issued) throw new Error("exchange failed");
assert.equal(issued.token_type, "Bearer");
assert.equal(issued.scope, "mcp:read");

assert.deepEqual(
  exchangeAuthorizationCode({
    secret,
    code,
    clientId,
    redirectUri: redirect,
    codeVerifier: "b".repeat(50),
  }),
  { error: "invalid_grant" }
);
assert.deepEqual(
  exchangeAuthorizationCode({
    secret,
    code,
    clientId,
    redirectUri: "https://claude.com/api/mcp/auth_callback",
    codeVerifier: verifier,
  }),
  { error: "invalid_grant" }
);

const refreshed = exchangeRefreshToken({ secret, refreshToken: issued.refresh_token, clientId });
assert.ok(!("error" in refreshed));

const metadata = protectedResourceMetadata(origin);
assert.equal(metadata.resource, "https://hakeemai.net/mcp");
assert.deepEqual(metadata.authorization_servers, [origin]);
assert.equal(authorizationServerMetadata(origin).authorization_endpoint, "https://hakeemai.net/oauth/authorize");
assert.equal(authorizationServerMetadata(origin).client_id_metadata_document_supported, true);

const forwarded = new Request("https://internal.local/mcp", {
  headers: { "x-forwarded-host": "hakeemai.net", "x-forwarded-proto": "https" },
});
assert.equal(publicOrigin(forwarded), origin);

const denied = mcpUnauthorized(forwarded);
assert.equal(denied.status, 401);
assert.match(denied.headers.get("WWW-Authenticate") ?? "", /resource_metadata="https:\/\/hakeemai\.net\/\.well-known\/oauth-protected-resource\/mcp"/);

const expired = createAuthorizationCode({
  secret,
  clientId,
  redirectUri: redirect,
  codeChallenge: challenge,
  resource,
  now: Math.floor(Date.now() / 1000) - 1000,
});
assert.deepEqual(
  exchangeAuthorizationCode({ secret, code: expired, clientId, redirectUri: redirect, codeVerifier: verifier }),
  { error: "invalid_grant" }
);

const withKey = new Request("https://hakeemai.net/mcp?key=stolen", { headers: { "x-api-key": secret } });
assert.equal(mcpCredentialAccepted(withKey, secret), true);
const queryOnly = new Request(`https://hakeemai.net/mcp?key=${secret}`);
assert.equal(mcpCredentialAccepted(queryOnly, secret), false);
const rawBearer = new Request("https://hakeemai.net/mcp", { headers: { authorization: `Bearer ${secret}` } });
assert.equal(mcpCredentialAccepted(rawBearer, secret), true);
const withBearer = new Request("https://hakeemai.net/mcp", {
  headers: { authorization: `Bearer ${issued.access_token}` },
});
assert.equal(mcpCredentialAccepted(withBearer, secret), true);
const wrongHost = new Request("https://other.example/mcp", {
  headers: { authorization: `Bearer ${issued.access_token}` },
});
assert.equal(mcpCredentialAccepted(wrongHost, secret), false);

assert.equal(isMcpOauthPublicPath("/oauth/authorize"), true);
assert.equal(isMcpOauthPublicPath("/.well-known/oauth-protected-resource/mcp"), true);
assert.equal(isMcpOauthPublicPath("/mcp"), false);

const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
assert.match(middleware, /oauth\/\(\?:authorize\|token\|register\)/);
assert.match(middleware, /oauth-protected-resource/);
assert.match(middleware, /isMcpOauthPublicPath/);

void (async () => {
process.env.HAKEEM_MCP_KEY = secret;
const authorize = await import("../app/oauth/authorize/route");
const discovery = await import("../app/.well-known/oauth-authorization-server/route");
const tokenRoute = await import("../app/oauth/token/route");

const discovered = await discovery.GET(new Request("https://hakeemai.net/.well-known/oauth-authorization-server"));
assert.equal(discovered.status, 200);
const discoveredBody = (await discovered.json()) as { authorization_endpoint: string };
assert.equal(discoveredBody.authorization_endpoint, "https://hakeemai.net/oauth/authorize");

const start = new URL("https://hakeemai.net/oauth/authorize");
start.searchParams.set("response_type", "code");
start.searchParams.set("client_id", clientId);
start.searchParams.set("redirect_uri", redirect);
start.searchParams.set("code_challenge", challenge);
start.searchParams.set("code_challenge_method", "S256");
start.searchParams.set("state", "state-1");
const page = await authorize.GET(new Request(start));
assert.equal(page.status, 200);
assert.match(await page.text(), /ربط موصل حكيم/);

const deniedPage = new URL(start);
const badForm = new FormData();
badForm.set("client_id", clientId);
badForm.set("redirect_uri", redirect);
badForm.set("code_challenge", challenge);
badForm.set("code_challenge_method", "S256");
badForm.set("state", "state-1");
badForm.set("connector_key", "wrong-key");
const rejected = await authorize.POST(new Request(deniedPage, { method: "POST", body: badForm }));
assert.equal(rejected.status, 401);

const goodForm = new FormData();
goodForm.set("client_id", clientId);
goodForm.set("redirect_uri", redirect);
goodForm.set("code_challenge", challenge);
goodForm.set("code_challenge_method", "S256");
goodForm.set("state", "state-1");
goodForm.set("connector_key", secret);
const approved = await authorize.POST(new Request("https://hakeemai.net/oauth/authorize", { method: "POST", body: goodForm }));
assert.equal(approved.status, 200);
const approvedHtml = await approved.text();
assert.match(approvedHtml, /العودة إلى Claude/);
const back = new URL((approvedHtml.match(/href="([^"]+)"/)?.[1] ?? "").replace(/&amp;/g, "&"));
assert.equal(back.origin + back.pathname, redirect);
assert.equal(back.searchParams.get("state"), "state-1");

const body = new URLSearchParams({
  grant_type: "authorization_code",
  code: back.searchParams.get("code") ?? "",
  client_id: clientId,
  redirect_uri: redirect,
  code_verifier: verifier,
});
const token = await tokenRoute.POST(
  new Request("https://hakeemai.net/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })
);
assert.equal(token.status, 200);
const tokenBody = (await token.json()) as { access_token: string };
const authed = new Request("https://hakeemai.net/mcp", { headers: { authorization: `Bearer ${tokenBody.access_token}` } });
assert.equal(mcpCredentialAccepted(authed, secret), true);

const stolen = new URL("https://hakeemai.net/oauth/authorize");
stolen.searchParams.set("response_type", "code");
stolen.searchParams.set("client_id", clientId);
stolen.searchParams.set("redirect_uri", "https://evil.example/callback");
stolen.searchParams.set("code_challenge", challenge);
stolen.searchParams.set("code_challenge_method", "S256");
const blocked = await authorize.GET(new Request(stolen));
assert.equal(blocked.status, 400);
console.log("mcp oauth ok");
})().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
