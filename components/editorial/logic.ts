// منطق واجهة المكتب النقي: بلا React ولا DOM، ويُختبر في scripts/test-editorial-desk-ui.ts.
import type { EditorialBinding, EditorialConfig, EditorialPolicy } from "@/lib/modules/editorial/policy";
import {
  CORRECTION_LABEL,
  DESK_ROLE_OPTIONS,
  domainLabel,
  ITEM_KIND_OPTIONS,
  type CorrectionKey,
  type DeskRoleValue,
  type ItemKindValue,
} from "./labels";

// ── الأعداد ─────────────────────────────────────────────────────────────────

/** منسق العدّادات القائم (هندية)؛ المواد والتواريخ والمعرّفات تبقى كما في البيانات. */
export function fmt(n: number): string {
  return n.toLocaleString("ar-SA");
}

export interface NounForms {
  one: string;
  two: string;
  few: string;
  many: string;
}

export const OPS_NOUN: NounForms = { one: "عملية واحدة", two: "عمليتان", few: "عمليات", many: "عملية" };
/** بعد المضاف («اعتماد …»): مجرور. */
export const OPS_NOUN_GEN: NounForms = { one: "عملية واحدة", two: "عمليتين", few: "عمليات", many: "عملية" };
export const AMEND_OPS_GEN: NounForms = { one: "عملية تعديل واحدة", two: "عمليتَي تعديل", few: "عمليات تعديل", many: "عملية تعديل" };
export const CHANGES_NOUN: NounForms = { one: "تغيير واحد", two: "تغييران", few: "تغييرات", many: "تغييرًا" };
export const CHANGES_NOUN_GEN: NounForms = { one: "تغيير واحد", two: "تغييرين", few: "تغييرات", many: "تغييرًا" };

/** «تغيير واحد غير محفوظ»، «تغييران غير محفوظين»، «٣ تغييرات غير محفوظة»، «١١ تغييرًا غير محفوظ» (مطابقة الصفة للعدد). */
export function unsavedChanges(n: number): string {
  const mod = n % 100;
  if (n === 1) return "تغيير واحد غير محفوظ";
  if (n === 2) return "تغييران غير محفوظين";
  if (mod >= 3 && mod <= 10) return `${fmt(n)} تغييرات غير محفوظة`;
  return `${fmt(n)} تغييرًا غير محفوظ`;
}

/** أثر حفظ الإعدادات على القائم (ق٣١) بجمل تطابق العدد؛ الصفر لا جملة له. */
export function impactLines(dropped: number, raised: number): string[] {
  const sets = (n: number) => {
    const mod = n % 100;
    if (n === 1) return "دفعة معلّقة واحدة";
    if (n === 2) return "دفعتين معلّقتين";
    if (mod >= 3 && mod <= 10) return `${fmt(n)} دفعات معلّقة`;
    return `${fmt(n)} دفعةً معلّقة`;
  };
  const out: string[] = [];
  if (dropped > 0) out.push(`تسقط موافقات قائمة على ${sets(dropped)}.`);
  if (raised > 0) out.push(`ترتفع الموافقات المطلوبة على ${sets(raised)}.`);
  return out;
}

/** العدد مع المعدود: ١ «عملية واحدة»، ٢ «عمليتان»، ٣–١٠ «٣ عمليات»، ١١ فأكثر «١١ عملية». */
export function countNoun(n: number, forms: NounForms): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  const mod = n % 100;
  if (mod >= 3 && mod <= 10) return `${fmt(n)} ${forms.few}`;
  return `${fmt(n)} ${forms.many}`;
}

/**
 * التاريخ والوقت بتوقيت الرياض بتقويم صريح، فيتطابق ما يرسمه الخادم (Node) والمتصفح (ar-SA في Chrome تقويمه أم القرى
 * افتراضيًّا وفي Node ميلادي). يبقى الميلادي كما تعرضه الصفحات القائمة حتى قرار المالك في توحيد الأرقام والتقويم.
 */
const DATE_PART = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-arab", { timeZone: "Asia/Riyadh", year: "numeric", month: "numeric", day: "numeric" });
const TIME_PART = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-arab", { timeZone: "Asia/Riyadh", hour: "numeric", minute: "2-digit" });
export function fmtDateTime(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  // التاريخ والوقت يُنسَّقان منفصلين ثم يُجمعان: نمط الجمع (الفاصلة) يختلف بين إصدارات ICU في Node وChrome.
  return Number.isNaN(d.getTime()) ? "—" : `${DATE_PART.format(d)} ${TIME_PART.format(d)}`;
}

// ── مهلة التراجع (ق٢، ق٢٧) ─────────────────────────────────────────────────

export const UNDO_WINDOW_MS = 6000;

/** deadline = null يعني أن العدّاد موقوف (الصفحة مخفية) وremaining ما بقي. */
export interface Countdown {
  remaining: number;
  deadline: number | null;
}

export function startCountdown(now: number, windowMs = UNDO_WINDOW_MS): Countdown {
  return { remaining: windowMs, deadline: now + windowMs };
}

export function remainingMs(c: Countdown, now: number): number {
  if (c.deadline === null) return Math.max(c.remaining, 0);
  return Math.max(c.deadline - now, 0);
}

export function pauseCountdown(c: Countdown, now: number): Countdown {
  if (c.deadline === null) return c;
  return { remaining: remainingMs(c, now), deadline: null };
}

export function resumeCountdown(c: Countdown, now: number): Countdown {
  if (c.deadline !== null) return c;
  return { remaining: c.remaining, deadline: now + c.remaining };
}

export function secondsLeft(c: Countdown, now: number): number {
  return Math.ceil(remainingMs(c, now) / 1000);
}

// ── التحديد الجماعي (ق١، ق٧) ───────────────────────────────────────────────

/** ما يُرسَل في الاعتماد الجماعي: المحدد الظاهر في الصفحة الحالية وحده، بترتيب ظهوره. */
export function visibleSelection(selected: Iterable<string>, visibleIds: readonly string[]): string[] {
  const set = new Set(selected);
  return visibleIds.filter((id) => set.has(id));
}

export interface SelectableItem {
  id: string;
  eligible: boolean;
  /** معلّقة في المهلة، أو قُرّرت، أو عليها قرار معلّق من غيري. */
  blocked: boolean;
}

/** «تحديد المؤهَّل الظاهر (N)»: المؤهلة الظاهرة غير المعلّقة وحدها. */
export function eligibleVisible(items: readonly SelectableItem[]): string[] {
  return items.filter((i) => i.eligible && !i.blocked).map((i) => i.id);
}

// ── التصحيح (ق٨) ────────────────────────────────────────────────────────────

export type CorrectionValues = Record<CorrectionKey, string>;

export interface CorrectionSource {
  article_number: number | null;
  paragraph_label: string | null;
  effective_from_hijri: string | null;
  effective_from_gregorian: string | null;
  new_text: string | null;
  op_type: string;
  old_phrase: string | null;
  new_phrase: string | null;
  target_law_title: string;
}

/** الحقول معبأة بالقيم المقترحة؛ التواريخ تُعرض بالشرطة المائلة كما في البطاقة. */
export function initialCorrection(item: CorrectionSource): CorrectionValues {
  const date = (v: string | null) => (v ? v.replace(/-/g, "/") : "");
  return {
    article_number: item.article_number === null ? "" : String(item.article_number),
    paragraph_label: item.paragraph_label ?? "",
    effective_from_hijri: date(item.effective_from_hijri),
    effective_from_gregorian: date(item.effective_from_gregorian),
    new_text: item.new_text ?? "",
    op_type: item.op_type,
    old_phrase: item.old_phrase ?? "",
    new_phrase: item.new_phrase ?? "",
    target_law_title: item.target_law_title,
  };
}

const ARABIC_DIGITS = /[٠-٩]/g;
const PERSIAN_DIGITS = /[۰-۹]/g;

export function latinDigits(value: string): string {
  return value
    .replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(PERSIAN_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** يقبل «1447/05/17» و«1447-05-17» (وبالأرقام الهندية)، ويعيد صيغة الخادم بالشرطة. */
export function normalizeDateInput(value: string): string {
  return latinDigits(value.trim()).replace(/\s+/g, "").replace(/[/.]/g, "-");
}

function sameDate(a: string, b: string): boolean {
  const n = (v: string) =>
    normalizeDateInput(v)
      .split("-")
      .map((p) => String(Number(p)))
      .join("-");
  return n(a) === n(b);
}

export interface CorrectionDiff {
  changed: Partial<Record<CorrectionKey, string | number>>;
  errors: Partial<Record<CorrectionKey, string>>;
}

/** يرسل ما تغيّر عن المقترح وحده (ق٨-٢)، ويتحقق من الصيغ تحت كل حقل (ق٨-٤). */
export function correctionDiff(initial: CorrectionValues, current: CorrectionValues): CorrectionDiff {
  const changed: CorrectionDiff["changed"] = {};
  const errors: CorrectionDiff["errors"] = {};
  for (const key of Object.keys(initial) as CorrectionKey[]) {
    const before = initial[key] ?? "";
    const after = current[key] ?? "";
    const isDate = key === "effective_from_hijri" || key === "effective_from_gregorian";
    const unchanged = isDate ? (before.trim() === "" ? after.trim() === "" : after.trim() !== "" && sameDate(before, after)) : before.trim() === after.trim();
    if (unchanged) continue;
    if (!after.trim()) {
      errors[key] = "لا يُفرَّغ الحقل من هنا؛ أعد قيمته أو غيّرها.";
      continue;
    }
    if (key === "article_number") {
      const n = Number(latinDigits(after.trim()));
      if (!Number.isInteger(n) || n < 1 || n > 10000) {
        errors[key] = "رقم المادة عدد صحيح من 1 إلى 10000.";
        continue;
      }
      changed[key] = n;
      continue;
    }
    if (key === "effective_from_hijri") {
      const v = normalizeDateInput(after);
      const m = /^(1[3-5]\d{2})-(\d{1,2})-(\d{1,2})$/.exec(v);
      if (!m || Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[3]) < 1 || Number(m[3]) > 30) {
        errors[key] = "التاريخ الهجري بصيغة 1447/05/17.";
        continue;
      }
      changed[key] = v;
      continue;
    }
    if (key === "effective_from_gregorian") {
      const v = normalizeDateInput(after);
      const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
      const iso = m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : "";
      if (!m || new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) !== iso) {
        errors[key] = "التاريخ الميلادي بصيغة 2026/10/17.";
        continue;
      }
      changed[key] = iso;
      continue;
    }
    changed[key] = after.trim();
  }
  return { changed, errors };
}

export function correctionSummary(changed: Partial<Record<string, string | number>>): string[] {
  return Object.keys(changed).map((k) => CORRECTION_LABEL[k] ?? k);
}

// ── نصوص المهلة والنتيجة (ق٢، ق٢٣-٤) ──────────────────────────────────────

export type DecisionVerb = "approve" | "reject" | "correct" | "agree" | "rejectShown";

export interface ApprovalContext {
  /** الموافقات الصالحة القائمة على القرار المعلّق (0 إن لم يكن). */
  approvals: number;
  required: number;
}

/** جنس اسم العنصر في الجملة: «المبدأ» مذكر، و«الدفعة» مؤنث؛ ورقم العملية يتبع صيغة المواصفة. */
export type Gender = "m" | "f";

/** سطر المهلة: «سيُعتمد…» حين يكتمل القرار بهذه الموافقة، وإلا «ستُسجَّل موافقتك… (١ من ٢)». */
export function pendingLine(verb: DecisionVerb, label: string, ctx: ApprovalContext, shownDecision?: string | null, gender: Gender = "m"): string {
  if (verb === "rejectShown") return `سيُرفض القرار المعروض على ${label}`;
  const after = ctx.approvals + 1;
  const completes = after >= ctx.required;
  const progress = ` (${fmt(after)} من ${fmt(ctx.required)})`;
  if (verb === "agree") {
    const what = shownDecision === "rejected" || shownDecision === "reject" ? "رفض" : shownDecision === "approved_with_edit" ? "اعتماد مع التصحيح" : "اعتماد";
    return completes ? `سيُطبَّق ${what} ${label}` : `ستُسجَّل موافقتك على ${what} ${label}${progress}`;
  }
  const will = gender === "f" ? "ستُ" : "سيُ";
  if (completes) {
    if (verb === "reject") return `${will}رفض ${label}`;
    if (verb === "correct") return `${will}عتمد مع التصحيح ${label}`;
    return `${will}عتمد ${label}`;
  }
  if (verb === "reject") return `ستُسجَّل موافقتك على رفض ${label}${progress}`;
  if (verb === "correct") return `ستُسجَّل موافقتك على تصحيح ${label}${progress}`;
  return `ستُسجَّل موافقتك على ${label}${progress}`;
}

export interface DecisionOutcome {
  status: "pending" | "published" | "rejected" | "approved";
  approvals: number;
  requiredApprovals: number;
  /** القرار المطبَّق: approved/rejected/approved_with_edit للتعديل، approve/reject للمبدأ والدفعة. */
  decision?: string | null;
}

export type ResultTone = "approve" | "reject" | "wait";

/** سطر النتيجة في مكان البطاقة بعد نجاح الخادم. الافتراضي مؤنث («اعتُمدت OP-…» كما في المواصفة، و«الدفعة»). */
export function resultLine(label: string, outcome: DecisionOutcome, gender: Gender = "f"): { text: string; tone: ResultTone } {
  const f = gender === "f";
  if (outcome.status === "pending" && (outcome.decision === "rejected" || outcome.decision === "reject")) {
    return { text: `سُجّل رفضك لـ ${label} (${fmt(outcome.approvals)} من ${fmt(outcome.requiredApprovals)})؛ أُرسل لمعتمِد آخر.`, tone: "wait" };
  }
  if (outcome.status === "pending") {
    return { text: `وافقتَ على ${label} (${fmt(outcome.approvals)} من ${fmt(outcome.requiredApprovals)})؛ ${f ? "أُرسلت" : "أُرسل"} لمعتمِد آخر.`, tone: "wait" };
  }
  if (outcome.status === "rejected" && outcome.decision !== "reject" && outcome.decision !== "rejected") {
    return { text: `رُفض القرار المعروض على ${label}؛ ${f ? "عادت" : "عاد"} إلى الطابور بلا قرار.`, tone: "reject" };
  }
  if (outcome.decision === "rejected" || outcome.decision === "reject") return { text: `${f ? "رُفضت" : "رُفض"} ${label}.`, tone: "reject" };
  if (outcome.decision === "approved_with_edit") return { text: `${f ? "اعتُمدت" : "اعتُمد"} مع التصحيح ${label}.`, tone: "approve" };
  return { text: `${f ? "اعتُمدت" : "اعتُمد"} ${label}.`, tone: "approve" };
}

/** هل يخرج العنصر من عرض «ينتظر قراري» بهذه النتيجة (فينقص عدّاد اللسان). */
export function leavesMyQueue(outcome: DecisionOutcome): boolean {
  if (outcome.status === "published" || outcome.status === "approved") return true;
  if (outcome.status === "pending") return true;
  return outcome.decision === "reject" || outcome.decision === "rejected";
}

// ── التركيز بعد القرار (ق٤-٤، ق٢٦-٢، ق٢٩) ──────────────────────────────────

/** أول عنصر غير مقرر بعد fromId في ترتيب الصفحة، أو null (فيذهب التركيز إلى زر العناصر التالية). */
export function nextUndecided(order: readonly string[], decided: ReadonlySet<string>, fromId: string | null): string | null {
  const start = fromId === null ? 0 : order.indexOf(fromId) + 1;
  for (let i = Math.max(start, 0); i < order.length; i++) if (!decided.has(order[i])) return order[i];
  return null;
}

// ── الإعدادات (ق٣١، ٧-٣، ٧-٤) ──────────────────────────────────────────────

export interface UserRef {
  id: string;
  name: string;
  email: string;
  role: string;
}

const ROLE_TITLE: Record<string, string> = Object.fromEntries(DESK_ROLE_OPTIONS.map((r) => [r.value, r.title]));
const KIND_TITLE: Record<string, string> = Object.fromEntries(ITEM_KIND_OPTIONS.map((k) => [k.value, k.title]));

function nameOf(users: readonly UserRef[], id: string): string {
  return users.find((u) => u.id === id)?.name || "مستخدم بلا اسم";
}

function scopeText<T extends string>(value: T[] | "all", all: string, label: (v: T) => string): string {
  return value === "all" ? all : value.map(label).join("، ");
}

function sameScope(a: string[] | "all", b: string[] | "all"): boolean {
  if (a === "all" || b === "all") return a === b;
  return a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
}

/** جمل عربية لكل تغيير بين نسختين (حوار المراجعة). */
export function settingsChanges(before: EditorialConfig, after: EditorialConfig, users: readonly UserRef[]): string[] {
  const out: string[] = [];
  const beforeMap = new Map(before.bindings.map((b) => [b.userId, b]));
  const afterMap = new Map(after.bindings.map((b) => [b.userId, b]));
  for (const b of after.bindings) {
    const prev = beforeMap.get(b.userId);
    const name = nameOf(users, b.userId);
    if (!prev) {
      const roles = b.roles.map((r) => `«${ROLE_TITLE[r] ?? r}»`).join(" و");
      out.push(`إضافة تكليف لـ ${name}${roles ? `: ${roles}` : " بلا أدوار"}${b.enabled ? "" : " (معطّل)"}`);
      continue;
    }
    for (const r of b.roles) if (!prev.roles.includes(r)) out.push(`منح «${ROLE_TITLE[r] ?? r}» لـ ${name}`);
    for (const r of prev.roles) if (!b.roles.includes(r)) out.push(`سحب «${ROLE_TITLE[r] ?? r}» من ${name}`);
    if (!sameScope(prev.itemKinds, b.itemKinds)) {
      out.push(`أنواع تكليف ${name}: ${scopeText(b.itemKinds, "كل الأنواع", (k) => KIND_TITLE[k] ?? k)}`);
    }
    if (!sameScope(prev.domains, b.domains)) {
      out.push(`مجالات تكليف ${name}: ${scopeText(b.domains, "كل المجالات", domainLabel)}`);
    }
    if (prev.enabled !== b.enabled) out.push(`${b.enabled ? "تفعيل" : "تعطيل"} تكليف ${name}`);
  }
  for (const b of before.bindings) if (!afterMap.has(b.userId)) out.push(`إزالة تكليف ${nameOf(users, b.userId)}`);
  for (const kind of ITEM_KIND_OPTIONS.map((k) => k.value)) {
    const p0 = before.policies[kind];
    const p1 = after.policies[kind];
    if (!p0 || !p1) continue;
    const title = KIND_TITLE[kind];
    if (p0.minApprovals !== p1.minApprovals) {
      out.push(`${p1.minApprovals > p0.minApprovals ? "رفع" : "خفض"} موافقات «${title}» من ${fmt(p0.minApprovals)} إلى ${fmt(p1.minApprovals)}`);
    }
    if (p0.ownerSelfApproval !== p1.ownerSelfApproval) {
      out.push(`${p1.ownerSelfApproval ? "السماح باعتماد" : "منع اعتماد"} المالك ما أعدّه في «${title}»`);
    }
    if (p0.enabled !== p1.enabled) out.push(`${p1.enabled ? "تفعيل" : "تعطيل"} مسار «${title}»`);
  }
  return out;
}

/** المعتمِدون المؤهلون لنوع ما (المالك ضمنًا + التكليفات البشرية المفعّلة بدور المراجع في نطاقها). */
export function eligibleApprovers(config: EditorialConfig, kind: ItemKindValue): number {
  const bound = config.bindings.filter(
    (b) => b.enabled && b.kind === "human" && b.roles.includes("reviewer") && (b.itemKinds === "all" || b.itemKinds.includes(kind)),
  ).length;
  return 1 + bound;
}

export interface ReapplyResult {
  config: EditorialConfig;
  failed: string[];
  applied: number;
}

function cloneConfig(c: EditorialConfig): EditorialConfig {
  return JSON.parse(JSON.stringify(c)) as EditorialConfig;
}

/**
 * تعارض 409: يعيد تطبيق تغييرات المالك (من base إلى mine) على النسخة الأحدث، حقلًا حقلًا،
 * على التكليف نفسه بالمستخدم أو السياسة نفسها. ما تعذّر يُسرد ولا يُطبَّق.
 */
export function reapplyChanges(base: EditorialConfig, mine: EditorialConfig, latest: EditorialConfig, users: readonly UserRef[]): ReapplyResult {
  const out = cloneConfig(latest);
  const failed: string[] = [];
  let applied = 0;
  const baseMap = new Map(base.bindings.map((b) => [b.userId, b]));
  const mineMap = new Map(mine.bindings.map((b) => [b.userId, b]));
  const userExists = (id: string) => users.some((u) => u.id === id);
  for (const b of mine.bindings) {
    const prev = baseMap.get(b.userId);
    const idx = out.bindings.findIndex((x) => x.userId === b.userId);
    const name = nameOf(users, b.userId);
    if (!prev) {
      if (!userExists(b.userId)) {
        failed.push(`إضافة تكليف لـ ${name}: المستخدم غير موجود`);
        continue;
      }
      if (idx >= 0) out.bindings[idx] = { ...b, roles: [...b.roles] };
      else out.bindings.push({ ...b, roles: [...b.roles] });
      applied += 1;
      continue;
    }
    const changedFields = bindingFieldChanges(prev, b);
    if (!changedFields) continue;
    if (idx < 0) {
      failed.push(`تعديل تكليف ${name}: أُزيل التكليف في النسخة الأحدث`);
      continue;
    }
    const target: EditorialBinding = { ...out.bindings[idx], roles: [...out.bindings[idx].roles] };
    if (changedFields.roles) {
      for (const r of b.roles) if (!prev.roles.includes(r) && !target.roles.includes(r)) target.roles.push(r);
      target.roles = target.roles.filter((r) => b.roles.includes(r) || !prev.roles.includes(r));
    }
    if (changedFields.itemKinds) target.itemKinds = b.itemKinds === "all" ? "all" : [...b.itemKinds];
    if (changedFields.domains) target.domains = b.domains === "all" ? "all" : [...b.domains];
    if (changedFields.enabled) target.enabled = b.enabled;
    out.bindings[idx] = target;
    applied += 1;
  }
  for (const b of base.bindings) {
    if (mineMap.has(b.userId)) continue;
    const idx = out.bindings.findIndex((x) => x.userId === b.userId);
    if (idx < 0) continue; // أُزيل في الأحدث أيضًا: النتيجة نفسها.
    out.bindings.splice(idx, 1);
    applied += 1;
  }
  for (const kind of ITEM_KIND_OPTIONS.map((k) => k.value)) {
    const p0 = base.policies[kind];
    const p1 = mine.policies[kind];
    if (!p0 || !p1 || !out.policies[kind]) continue;
    const target: EditorialPolicy = { ...out.policies[kind] };
    let touched = false;
    for (const field of ["minApprovals", "ownerSelfApproval", "enabled"] as const) {
      if (p0[field] !== p1[field]) {
        (target as unknown as Record<string, unknown>)[field] = p1[field];
        touched = true;
      }
    }
    if (touched) {
      out.policies[kind] = target;
      applied += 1;
    }
  }
  return { config: out, failed, applied };
}

function bindingFieldChanges(a: EditorialBinding, b: EditorialBinding): { roles: boolean; itemKinds: boolean; domains: boolean; enabled: boolean } | null {
  const roles = [...a.roles].sort().join("|") !== [...b.roles].sort().join("|");
  const itemKinds = !sameScope(a.itemKinds, b.itemKinds);
  const domains = !sameScope(a.domains, b.domains);
  const enabled = a.enabled !== b.enabled;
  return roles || itemKinds || domains || enabled ? { roles, itemKinds, domains, enabled } : null;
}

/** ملخص الصف المطوي: «مراجع، ناشر · كل الأنواع · كل المجالات». */
export function bindingSummary(b: EditorialBinding): string {
  const roles = b.roles.length ? b.roles.map((r) => ROLE_TITLE[r as DeskRoleValue] ?? r).join("، ") : "بلا أدوار";
  const kinds = scopeText(b.itemKinds, "كل الأنواع", (k) => KIND_TITLE[k] ?? k);
  const domains = scopeText(b.domains, "كل المجالات", domainLabel);
  return `${roles} · ${kinds} · ${domains}`;
}

/** يقبل رابط https وحده؛ ما سواه (javascript: وdata: وhttp: والنسبي والمكسور) لا يُعرض رابطًا (ن٩). */
export function safeSourceHref(href: string | null | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
