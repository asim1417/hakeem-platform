import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  getDatabaseFingerprint,
  isDiagnosticTokenAuthorized,
  isRuntimeDiagnosticsEnabled
} from "../lib/modules/diagnostics/runtime-db-proof";

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

const poolerUrl = "postgresql://postgres.demo-project-ref:password@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
const poolerFingerprint = getDatabaseFingerprint(poolerUrl);
assert.equal(poolerFingerprint.providerGuess, "supabase");
assert.equal(poolerFingerprint.hostType, "supabase-pooler");
assert.equal(poolerFingerprint.projectRefIfSupabase, "demo-project-ref");
assert.equal(poolerFingerprint.regionIfDetected, "ap-southeast-1");
assert.equal(poolerFingerprint.dbNameIfDetected, "postgres");
assert.equal(poolerFingerprint.isPooler, true);
assert.equal(typeof poolerFingerprint.hostFingerprint, "string");

const directUrl = "postgresql://postgres:password@db.bnzicgymocelefeqiwig.supabase.co:5432/postgres";
const directFingerprint = getDatabaseFingerprint(directUrl);
assert.equal(directFingerprint.providerGuess, "supabase");
assert.equal(directFingerprint.hostType, "supabase-direct");
assert.equal(directFingerprint.projectRefIfSupabase, "bnzicgymocelefeqiwig");
assert.equal(directFingerprint.isPooler, false);

const serializedFingerprints = JSON.stringify([poolerFingerprint, directFingerprint]);
assert.equal(serializedFingerprints.includes("password"), false);
assert.equal(serializedFingerprints.includes(poolerUrl), false);
assert.equal(serializedFingerprints.includes(directUrl), false);
assert.equal(serializedFingerprints.includes("postgres.demo-project-ref"), false);
assert.equal(serializedFingerprints.includes("db.bnzicgymocelefeqiwig.supabase.co"), false);

const routePath = join(process.cwd(), "app/api/diagnostics/runtime-db-proof/route.ts");
const helperPath = join(process.cwd(), "lib/modules/diagnostics/runtime-db-proof.ts");
const routeSource = readFileSync(routePath, "utf8");
const helperSource = readFileSync(helperPath, "utf8");
const diagnosticSource = `${routeSource}\n${helperSource}`;

assert.match(routeSource, /export const runtime = "nodejs"/);
assert.match(routeSource, /export const dynamic = "force-dynamic"/);
assert.match(routeSource, /new NextResponse\(null, \{ status: 404 \}\)/);
assert.match(routeSource, /status: 403/);
assert.doesNotMatch(routeSource, /export function /);
assert.doesNotMatch(routeSource, /export const KNOWN_GITHUB_DATABASE/);

const forbiddenDbWrites = /\b(insert|update|delete|truncate|upsert|migrate)\b|db push/i;
assert.doesNotMatch(diagnosticSource, forbiddenDbWrites);

function collectFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return collectFiles(fullPath);
    return stat.isFile() ? [fullPath] : [];
  });
}

const dashboardFiles = collectFiles(join(process.cwd(), "app/dashboard"));
const visibleReferences = dashboardFiles.filter((filePath) =>
  readFileSync(filePath, "utf8").includes("runtime-db-proof")
);
assert.deepEqual(visibleReferences, []);

console.log("runtime-db-proof route guards ok");
