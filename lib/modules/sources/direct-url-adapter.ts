import "server-only";

// محوّل DIRECT_URL خلف عقد المصدر الموحّد (§9) — يلفّ الموصل القائم دون تعديله.
import { getDirectUrlConnector } from "@/lib/modules/documents/connectors/registry";
import type {
  SourceAdapter,
  SourceMetadata,
  IntegrityReport,
  RightsDecision,
} from "./source-adapter";

/** يبني محوّلًا يترجم قدرات موصل DIRECT_URL إلى العقد الموحّد. */
export function createDirectUrlSourceAdapter(): SourceAdapter {
  const connector = getDirectUrlConnector();
  return {
    provider: "DIRECT_URL",
    capabilities: ["fetchMetadata", "resolveRights", "verifyIntegrity"],

    async fetchMetadata(id: string): Promise<SourceMetadata> {
      const info = await connector.inspect({ url: id });
      return {
        id,
        fileName: info.fileName,
        mimeType: info.reportedMimeType,
        size: info.reportedSize,
        accessible: info.accessible,
        warnings: info.warnings,
      };
    },

    async resolveRights(id: string): Promise<RightsDecision> {
      // القرار مبنيّ على فحص السلامة القائم (SSRF/HTTPS): متاحٌ إن أمكن الفحص.
      try {
        const info = await connector.inspect({ url: id });
        return {
          allowed: info.accessible && !info.requiresAuthentication,
          reason: info.requiresAuthentication ? "يتطلّب مصادقة" : "متاح للجلب",
        };
      } catch (e) {
        return { allowed: false, reason: e instanceof Error ? e.message : "تعذّر التقييم" };
      }
    },

    async verifyIntegrity(payload: unknown): Promise<IntegrityReport> {
      const url = typeof payload === "string" ? payload : (payload as { url?: string })?.url;
      if (!url) return { ok: false, detail: "لا رابط للتحقّق" };
      try {
        const dl = await connector.download({ url });
        return { ok: true, sha256: dl.sha256, detail: `تُحقّق ${dl.size} بايت` };
      } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : "فشل التحقّق" };
      }
    },
  };
}
