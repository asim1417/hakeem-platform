# HKM-JDS-002 — طبقة الإجراءات والصياغة القضائيّة (JDS v2)

تنفيذ الأمر الحاكم HKM-JDS-002 عبر سلسلة PRs مترابطة (§32)، بحيث **تنتفع كلّ خدمةٍ**
من طبقةٍ قضائيّة مشتركة دون بناء «مكدّس ثالث» (§33).

## المبدأ
طبقة `lib/modules/judicial/` = **عقود + سجلّات** موحّدة (تصنيف، سلطة، لغة، بوّابات جودة،
حزم مجال) تُركَّب فوق المحرّكات القائمة (`judicial-assistant`, `simulations`, `hakeem-agent`,
`legal-core`) — انظر `jds-architecture-map.md`.

## حالة السلسلة (§32)
| PR | المحتوى | الحالة |
|---|---|---|
| **PR1** | تدقيق + عقود + سجلّات (`lib/modules/judicial/*`) + `test:jds` + تقارير §9 | ✅ منجز |
| PR2 | نموذج بيانات مُطبَّع + ensure-schema idempotent + بذور | ⬜ |
| PR3 | تكامل Legal Core + سريان + حقن `lawAsOfDate` في حزم المجال | ⬜ |
| PR4 | محرّك خريطة الإجراءات + وقائع/أدلّة/مسائل مطبَّعة | ⬜ |
| PR5 | محرّك الوصفة + النواة اللغويّة + مرورات الصياغة (§23) + قراءة المرجعين | ⬜ |
| PR6 | التسبيب + اتّساق المنطوق + محرّك تنفيذ بوّابات الجودة | ⬜ |
| PR7 | الوكيل الخلفيّ الدائم + مساحة العمل | ⬜ |
| PR8 | مجموعة التقييم (§29) + التحصين الأمنيّ | ⬜ |

## ملفّات PR1
- `lib/modules/judicial/contracts.ts` — §6/§11/§12/§15/§16/§22/§27/§8 كأنواع.
- `lib/modules/judicial/language-kernel.ts` — §13.
- `lib/modules/judicial/quality-gates.ts` — §27 (JG0..JG21).
- `lib/modules/judicial/domain-packs.ts` — §8 (9 حزم).
- `lib/modules/judicial/task-characterization.ts` — §15 (تصنيف حتميّ).
- `lib/modules/judicial/patterns.ts` — §11 (بذرة من §13).
- `scripts/test-judicial-jds.ts` — `npm run test:jds` (26 فحصًا).

## مبادئ الصدق المطبَّقة
- لا اختلاق: أنماط PR1 مصدرها `INTERNAL_HAKEEM_POLICY` (نواة §13)، لا مرجعٌ خارجيّ.
- المرجعان القضائيّان **غير موجودين** في المستودع — لم تُختلق بصمتهما (`jds-missing-references.md`).
- تواريخ سريان حزم المجال `PENDING` حتى تُثبت من النواة (PR3).
- لا دمج/نشر/اعتماد تلقائيّ (§35.14): تبقى الطبقة عند العقود؛ لا مخرج قضائيّ يُصدَّر.
