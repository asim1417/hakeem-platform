// ─────────────────────────────────────────────────────────────────────────────
// نظام الأوامر (المرحلة ٧) — الخبير يكتب أمرًا (/فحص-حكم …) فيُوجَّه لوكيل + مهارة مباشرةً؛
// المبتدئ يكتب سؤالًا والمنسّق يوجّه. حتمي (بلا نموذج) → يُختبَر بلا قاعدة. لا يلمس الأمن.
// ─────────────────────────────────────────────────────────────────────────────
import type { SkillName } from "./skills";

export type CommandTarget = "judicial" | "drafter_naqd" | "commercial_analysis" | "drafter_reply_memo";

export interface CommandSpec {
  command: string; // النصّ المعروض
  target: CommandTarget;
  skill: SkillName;
  label: string;
}

/** خريطة الأوامر — الاسم المُطبَّع (بلا «/» وبفواصل موحّدة) → المواصفة. */
const COMMANDS: Record<string, CommandSpec> = {
  "فحص-حكم": { command: "/فحص-حكم", target: "judicial", skill: "aman-judgment-audit", label: "فحص حكم قضائي" },
  "لائحة-نقض": { command: "/لائحة-نقض", target: "drafter_naqd", skill: "aman-naqd", label: "صياغة لائحة نقض" },
  "تحليل-تجاري": { command: "/تحليل-تجاري", target: "commercial_analysis", skill: "aman-commercial-litigation", label: "تحليل نزاع تجاري" },
  "مذكرة-جوابية": { command: "/مذكرة-جوابية", target: "drafter_reply_memo", skill: "arabic-editorial-standards", label: "صياغة مذكرة جوابية" },
};

export interface ParsedCommand {
  spec: CommandSpec;
  /** بقيّة النصّ بعد الأمر (الوقائع/المدخل). */
  args: string;
}

/** يوحّد رمز الأمر: يزيل «/»، ويقبل المسافة أو الشرطة بين الكلمتين. */
function normalizeToken(token: string): string {
  return token.replace(/^\//, "").replace(/\s+/g, "-").replace(/_/g, "-").trim();
}

/**
 * يحلّل مدخلًا يبدأ بأمر (/…). يعيد الأمر وبقيّة النصّ، أو null إن لم يكن أمرًا.
 */
export function parseCommand(input: string): ParsedCommand | null {
  const raw = (input || "").trim();
  if (!raw.startsWith("/")) return null;
  const firstSpace = raw.search(/\s/);
  const head = firstSpace === -1 ? raw : raw.slice(0, firstSpace);
  const args = firstSpace === -1 ? "" : raw.slice(firstSpace + 1).trim();
  const spec = COMMANDS[normalizeToken(head)];
  return spec ? { spec, args } : null;
}

/** قائمة الأوامر المتاحة (لعرضها في حقل «اسأل حكيم»). */
export function listCommands(): CommandSpec[] {
  return Object.values(COMMANDS);
}
