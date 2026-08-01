// HKM-VOICE-NOTE-SA-007 §8 — تحقّق تفاوض الصيغ + التحقّق بالبايتات. npm run test:voice-mime-negotiation
import {
  chooseSupportedAudioMimeType,
  extensionForMime,
  codecFromMime,
  browserFamily,
  PREFERRED_AUDIO_MIME_TYPES,
} from "@/lib/modules/voice/mime-negotiation";
import { detectAudioContainer, mimeMatchesContainer, validateAudioBytes } from "@/lib/modules/voice/audio-validation";

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("✓ " + n)) : (fail++, console.log("✗ " + n)); };

function main() {
  // Chrome يدعم webm/opus أولًا.
  const chrome = chooseSupportedAudioMimeType((t) => t.startsWith("audio/webm"));
  check("Chrome ⇒ webm/opus", chrome === "audio/webm;codecs=opus");

  // Safari/iPhone: لا webm، يدعم mp4 ⇒ يُختار mp4.
  const safari = chooseSupportedAudioMimeType((t) => t.startsWith("audio/mp4"));
  check("Safari ⇒ mp4", safari === "audio/mp4;codecs=mp4a.40.2");

  // لا دعم لأيّ نوع ⇒ null.
  check("لا مدعوم ⇒ null", chooseSupportedAudioMimeType(() => false) === null);

  // الامتدادات مطابِقة للحاوية.
  check("webm ⇒ webm", extensionForMime("audio/webm;codecs=opus") === "webm");
  check("mp4 ⇒ m4a", extensionForMime("audio/mp4") === "m4a");
  check("ogg ⇒ ogg", extensionForMime("audio/ogg;codecs=opus") === "ogg");

  check("codec parse", codecFromMime("audio/mp4;codecs=mp4a.40.2") === "mp4a.40.2");
  check("browserFamily safari (iPhone UA)", browserFamily("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/605") === "safari");
  check("القائمة المفضّلة غير فارغة", PREFERRED_AUDIO_MIME_TYPES.length >= 3);

  // Magic bytes: WebM.
  const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);
  check("يكتشف WebM", detectAudioContainer(webm) === "webm");
  // MP4: ....ftyp
  const mp4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]);
  check("يكتشف MP4", detectAudioContainer(mp4) === "mp4");
  check("MP4 يطابق audio/mp4", mimeMatchesContainer("audio/mp4", "mp4"));
  check("WebM لا يطابق audio/mp4", !mimeMatchesContainer("audio/mp4", "webm"));

  // تحقّقٌ شامل: نوعٌ يخالف المحتوى يُرفَض.
  const bad = validateAudioBytes({ bytes: webm, declaredMimeType: "audio/mp4", maxBytes: 1_000_000 });
  check("MIME mismatch يُرفَض", !bad.ok && bad.code === "MIME_MISMATCH");
  const good = validateAudioBytes({ bytes: webm, declaredMimeType: "audio/webm;codecs=opus", maxBytes: 1_000_000 });
  check("مطابقٌ ⇒ صالح", good.ok);
  const tooBig = validateAudioBytes({ bytes: webm, declaredMimeType: "audio/webm", maxBytes: 4 });
  check("تجاوز الحجم يُرفَض", !tooBig.ok && tooBig.code === "TOO_LARGE");
  const empty = validateAudioBytes({ bytes: new Uint8Array(), declaredMimeType: "audio/webm", maxBytes: 10 });
  check("فارغ يُرفَض", !empty.ok && empty.code === "EMPTY");

  console.log(`\nنتيجة §8 (mime + validation): ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}
main();
