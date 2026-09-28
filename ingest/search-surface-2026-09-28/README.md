# الموجة ١ — وجه البحث + بطاقة النظام + «نص النظام»

التاريخ: 2026-09-28. إضافة فقط. لا UPDATE ولا DELETE ولا TRUNCATE ولا DROP على جدول أو صف قائم.

## ما تضيفه

| الطبقة | الجديد | يقرأه |
|---|---|---|
| قاعدة | `search_surface`، `search_surface_member`، `law_card` (هجرة `20260928120000_search_surface_law_card`)، وعليها مشغّل الإضافة فقط | — |
| بحث | `lib/modules/legal-core/search-surface.ts` | النواة `searchLegalCore`، `getArticlesByNumber`، `hybridSearch` (ومنه MCP والشامل)، الاقتراحات |
| مطابقة الأسماء | `matchSystemsInText` و`matchNameToRegistry` و`findExactArticleMatch`: كلمات كاملة، والجوهر الأقصر داخل جوهر أطول يسقط، ووصف «الصادر بالمرسوم…» لا يدخل الجوهر | اسأل حكيم، المخطِّط، نطاق النموذج، «المادة {رقم} {نظام}» |
| صفحة النظام | بطاقة النظام ثم «نص النظام»: العنوان، السنة، البسملة، المرسوم، قرار المجلس، عنوان النظام، ثم المواد كاملة | `/legal/[slug]` |

قاعدة الوجه: لكل عمل آخر صف `valid_on <= اليوم`. أعضاء العمل غير الوجه يخرجون من الصناديق، ويُحوَّل اسمهم إلى الوجه.
نافذة التنفيذ: صف م/53 من 2012-07-03 وصف م/237 من 2026-10-28. التحوّل يوم 28 أكتوبر بلا تعديل صفوف.
الأرشيف يبقى: كل نظام يُفتح بالرابط المباشر، ومعه تنبيه إن لم يكن الساري وإحالة إلى النسخة السارية.

## التشغيل

```
# 1) المختبر المحلي (DATABASE_URL على 127.0.0.1)
python3 tests/staging_fixture.py                        # مختبر فقط: أشكال الإنتاج بنصوص اختبار
python3 scripts/build_law_cards.py                      # يبني data/law_cards_boe.jsonl ويفحص الحرفية
python3 scripts/build_surface.py --target staging --preview --report /tmp/preview.json
python3 scripts/build_surface.py --target staging --report /tmp/run.json
python3 tests/export_snapshot.py tests/staging_snapshot.json
npx tsx scripts/test-search-surface.ts                  # اختبار القبول

# 2) فرع Neon تجريبي من الإنتاج (DATABASE_URL على فرع غير ep-icy-rice)
python3 scripts/build_surface.py --target branch --preview --report branch_preview.json
python3 scripts/build_surface.py --target branch --report branch_run.json

# 3) الإنتاج — بعد كلمة المالك «احقن» فقط
HAKEEM_INJECT=yes python3 scripts/build_surface.py --target production --preview   # أرقام أولًا
HAKEEM_INJECT=yes python3 scripts/build_surface.py --target production             # بعد الموافقة
```

الإنتاج يفرض: حارسا md5 (التنفيذ م1، المعاملات المدنية م1)، عدد المخلوط 98/29/23، ثبات عدد الأنظمة والمواد والتحقق داخل المعاملة، وصفر حركة `n_tup_upd`/`n_tup_del` على الجداول الثلاثة. أي خلل = تراجع.
السكربت لا يطبع سلسلة الاتصال.

## ما لم يُنجز وينتظر المالك

- «نبذة عن النظام» ومسار التصنيف لم تُلتقط في قراءة هيئة الخبراء الأولى. الحقلان فارغان ولا يُخمَّنان. يُضافان بصف `law_card` جديد بعد قراءة المالك.
- البطاقات لتسعة أنظمة فقط (المقروءة). «نظام مكافحة التستر 1425» لم يُطابَق باسم في القاعدة فلم تُكتب له بطاقة.
- الخلف للأنظمة المستبدلة: اليوم تخرج من وجه الساري بلا خلف (`surface_system_id` فارغ). عند وصول تصدير المالك يُضاف صف جديد بالخلف وعضو `successor`، دون تعديل الصف القديم.
- الموجة ٢ (search_norm للمواد الـ353) لا تُنفّذ قبل عبارة «فهرسة المواد الجديدة».
