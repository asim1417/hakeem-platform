#!/usr/bin/env python3
"""gap019k (HKM-052، M2b): تاريخ نفاذ نظام الشركات 1443.

المخزن 2022-06-30 هو تاريخ الصدور، والنظام «يعمل به بعد (180) يومًا من تاريخ نشره».
بطاقة هيئة الخبراء (فُتحت في كروم 29/10): النشر 1443/12/23هـ = 2022-07-22، و«النفاذ بعد (180) يوماً من تاريخ النشر»، بلا تاريخ نفاذ منصوص.
بيان هيئة السوق المالية الرسمي: «نشر في صحيفة أم القرى بتاريخ 23/12/1443هـ» و«وسينفذ بتاريخ 26/06/1444هـ الموافق 19/01/2023م» (القارئ h1).
الحساب بقاعدة HKM-024 (النشر + 180) = 2023-01-18، أي آخر يوم من المدة إذا لم يُحسب يوم النشر، فيكون اليوم التالي أول يوم نفاذ.
القرار (بتفويض المالك 29/10 «لا ترجع لي»): يُعتمد التاريخ الذي أعلنته الجهة الرسمية نصًا 2023-01-19، ويُذكر الحساب في الدليل،
كما في قرار المالك في القرار 921 (الحرفي مع ذكر التاريخين).
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'gap019k-companies-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
SID, NAME, OLD, NEW = 'cmpwi0cei0021nxff6ei08xis', 'نظام الشركات', '2022-06-30', '2023-01-19'
URL = 'https://cma.gov.sa/MediaCenter/PR/Pages/-New-Companies-Law.aspx'


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


note = (f"HKM-052 {BY}: «يعمل به بعد (180) يومًا من تاريخ نشره»؛ النشر 1443/12/23هـ = 2022-07-22 (بطاقة هيئة الخبراء، فُتحت في كروم 29/10)؛ "
        f"وبيان هيئة السوق المالية: «وسينفذ بتاريخ 26/06/1444هـ الموافق 19/01/2023م». الحساب (النشر + 180) = 2023-01-18 آخر يوم في المدة، "
        f"والمعتمد التاريخ الرسمي المعلن {NEW}؛ وكان المخزن {OLD} (تاريخ الصدور) [تفويض المالك 29/10]")
pid = 'g19kp-' + hashlib.sha256(f'{BY}|{SID}'.encode()).hexdigest()[:24]
st = [f"SELECT CASE WHEN (SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(SID)})={lit(OLD)}::date"
      f" AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g19kp-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before",
      "INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) "
      f"SELECT {lit(pid)}, 'system', {lit(SID)}, {lit(NAME)}, NULL, 'official', {lit(BY)}, {lit(URL)}, {lit(hashlib.md5(note.encode()).hexdigest())}, DATE '2026-10-29', "
      f"{lit('effective_from_corrected:' + OLD + '->' + NEW)}, {lit(note)} WHERE NOT EXISTS (SELECT 1 FROM legal_text_provenance WHERE id = {lit(pid)})",
      f"UPDATE legal_systems SET preamble_effective_from = {lit(NEW)}::timestamptz WHERE id = {lit(SID)} AND preamble_effective_from::date = {lit(OLD)}::date",
      f"SELECT CASE WHEN (SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(SID)})={lit(NEW)}::date"
      f" AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g19kp-%')=1 THEN 'ok' ELSE {FAIL} END AS guard_after"]
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'report': {'corrected': 1, 'new_articles': 0, 'changed_text': 0,
           'plan': [dict(name=NAME, old=OLD, new=NEW)]}, 'statements': st},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st))
