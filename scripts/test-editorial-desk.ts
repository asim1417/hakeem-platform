import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { fromNodeSocket } from "pg-gateway/node";
import {
  DEFAULT_CONFIG,
  PERMISSIONS,
  allowed,
  assertWriteEnabled,
  type ChangeInput,
} from "../lib/modules/editorial/contracts";
import {
  amendmentDecision,
  compareWorkIdentity,
} from "../lib/modules/editorial/checks";

async function main() {
  // This suite constructs its own in-memory PostgreSQL. It never reads a hosted URL or .env.
  const db = new PGlite();
  await db.waitReady;
  await db.exec(readFileSync("scripts/editorial/test-fixture.sql", "utf8"));
  await db.exec(
    readFileSync(
      "prisma/migrations/20261017080000_editorial_desk/migration.sql",
      "utf8",
    ),
  );
  const sockets = new Set<import("node:net").Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    void fromNodeSocket(socket, {
      serverVersion: "17.0",
      async onMessage(data, state) {
        if (!state.isAuthenticated) return;
        if (data[0] === 88) {
          socket.end();
          return new Uint8Array();
        }
        const result = Buffer.from(await db.execProtocolRaw(data));
        // PGlite's single-user backend may emit ReadyForQuery after an extended-protocol
        // error. Network PostgreSQL emits it only on Sync (or a simple Query).
        if (data[0] === 83 || data[0] === 81) return result;
        const parts: Buffer[] = [];
        for (let offset = 0; offset < result.length;) {
          const length = result.readInt32BE(offset + 1) + 1;
          if (result[offset] !== 90)
            parts.push(result.subarray(offset, offset + length));
          offset += length;
        }
        return Buffer.concat(parts);
      },
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${address.port}/postgres?connection_limit=1&sslmode=disable`;
  process.env.EDITORIAL_DESK_WRITE = "1";
  Object.assign(process.env, { NODE_ENV: "test" });
  const { prisma } = await import("../lib/prisma");
  if (process.argv.includes("--citation-only")) {
    await import("./test-citation-guard");
    return;
  }
  const service = await import("../lib/modules/editorial/service");
  const { reviewIntake } = await import("../lib/modules/editorial/intake");
  const { hash } = await import("../lib/modules/editorial/repository");
  let count = 0;
  const test = async (name: string, fn: () => Promise<void> | void) => {
    await fn();
    count++;
    console.log(`PASS ${name}`);
  };
  const config = structuredClone(DEFAULT_CONFIG);
  config.roles.push({
    id: "manager",
    name: "مدير التحرير",
    enabled: true,
    permissions: [...PERMISSIONS],
  });
  for (const [userId, roleId] of [
    ["editor", "editor"],
    ["reviewer", "reviewer"],
    ["reviewer2", "reviewer"],
    ["publisher", "publisher"],
    ["agent", "agent"],
  ])
    config.bindings.push({
      userId,
      roleId,
      kind: userId === "agent" ? "agent" : "human",
      targets: ["work", "unit", "ruling", "relation", "principle", "amendment"],
      domains: [],
      enabled: true,
    });
  const input = (id: string, key: string, status = "ملغى"): ChangeInput => ({
    title: `تغيير ${id}`,
    targetType: "work",
    targetId: id,
    op: "set_work_status",
    after: { status },
    evidenceInstrument: "مرسوم تجريبي",
    evidenceUrl: `https://example.test/${key}`,
    evidenceQuote: `سند تجريبي ${key}`,
    sourceRank: 1,
    idempotencyKey: key,
  });
  try {
    await service.saveConfig("owner", config, 0, "تجهيز فريق الاختبار", "test");
    if (process.argv.includes("--serve")) {
      await prisma.$disconnect();
      await db.exec("DEALLOCATE ALL");
      const { spawn } = await import("node:child_process");
      const { createServer: httpServer } = await import("node:http");
      const { createHmac } = await import("node:crypto");
      const secret = "synthetic-editorial-fixture-only";
      const payload = Buffer.from(
        JSON.stringify({
          userId: "owner",
          role: "SUPER_ADMIN",
          name: "Owner",
          email: "owner@example.test",
          exp: Date.now() + 3600000,
          nonce: "fixture",
        }),
      ).toString("base64url");
      const cookie =
        payload +
        "." +
        createHmac("sha256", secret).update(payload).digest("base64url");
      httpServer((_req, res) => {
        res.writeHead(302, {
          "Set-Cookie": `hakeem_session=${cookie}; Path=/; HttpOnly; SameSite=Lax`,
          Location: "http://127.0.0.1:3080/admin/legal",
        });
        res.end();
      }).listen(3081, "127.0.0.1");
      const child = spawn(
        process.execPath,
        [
          "node_modules/next/dist/bin/next",
          "dev",
          "-p",
          "3080",
          "-H",
          "127.0.0.1",
        ],
        {
          stdio: "inherit",
          env: {
            ...process.env,
            NODE_ENV: "development",
            REQUIRE_AUTH: "true",
            AUTH_SECRET: secret,
            NEXT_TELEMETRY_DISABLED: "1",
          },
        },
      );
      process.on("SIGINT", () => {
        child.kill();
        process.exit(0);
      });
      console.log("Synthetic UI: http://127.0.0.1:3081");
      await new Promise<void>(() => {});
    }
    await test("SYSTEM_ADMIN has no editorial bypass; agents cannot approve", () => {
      assert.equal(
        allowed(
          { id: "admin", role: "SYSTEM_ADMIN", isActive: true },
          config,
          "LEGAL_PUBLISHER",
        ),
        false,
      );
      for (const p of PERMISSIONS.filter((p) => p !== "LEGAL_AGENT_PROPOSE"))
        assert.equal(
          allowed({ id: "agent", role: "LAWYER", isActive: true }, config, p),
          false,
        );
    });
    let set = await service.propose("editor", [input("work1", "one")], "test");
    await service.submit("editor", set.id, "test");
    await test("self approval and agent approval rejected", async () => {
      await assert.rejects(
        service.decide("editor", set.id, "approve", "test reason", "test"),
      );
      await assert.rejects(
        service.decide("agent", set.id, "approve", "test reason", "test"),
      );
      await assert.rejects(service.publish("publisher", set.id, "test"));
    });
    await service.decide(
      "reviewer",
      set.id,
      "approve",
      "source checked",
      "test",
    );
    await test("approved payload cannot be edited", async () => {
      await assert.rejects(
        prisma.$executeRaw`UPDATE editorial_change SET after_json='{"status":"ساري"}'::jsonb WHERE change_set_id=${set.id}`,
      );
    });
    await service.publish("publisher", set.id, "test");
    await test("publish appends evidence and durable outbox atomically", async () => {
      assert.equal(await prisma.verification.count(), 1);
      assert.equal(await prisma.editorialIndexSync.count(), 1);
      assert.equal(
        (await prisma.legalSystem.findUniqueOrThrow({ where: { id: "work1" } }))
          .preamble,
        null,
      );
    });
    await test("append-only audit rejects update and delete", async () => {
      await assert.rejects(
        prisma.$executeRaw`UPDATE audit_event SET action='tampered'`,
      );
      await assert.rejects(prisma.$executeRaw`DELETE FROM audit_event`);
    });
    const original = await prisma.verification.findMany();
    const compensation = await service.revert(
      "owner",
      set.id,
      "تصحيح قرار النشر التجريبي",
      "test",
    );
    await service.submit("owner", compensation.id, "test");
    await service.decide(
      "reviewer",
      compensation.id,
      "approve",
      "راجعنا التراجع",
      "test",
    );
    await service.publish("publisher", compensation.id, "test");
    await test("revert preserves original evidence", async () => {
      const unchanged = await prisma.verification.findMany({
        where: { id: { in: original.map((r) => r.id) } },
      });
      assert.equal(hash(unchanged), hash(original));
      assert.equal(await prisma.verification.count(), 2);
      assert.equal(
        (
          await prisma.editorialChangeSet.findUniqueOrThrow({
            where: { id: set.id },
          })
        ).status,
        "reverted",
      );
    });
    set = await service.propose(
      "editor",
      [
        input("work1", "batch1"),
        input("work2", "batch2"),
        input("work3", "batch3"),
      ],
      "test",
    );
    await service.submit("editor", set.id, "test");
    await service.decide(
      "reviewer",
      set.id,
      "approve",
      "راجعنا الدفعة",
      "test",
    );
    await db.exec(
      "CREATE FUNCTION fixture_reject_third() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.object_id='work3' THEN RAISE EXCEPTION 'injected publication failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER fixture_reject BEFORE INSERT ON verification FOR EACH ROW EXECUTE FUNCTION fixture_reject_third();",
    );
    await test("third-change failure rolls back whole batch and evidence", async () => {
      const before = await prisma.verification.count();
      await assert.rejects(service.publish("publisher", set.id, "test"));
      assert.equal(await prisma.verification.count(), before);
      assert.equal(await prisma.editorialIndexSync.count(), 2);
    });
    await test("intake rejects empty corrections and agent decisions", async () => {
      assert.throws(() =>
        amendmentDecision({ decision: "approved_with_edit" }),
      );
      await assert.rejects(
        reviewIntake(
          "agent",
          "amendment",
          "op1",
          "approve",
          "reason",
          {},
          "test",
        ),
      );
    });
    await test("concurrent intake decisions yield one source decision", async () => {
      const before = await prisma.verification.count();
      const outcomes = await Promise.allSettled([
        reviewIntake(
          "reviewer",
          "amendment",
          "op1",
          "approve",
          "سبب",
          {},
          "test",
        ),
        reviewIntake(
          "reviewer",
          "amendment",
          "op1",
          "approve",
          "سبب",
          {},
          "test",
        ),
      ]);
      assert(outcomes.some((o) => o.status === "fulfilled"));
      const rows = await prisma.$queryRaw<
        Array<{ n: bigint }>
      >`SELECT count(*) n FROM uqn_fix.amendment_review`;
      assert.equal(Number(rows[0].n), 1);
      assert.equal(await prisma.verification.count(), before);
      assert.equal(await prisma.unitVersion.count(), 0);
    });
    await test("principle decisions use shared review service", async () => {
      await reviewIntake(
        "reviewer",
        "principle",
        "principle1",
        "approve",
        "مراجعة المصدر",
        {},
        "test",
      );
      assert.equal(
        (
          await prisma.judicialPrinciple.findUniqueOrThrow({
            where: { id: "principle1" },
          })
        ).reviewStatus,
        "reviewed",
      );
    });
    await test("configuration revision and immediate revocation", async () => {
      const next = structuredClone(config);
      next.bindings = next.bindings.filter((b) => b.userId !== "reviewer");
      await service.saveConfig("owner", next, 1, "سحب تكليف تجريبي", "test");
      await assert.rejects(
        service.saveConfig("owner", config, 1, "تعديل متعارض", "test"),
      );
      await assert.rejects(
        reviewIntake(
          "reviewer",
          "principle",
          "principle2",
          "approve",
          "سبب",
          {},
          "test",
        ),
      );
    });
    await test("batch intake rejects uncertain rows atomically", async () => {
      const { reviewIntakeBatch } =
        await import("../lib/modules/editorial/intake");
      await assert.rejects(
        reviewIntakeBatch(
          "reviewer2",
          ["op2", "op3"],
          "مراجعة الدفعة التجريبية",
          "test",
        ),
      );
      const rows = await prisma.$queryRaw<
        Array<{ n: bigint }>
      >`SELECT count(*) n FROM uqn_fix.amendment_review WHERE op_id='op2'`;
      assert.equal(Number(rows[0].n), 0);
    });
    await test("two reviewers required; emergency revert is owner-only and policy-controlled", async () => {
      const current = await prisma.editorialConfig.findFirstOrThrow({
        orderBy: { revision: "desc" },
      });
      const next = structuredClone(config);
      next.policies.find((p) => p.target === "work")!.minApprovals = 2;
      await service.saveConfig(
        "owner",
        next,
        current.revision,
        "اشتراط اعتمادين مستقلين",
        "test",
      );
      const draft = await service.propose(
        "editor",
        [input("work5", "multi")],
        "test",
      );
      await service.submit("editor", draft.id, "test");
      assert.equal(
        (
          await service.decide(
            "reviewer",
            draft.id,
            "approve",
            "مراجعة أولى",
            "test",
          )
        ).status,
        "pending",
      );
      await assert.rejects(service.publish("publisher", draft.id, "test"));
      await service.decide(
        "reviewer2",
        draft.id,
        "approve",
        "مراجعة ثانية",
        "test",
      );
      await service.publish("publisher", draft.id, "test");
      await assert.rejects(
        service.urgentRevert(
          "owner",
          draft.id,
          "تصحيح عاجل تجريبي موثق",
          "test",
        ),
      );
      next.policies.find((p) => p.target === "work")!.urgentOwnerRevert = true;
      await service.saveConfig(
        "owner",
        next,
        current.revision + 1,
        "تفعيل استثناء التراجع العاجل",
        "test",
      );
      await assert.rejects(
        service.urgentRevert(
          "publisher",
          draft.id,
          "تصحيح عاجل تجريبي موثق",
          "test",
        ),
      );
      const reverted = await service.urgentRevert(
        "owner",
        draft.id,
        "تصحيح عاجل تجريبي موثق",
        "test",
      );
      assert.equal(reverted.status, "published");
      assert.equal(
        (
          await prisma.editorialChangeSet.findUniqueOrThrow({
            where: { id: draft.id },
          })
        ).status,
        "reverted",
      );
      assert(
        (await prisma.editorialTask.count({
          where: { changeSetId: reverted.id },
        })) > 0,
      );
      assert.equal(
        await prisma.editorialAuditEvent.count({
          where: { action: "urgent_revert" },
        }),
        1,
      );
    });
    await test("identity keeps similar Saudi titles ambiguous", () => {
      assert.equal(
        compareWorkIdentity(
          {
            name: "ترتيبات مكتب تطوير الجوف",
            instrument: "1",
            date: "2020-01-01",
          },
          {
            name: "ترتيبات مكتب تطوير جازان",
            instrument: "1",
            date: "2020-01-01",
          },
        ),
        "ambiguous",
      );
      assert.equal(
        compareWorkIdentity(
          {
            name: "نظام تملك غير السعوديين للعقار",
            instrument: "1",
            date: "2020-01-01",
          },
          {
            name: "نظام تملك غير السعوديين للعقار واستثماره",
            instrument: "1",
            date: "2020-01-01",
          },
        ),
        "ambiguous",
      );
    });
    await test("OpenSearch error is durable and retry completes all steps", async () => {
      const { runSync } = await import("../lib/modules/editorial/sync");
      process.env.OPENSEARCH_URL = "http://127.0.0.1:1";
      const failed = await runSync("publisher", {
        request: async () => new Response('{"errors":true}', { status: 200 }),
        revalidate: () => {},
      });
      assert.equal(failed.complete, false);
      const job = await prisma.editorialIndexSync.findFirstOrThrow({
        where: { lastError: { not: null } },
      });
      assert(job.lastError?.includes("OpenSearch"));
      assert(job.searchNormAt);
      assert(job.revalidatedAt);
      assert.equal(job.opensearchAt, null);
      await prisma.editorialIndexSync.update({
        where: { id: job.id },
        data: { nextAttemptAt: new Date(0) },
      });
      const retried = await runSync("publisher", {
        request: async () => new Response('{"errors":false}', { status: 200 }),
        revalidate: () => {},
      });
      assert.equal(retried.complete, true);
      const done = await prisma.editorialIndexSync.findUniqueOrThrow({
        where: { id: job.id },
      });
      assert(done.completedAt);
      assert.equal(done.lastError, null);
      assert.equal(
        done.searchNormAt?.toISOString(),
        job.searchNormAt.toISOString(),
      );
      delete process.env.OPENSEARCH_URL;
    });
    await test("Hijri correction uses Umm al-Qura and rejects impossible dates", () => {
      assert.equal(
        amendmentDecision({
          decision: "approved_with_edit",
          effective_from_hijri: "1446-09-01",
        }).corrected.effective_from_gregorian,
        "2025-03-01",
      );
      assert.throws(() =>
        amendmentDecision({
          decision: "approved_with_edit",
          effective_from_hijri: "1446-15-35",
        }),
      );
    });
    await test("write flag fails closed", async () => {
      delete process.env.EDITORIAL_DESK_WRITE;
      assert.throws(() => assertWriteEnabled());
      await assert.rejects(
        service.propose("owner", [input("work4", "off")], "test"),
      );
    });
    console.log(
      `Editorial integration: ${count} passed (local PostgreSQL/WASM, synthetic fixtures).`,
    );
  } finally {
    await prisma.$disconnect();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((r) => server.close(() => r()));
    await db.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
