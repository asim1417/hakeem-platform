# العقود الاختياريّة — مواءمة إضافيّة غير كاسرة

عقودٌ ومحرّكات إضافيّة من المخطط السيادي، كلّها **إضافيّة، لا تغيّر سلوكًا قائمًا**، ومربوطة بالموقع.

| العقد | §المخطط | المسار | الربط |
|---|---|---|---|
| **SourceAdapter** موحّد | §9 | `lib/modules/sources/source-adapter.ts` | محوّل `direct-url-adapter.ts` يلفّ موصل DIRECT_URL القائم (قدرات: metadata/rights/integrity) |
| **DocumentProvider** موحّد | §11 | `lib/modules/documents/document-provider.ts` | `simulation-document-provider.ts` يلفّ مُصدِّر المحاكاة (validate/export) |
| **أولوية القواعد** + تسجيل السبب | §16 | `lib/modules/governance/rule-priority.ts` | رسميّ>مؤسسة>قسم>مجال>افتراضي، مع سجلّ ما تجاوزته كل قاعدة |
| **ABAC** قائم على السمات | §20 | `lib/modules/auth/abac-policy.ts` | يكمّل RBAC: ملكيّة + تصنيف حساسية + تجاوز المدير |
| **Metrics + Logger** بنيويّ | §23 | `lib/modules/observability/{metrics,logger}.ts` | عدّادات/مؤقّتات في الذاكرة + `GET /api/metrics` (محميّ) + وسم إنشاء جلسات المراجعة |
| **مقدّر تكلفة AI** | §17 | `lib/modules/ai/cost-estimator.ts` | تكلفة نقديّة من أسعار سجلّ النماذج (يكمّل عدّاد الرموز) |
| **مصفوفة التوافق + الإهمال** | §27 | `lib/modules/governance/compatibility.ts` | مصدر إصدارات واحد + سياسة إهمال، معروضة في `/admin/governance` |

## مبدأ القدرات المُعلَنة
عقدا §9 و§11 يُعلنان `capabilities` صراحةً؛ العمليات غير المدعومة ترمي `NotSupportedError`/`DocNotSupportedError` — **لا اختلاق نتائج**. عند توفّر مزوّد أقوى (Google Drive، محرّك DOCX كامل) يُنفَّذ خلف نفس العقد دون لمس المستدعين.

## الاختبار
```
npm run test:optional-contracts   # §9/§11/§16/§20/§23/§17/§27
```

## خارج نطاق «العقود» (مؤجَّل — ميزات UX لا عقود)
شريط الأوامر الموحّد ⌘K (§18) وإطار Workspaces الموحّد ميزتا واجهة، لا عقود؛ تُنفَّذان كمسار مستقلّ عند الطلب.
