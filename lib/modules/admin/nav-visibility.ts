/**
 * قراءة رايات إظهار عناصر القائمة — سقوط آمن إلى الإظهار.
 */
import "server-only";

import { isFeatureEnabled } from "@/lib/modules/admin/feature-toggles";
import { TRADITIONAL_SEARCH_ENABLED } from "@/lib/modules/config/search-visibility";

export async function getNavVisibility() {
  const [agents, documents, simulations, traditional] = await Promise.all([
    isFeatureEnabled("ui.agents_nav", true),
    isFeatureEnabled("ui.documents_nav", true),
    isFeatureEnabled("ui.simulations_nav", true),
    // الأولوية: راية القاعدة إن وُجدت؛ وإلا متغيّر البيئة الحالي
    isFeatureEnabled("ui.traditional_search", TRADITIONAL_SEARCH_ENABLED),
  ]);
  return {
    agents,
    documents,
    simulations,
    traditionalSearch: traditional,
  };
}
