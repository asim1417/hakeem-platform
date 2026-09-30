import {
  createAuthorizationCode,
  isAllowedClientId,
  isAllowedRedirect,
  keysMatch,
  mcpResourceUrl,
  publicOrigin,
} from "@/lib/mcp/oauth";
import { renderAuthorizePage, renderOauthMessage, renderReturnToClaude } from "@/lib/mcp/oauth-pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELD_LIMIT = 512;

type AuthorizeInput = {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
  resource: string;
};

export async function GET(request: Request) {
  const input = readInput(new URL(request.url).searchParams);
  if (input && !resolveResource(publicOrigin(request), input.resource)) {
    return renderOauthMessage("تعذّر بدء الربط", "مورد الربط لا يطابق خادم حكيم.");
  }
  return authorizeResponse(request, input, "");
}

export async function POST(request: Request) {
  const form = await request.formData();
  const input = readInput(form);
  if (!input) {
    return renderOauthMessage("تعذّر بدء الربط", "طلب الربط ناقص أو وجهته غير مسموحة. أعد المحاولة من شاشة الموصلات في Claude.");
  }
  const secret = process.env.HAKEEM_MCP_KEY?.trim() ?? "";
  const provided = String(form.get("connector_key") ?? "");
  if (!secret || !keysMatch(provided, secret)) {
    console.warn("[mcp-oauth] authorize rejected");
    return authorizeResponse(request, input, "المفتاح غير مطابق. تحقّق من مفتاح موصل حكيم لدى مسؤول المنصة.");
  }
  const origin = publicOrigin(request);
  const resource = resolveResource(origin, input.resource);
  if (!resource) {
    return renderOauthMessage("تعذّر بدء الربط", "مورد الربط لا يطابق خادم حكيم.");
  }
  const code = createAuthorizationCode({
    secret,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    resource,
  });
  const target = new URL(input.redirectUri);
  target.searchParams.set("code", code);
  if (input.state) target.searchParams.set("state", input.state);
  return new Response(renderReturnToClaude(target.toString()), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}

function authorizeResponse(request: Request, input: AuthorizeInput | null, error: string): Response {
  if (!input) {
    return renderOauthMessage("تعذّر بدء الربط", "طلب الربط ناقص أو وجهته غير مسموحة. أعد المحاولة من شاشة الموصلات في Claude.");
  }
  if (!process.env.HAKEEM_MCP_KEY?.trim()) {
    return renderOauthMessage("الربط غير متاح", "مفتاح موصل حكيم غير مضبوط على الخادم.", 503);
  }
  const html = renderAuthorizePage({ ...input, error: error || undefined });
  return new Response(html, {
    status: error ? 401 : 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function readInput(source: { get(name: string): string | File | null }): AuthorizeInput | null {
  const input: AuthorizeInput = {
    clientId: text(source, "client_id"),
    redirectUri: text(source, "redirect_uri"),
    state: text(source, "state"),
    codeChallenge: text(source, "code_challenge"),
    codeChallengeMethod: text(source, "code_challenge_method") || "S256",
    scope: text(source, "scope"),
    resource: text(source, "resource"),
  };
  if (source instanceof URLSearchParams && source.get("response_type") && source.get("response_type") !== "code") {
    return null;
  }
  if (!isAllowedClientId(input.clientId)) return null;
  if (!isAllowedRedirect(input.redirectUri)) return null;
  if (input.codeChallengeMethod !== "S256") return null;
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(input.codeChallenge)) return null;
  return input;
}

function text(source: { get(name: string): string | File | null }, name: string): string {
  const value = source.get(name);
  if (typeof value !== "string") return "";
  return value.length > FIELD_LIMIT ? "" : value;
}

function resolveResource(origin: string, requested: string): string | null {
  const expected = mcpResourceUrl(origin);
  if (!requested) return expected;
  return requested.replace(/\/+$/, "") === expected ? expected : null;
}
