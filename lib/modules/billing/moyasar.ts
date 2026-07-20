// ─────────────────────────────────────────────────────────────────────────────
// Moyasar — إنشاء فاتورة عند توفر المفتاح السري. بلا مفتاح = غير حيّ.
// ─────────────────────────────────────────────────────────────────────────────
import type { PlanDefinition, PlanInterval } from "@/config/pricing";

export function moyasarSecret(): string {
  return (process.env.MOYASAR_SECRET_KEY || "").trim();
}

export function moyasarPublishable(): string {
  return (process.env.MOYASAR_PUBLISHABLE_KEY || "").trim();
}

export function isMoyasarLive(): boolean {
  return Boolean(moyasarSecret());
}

function amountHalalas(plan: PlanDefinition, interval: PlanInterval): number | null {
  const sar =
    interval === "yearly" && plan.yearlySar != null ? plan.yearlySar : plan.monthlySar;
  if (sar == null || sar <= 0) return null;
  return Math.round(sar * 100);
}

export type MoyasarInvoice = {
  id: string;
  url: string;
  status: string;
};

/** إنشاء فاتورة Moyasar وإرجاع رابط الدفع. */
export async function createMoyasarInvoice(input: {
  plan: PlanDefinition;
  interval: PlanInterval;
  userId: string;
  userEmail: string;
  userName: string;
  origin: string;
}): Promise<{ ok: true; invoice: MoyasarInvoice } | { ok: false; message: string }> {
  const secret = moyasarSecret();
  if (!secret) return { ok: false, message: "مفتاح Moyasar غير مضبوط." };

  const amount = amountHalalas(input.plan, input.interval);
  if (amount == null) return { ok: false, message: "الخطة غير قابلة للدفع." };

  const success = `${input.origin}/dashboard/billing?paid=1&plan=${input.plan.id}`;
  const back = `${input.origin}/dashboard/subscribe?checkout=cancel`;
  const callback = `${input.origin}/api/billing/webhook`;

  const auth = Buffer.from(`${secret}:`).toString("base64");
  try {
    const res = await fetch("https://api.moyasar.com/v1/invoices", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: "SAR",
        description: `اشتراك حكيم — ${input.plan.nameAr} (${input.interval})`,
        callback_url: callback,
        success_url: success,
        back_url: back,
        metadata: {
          userId: input.userId,
          planId: input.plan.id,
          interval: input.interval,
          email: input.userEmail,
          name: input.userName,
        },
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      url?: string;
      status?: string;
      message?: string;
      type?: string;
    };

    if (!res.ok || !data.id || !data.url) {
      return {
        ok: false,
        message: data.message || `تعذّر إنشاء فاتورة Moyasar (${res.status}).`,
      };
    }

    return {
      ok: true,
      invoice: { id: data.id, url: data.url, status: data.status || "initiated" },
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "خطأ شبكة مع Moyasar.",
    };
  }
}

/** تفعيل اشتراك المستخدم بعد دفع ناجح (SQL خام على subscriptionStatus). */
export async function activateSubscription(userId: string): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$executeRawUnsafe(
      `UPDATE "users" SET "subscriptionStatus" = 'active' WHERE id = $1`,
      userId
    );
  } catch {
    /* قبل هجرة الحصّة — تجاهل */
  }
}
