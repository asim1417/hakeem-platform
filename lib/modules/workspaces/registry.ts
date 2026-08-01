// إطار مساحات العمل — المخطط السيادي §18. سجلّ تصريحيّ لمساحات العمل التي
// تحفظ حالتها، يربط كل مساحة بمسارها وقدراتها. نواة نقيّة (بلا عميل/خادم).

export type WorkspaceId =
  | "reading"
  | "search"
  | "review"
  | "evidence"
  | "writing"
  | "comparison"
  | "knowledge-graph"
  | "administration";

export interface WorkspaceDef {
  id: WorkspaceId;
  labelAr: string;
  href: string;
  capabilities: string[];
  /** الصلاحية اللازمة لعرض المساحة (اختياريّة). */
  permission?: string;
}

export const WORKSPACES: WorkspaceDef[] = [
  { id: "reading", labelAr: "القراءة", href: "/dashboard/legal-core", capabilities: ["read", "annotate"] },
  { id: "search", labelAr: "البحث", href: "/dashboard/legal-search", capabilities: ["search"] },
  { id: "review", labelAr: "المراجعة", href: "/dashboard/review", capabilities: ["review"], permission: "REVIEW_USE" },
  { id: "evidence", labelAr: "الأدلّة", href: "/dashboard/files", capabilities: ["evidence"] },
  { id: "writing", labelAr: "الصياغة", href: "/dashboard/ask", capabilities: ["draft"] },
  { id: "comparison", labelAr: "المقارنة", href: "/dashboard/legal-search?mode=compare", capabilities: ["compare"] },
  { id: "knowledge-graph", labelAr: "الرسم المعرفيّ", href: "/dashboard/knowledge-graph", capabilities: ["graph"] },
  { id: "administration", labelAr: "الإدارة", href: "/admin", capabilities: ["admin"], permission: "GOVERNANCE_AUDIT_VIEW" },
];

export function getWorkspace(id: WorkspaceId): WorkspaceDef | null {
  return WORKSPACES.find((w) => w.id === id) ?? null;
}

/** حالة مساحة العمل المحفوظة (§18: تحفظ آخر موضع/فلاتر). */
export interface WorkspaceState {
  workspaceId: WorkspaceId;
  lastPath?: string;
  filters?: Record<string, string>;
  updatedAt?: string;
}

export const WORKSPACE_STATE_KEY = "hakeem.workspace.state.v1";
