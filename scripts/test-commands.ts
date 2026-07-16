// اختبار نظام الأوامر + المهارات (المرحلة ٧) — حتمي، بلا قاعدة.
import { parseCommand, listCommands } from "../lib/modules/agents/commands";
import { SKILLS } from "../lib/modules/agents/skills";
let ok = 0, fail = 0;
const t = (c: boolean, m: string) => { console.log(`${c ? "✓" : "✗"} ${m}`); c ? ok++ : fail++; };

const a = parseCommand("/فحص-حكم هذا نصّ الحكم محل الفحص");
t(a?.spec.target === "judicial" && a?.spec.skill === "aman-judgment-audit", "/فحص-حكم → judicial + aman-judgment-audit");
t(!!a?.args.startsWith("هذا نصّ"), "استخرج الوقائع بعد الأمر");

t(parseCommand("/لائحة-نقض")?.spec.target === "drafter_naqd", "/لائحة-نقض → drafter_naqd");
t(parseCommand("/تحليل-تجاري نزاع حصص")?.spec.skill === "aman-commercial-litigation", "/تحليل-تجاري → مهارة تجارية");
t(parseCommand("/مذكرة-جوابية")?.spec.target === "drafter_reply_memo", "/مذكرة-جوابية → مذكرة");
t(parseCommand("ما مدة الإشعار؟") === null, "سؤال عادي ليس أمرًا (null)");
t(parseCommand("/امر-غير-موجود") === null, "أمر غير معروف → null");
t(listCommands().length === 4, `عدد الأوامر = ${listCommands().length} (4)`);
t(Object.keys(SKILLS).length === 4, `عدد المهارات = ${Object.keys(SKILLS).length} (4)`);

console.log(`\nنتيجة: ${ok} نجح، ${fail} فشل`);
if (fail) process.exit(1);
