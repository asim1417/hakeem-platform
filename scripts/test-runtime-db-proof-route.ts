import assert from "node:assert/strict";
import {
  getDatabaseFingerprint,
  isDiagnosticTokenAuthorized,
  isRuntimeDiagnosticsEnabled
} from "../app/api/diagnostics/runtime-db-proof/route";

assert.equal(isRuntimeDiagnosticsEnabled({}), false);
assert.equal(isRuntimeDiagnosticsEnabled({ ENABLE_RUNTIME_DIAGNOSTICS: "false" }), false);
assert.equal(isRuntimeDiagnosticsEnabled({ ENABLE_RUNTIME_DIAGNOSTICS: "true" }), true);

assert.equal(isDiagnosticTokenAuthorized(null, { RUNTIME_DIAGNOSTIC_TOKEN: "secret" }), false);
assert.equal(isDiagnosticTokenAuthorized("wrong", { RUNTIME_DIAGNOSTIC_TOKEN: "secret" }), false);
assert.equal(isDiagnosticTokenAuthorized("secret", {}), false);
assert.equal(isDiagnosticTokenAuthorized("secret", { RUNTIME_DIAGNOSTIC_TOKEN: "secret" }), true);

const missingFingerprint = getDatabaseFingerprint(undefined);
assert.equal(missingFingerprint.hostType, "missing_database_url");
assert.equal(missingFingerprint.projectRefIfSupabase, null);

const supabaseFingerprint = getDatabaseFingerprint(
  "postgresql://postgres.demo-project-ref:password@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
);
assert.equal(supabaseFingerprint.providerGuess, "supabase");
assert.equal(supabaseFingerprint.hostType, "supabase-pooler");
assert.equal(supabaseFingerprint.projectRefIfSupabase, "demo-project-ref");
assert.equal(supabaseFingerprint.regionIfDetected, "ap-southeast-1");
assert.equal(supabaseFingerprint.dbNameIfDetected, "postgres");
assert.equal(supabaseFingerprint.isPooler, true);
assert.equal(typeof supabaseFingerprint.hostFingerprint, "string");
assert.equal(supabaseFingerprint.hostFingerprint?.includes("supabase"), false);

console.log("runtime-db-proof route guards ok");
