# تدقيق الحالة الراهنة — مسجّل حكيم الصوتي

**المرجع:** HKM-VOICE-NOTE-SA-007 · المرحلة الأولى (الفحص)
**التاريخ:** 2026-08-01 · **الفرع:** `claude/legal-platform-audit-ii0r3u` (من أحدث `main`)

---

## ١. الخلاصة التنفيذيّة

التنفيذ الصوتيّ الحاليّ في `HakeemComposer` **ليس مسجّلًا صوتيًّا إنتاجيًّا**. إنّه غلافٌ رفيع حول
`window.SpeechRecognition` / `window.webkitSpeechRecognition` فقط — أي تفريغٌ فوريّ من المتصفّح بلا:
التقاطِ صوتٍ حقيقيّ (`getUserMedia`/`MediaRecorder`)، ولا موجةٍ حيّة، ولا Blob محليّ، ولا معاينة/تشغيل،
ولا إيماءات (ضغط/سحب/قفل)، ولا آلة حالاتٍ صريحة، ولا تفريغٍ خادميّ، ولا اختيار مزوّد، ولا خصوصيّةٍ محليّة أولًا.

إضافةً إلى ذلك، **الإدراج يمسح النصّ السابق**: الوصل الحاليّ يستبدل كامل محتوى الصندوق بالنصّ المفرَّغ.

## ٢. الملفّ الحاليّ ومسؤوليّته

| الملفّ | الحالة |
|---|---|
| `components/hakeem-composer/voice-recorder.tsx` | يُصدّر `VoiceButton`. يعتمد **حصرًا** على `SpeechRecognition`/`webkitSpeechRecognition` (الأسطر 17–24، 59–97). `lang="ar-SA"`, `continuous`, `interimResults`. عند التوقّف يستدعي `onTranscript(combined)`. |
| `components/hakeem-composer/hakeem-composer.tsx` | يستورد `VoiceButton` (سطر 46) ويصله (سطر 421–423): `onTranscript={(t) => updateValue(t.slice(0, maxChars), …)}`. |
| `components/hakeem-composer/composer-textarea.tsx` | يتتبّع المؤشّر عبر `onSelect`/`onKeyUp`/`onClick` (متاحٌ لإدراجٍ عند المؤشّر مستقبلًا). |

### دليل الاعتماد على SpeechRecognition (لا مسجّل حقيقيّ)
```ts
// voice-recorder.tsx:17
function getSpeechRecognition(): (new () => SpeechRec) | null {
  const w = window as … { SpeechRecognition?…; webkitSpeechRecognition?…; };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}
```
لا وجود لأيٍّ من: `navigator.mediaDevices.getUserMedia`, `MediaRecorder`, `AudioContext`, `AnalyserNode`,
`URL.createObjectURL`, Pointer Events، أو رفعٍ خادميّ.

## ٣. عيوبٌ مقابل معايير القبول (§21)

| # | المعيار | الحالة الآن |
|---|---|---|
| 1 | يعمل دون SpeechRecognition | ❌ يعتمد عليه كليًّا |
| 2 | MediaRecorder حقيقيّ | ❌ غير موجود |
| 3 | موجة حيّة | ❌ |
| 4–7 | ضغط/سحب إلغاء/سحب قفل/Pause‑Resume | ❌ (نقرةٌ واحدة فقط) |
| 8 | معاينة وتشغيل | ❌ |
| 9 | لا رفع قبل الموافقة | ⚠️ لا رفعَ إطلاقًا (تفريغٌ محليّ)، لكنّ لا نموذج «موافقة» |
| 10 | لا إرسال تلقائيّ | ✅ (لا يستدعي submit) |
| 11 | **لا يمسح النصّ السابق** | ❌ **يمسح** (`updateValue` يستبدل الكلّ) |
| 12 | يعمل على iPhone حقيقيّ | ⚠️ SpeechRecognition غير موثوق على Safari/iOS |
| 13 | تفاوض MIME فعليّ | ❌ لا التقاطَ أصلًا |
| 14 | لا يترك الميكروفون مفتوحًا | — (لا مسارات) |
| 15–16 | ar‑SA + قائمة عبارات قانونيّة | ⚠️ ar‑SA للتعرّف فقط، بلا phrase list |
| 17–18 | Benchmark + اختيار مزوّد بالأرقام | ❌ |
| 19 | الصوت لا يُخزَّن افتراضيًّا | ✅ (لا صوت) |

## ٤. البنية التحتيّة القابلة لإعادة الاستخدام (موجودة)

| الحاجة (من الأمر) | المتاح في المستودع |
|---|---|
| Audit (بيانات وصفيّة فقط §15) | `lib/modules/audit/audit.ts` (`auditEvent`) |
| Rate limit موزّع (§14.3) | `lib/modules/support/rate-limit.ts` · `attachments/upload-rate-limit.ts` · `documents/rate-limit.ts` |
| بوّابة الاستخدام/الصلاحيّة (§14.2) | `lib/modules/billing/access-gate.ts` (`gateAdvancedUse`) |
| تتبّع المؤشّر للإدراج (§16) | `composer-textarea.tsx` (`onSelect`) |
| أعلام البيئة (§17) | نمط `lib/modules/config/*` قائم |

## ٥. الفجوات (يجب إنشاؤها)

- `lib/modules/voice/**` — **غير موجود**.
- `components/hakeem-composer/voice/**` — **غير موجود**.
- `app/api/voice/**` — **غير موجود**.
- تبعيّات: `wavesurfer.js` — **غير مثبّتة** (لا `wavesurfer`/`recordrtc`/`ffmpeg` في `package.json`).
- لا `VoiceState` آلة حالات، ولا `chooseSupportedAudioMimeType`, ولا `insertTranscriptAtCaret`.

## ٦. المخاطر والقيود المعلَنة (صدقًا)

1. **اختبار iPhone الحيّ (§20) وBenchmark الـ100 مقطع (§18):** لا يمكن تنفيذهما في بيئة الوكيل — يتطلّبان أجهزةً حقيقيّة وأصواتًا حقيقيّة. **لن يُوسَم Mark Ready** قبل إتمامها بشريًّا.
2. **مفاتيح مزوّدي التفريغ (Azure/OpenAI/Google §11):** أسرارٌ خادميّة يوفّرها المالك؛ الأدلّة تُبنى بواجهاتٍ ومحاكاةٍ آمنة، والتشغيل الحقيقيّ خلف أعلامٍ مطفأة.
3. **الخصوصيّة (§15):** التصميم Local‑First؛ لا صوت في DB/Blob/Analytics/Audit — يُطبَّق في مسار الرفع.

## ٧. خطّة التنفيذ (مراحل، خلف أعلامٍ مطفأة افتراضيًّا)

1. **(هذه الدفعة)** التدقيق + النواة النقيّة: آلة الحالات الصارمة، تفاوض MIME، تحقّق الصوت (Magic Bytes)، مطبّع النصّ، قائمة العبارات القانونيّة، سجلّ المزوّدين + الواجهات، الأعلام، واختبارات الوحدات النقيّة.
2. مكوّنات الواجهة: `useVoiceRecorder`/`useVoiceGestures` + `VoiceNoteButton`/`VoiceRecordingBar`/`VoiceWaveform`/`VoiceLockedRecorder`/`VoicePreview` (MediaRecorder + wavesurfer + Pointer Events + `insertTranscriptAtCaret`).
3. الخادم: `POST /api/voice/transcribe` (مصادقة → استخدام → Rate limit → MIME/Magic/الحجم → مزوّد → تطبيع → Audit وصفيّ → حذف مؤقّت) + `providers/health`.
4. مزوّدات التفريغ (Azure/OpenAI/Google) خلف الأعلام.
5. Benchmark عربيّ سعوديّ قانونيّ + `scripts/eval-voice-saudi-legal.ts` (يحتاج مجموعة أصواتٍ يوفّرها المالك).
6. مصفوفة اختبار iPhone الحيّة (بشريّة) + الوثائق.

> **الحدود الحاكمة:** PR مستقلّ · لا دمج · لا نشر · لا Mark Ready قبل اختبار iPhone الفعليّ. الأعلام مطفأة افتراضيًّا ⇒ صفر تغيير على المستخدم حتى التفعيل.
