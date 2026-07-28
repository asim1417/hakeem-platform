import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { createPairingCode } from "@/lib/modules/rasd/bridge/pairing";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("RASD_ADMIN", request);
  if (gate.response) return gate.response;
  const ownerId = gate.user?.id ?? "admin";
  const pairing = createPairingCode(String(ownerId));
  return NextResponse.json({
    code: pairing.code,
    expiresAt: pairing.expiresAt,
    pairingUrl: `hakeem-rasd://pair?code=${encodeURIComponent(pairing.code)}`,
    qrPayload: pairing.code,
    instructions: {
      ar: "افتح تطبيق جسر رصد حكيم المحلي وأدخل الرمز خلال 10 دقائق.",
      downloads: {
        windows: "/admin/rasd/agents#download-windows",
        mac: "/admin/rasd/agents#download-mac",
        linux: "/admin/rasd/agents#download-linux"
      }
    }
  });
}
