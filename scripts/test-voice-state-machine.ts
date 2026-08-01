// HKM-VOICE-NOTE-SA-007 §5 — تحقّق آلة الحالات (نقيّ). npm run test:voice-state-machine
import { voiceReducer, canTransition, isCapturing, isTerminal, INITIAL_VOICE_STATE } from "@/lib/modules/voice/recording-state";
import type { VoiceState } from "@/lib/modules/voice/contracts";

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("✓ " + n)) : (fail++, console.log("✗ " + n)); };

function main() {
  check("الحالة الابتدائيّة IDLE", INITIAL_VOICE_STATE === "IDLE");

  // مسار WhatsApp السريع: IDLE→إذن→ضغط→إفلات→تسجيل.
  let s: VoiceState = "IDLE";
  s = voiceReducer(s, { type: "REQUEST_PERMISSION" }); check("IDLE→REQUESTING", s === "REQUESTING_PERMISSION");
  s = voiceReducer(s, { type: "PERMISSION_GRANTED" }); check("→PRESS_RECORDING", s === "PRESS_RECORDING");
  s = voiceReducer(s, { type: "STOP" }); check("PRESS→STOPPING", s === "STOPPING");
  s = voiceReducer(s, { type: "STOPPED" }); check("STOPPING→RECORDED", s === "RECORDED");

  // القفل ثمّ إيقاف مؤقّت ثمّ استئناف.
  let l: VoiceState = "PRESS_RECORDING";
  l = voiceReducer(l, { type: "LOCK" }); check("PRESS→LOCKED", l === "LOCKED_RECORDING");
  l = voiceReducer(l, { type: "PAUSE" }); check("LOCKED→PAUSED", l === "PAUSED");
  l = voiceReducer(l, { type: "RESUME" }); check("PAUSED→LOCKED", l === "LOCKED_RECORDING");

  // التفريغ: RECORDED→UPLOADING→TRANSCRIBING→TRANSCRIBED.
  let t: VoiceState = "RECORDED";
  t = voiceReducer(t, { type: "TRANSCRIBE" }); check("RECORDED→UPLOADING", t === "UPLOADING");
  t = voiceReducer(t, { type: "UPLOAD_STARTED" }); check("UPLOADING→TRANSCRIBING", t === "TRANSCRIBING");
  t = voiceReducer(t, { type: "TRANSCRIBED" }); check("TRANSCRIBING→TRANSCRIBED", t === "TRANSCRIBED");

  // التسجيل القصير جدًّا يُلغى.
  check("PRESS + TOO_SHORT ⇒ CANCELLED", voiceReducer("PRESS_RECORDING", { type: "TOO_SHORT" }) === "CANCELLED");

  // منع الانتقالات غير القانونيّة (لا تغيير).
  check("لا PAUSE من IDLE", voiceReducer("IDLE", { type: "PAUSE" }) === "IDLE");
  check("لا TRANSCRIBE من PRESS", voiceReducer("PRESS_RECORDING", { type: "TRANSCRIBE" }) === "PRESS_RECORDING");
  check("canTransition IDLE/REQUEST_PERMISSION", canTransition("IDLE", "REQUEST_PERMISSION"));
  check("!canTransition IDLE/STOP", !canTransition("IDLE", "STOP"));

  // أعلام الموارد.
  check("isCapturing(LOCKED_RECORDING)", isCapturing("LOCKED_RECORDING"));
  check("!isCapturing(RECORDED)", !isCapturing("RECORDED"));
  check("isTerminal(TRANSCRIBED)", isTerminal("TRANSCRIBED"));
  check("!isTerminal(LOCKED_RECORDING)", !isTerminal("LOCKED_RECORDING"));

  // الحذف يعيد إلى IDLE.
  check("RECORDED + DELETE ⇒ IDLE", voiceReducer("RECORDED", { type: "DELETE" }) === "IDLE");
  // رفض الإذن حالةٌ نهائيّة قابلةٌ لإعادة المحاولة.
  check("REQUESTING + PERMISSION_DENIED", voiceReducer("REQUESTING_PERMISSION", { type: "PERMISSION_DENIED" }) === "PERMISSION_DENIED");
  check("PERMISSION_DENIED + REQUEST ⇒ REQUESTING", voiceReducer("PERMISSION_DENIED", { type: "REQUEST_PERMISSION" }) === "REQUESTING_PERMISSION");

  console.log(`\nنتيجة §5 (state-machine): ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}
main();
