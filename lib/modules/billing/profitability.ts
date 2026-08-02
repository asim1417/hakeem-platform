import "server-only";

// ربحية الخدمات — HKM-BILLING-UX-001 (§12). لكل خدمة: الطلبات، النقاط المحصّلة،
// تكلفة Claude الفعلية، متوسط التوكنات/الزمن، نسبة الأخطاء، الهامش. داخلي (لا يُعرض للمستخدم).

export interface ServiceProfitability {
  serviceKey: string;
  requests: number;
  errorRequests: number;
  errorRate: number;
  inputTokens: number;
  outputTokens: number;
  avgTokens: number;
  avgLatencyMs: number;
  providerCostSar: number; // تكلفة Claude (ر.س)
  chargedPoints: number; // النقاط المحصّلة
}

export interface ProfitabilityOverview {
  totalProviderCostSar: number;
  totalChargedPoints: number;
  services: ServiceProfitability[];
}

const USD_TO_SAR = 3.75;

/** ربحية لكل خدمة خلال فترة (منذ since، افتراضيًا كل التاريخ). */
export async function getServiceProfitability(since?: Date): Promise<ProfitabilityOverview> {
  const empty: ProfitabilityOverview = { totalProviderCostSar: 0, totalChargedPoints: 0, services: [] };
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRawUnsafe<
      {
        service_key: string | null;
        requests: number;
        errors: number;
        inp: number;
        outp: number;
        cost_micros: number;
        charged: number;
        latency: number;
      }[]
    >(
      `SELECT COALESCE("service_key",'unknown') AS service_key,
              COUNT(*)::int AS requests,
              COUNT(*) FILTER (WHERE "error_code" IS NOT NULL OR "status" = 'error')::int AS errors,
              COALESCE(SUM("input_tokens"),0)::bigint AS inp,
              COALESCE(SUM("output_tokens"),0)::bigint AS outp,
              COALESCE(SUM("provider_cost_micros_usd"),0)::bigint AS cost_micros,
              COALESCE(SUM("charged_points"),0)::bigint AS charged,
              COALESCE(AVG("latency_ms"),0)::int AS latency
         FROM "ai_usage_events"
        ${since ? `WHERE "created_at" >= $1::timestamptz` : ""}
        GROUP BY COALESCE("service_key",'unknown')
        ORDER BY cost_micros DESC`,
      ...(since ? [since] : [])
    );

    const services: ServiceProfitability[] = rows.map((r) => {
      const requests = Number(r.requests) || 0;
      const errors = Number(r.errors) || 0;
      const inputTokens = Number(r.inp) || 0;
      const outputTokens = Number(r.outp) || 0;
      const providerCostSar = (Number(r.cost_micros) / 1_000_000) * USD_TO_SAR;
      return {
        serviceKey: r.service_key || "unknown",
        requests,
        errorRequests: errors,
        errorRate: requests > 0 ? errors / requests : 0,
        inputTokens,
        outputTokens,
        avgTokens: requests > 0 ? Math.round((inputTokens + outputTokens) / requests) : 0,
        avgLatencyMs: Number(r.latency) || 0,
        providerCostSar: Math.round(providerCostSar * 100) / 100,
        chargedPoints: Number(r.charged) || 0,
      };
    });

    return {
      totalProviderCostSar: Math.round(services.reduce((s, x) => s + x.providerCostSar, 0) * 100) / 100,
      totalChargedPoints: services.reduce((s, x) => s + x.chargedPoints, 0),
      services,
    };
  } catch {
    return empty;
  }
}
