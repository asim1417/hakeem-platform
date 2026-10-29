/**
 * HKM-054: subscriptions/listen يُرفض فورًا بخطأ JSON-RPC ‎-32603 داخل الجسم (رد الحزمة حين maxSubscriptions = 0)،
 * بدل بثّ لا ينتهي حتى مهلة 300 ث. وبقية الطرق تمرّ كما هي. على المسار الحقيقي app/mcp/route.ts بوضع مفتوح؛ لا شبكة ولا قاعدة.
 * التشغيل: npx tsx scripts/test-mcp-listen-guard.ts
 */
import { createRequire } from "node:module";
import { listenRequestId, withListenRefused } from "../lib/mcp/listen-guard";

const req = createRequire(__filename);
const serverOnly = req.resolve("server-only");
req.cache[serverOnly] = { id: serverOnly, filename: serverOnly, loaded: true, exports: {} } as unknown as NodeJS.Module;

let failed = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    failed += 1;
    console.error("✗ " + m);
  } else console.log("✓ " + m);
};

const rpc = (body: unknown, protocol: string | null = "2026-07-28") =>
  new Request("https://hakeemai.net/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(protocol ? { "mcp-protocol-version": protocol } : {}),
    },
    body: JSON.stringify(body),
  });

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms))]);

async function main() {
  // ① التعرّف: طلب مفرد بالطريقة فقط.
  ok(listenRequestId({ jsonrpc: "2.0", id: 7, method: "subscriptions/listen", params: {} }) === 7, "طلب listen يُعرف بمعرّفه");
  ok(listenRequestId({ method: "subscriptions/listen" }) === null, "listen بلا معرّف: id = null");
  ok(listenRequestId({ id: 1, method: "tools/call" }) === undefined && listenRequestId([{ method: "subscriptions/listen" }]) === undefined && listenRequestId(null) === undefined, "غير listen يمرّ");

  // ② الغلاف وحده: listen لا يصل للمعالج، وغيره يصل.
  let reached = 0;
  const inner = withListenRefused(async () => {
    reached += 1;
    return new Response("inner", { status: 200 });
  });
  const refused = await inner(rpc({ jsonrpc: "2.0", id: "s1", method: "subscriptions/listen", params: { notifications: {} } }));
  const body = (await refused.json()) as { id: unknown; error?: { code: number; message: string } };
  ok(reached === 0 && refused.status === 200 && body.id === "s1" && body.error?.code === -32603 && body.error.message === "Subscription limit reached", "listen يُرفض في الجسم بحالة 200 (‎-32603)");
  ok((await (await inner(rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }))).text()) === "inner" && reached === 1, "tools/list يمرّ للمعالج");
  ok((await (await inner(new Request("https://hakeemai.net/mcp", { method: "GET" }))).text()) === "inner", "GET يمرّ");

  // ③ المسار الحقيقي بوضع مفتوح: listen يرجع فورًا (كان بثًّا مفتوحًا)، وtools/list يعمل.
  process.env.HAKEEM_MCP_ALLOW_OPEN = "1";
  delete process.env.HAKEEM_MCP_KEY;
  delete process.env.MCP_TOKEN_SECRET;
  const { POST } = await import("../app/mcp/route");
  const res = await withTimeout(POST(rpc({ jsonrpc: "2.0", id: 9, method: "subscriptions/listen", params: { notifications: { toolsListChanged: true } } })), 3000);
  ok(res !== "timeout", "المسار الحقيقي: listen لا يعلّق");
  if (res !== "timeout") {
    const text = await withTimeout(res.text(), 3000);
    ok(text !== "timeout" && text.includes("-32603") && text.includes("Subscription limit reached"), `المسار الحقيقي: جسم الرفض كاملًا ثم ينتهي (${String(text).slice(0, 120)})`);
  }
  const list = await withTimeout(POST(rpc({ jsonrpc: "2.0", id: 10, method: "tools/list", params: {} }, null)), 10000);
  const listText = list === "timeout" ? "timeout" : await list.text();
  ok(listText.includes("hakeem_search"), `المسار الحقيقي: tools/list كما هو (${listText.slice(0, 120)})`);

  if (failed) {
    console.error(`\n${failed} فشل`);
    process.exit(1);
  }
  console.log("\nكل اختبارات رفض listen نجحت");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
