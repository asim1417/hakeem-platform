/**
 * نقطة ChatGPT العامة لـ«أمان الامتثال».
 *
 * لا تكشف إلا أدوات الفرز والتواصل العامة الآمنة؛ يبقى /mcp الكامل مستقلاً
 * ومحميّاً بمفتاحه الاختياري لخدمات حكيم البحثية.
 */
import { createMcpHandler } from "mcp-handler";
import { AMAN_MCP_SERVER_INFO, registerAmanTools } from "@/lib/mcp/aman-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createMcpHandler(registerAmanTools, {
  serverInfo: AMAN_MCP_SERVER_INFO,
});

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
