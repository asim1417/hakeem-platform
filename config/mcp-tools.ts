/**
 * سياسة أدوات موصل حكيم (MCP) للمستخدمين المرتبطين بحساباتهم.
 *  - tier: free = متاحة لكل حساب؛ paid = للمشترك (أو لمن يعمل نظام الوحدات لديه).
 *  - service: رمز خدمة الرصيد الذي يُحجز قبل التنفيذ ويُخصم بعد النجاح فقط؛ null = بلا خصم.
 * البحث والحصر يُخصمان؛ القراءة المباشرة بمعرّف والدليل والتحقق من الإحالة بلا خصم (مع حدّ المعدّل).
 * المفتاح المشترك (فريق أمان) لا يمرّ بهذه السياسة.
 */
import type { UsageServiceCode } from "@/config/usage-credits";

export type McpToolTier = "free" | "paid";

export type McpToolPolicy = {
  tier: McpToolTier;
  service: UsageServiceCode | null;
};

export const MCP_TOOL_POLICY = {
  hakeem_search: { tier: "free", service: "HYBRID_SEARCH" },
  hakeem_get_article: { tier: "free", service: null },
  hakeem_verify_citation: { tier: "free", service: null },
  hakeem_guide: { tier: "free", service: null },
  hakeem_get_law: { tier: "paid", service: null },
  hakeem_bylaw_links: { tier: "paid", service: null },
  hakeem_expand_terms: { tier: "paid", service: null },
  hakeem_get_articles_range: { tier: "paid", service: null },
  hakeem_get_ruling: { tier: "paid", service: null },
  hakeem_search_rulings: { tier: "paid", service: "HYBRID_SEARCH" },
  hakeem_research: { tier: "paid", service: "HYBRID_SEARCH" },
  hakeem_enumerate: { tier: "paid", service: "HYBRID_SEARCH" },
  hakeem_enumerate_rulings: { tier: "paid", service: "HYBRID_SEARCH" },
  // HKM-044 المرحلة الأولى (التسعير مقترح وينتظر اعتماد المالك): الفهرس والتشخيص والاستناد والبصمة بلا خصم،
  // والفهرس الكامل للنظام كبطاقته (مدفوع بلا خصم)، والبحث النصي والدلالي وتتبع النص بخصم بحث.
  hakeem_health: { tier: "free", service: null },
  hakeem_stats: { tier: "free", service: null },
  hakeem_list_categories: { tier: "free", service: null },
  hakeem_list_laws: { tier: "free", service: null },
  hakeem_resolve: { tier: "free", service: null },
  hakeem_get_citation: { tier: "free", service: null },
  hakeem_check_ref: { tier: "free", service: null },
  hakeem_get_toc: { tier: "paid", service: null },
  hakeem_search_phrase: { tier: "paid", service: "HYBRID_SEARCH" },
  hakeem_search_boolean: { tier: "paid", service: "HYBRID_SEARCH" },
  hakeem_semantic_search: { tier: "paid", service: "HYBRID_SEARCH" },
  hakeem_trace_text: { tier: "paid", service: "HYBRID_SEARCH" },
} as const satisfies Record<string, McpToolPolicy>;

export type McpToolName = keyof typeof MCP_TOOL_POLICY;

/** أداة غير مدرجة تُعامل كمدفوعة بخصم بحث — فشلٌ آمن لا يفتح أداة جديدة مجانًا. */
export function mcpToolPolicy(name: string): McpToolPolicy {
  return (MCP_TOOL_POLICY as Record<string, McpToolPolicy>)[name] ?? { tier: "paid", service: "HYBRID_SEARCH" };
}
