// إعدادات مكتب التحرير: التكليف الفردي (بشري أو وكيل) بأدوار المكتب ونطاقها، وسياسة لكل نوع عنصر.
// المصدر الوحيد لصلاحيات المكتب (ق-٢). نسخ إلحاقية في editorial_config؛ يحررها المالك وحده في المرحلة صفر.
// القراءة للأفعال داخل المعاملة نفسها بعد قفل استشاري مشترك، والحفظ بقفل حصري؛ فالسحب يسري فورًا
// دون أن تتسلسل أفعال المكتب فيما بينها.
import { z } from "zod";
import { pgErrorCode, type SqlClient } from "./db";
import { EditorialError, ITEM_KINDS, type ItemKind } from "./types";

export { ITEM_KINDS };
export type { ItemKind };

export const DESK_ROLES = ["editor_laws", "editor_rulings", "reviewer", "publisher", "qa_view"] as const;
export type DeskRole = (typeof DESK_ROLES)[number];

/** أدوار لا يُكلَّف بها الوكيل (يقترح فقط). */
export const AGENT_FORBIDDEN_ROLES: readonly DeskRole[] = ["reviewer", "publisher"];

export interface EditorialBinding {
  userId: string;
  kind: "human" | "agent";
  roles: DeskRole[];
  itemKinds: ItemKind[] | "all";
  domains: string[] | "all";
  enabled: boolean;
}

export interface EditorialPolicy {
  minApprovals: number;
  ownerSelfApproval: boolean;
  enabled: boolean;
}

export interface EditorialConfig {
  bindings: EditorialBinding[];
  policies: Record<ItemKind, EditorialPolicy>;
}

const bindingSchema = z
  .object({
    userId: z.string().trim().min(1).max(200),
    kind: z.enum(["human", "agent"]),
    roles: z.array(z.enum(DESK_ROLES)).max(DESK_ROLES.length),
    itemKinds: z.union([z.literal("all"), z.array(z.enum(ITEM_KINDS)).min(1).max(ITEM_KINDS.length)]),
    domains: z.union([z.literal("all"), z.array(z.string().trim().min(1).max(100)).min(1).max(100)]),
    enabled: z.boolean(),
  })
  .strict();

const policySchema = z
  .object({
    minApprovals: z.number().int().min(1, "الحد الأدنى للموافقات من 1 إلى 5.").max(5, "الحد الأدنى للموافقات من 1 إلى 5."),
    ownerSelfApproval: z.boolean(),
    enabled: z.boolean(),
  })
  .strict();

export const editorialConfigSchema = z
  .object({
    bindings: z.array(bindingSchema).max(500),
    policies: z
      .object({
        set_work_status: policySchema,
        review_amendment_op: policySchema,
        review_principle: policySchema,
        revert: policySchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((config, ctx) => {
    const seen = new Set<string>();
    config.bindings.forEach((binding, index) => {
      if (seen.has(binding.userId)) {
        ctx.addIssue({ code: "custom", path: ["bindings", index, "userId"], message: "للمستخدم تكليف واحد فقط." });
      }
      seen.add(binding.userId);
      if (new Set(binding.roles).size !== binding.roles.length) {
        ctx.addIssue({ code: "custom", path: ["bindings", index, "roles"], message: "دور مكرر في التكليف." });
      }
      if (binding.kind === "agent" && binding.roles.some((r) => AGENT_FORBIDDEN_ROLES.includes(r))) {
        ctx.addIssue({ code: "custom", path: ["bindings", index, "roles"], message: "الوكيل يقترح فقط؛ لا يُكلَّف بالاعتماد ولا بالنشر." });
      }
    });
  });

export const DEFAULT_POLICY: EditorialPolicy = { minApprovals: 1, ownerSelfApproval: true, enabled: true };

/** القيم الافتراضية تحفظ الأمر: معتمِد واحد غير المُعِدّ، واعتماد المالك الذاتي المسبَّب مسموح، ولا تكليف لأحد. */
export const DEFAULT_EDITORIAL_CONFIG: EditorialConfig = {
  bindings: [],
  policies: {
    set_work_status: { ...DEFAULT_POLICY },
    review_amendment_op: { ...DEFAULT_POLICY },
    review_principle: { ...DEFAULT_POLICY },
    revert: { ...DEFAULT_POLICY },
  },
};

/** يتحقق من الإعدادات ويعيدها، أو يرمي INVALID_INPUT بأول ما يخالف المخطط. */
export function parseEditorialConfig(raw: unknown): EditorialConfig {
  const parsed = editorialConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message }));
    throw new EditorialError("INVALID_INPUT", `إعدادات المكتب غير صالحة: ${issues[0]?.message ?? "مخالفة للمخطط"}`, { issues });
  }
  return parsed.data as EditorialConfig;
}

export function bindingFor(config: EditorialConfig, userId: string): EditorialBinding | null {
  return config.bindings.find((b) => b.userId === userId) ?? null;
}

/** سياسة نوع العنصر كما هي (بلا رفض)؛ للعرض وعدّ الموافقات. */
export function policySnapshot(config: EditorialConfig, kind: ItemKind): EditorialPolicy {
  return config.policies[kind] ?? DEFAULT_POLICY;
}

/** سياسة نوع العنصر لفعل جديد عليه؛ المسار المعطّل يُرفض (التراجع العاجل للمالك لا يمر بهذا). */
export function policyFor(config: EditorialConfig, kind: ItemKind): EditorialPolicy {
  const policy = policySnapshot(config, kind);
  if (!policy.enabled) {
    throw new EditorialError("FORBIDDEN", "مسار هذا النوع معطّل في إعدادات المكتب.", { itemKind: kind, policyDisabled: true });
  }
  return policy;
}

// ── القراءة والقفل ────────────────────────────────────────────────────────────

/** مفتاح القفل الاستشاري لإعدادات المكتب: مشترك لكل فعل، وحصري عند حفظ الإعدادات. */
export const EDITORIAL_CONFIG_LOCK = 7270231;

export async function lockConfigShared(tx: SqlClient): Promise<void> {
  await tx.query(`SELECT pg_advisory_xact_lock_shared($1::bigint) IS NULL AS locked`, [EDITORIAL_CONFIG_LOCK]);
}

export async function lockConfigExclusive(tx: SqlClient): Promise<void> {
  await tx.query(`SELECT pg_advisory_xact_lock($1::bigint) IS NULL AS locked`, [EDITORIAL_CONFIG_LOCK]);
}

export interface LoadedConfig {
  version: number;
  config: EditorialConfig;
  /** false = جدول الإعدادات غير مطبّق على هذه القاعدة (لا تكليف لأحد غير المالك). */
  installed: boolean;
}

/**
 * آخر نسخة من الإعدادات. غياب أي نسخة = القيم الافتراضية (نسخة 0).
 * نسخة مخزّنة لا تطابق المخطط تُرفض (فشل مغلق) ولا تُستبدل بالافتراضي بصمت.
 */
export async function loadEditorialConfig(db: SqlClient): Promise<LoadedConfig> {
  let rows: Array<{ version: number; config: unknown }>;
  try {
    rows = await db.query<{ version: number; config: unknown }>(
      `SELECT version, config FROM editorial_config ORDER BY version DESC LIMIT 1`,
    );
  } catch (error) {
    if (pgErrorCode(error) === "42P01") return { version: 0, config: DEFAULT_EDITORIAL_CONFIG, installed: false };
    throw error;
  }
  const row = rows[0];
  if (!row) return { version: 0, config: DEFAULT_EDITORIAL_CONFIG, installed: true };
  const parsed = editorialConfigSchema.safeParse(row.config);
  if (!parsed.success) {
    throw new EditorialError("INVALID_STATE", "نسخة إعدادات المكتب المخزّنة لا تطابق المخطط؛ الأفعال مقفلة حتى يحفظ المالك نسخة صالحة.", {
      version: row.version,
    });
  }
  return { version: Number(row.version), config: parsed.data as EditorialConfig, installed: true };
}
