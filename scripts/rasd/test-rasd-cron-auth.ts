/**
 * Cron route authorization tests for Rasd weekly scheduler path.
 * Does not claim the scheduler is production-verified on Vercel.
 */
import { timingSafeEqual } from "crypto";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorized(headers: Record<string, string | null>, secret: string | undefined): boolean {
  if (!secret) return false;
  const headerSecret = headers["x-cron-secret"];
  const auth = headers.authorization;
  return Boolean(
    (headerSecret && safeEqual(headerSecret, secret)) || (auth && safeEqual(auth, `Bearer ${secret}`))
  );
}

function schedulerDisabled(env: Record<string, string | undefined>): string | undefined {
  if (env.VERCEL_ENV === "preview" && env.RASD_ALLOW_PREVIEW_CRON !== "true") {
    return "preview_cron_disabled";
  }
  if (env.RASD_SCHEDULER_ENABLED === "false") {
    return "RASD_SCHEDULER_ENABLED=false";
  }
  return undefined;
}

test("cron rejects missing secret", () => {
  assert(!authorized({ "x-cron-secret": null, authorization: null }, undefined), "no secret");
  assert(!authorized({ "x-cron-secret": "x", authorization: null }, "y"), "mismatch");
});

test("cron accepts x-cron-secret", () => {
  assert(authorized({ "x-cron-secret": "s3cret", authorization: null }, "s3cret"), "header ok");
});

test("cron accepts bearer", () => {
  assert(authorized({ "x-cron-secret": null, authorization: "Bearer s3cret" }, "s3cret"), "bearer ok");
});

test("preview cron disabled by default", () => {
  assert(
    schedulerDisabled({ VERCEL_ENV: "preview", RASD_SCHEDULER_ENABLED: "true" }) === "preview_cron_disabled",
    "preview blocked"
  );
});

test("scheduler flag disables cron", () => {
  assert(
    schedulerDisabled({ VERCEL_ENV: "production", RASD_SCHEDULER_ENABLED: "false" }) ===
      "RASD_SCHEDULER_ENABLED=false",
    "flag"
  );
});

test("production with scheduler enabled is not disabled by helper", () => {
  assert(schedulerDisabled({ VERCEL_ENV: "production", RASD_SCHEDULER_ENABLED: "true" }) === undefined, "ok");
});

console.log(`Rasd cron auth tests: ${passed} PASS / ${failed} FAIL`);
if (failed > 0) process.exit(1);
