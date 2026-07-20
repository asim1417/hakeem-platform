import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { ensureLocalUserFromClerk, deactivateLocalUserByClerkId } from "@/lib/modules/auth/clerk-sync";

export const dynamic = "force-dynamic";

type ClerkEmail = { email_address: string; id: string };
type ClerkUserEvent = {
  data: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    email_addresses?: ClerkEmail[];
    primary_email_address_id?: string | null;
  };
  type: string;
};

/**
 * POST /api/webhooks/clerk — مزامنة user.created / updated / deleted.
 * يتطلب CLERK_WEBHOOK_SECRET من لوحة Clerk → Webhooks.
 */
export async function POST(request: NextRequest) {
  const secret = (process.env.CLERK_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    return NextResponse.json({ message: "CLERK_WEBHOOK_SECRET غير مضبوط." }, { status: 503 });
  }

  const payload = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ message: "توقيع Svix ناقص." }, { status: 400 });
  }

  let evt: ClerkUserEvent;
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch {
    return NextResponse.json({ message: "توقيع غير صالح." }, { status: 400 });
  }

  const type = evt.type;
  const data = evt.data;

  if (type === "user.deleted") {
    await deactivateLocalUserByClerkId(data.id);
    return NextResponse.json({ ok: true, action: "deactivated" });
  }

  if (type === "user.created" || type === "user.updated") {
    const primary =
      data.email_addresses?.find((e) => e.id === data.primary_email_address_id)?.email_address ||
      data.email_addresses?.[0]?.email_address;
    if (!primary) {
      return NextResponse.json({ ok: true, skipped: "no_email" });
    }
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || data.username;
    await ensureLocalUserFromClerk({ clerkId: data.id, email: primary, name });
    return NextResponse.json({ ok: true, action: type });
  }

  return NextResponse.json({ ok: true, ignored: type });
}
