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

## الطبقات المتبقّية (مراحل تالية)
- **الواجهة:** `components/hakeem-composer/voice/` (Button/RecordingBar/Waveform/LockedRecorder/Preview/PermissionHelp + `useVoiceRecorder`/`useVoiceGestures`) — MediaRecorder + wavesurfer + Pointer Events.
- **الخادم:** `app/api/voice/transcribe/route.ts` (§14) + `providers/health/route.ts`.
- **المزوّدات:** وصل Azure/OpenAI/Google الفعليّ خلف العلم.
- **Benchmark:** `scripts/eval-voice-saudi-legal.ts` + `data/evals/voice-saudi-legal/` (يحتاج أصواتًا من المالك).
- **iPhone الحيّ:** مصفوفة اختبارٍ بشريّة (لا يمكن آليًّا).

## مبادئ التصميم
- **مصدر حالةٍ واحد** (§5): لا `isRecording/isPaused/isLocked` متعارضة.
- **حَقن التبعيّات للاختبار:** `isTypeSupported` يُمرَّر (لا DOM في node).
- **الأعلام مطفأة افتراضيًّا:** صفر تغيير على المستخدم حتى التفعيل الصريح.
