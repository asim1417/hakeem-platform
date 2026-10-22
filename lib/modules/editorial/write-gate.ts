import { controlsOf, type DeskControls, type EditorialConfig } from "./policy";
import { EditorialError, type EditorialErrorCode } from "./types";

/**
 * بوابة الكتابة (قرار المالك 17/10/2026 22:13: «حلول سريعة ومرنة في اللوحة»):
 * - مفتاح الكتابة في إعدادات المكتب يشغّله المالك ويوقفه بسبب مكتوب، بلا إعادة نشر.
 * - متغير البيئة EDITORIAL_DESK_WRITE يبقى فوقه: «0» مفتاح طوارئ يقفل الكتابة مهما كانت اللوحة،
 *   و«1» تشغيل قسري (المسار القديم). غيابه = تتبع اللوحة.
 * - نسخ المعاينة (VERCEL_ENV=preview) تشارك قاعدة الإنتاج، فهي مقفلة افتراضيًا ولو كان مفتاح اللوحة مفتوحًا،
 *   إلا بـ EDITORIAL_DESK_WRITE=1 لبيئة المعاينة صراحةً (مراجعة الجودة م١ على 7681ec8).
 * - التحقق الثنائي شرط لكل كتابة بشرية ما دام مفعّلًا في الإعدادات (الافتراضي). الوكيل يقترح فقط ولا يُسأل عنه.
 *   معناه: الحساب المرتبط في خدمة الدخول سجّل التحقق الثنائي، لا أن الجلسة الحالية مرّت به.
 */
export type EnvWriteSwitch = "kill" | "force_on" | "panel";
/** سبب القفل من البيئة: مفتاح الطوارئ، أو نسخة معاينة. */
export type EnvLockReason = "env_zero" | "preview";

export function envWriteLock(env: Record<string, string | undefined> = process.env): EnvLockReason | null {
  const v = (env.EDITORIAL_DESK_WRITE ?? "").trim();
  if (v === "0") return "env_zero";
  if (v === "1") return null;
  if ((env.VERCEL_ENV ?? "").trim() === "preview") return "preview";
  return null;
}

export function envWriteSwitch(env: Record<string, string | undefined> = process.env): EnvWriteSwitch {
  if ((env.EDITORIAL_DESK_WRITE ?? "").trim() === "1") return "force_on";
  return envWriteLock(env) ? "kill" : "panel";
}

export const READ_ONLY_MESSAGE = "اللوحة للقراءة فقط: الكتابة مقفلة حتى يشغّلها المالك من إعدادات المكتب.";
export const KILL_SWITCH_MESSAGE = "الكتابة مقفلة بمفتاح الطوارئ في إعدادات النشر (EDITORIAL_DESK_WRITE=0)؛ لا تُشغَّل من اللوحة.";
export const PREVIEW_LOCK_MESSAGE =
  "هذه نسخة معاينة تشارك قاعدة الإنتاج، فالكتابة فيها مقفلة. اكتب من الموقع الأساسي، أو اضبط EDITORIAL_DESK_WRITE=1 لبيئة المعاينة في إعدادات النشر.";

export function envLockMessage(reason: EnvLockReason | null | undefined): string {
  return reason === "preview" ? PREVIEW_LOCK_MESSAGE : KILL_SWITCH_MESSAGE;
}
export const MFA_REQUIRED_MESSAGE =
  "إعدادات المكتب تشترط التحقق الثنائي لحسابك قبل أي كتابة. فعّله من «الأمان والتحقق الثنائي» في قائمة حسابك ثم أعد المحاولة.";

/** هل الكتابة مفتوحة للمكتب (بلا اعتبار للفاعل)؟ */
export function isEditorialWriteEnabled(config: Pick<EditorialConfig, "controls"> | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  const s = envWriteSwitch(env);
  if (s === "kill") return false;
  if (s === "force_on") return true;
  return controlsOf(config).writeEnabled;
}

export interface WriteDenial {
  code: EditorialErrorCode;
  message: string;
}

/** قرار الكتابة لفاعل بعينه. نقي. null = مسموح. */
export function deskWriteDenial(input: {
  env: EnvWriteSwitch;
  lock?: EnvLockReason | null;
  controls: DeskControls;
  actorKind: "human" | "agent";
  mfa: boolean | null | undefined;
}): WriteDenial | null {
  if (input.env === "kill") return { code: "WRITE_DISABLED", message: envLockMessage(input.lock) };
  const open = input.env === "force_on" || input.controls.writeEnabled;
  if (!open) return { code: "WRITE_DISABLED", message: READ_ONLY_MESSAGE };
  if (input.controls.requireMfa && input.actorKind === "human" && input.mfa !== true) {
    return { code: "MFA_REQUIRED", message: MFA_REQUIRED_MESSAGE };
  }
  return null;
}

/** فحص مسبق سريع خارج المعاملة: مفتاح الطوارئ وحده. القرار الكامل داخل معاملة الفعل (desk-tx.ts). */
export function assertEditorialWriteEnabled(env: Record<string, string | undefined> = process.env): void {
  if (envWriteSwitch(env) === "kill") throw new EditorialError("WRITE_DISABLED", envLockMessage(envWriteLock(env)));
}

/** القرار الكامل داخل المعاملة بعد قراءة آخر نسخة من الإعدادات. */
export function assertDeskWritable(config: Pick<EditorialConfig, "controls">, actor: { kind: "human" | "agent"; mfa?: boolean | null }, env: Record<string, string | undefined> = process.env): void {
  const denial = deskWriteDenial({ env: envWriteSwitch(env), lock: envWriteLock(env), controls: controlsOf(config), actorKind: actor.kind, mfa: actor.mfa });
  if (denial) throw new EditorialError(denial.code, denial.message);
}

export interface DeskWriteState {
  /** الكتابة مفتوحة للمكتب. */
  enabled: boolean;
  env: EnvWriteSwitch;
  /** سبب القفل من البيئة حين env = kill. */
  lock: EnvLockReason | null;
  controls: DeskControls;
  /** تعذّرت قراءة الإعدادات فأُقفلت الكتابة احتياطًا (لا مفتاح طوارئ). */
  loadFailed?: boolean;
}

export function deskWriteState(config: Pick<EditorialConfig, "controls"> | null | undefined, env: Record<string, string | undefined> = process.env): DeskWriteState {
  return { enabled: isEditorialWriteEnabled(config, env), env: envWriteSwitch(env), lock: envWriteLock(env), controls: controlsOf(config) };
}

/**
 * هل المكتب «حيّ» (يُستعمل لإيقاف زر اعتماد المبادئ القديم)؟ مفتاح اللوحة مفتوح، أو تشغيل قسري.
 * قفل البيئة (طوارئ أو معاينة) لا يعيد المسار القديم إلى العمل: إن كان المالك شغّل المكتب فالقديم موقوف في كل البيئات.
 */
export function isDeskLive(config: Pick<EditorialConfig, "controls"> | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  return (env.EDITORIAL_DESK_WRITE ?? "").trim() === "1" || controlsOf(config).writeEnabled;
}
