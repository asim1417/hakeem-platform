/**
 * اختبار وحدات إعداد OAuth (Google + Microsoft Entra) دون شبكة حقيقية.
 * التشغيل: npx tsx scripts/test-oauth-providers.ts
 */
import assert from "node:assert/strict";

process.env.GOOGLE_CLIENT_ID = "";
process.env.GOOGLE_CLIENT_SECRET = "";
process.env.AZURE_AD_CLIENT_ID = "";
process.env.AZURE_AD_CLIENT_SECRET = "";
process.env.AZURE_AD_TENANT_ID = "";
process.env.OAUTH_ADMIN_EMAILS = "admin@hakeem.sa, Owner@Org.com";
process.env.OAUTH_REDIRECT_BASE = "";

async function main() {
  const google = await import("../lib/modules/auth/google-oauth");
  const microsoft = await import("../lib/modules/auth/microsoft-oauth");
  const shared = await import("../lib/modules/auth/oauth-shared");

  assert.equal(google.isGoogleOAuthConfigured(), false);
  assert.equal(microsoft.isMicrosoftOAuthConfigured(), false);

  process.env.GOOGLE_CLIENT_ID = "google-client.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "google-secret";
  assert.equal(google.isGoogleOAuthConfigured(), true);
  assert.equal(
    google.googleCallbackUrl("https://hakeem.example"),
    "https://hakeem.example/api/auth/callback/google"
  );
  const gUrl = google.buildGoogleAuthUrl(
    "google-client.apps.googleusercontent.com",
    "https://hakeem.example/api/auth/callback/google",
    "state123"
  );
  assert.ok(gUrl.startsWith("https://accounts.google.com/"));
  assert.ok(gUrl.includes("client_id=google-client"));
  assert.ok(gUrl.includes("state=state123"));

  process.env.AZURE_AD_CLIENT_ID = "11111111-2222-3333-4444-555555555555";
  process.env.AZURE_AD_CLIENT_SECRET = "entra-secret";
  process.env.AZURE_AD_TENANT_ID = "contoso.onmicrosoft.com";
  assert.equal(microsoft.isMicrosoftOAuthConfigured(), true);
  const cfg = microsoft.getMicrosoftOAuthConfig();
  assert.ok(cfg);
  assert.equal(cfg!.tenantId, "contoso.onmicrosoft.com");
  assert.equal(
    microsoft.microsoftCallbackUrl("https://hakeem.example"),
    "https://hakeem.example/api/auth/callback/microsoft"
  );
  const mUrl = microsoft.buildMicrosoftAuthUrl(
    cfg!,
    "https://hakeem.example/api/auth/callback/microsoft",
    "ms-state"
  );
  assert.ok(mUrl.includes("login.microsoftonline.com/contoso.onmicrosoft.com"));
  assert.ok(mUrl.includes("response_type=code"));
  assert.ok(mUrl.includes("state=ms-state"));
  assert.ok(mUrl.includes("User.Read"));

  assert.equal(shared.isOAuthAdminEmail("admin@hakeem.sa"), true);
  assert.equal(shared.isOAuthAdminEmail("owner@org.com"), true);
  assert.equal(shared.isOAuthAdminEmail("other@org.com"), false);
  assert.equal(shared.safeNextPath("/dashboard/ask"), "/dashboard/ask");
  assert.equal(shared.safeNextPath("https://evil.com"), "/dashboard");
  assert.equal(shared.safeNextPath("//evil.com"), "/dashboard");
  assert.ok(shared.newOAuthState().length >= 16);

  process.env.OAUTH_REDIRECT_BASE = "https://custom.example";
  assert.equal(
    microsoft.microsoftCallbackUrl("https://ignored.example"),
    "https://custom.example/api/auth/callback/microsoft"
  );

  console.log("test-oauth-providers: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
