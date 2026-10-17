import { z } from "zod";

export const PERMISSIONS = [
  "LEGAL_EDITOR_LAWS",
  "LEGAL_EDITOR_RULINGS",
  "LEGAL_REVIEWER",
  "LEGAL_PUBLISHER",
  "LEGAL_QA_VIEW",
  "LEGAL_AGENT_PROPOSE",
  "LEGAL_CONFIG_MANAGE",
  "LEGAL_TASK_MANAGE",
] as const;
export type EditorialPermission = (typeof PERMISSIONS)[number];
export const PERMISSION_LABELS: Record<EditorialPermission, string> = {
  LEGAL_EDITOR_LAWS: "اقتراح تحرير التشريعات",
  LEGAL_EDITOR_RULINGS: "اقتراح تحرير القضاء",
  LEGAL_REVIEWER: "مراجعة واعتماد",
  LEGAL_PUBLISHER: "نشر وتراجع",
  LEGAL_QA_VIEW: "عرض الجودة والتدقيق",
  LEGAL_AGENT_PROPOSE: "اقتراحات الوكلاء",
  LEGAL_CONFIG_MANAGE: "إدارة الأدوار والسياسات",
  LEGAL_TASK_MANAGE: "إسناد المهام",
};
export const targetSchema = z.enum([
  "work",
  "unit",
  "ruling",
  "relation",
  "principle",
  "amendment",
]);
export type TargetType = z.infer<typeof targetSchema>;
const id = z.string().trim().min(1).max(200);
const text = z.string().trim().max(2000);
const date = z.string().date("تاريخ غير صالح");
export const metadataSchema = z
  .object({
    officialName: text.optional(),
    aliases: z.array(text).max(50).optional(),
    documentKind: text.optional(),
    instrumentKind: text.optional(),
    instrumentNumber: text.optional(),
    issuer: text.optional(),
    authorityBasis: text.optional(),
    domain: text.optional(),
    issuedOn: date.optional(),
    issuedHijri: text.optional(),
    publishedOn: date.optional(),
    effectiveOn: date.optional(),
    applicationOn: date.optional(),
    code: text.optional(),
    externalIdentifier: text.optional(),
    sourceUrl: z
      .string()
      .url()
      .max(2000)
      .regex(/^https?:\/\//)
      .optional(),
    publicationRef: text.optional(),
    structure: z
      .enum(["articles", "clauses", "tables", "annexes", "mixed"])
      .optional(),
  })
  .strict();
export const changeInputSchema = z
  .object({
    title: z.string().trim().min(3).max(250),
    targetType: targetSchema,
    targetId: id,
    op: z.enum([
      "set_work_status",
      "update_metadata",
      "set_preamble",
      "create_work",
      "review_principle",
      "review_amendment",
      "set_unit_text",
      "review_ruling",
      "create_relation",
    ]),
    after: z
      .record(
        z.union([
          z.string().max(200000),
          z.number(),
          z.boolean(),
          z.null(),
          z.array(z.string().max(2000)),
        ]),
      )
      .default({}),
    evidenceInstrument: z.string().trim().min(2).max(2000),
    evidenceUrl: z
      .string()
      .url()
      .max(2000)
      .regex(/^https?:\/\//, "الرابط يجب أن يكون HTTP أو HTTPS"),
    evidenceQuote: z.string().trim().min(2).max(20000),
    sourceRank: z.number().int().min(1).max(10).default(1),
    idempotencyKey: id,
  })
  .strict();
export type ChangeInput = z.infer<typeof changeInputSchema>;
export const roleSchema = z
  .object({
    id,
    name: z.string().trim().min(2).max(100),
    permissions: z.array(z.enum(PERMISSIONS)).max(8),
    enabled: z.boolean(),
  })
  .strict();
export const configSchema = z
  .object({
    roles: z.array(roleSchema).max(100),
    bindings: z
      .array(
        z
          .object({
            userId: id,
            roleId: id,
            kind: z.enum(["human", "agent"]),
            targets: z.array(targetSchema).min(1),
            domains: z.array(text).max(100),
            enabled: z.boolean(),
          })
          .strict(),
      )
      .max(1000),
    policies: z
      .array(
        z
          .object({
            target: targetSchema,
            minApprovals: z.number().int().min(1).max(10),
            ownerSelfApproval: z.boolean(),
            urgentOwnerRevert: z.boolean().default(false),
            enabled: z.boolean(),
          })
          .strict(),
      )
      .length(6),
    taskTemplates: z
      .array(
        z
          .object({
            id,
            name: text.min(2),
            target: targetSchema,
            roleId: id,
            dueHours: z.number().int().min(1).max(8760),
            enabled: z.boolean(),
          })
          .strict(),
      )
      .max(100),
    documentKinds: z.array(text.min(1)).min(1).max(100),
    instrumentKinds: z.array(text.min(1)).min(1).max(100),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (new Set(c.roles.map((r) => r.id)).size !== c.roles.length)
      ctx.addIssue({ code: "custom", message: "معرف دور مكرر" });
    if (new Set(c.policies.map((r) => r.target)).size !== 6)
      ctx.addIssue({ code: "custom", message: "سياسة واحدة لكل نوع" });
    for (const b of [...c.bindings, ...c.taskTemplates])
      if (!c.roles.some((r) => r.id === b.roleId))
        ctx.addIssue({ code: "custom", message: "الدور غير موجود" });
  });
export type DeskConfig = z.infer<typeof configSchema>;
export const DEFAULT_CONFIG: DeskConfig = {
  roles: [
    {
      id: "editor",
      name: "محرر",
      permissions: [
        "LEGAL_EDITOR_LAWS",
        "LEGAL_EDITOR_RULINGS",
        "LEGAL_QA_VIEW",
      ],
      enabled: true,
    },
    {
      id: "reviewer",
      name: "مراجع",
      permissions: ["LEGAL_REVIEWER", "LEGAL_QA_VIEW"],
      enabled: true,
    },
    {
      id: "publisher",
      name: "ناشر",
      permissions: ["LEGAL_PUBLISHER", "LEGAL_QA_VIEW"],
      enabled: true,
    },
    {
      id: "agent",
      name: "وكيل اقتراح",
      permissions: ["LEGAL_AGENT_PROPOSE"],
      enabled: true,
    },
  ],
  bindings: [],
  policies: targetSchema.options.map((target) => ({
    target,
    minApprovals: 1,
    ownerSelfApproval: false,
    urgentOwnerRevert: false,
    enabled: true,
  })),
  taskTemplates: [],
  documentKinds: [
    "نظام",
    "لائحة",
    "لائحة تنفيذية",
    "لائحة تنظيمية",
    "تنظيم",
    "ترتيبات",
    "قواعد",
    "ضوابط",
    "سياسة",
    "دليل إجراءات",
  ],
  instrumentKinds: [
    "مرسوم ملكي",
    "أمر ملكي",
    "أمر سامٍ",
    "قرار مجلس الوزراء",
    "قرار وزاري",
    "قرار مجلس إدارة",
  ],
};
export type Actor = { id: string; role: string; isActive: boolean };
export type Scope = { target: TargetType; domain: string };
export class DeskError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assertWriteEnabled(env = process.env) {
  if (env.EDITORIAL_DESK_WRITE !== "1")
    throw new DeskError(
      403,
      "مكتب التحرير للقراءة فقط؛ الكتابة غير مفعلة في هذه البيئة.",
    );
}
export function actorKind(actor: Actor, config: DeskConfig): "human" | "agent" {
  return config.bindings.some(
    (b) => b.userId === actor.id && b.kind === "agent",
  )
    ? "agent"
    : "human";
}
export function allowed(
  actor: Actor,
  config: DeskConfig,
  permission: EditorialPermission,
  scope?: Scope,
): boolean {
  if (!actor.isActive) return false;
  // Agent identity is a restriction, never a role capable of approving or publishing.
  if (
    actorKind(actor, config) === "agent" &&
    permission !== "LEGAL_AGENT_PROPOSE"
  )
    return false;
  if (actor.role === "SUPER_ADMIN") return true;
  return config.bindings.some(
    (b) =>
      b.enabled &&
      b.userId === actor.id &&
      (!scope ||
        (b.targets.includes(scope.target) &&
          (!b.domains.length || b.domains.includes(scope.domain)))) &&
      config.roles.some(
        (r) =>
          r.id === b.roleId && r.enabled && r.permissions.includes(permission),
      ),
  );
}
export function demand(
  actor: Actor,
  config: DeskConfig,
  permission: EditorialPermission,
  scope?: Scope,
) {
  if (!allowed(actor, config, permission, scope))
    throw new DeskError(403, "ليست لديك صلاحية هذه المهمة ضمن نطاقها.");
}
export function policyFor(config: DeskConfig, target: TargetType) {
  const policy = config.policies.find((p) => p.target === target);
  if (!policy?.enabled)
    throw new DeskError(409, "مسار هذا النوع معطل في السياسات.");
  return policy;
}
export function normalizeIdentity(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}
