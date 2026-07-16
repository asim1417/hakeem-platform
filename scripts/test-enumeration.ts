import { detectDurationEnumeration, extractDurations } from "../lib/modules/agents/enumeration";
let ok=0, fail=0; const t=(c:boolean,m:string)=>{console.log(`${c?"✓":"✗"} ${m}`);c?ok++:fail++;};

const d = detectDurationEnumeration("اريد اي مدة تم ذكرها في نظام المعاملات المدنية");
t(d?.systemName === "المعاملات المدنية", `كشف النظام: ${d?.systemName}`);
t(detectDurationEnumeration("ما شروط فسخ العقد؟") === null, "سؤال غير حصريّ → null");
t(detectDurationEnumeration("كل الحالات في نظام العمل") === null, "حصر بلا موضوع مدد → null");

const ds = extractDurations("يجب رفع الدعوى خلال ثلاثين يومًا، ويسقط الحق بمضي 180 يومًا، والتقادم خمس سنوات.");
t(ds.some(x=>/يوم/.test(x)), `استخرج المدد اليومية: ${ds.join(" · ")}`);
t(ds.some(x=>/سنوات|سنة/.test(x)), "استخرج السنوات");
t(extractDurations("لا مدة هنا نصّ عادي").length === 0, "نصّ بلا مدد → لا استخراج");

console.log(`\nنتيجة: ${ok} نجح، ${fail} فشل`);
if(fail) process.exit(1);
