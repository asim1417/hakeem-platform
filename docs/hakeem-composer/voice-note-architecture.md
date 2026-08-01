# معماريّة مسجّل حكيم الصوتي (HKM-VOICE-NOTE-SA-007)

## المسار المستهدف
```
HakeemComposer
 → VoiceNoteController (useVoiceRecorder + آلة حالات §5)
 → getUserMedia (channelCount:1, echo/noise/gain)
 → MediaRecorder (نوع MIME مُتفاوَض §8)
 → Live Waveform (wavesurfer.js + record plugin)
 → Local Blob (لا رفع)  ← الخصوصيّة: Local-First
 → Preview (تشغيل/seek/حذف/إعادة تسجيل — نمط Voice Memos)
 → «تحويل إلى نص» (موافقة صريحة)
 → POST /api/voice/transcribe (Saudi ar-SA STT + phrase list §12)
 → Legal Normalization (§13، raw + normalized)
 → insertTranscriptAtCaret (§16، لا يمسح النصّ)
 → المستخدم يرسل يدويًّا (لا إرسال تلقائيّ)
```

## الطبقات المُنجَزة (هذه الدفعة — نقيّة، قابلة للاختبار، بلا DOM)
| الوحدة | المسؤوليّة | §|
|---|---|---|
| `lib/modules/voice/contracts.ts` | الأنواع + `VoiceState`/`VoiceEvent` + عقد المزوّد + الحدود | 5/8/11 |
| `recording-state.ts` | آلة الحالات الصارمة (انتقالاتٌ قانونيّة فقط) | 5 |
| `mime-negotiation.ts` | `chooseSupportedAudioMimeType` + امتداد/codec/عائلة | 8 |
| `audio-validation.ts` | Magic Bytes + مطابقة النوع للحاوية | 14 |
| `transcript-normalizer.ts` | تطبيعٌ محافظ (raw + normalized) بلا اختلاق | 13 |
| `legal-phrase-list.ts` | قائمة العبارات القانونيّة + تنقية التلميحات | 12 |
| `insert-transcript.ts` | إدراجٌ عند المؤشّر لا يمسح النصّ | 16 |
| `provider-registry.ts` + `provider-health.ts` + `providers/*` | اختيار مزوّدٍ بالإتاحة (لا رأي) | 11 |
| `lib/modules/config/voice.ts` | الأعلام (كلّها OFF افتراضيًّا) | 17 |

## الطبقات المبنيّة (الواجهة + الخادم)
- **الواجهة:** `components/hakeem-composer/voice/` — `useVoiceRecorder` (getUserMedia + MediaRecorder + آلة الحالات + تنظيف §9/§10) · `useVoiceGestures` (Pointer §6) · `VoiceWaveform` (AnalyserNode حيّ) · `VoiceRecordingBar` · `VoiceLockedRecorder` · `VoicePreview` (wavesurfer §7) · `VoicePermissionHelp` · `VoiceNoteButton` (المتحكّم). موصولةٌ في `HakeemComposer` خلف `NEXT_PUBLIC_HAKEEM_VOICE_NOTE_V2`.
- **الخادم:** `app/api/voice/transcribe/route.ts` (§14) + `providers/health/route.ts`.
- **مزوّد OpenAI:** موصولٌ فعليًّا (`gpt-4o-transcribe`, language=ar, prompt = تلميحات قانونيّة) — يعمل عند ضبط `OPENAI_API_KEY`.

## الطبقات المتبقّية (تحتاج المالك)
- **Azure/Google:** واجهاتٌ جاهزة؛ الوصل الفعليّ عند توفّر مفاتيحهما.
- **Benchmark:** `scripts/eval-voice-saudi-legal.ts` + `data/evals/voice-saudi-legal/` (يحتاج أصواتًا حقيقيّة من المالك).
- **iPhone الحيّ:** مصفوفة اختبارٍ بشريّة (لا يمكن آليًّا) — شرطُ التفعيل الحقيقيّ.

## مبادئ التصميم
- **مصدر حالةٍ واحد** (§5): لا `isRecording/isPaused/isLocked` متعارضة.
- **حَقن التبعيّات للاختبار:** `isTypeSupported` يُمرَّر (لا DOM في node).
- **الأعلام مطفأة افتراضيًّا:** صفر تغيير على المستخدم حتى التفعيل الصريح.
