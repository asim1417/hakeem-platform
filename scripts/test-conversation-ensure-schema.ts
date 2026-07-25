/**
 * فحص سطح ensure-schema لمحرك الجلسات.
 * npx tsx scripts/test-conversation-ensure-schema.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ensure = fs.readFileSync(
  path.join(root, "lib/modules/conversations/ensure-schema.ts"),
  "utf8"
);
const instrumentation = fs.readFileSync(path.join(root, "instrumentation.ts"), "utf8");
const health = fs.readFileSync(path.join(root, "app/api/health/route.ts"), "utf8");
const engine = fs.readFileSync(path.join(root, "lib/modules/conversations/engine.ts"), "utf8");

assert.ok(ensure.includes("ensureConversationSessionSchema"));
assert.ok(ensure.includes('ADD COLUMN IF NOT EXISTS "service_key"'));
assert.ok(ensure.includes("chat_conversations_service_key_check"));
assert.ok(instrumentation.includes("ensureConversationSessionSchema"));
assert.ok(health.includes("conversationSession"));
assert.ok(health.includes("ensureConversationSessionSchema"));
assert.ok(engine.includes("ensureConversationSessionSchema"));

async function live() {
  if (!process.env.DATABASE_URL) {
    console.log("test-conversation-ensure-schema: surface OK (no DATABASE_URL)");
    return;
  }
  const { ensureConversationSessionSchema, isConversationSessionSchemaReady } = await import(
    "../lib/modules/conversations/ensure-schema"
  );
  const applied = await ensureConversationSessionSchema();
  assert.equal(applied, true);
  assert.equal(await isConversationSessionSchemaReady(), true);
  console.log("test-conversation-ensure-schema: OK (live)");
}

live().catch((e) => {
  console.error(e);
  process.exit(1);
});
