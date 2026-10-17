// معاملة فعل المكتب: قفل استشاري مشترك، ثم قراءة آخر نسخة من الإعدادات وحساب المستخدم
// داخل المعاملة نفسها، فيُبنى الفاعل من تكليفه الحالي (لا من صلاحيات حُسبت قبل الطلب).
// سحب التكليف أو تعطيل الحساب يسري على أي فعل يبدأ بعد حفظه.
import { resolveEditorialAccess } from "./access";
import type { EditorialDb, SqlClient } from "./db";
import { bindingFor, loadEditorialConfig, lockConfigShared, type EditorialConfig } from "./policy";
import { EditorialError, type EditorialActor } from "./types";
import { assertDeskWritable } from "./write-gate";

export interface DeskContext {
  tx: SqlClient;
  /** الفاعل محسوبًا من حسابه وتكليفه داخل المعاملة. */
  actor: EditorialActor;
  config: EditorialConfig;
  configVersion: number;
}

/** يبني الفاعل من صف المستخدم والتكليف الحالي. الحساب الغائب أو المعطّل يُرفض. */
export async function freshActor(tx: SqlClient, actor: Pick<EditorialActor, "id" | "sessionId" | "mfa">, config: EditorialConfig): Promise<EditorialActor> {
  const rows = await tx.query<{ id: string; role: string; isActive: boolean }>(
    `SELECT id, role::text AS role, "isActive" FROM users WHERE id = $1`,
    [actor.id],
  );
  const user = rows[0];
  if (!user || !user.isActive) throw new EditorialError("FORBIDDEN", "الحساب غير موجود أو غير فعّال.");
  const access = resolveEditorialAccess(user.role, bindingFor(config, user.id));
  return access.agent
    ? { id: user.id, kind: "agent", agentName: `user:${user.id}`, role: user.role, access, sessionId: actor.sessionId ?? null }
    : { id: user.id, kind: "human", role: user.role, access, sessionId: actor.sessionId ?? null, mfa: actor.mfa ?? null };
}

export async function deskTransaction<T>(
  db: EditorialDb,
  actor: Pick<EditorialActor, "id" | "sessionId" | "mfa">,
  fn: (ctx: DeskContext) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await lockConfigShared(tx);
    const loaded = await loadEditorialConfig(tx);
    const fresh = await freshActor(tx, actor, loaded.config);
    // مفتاح الكتابة وشرط التحقق الثنائي من آخر نسخة إعدادات تحت القفل نفسه: الإيقاف يسري على كل فعل يبدأ بعده.
    assertDeskWritable(loaded.config, fresh);
    return fn({ tx, actor: fresh, config: loaded.config, configVersion: loaded.version });
  });
}
