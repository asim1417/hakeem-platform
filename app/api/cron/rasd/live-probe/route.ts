import { NextRequest, NextResponse } from "next/server";
import { lookup } from "dns/promises";
import { connect } from "net";
import tls from "tls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const HOSTS: Record<string, string[]> = {
  BOE: ["laws.boe.gov.sa", "boe.gov.sa"],
  NCAR: ["ncar.gov.sa", "www.ncar.gov.sa"],
  UQN: ["www.uqn.gov.sa", "uqn.gov.sa"]
};

function authorized(request: NextRequest): boolean {
  const secret = process.env.RASD_LIVE_PROBE_TOKEN || process.env.RASD_CRON_SECRET || process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("x-rasd-probe-token") || request.headers.get("x-cron-secret");
    const auth = request.headers.get("authorization");
    return Boolean((header && header === secret) || (auth && auth === `Bearer ${secret}`));
  }
  // Preview-only shallow probe when no secret configured (verification PRs).
  return process.env.VERCEL_ENV === "preview";
}

function tcp(host: string, timeoutMs = 8000): Promise<{ ok: boolean; error?: string; ms?: number }> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = connect({ host, port: 443 });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: "tcp_timeout" });
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      const ms = Date.now() - started;
      socket.end();
      resolve({ ok: true, ms });
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message });
    });
  });
}

function tlsHandshake(host: string, timeoutMs = 12000): Promise<{ ok: boolean; error?: string; protocol?: string | null }> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: true, timeout: timeoutMs });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: "tls_timeout" });
    }, timeoutMs);
    socket.once("secureConnect", () => {
      clearTimeout(timer);
      const protocol = socket.getProtocol();
      socket.end();
      resolve({ ok: true, protocol });
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message });
    });
  });
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ message: "غير مصرح." }, { status: 401 });
  }
  const target = (request.nextUrl.searchParams.get("target") || "BOE").toUpperCase();
  const hosts = HOSTS[target];
  if (!hosts) return NextResponse.json({ message: "target غير مدعوم" }, { status: 400 });

  const rows = [];
  for (const host of hosts) {
    let dns: { ok: boolean; addrs?: string[]; error?: string } = { ok: false };
    try {
      const records = await lookup(host, { all: true });
      dns = { ok: true, addrs: records.map((r) => r.address) };
    } catch (error) {
      dns = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    const tcpResult = dns.ok ? await tcp(host) : { ok: false, error: "skipped_dns" };
    const tlsResult = tcpResult.ok ? await tlsHandshake(host) : { ok: false, error: "skipped_tcp" };
    let http: Record<string, unknown> = { ok: false, error: "skipped_tls" };
    if (tlsResult.ok) {
      try {
        const response = await fetch(`https://${host}/`, {
          method: "HEAD",
          redirect: "manual",
          headers: { "user-agent": "Hakeem-Rasd/1.0 (+https://hakeem.sa)" }
        });
        http = { ok: response.status > 0, status: response.status, contentType: response.headers.get("content-type") };
      } catch (error) {
        http = { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
    rows.push({ host, dns, tcp: tcpResult, tls: tlsResult, http });
  }

  return NextResponse.json({
    target,
    checkedAt: new Date().toISOString(),
    environment: { vercelEnv: process.env.VERCEL_ENV ?? null, region: process.env.VERCEL_REGION ?? null },
    connectivity: rows,
    tlsOk: rows.some((r) => r.tls.ok),
    httpOk: rows.some((r) => Boolean((r.http as { ok?: boolean }).ok))
  });
}
