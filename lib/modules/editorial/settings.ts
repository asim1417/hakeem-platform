// قراءة إعدادات المكتب وحفظها (للمالك وحده في المرحلة صفر).
// الحفظ نسخة جديدة إلحاقية برقم يلي النسخة الأساس، بسبب إلزامي، وتحت قفل حصري يسلسله مع كل أفعال المكتب.
import { canManageSettings } from "./access";
import { fingerprint, recordAudit } from "./audit";
import { approvalStateFrom, type ChangeRow, type ChangeSetRow, type DecisionRow } from "./core";
import type { EditorialDb, SqlClient } from "./db";
import { freshActor } from "./desk-tx";
import { assertDeskIntegrity } from "./integrity";
import {
  bindingFor,
  controlsOf,
  DEFAULT_EDITORIAL_CONFIG,
  loadEditorialConfig,
  lockConfigExclusive,
  parseEditorialConfig,
  type DeskControls,
  type EditorialConfig,
} from "./policy";
import { EditorialError, type EditorialActor } from "./types";
import { assertEditorialWriteEnabled, envWriteSwitch, KILL_SWITCH_MESSAGE, MFA_REQUIRED_MESSAGE } from "./write-gate";

export interface SettingsUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface SettingsView {
  version: number;
  config: EditorialConfig;
  users: SettingsUser[];
}

function assertOwner(actor: EditorialActor) {
  if (!canManageSettings(actor.access)) throw new EditorialError("FORBIDDEN", "إعدادات المكتب للمالك وحده.");
}

/** المستخدمون الفعّالون (للاختيار في التكليف)، ومعهم من له تكليف قائم ولو عُطّل حسابه. حد 500. */
async function settingsUsers(db: SqlClient, config: EditorialConfig): Promise<SettingsUser[]> {
  const bound = config.bindings.map((b) => b.userId);
  return db.query<SettingsUser>(
    `SELECT id, name, email, role::text AS role
       FROM users
      WHERE "isActive" = TRUE OR id = ANY($1::text[])
      ORDER BY (role::text = 'SUPER_ADMIN') DESC, name, id
      LIMIT 500`,
    [bound],
  );
}

export async function readEditorialSettings(db: SqlClient, actor: EditorialActor): Promise<SettingsView> {
  assertOwner(actor);
  const loaded = await loadEditorialConfig(db);
  return { version: loaded.version, config: loaded.config, users: await settingsUsers(db, loaded.config) };
}

export interface SaveSettingsInput {
  baseVersion: number;
  reason: string;
  config: unknown;
}

export async function saveEditorialSettings(
  db: EditorialDb,
  actor: EditorialActor,
  input: SaveSettingsInput,
): Promise<{ version: number }> {
  // حفظ التكليفات والسياسات مسموح والكتابة مقفلة (يجهّز المالك فريقه قبل التشغيل)، إلا بمفتاح الطوارئ.
  assertEditorialWriteEnabled();
  await assertDeskIntegrity(db);
  const reason = typeof input?.reason === "string" ? input.reason.trim() : "";
  if (reason.length < 5) throw new EditorialError("REASON_REQUIRED", "سبب حفظ الإعدادات مطلوب (خمسة أحرف على الأقل).");
  if (reason.length > 2000) throw new EditorialError("INVALID_INPUT", "سبب الحفظ أطول من المسموح.");
  if (!Number.isInteger(input.baseVersion) || input.baseVersion < 0) {
    throw new EditorialError("INVALID_INPUT", "رقم النسخة الأساس غير صالح.");
  }
  const next = parseEditorialConfig(input.config);

  return db.transaction(async (tx) => {
    // حصري: ينتظر أفعال المكتب الجارية، ويُبقي الأفعال الجديدة حتى يُحفظ.
    await lockConfigExclusive(tx);
    // المالك يحرر الإعدادات بحسابه الحالي (لا بصلاحيات حُسبت قبل الطلب)، ويُفحص قبل النسخة (ن٦)
    // حتى لا يتلقى غير المالك رقم النسخة الحالية.
    const loaded = await loadEditorialConfig(tx).catch(() => null);
    const previous = loaded?.config ?? null;
    const owner = await freshActor(tx, actor, previous ?? next);
    assertOwner(owner);
    // مفتاح الكتابة وشرط التحقق الثنائي لا يتغيران بالحفظ العام؛ يُنقلان من النسخة السابقة كما هما.
    const controls = controlsOf(previous);
    if (controls.requireMfa && owner.mfa !== true) throw new EditorialError("MFA_REQUIRED", MFA_REQUIRED_MESSAGE);
    next.controls = controls;
    const latest = await tx.query<{ version: number }>(`SELECT version FROM editorial_config ORDER BY version DESC LIMIT 1`);
    const current = latest[0] ? Number(latest[0].version) : 0;
    if (current !== input.baseVersion) {
      throw new EditorialError("CONFLICT", "حُفظت نسخة أحدث من الإعدادات بعد فتحها؛ أعد تحميلها ثم عدّل.", {
        baseVersion: input.baseVersion,
        currentVersion: current,
      });
    }

    const ids = next.bindings.map((b) => b.userId);
    const users = await tx.query<{ id: string; role: string }>(`SELECT id, role::text AS role FROM users WHERE id = ANY($1::text[])`, [ids]);
    const roleOf = new Map(users.map((u) => [u.id, u.role]));
    for (const binding of next.bindings) {
      const role = roleOf.get(binding.userId);
      if (!role) throw new EditorialError("INVALID_INPUT", "مستخدم غير موجود في التكليف.", { userId: binding.userId });
      // المالك لا يُكلَّف وكيلًا.
      if (role === "SUPER_ADMIN" && binding.kind === "agent") {
        throw new EditorialError("INVALID_INPUT", "لا يُكلَّف المالك وكيلًا آليًّا.", { userId: binding.userId });
      }
      // قلب الوكيل إلى بشري للمالك وحده (القيد مكتوب صراحة ليبقى إن فُوِّضت الإعدادات لاحقًا).
      const before = previous ? bindingFor(previous, binding.userId) : null;
      if (before?.kind === "agent" && binding.kind === "human" && !owner.access.superAdmin) {
        throw new EditorialError("FORBIDDEN", "قلب حساب وكيل إلى بشري للمالك وحده.", { userId: binding.userId });
      }
    }

    const version = current + 1;
    await tx.query(
      `INSERT INTO editorial_config (version, config, reason, actor_id) VALUES ($1, $2::jsonb, $3, $4) RETURNING version`,
      [version, JSON.stringify(next), reason, owner.id],
    );
    const flipped = next.bindings
      .filter((b) => previous && bindingFor(previous, b.userId)?.kind === "agent" && b.kind === "human")
      .map((b) => b.userId);
    await recordAudit(tx, owner, {
      action: "config.save",
      objectType: "editorial_config",
      objectId: String(version),
      before: previous,
      after: next,
      detail: {
        version,
        baseVersion: input.baseVersion,
        reason,
        bindings: next.bindings.length,
        policies: next.policies,
        agentToHuman: flipped,
        afterHash: fingerprint(next),
      },
    });
    return { version };
  });
}

// ── مفتاح الكتابة وشرط التحقق الثنائي (قرار المالك 17/10/2026 22:13) ─────────

export interface DeskSwitchInput {
  baseVersion: number;
  reason: string;
  writeEnabled: boolean;
  /** غيابه = يبقى كما هو. */
  requireMfa?: boolean;
}

/**
 * نسخة إعدادات جديدة لا تغيّر إلا المفتاح: التكليفات والسياسات تُنقل كما هي. للمالك وحده، بسبب مكتوب.
 * - لا يمر ببوابة الكتابة (وإلا لما شُغّلت)، لكن مفتاح الطوارئ يمنع التشغيل.
 * - التشغيل مع شرط التحقق الثنائي يتطلب التحقق الثنائي لحساب المالك نفسه؛ الإيقاف مسموح دائمًا.
 * - التشغيل يتطلب سلامة الجداول والمشغّلات (assertDeskIntegrity).
 */
export async function setDeskWriteSwitch(db: EditorialDb, actor: EditorialActor, input: DeskSwitchInput): Promise<{ version: number; controls: DeskControls }> {
  assertOwner(actor);
  const reason = typeof input?.reason === "string" ? input.reason.trim() : "";
  if (reason.length < 5) throw new EditorialError("REASON_REQUIRED", "سبب تغيير المفتاح مطلوب (خمسة أحرف على الأقل).");
  if (reason.length > 2000) throw new EditorialError("INVALID_INPUT", "السبب أطول من المسموح.");
  if (typeof input.writeEnabled !== "boolean" || (input.requireMfa !== undefined && typeof input.requireMfa !== "boolean")) {
    throw new EditorialError("INVALID_INPUT", "قيمة المفتاح غير صالحة.");
  }
  if (!Number.isInteger(input.baseVersion) || input.baseVersion < 0) throw new EditorialError("INVALID_INPUT", "رقم النسخة الأساس غير صالح.");
  if (input.writeEnabled && envWriteSwitch() === "kill") throw new EditorialError("WRITE_DISABLED", KILL_SWITCH_MESSAGE);
  if (input.writeEnabled) await assertDeskIntegrity(db);

  return db.transaction(async (tx) => {
    await lockConfigExclusive(tx);
    const loaded = await loadEditorialConfig(tx).catch(() => null);
    const previous = loaded?.config ?? null;
    const base = previous ?? DEFAULT_EDITORIAL_CONFIG;
    const owner = await freshActor(tx, actor, base);
    assertOwner(owner);
    const latest = await tx.query<{ version: number }>(`SELECT version FROM editorial_config ORDER BY version DESC LIMIT 1`);
    const current = latest[0] ? Number(latest[0].version) : 0;
    if (current !== input.baseVersion) {
      throw new EditorialError("CONFLICT", "حُفظت نسخة أحدث من الإعدادات بعد فتحها؛ أعد تحميلها ثم عدّل.", {
        baseVersion: input.baseVersion,
        currentVersion: current,
      });
    }
    const before = controlsOf(previous);
    const after: DeskControls = { writeEnabled: input.writeEnabled, requireMfa: input.requireMfa ?? before.requireMfa };
    if (after.writeEnabled && after.requireMfa && owner.mfa !== true) throw new EditorialError("MFA_REQUIRED", MFA_REQUIRED_MESSAGE);
    if (before.writeEnabled === after.writeEnabled && before.requireMfa === after.requireMfa) {
      throw new EditorialError("INVALID_STATE", "لا تغيير: المفتاح على هذه الحالة أصلًا.");
    }
    const next: EditorialConfig = parseEditorialConfig({ ...JSON.parse(JSON.stringify(base)), controls: after });
    const version = current + 1;
    await tx.query(`INSERT INTO editorial_config (version, config, reason, actor_id) VALUES ($1, $2::jsonb, $3, $4)`, [version, JSON.stringify(next), reason, owner.id]);
    await recordAudit(tx, owner, {
      action: "config.switch",
      objectType: "editorial_config",
      objectId: String(version),
      before: { controls: before },
      after: { controls: after },
      detail: { version, baseVersion: input.baseVersion, reason, controls: after, mfa: owner.mfa ?? null, afterHash: fingerprint(next) },
    });
    return { version, controls: after };
  });
}

// ── معاينة أثر الحفظ (م٩، ق٣١) ───────────────────────────────────────────────

export interface SettingsPreview {
  /** دفعات أو عناصر معلّقة (pending، أو معتمدة تنتظر النشر) تسقط منها موافقة قائمة بالإعدادات المقترحة. */
  approvalsDropped: number;
  /** دفعات أو عناصر معلّقة يرتفع حدها المطلوب من الموافقات. */
  pendingRaised: number;
}

/**
 * أثر الإعدادات المقترحة على القائم، قبل الحفظ وبلا أي كتابة: تُعدّ موافقات كل دفعة معلّقة
 * بالإعدادات الحالية ثم بالمقترحة (بالقاعدة نفسها التي يُعدّ بها عند القرار والنشر).
 * «المعلّقة» تشمل المعتمدة التي لم تُنشر، لأن النشر يعيد العدّ بالصلاحية الحالية.
 */
export async function previewEditorialSettings(db: SqlClient, actor: EditorialActor, rawConfig: unknown): Promise<SettingsPreview> {
  assertOwner(actor);
  const next = parseEditorialConfig(rawConfig);
  const current = (await loadEditorialConfig(db)).config;
  const sets = await db.query<ChangeSetRow>(`SELECT * FROM change_set WHERE status IN ('pending', 'approved') ORDER BY created_at LIMIT 5000`);
  if (!sets.length) return { approvalsDropped: 0, pendingRaised: 0 };
  const ids = sets.map((s) => s.id);
  const [changes, decisions] = await Promise.all([
    db.query<ChangeRow>(`SELECT * FROM editorial_change WHERE change_set_id = ANY($1::text[]) ORDER BY created_at, id`, [ids]),
    db.query<DecisionRow & { change_set_id: string }>(
      `SELECT d.id, d.change_set_id, d.reviewer_id, d.decision, d.reason, d.self_approval, d.payload_hash, d.decided_at,
              u.role::text AS role, u."isActive", u.name
         FROM review_decision d LEFT JOIN users u ON u.id = d.reviewer_id
        WHERE d.change_set_id = ANY($1::text[]) ORDER BY d.decided_at, d.id`,
      [ids],
    ),
  ]);
  let approvalsDropped = 0;
  let pendingRaised = 0;
  for (const set of sets) {
    const own = changes.filter((c) => c.change_set_id === set.id);
    const setDecisions = decisions.filter((d) => d.change_set_id === set.id);
    const before = approvalStateFrom(current, set, own, setDecisions);
    const after = approvalStateFrom(next, set, own, setDecisions);
    if (after.approvals < before.approvals) approvalsDropped += 1;
    if (after.required > before.required) pendingRaised += 1;
  }
  return { approvalsDropped, pendingRaised };
}
