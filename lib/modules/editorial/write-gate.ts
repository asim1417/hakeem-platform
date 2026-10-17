import { controlsOf, type DeskControls, type EditorialConfig } from "./policy";
import { EditorialError, type EditorialErrorCode } from "./types";

/**
 * بوابة الكتابة (قرار المالك 17/10/2026 22:13: «حلول سريعة ومرنة في اللوحة»):
 * - مفتاح الكتابة في إعدادات المكتب يشغّله المالك ويوقفه بسبب مكتوب، بلا إعادة نشر.
 * - متغير البيئة EDITORIAL_DESK_WRITE يبقى فوقه: «0» مفتاح طوارئ يقفل الكتابة مهما كانت اللوحة،
 *   و«1» تشغيل قسري (المسار القديم). غيابه = تتبع اللوحة.
 * - التحقق الثنائي شرط لكل كتابة بشرية ما دام مفعّلًا في الإعدادات (الافتراضي). الوكيل يقترح فقط ولا يُسأل عنه.
 * Preview يشارك قاعدة الإنتاج، فالمفتاح واحد للبيئتين؛ مفتاح الطوارئ في Vercel يُضبط لكل بيئة.
 */
export type EnvWriteSwitch = "kill" | "force_on" | "panel";

export function envWriteSwitch(env: Record<string, string | undefined> = process.env): EnvWriteSwitch {
  const v = (env.EDITORIAL_DESK_WRITE ?? "").trim();
  if (v === "0") return "kill";
  if (v === "1") return "force_on";
  return "panel";
}

export const READ_ONLY_MESSAGE = "اللوحة للقراءة فقط: الكتابة مقفلة حتى يشغّلها المالك من إعدادات المكتب.";
export const KILL_SWITCH_MESSAGE = "الكتابة مقفلة بمفتاح الطوارئ في إعدادات النشر (EDITORIAL_DESK_WRITE=0)؛ لا تُشغَّل من اللوحة.";
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
  controls: DeskControls;
  actorKind: "human" | "agent";
  mfa: boolean | null | undefined;
}): WriteDenial | null {
  if (input.env === "kill") return { code: "WRITE_DISABLED", message: KILL_SWITCH_MESSAGE };
  const open = input.env === "force_on" || input.controls.writeEnabled;
  if (!open) return { code: "WRITE_DISABLED", message: READ_ONLY_MESSAGE };
  if (input.controls.requireMfa && input.actorKind === "human" && input.mfa !== true) {
    return { code: "MFA_REQUIRED", message: MFA_REQUIRED_MESSAGE };
  }
  return null;
}

/** فحص مسبق سريع خارج المعاملة: مفتاح الطوارئ وحده. القرار الكامل داخل معاملة الفعل (desk-tx.ts). */
export function assertEditorialWriteEnabled(env: Record<string, string | undefined> = process.env): void {
  if (envWriteSwitch(env) === "kill") throw new EditorialError("WRITE_DISABLED", KILL_SWITCH_MESSAGE);
}

/** القرار الكامل داخل المعاملة بعد قراءة آخر نسخة من الإعدادات. */
export function assertDeskWritable(config: Pick<EditorialConfig, "controls">, actor: { kind: "human" | "agent"; mfa?: boolean | null }, env: Record<string, string | undefined> = process.env): void {
  const denial = deskWriteDenial({ env: envWriteSwitch(env), controls: controlsOf(config), actorKind: actor.kind, mfa: actor.mfa });
  if (denial) throw new EditorialError(denial.code, denial.message);
}

export interface DeskWriteState {
  /** الكتابة مفتوحة للمكتب. */
  enabled: boolean;
  env: EnvWriteSwitch;
  controls: DeskControls;
}

export function deskWriteState(config: Pick<EditorialConfig, "controls"> | null | undefined, env: Record<string, string | undefined> = process.env): DeskWriteState {
  return { enabled: isEditorialWriteEnabled(config, env), env: envWriteSwitch(env), controls: controlsOf(config) };
}
