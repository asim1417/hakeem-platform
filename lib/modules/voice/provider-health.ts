// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §11 — حالة إتاحة المزوّدين (لعرضها في /api/voice/providers/health).
// لا يُعيد مفاتيح ولا endpoints — فقط id + available + reason وصفيّ.
// ─────────────────────────────────────────────────────────────────────────────
import { allProviders } from "./provider-registry";

export interface ProviderHealthEntry {
  id: string;
  available: boolean;
  reason?: string;
}

export async function collectProviderHealth(): Promise<ProviderHealthEntry[]> {
  const providers = allProviders();
  const out: ProviderHealthEntry[] = [];
  for (const p of providers) {
    try {
      const h = await p.health();
      out.push({ id: p.id, available: h.available, reason: h.reason });
    } catch (e) {
      out.push({ id: p.id, available: false, reason: e instanceof Error ? e.message : "خطأ" });
    }
  }
  return out;
}
