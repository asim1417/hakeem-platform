#!/usr/bin/env python3
"""gap022 (HKM-052، نظام بلا مواد): المادة (47) من نظام تأديب الموظفين (م/7 لعام 1391هـ)، وهي الباقية في العمل.

حالة النظام في حكيم «ملغى مع بقاء أحكام محددة مؤقتًا»، ودليلها في أم القرى (details?p=25316):
«إلغاء نظام تأديب الموظفين … اعتباراً من تاريخ نفاذ نظام هيئة الرقابة ومكافحة الفساد مع استمرار العمل بحكم المادة (47) منه إلى حين صدور اللائحة الإدارية …».
والنظام بلا مواد في حكيم. ليس في لقطة هيئة الخبراء ولا في أم القرى المخزنة، فالمصدر نظما (قرار المالك 28/10: مصدر معتمد ما لم تخالفه الهيئة أو أم القرى).
يُدخل نص المادة (47) وحدها: نسختها واحدة في نظما بلا تعديل، وهي النافذة.
ولا تُدخل المواد التسع والأربعون الأخرى: ملغاة كلها (أكثرها بنظام الانضباط الوظيفي 1443 ثم الباقي في 1446)،
ونصها في نظما مخلوط بملاحظات التعديل والإلغاء فلا يُنقل بلا قارئ يفصلها.
الكتابة: إضافة فقط (مادة، وتحقق الوحدة «ساري»، وصف المصدر)، وعدد المواد من المواد نفسها (نمط «articleCount = 0» المسموح).

    python3 batches/gap022-discipline-law/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'gap022-discipline-law-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
SID, NAME = 'fix25-1d499fa86360862021ef73aa', 'نظام تأديب الموظفين'
L = json.load(open(D / 'law.json', encoding='utf-8'))
A = next(a for a in L['articles'] if a['n'] == 47)
assert A['content'].startswith('مع مُراعاة أحكام الأنظِمة الخاصة') and A['content'].endswith('إلا عقوبة اللوم أو العزل.')
UQN = 'https://www.uqn.gov.sa/details?p=25316'
REPEAL = ('«سادساً: إلغاء نظام تأديب الموظفين، الصادر بالمرسوم الملكي رقم (م/7) وتاريخ 1 /2/ 1391هـ، اعتباراً من تاريخ نفاذ نظام هيئة الرقابة ومكافحة الفساد '
          'مع استمرار العمل بحكم المادة (47) منه إلى حين صدور اللائحة الإدارية المنصوص عليها في الفقرة (1) من المادة (التاسعة) من النظام والعمل بها.»')


def lit(v):
    if v is None:
        return 'NULL'
    v = str(v)
    assert '$hk$' not in v
    return f'$hk${v}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


AID = 'nz26-' + h('nezams', SID, 'article', '47')
RD = 'المرسوم الملكي رقم (م/7) وتاريخ 1391/2/1هـ'
st = [f"SELECT CASE WHEN (SELECT count(*) FROM legal_systems WHERE id={lit(SID)} AND \"articleCount\"=0)=1"
      f" AND (SELECT count(*) FROM legal_articles WHERE \"legalSystemId\"={lit(SID)})=0 AND (SELECT count(*) FROM legal_articles WHERE id={lit(AID)})=0"
      f" AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)})=0 THEN 'ok' ELSE {FAIL} END AS guard_before",
      f"""INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, chapter, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm)
SELECT {lit(AID)}, s.id, s.name, s.classification, 47, 0, {lit(A['title'])}, {lit(A['content'])}, NULL, {lit(RD)}, NULL, 'سارية', now(), now(),
  uqn_fix.hkm30_search_norm(s.name, {lit(A['title'])}, {lit(A['content'])}, ARRAY[]::text[], s.classification, NULL)
FROM legal_systems s WHERE s.id={lit(SID)}""",
      f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
VALUES ({lit('vfg22-' + h(BY, 'unit', AID))}, 'unit', {lit(AID)}, 'ساري', {lit(RD + ' — باقية بعد إلغاء النظام')}, {lit(UQN)},
  {lit('المادة الباقية في العمل بنص أداة الإلغاء: ' + REPEAL + ' ونص المادة من نظما (' + L['url'] + ')، وهو نسخة واحدة بلا تعديل؛ قرار المالك 28/10: نظما مصدر معتمد ما لم تخالفه الهيئة أو أم القرى')},
  'owner_decision', {lit(BY)}, NULL)""",
      "INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) "
      f"VALUES ({lit('g22p-' + h(BY, AID))}, 'article', {lit(AID)}, {lit(NAME)}, 47, 'nezams', {lit('nezams:427')}, {lit(L['url'])}, {lit(A['sha256'])}, DATE '2026-10-29', 'insert:nezams', NULL)",
      f"UPDATE legal_systems SET \"articleCount\" = (SELECT count(*) FROM legal_articles WHERE \"legalSystemId\" = {lit(SID)} AND \"articleBis\" < 100) WHERE id = {lit(SID)} AND \"articleCount\" = 0",
      f"SELECT CASE WHEN (SELECT count(*) FROM legal_articles WHERE \"legalSystemId\"={lit(SID)} AND coalesce(search_norm,'')<>''"
      f" AND encode(sha256(convert_to(content,'UTF8')),'hex')={lit(A['sha256'])})=1 AND (SELECT \"articleCount\" FROM legal_systems WHERE id={lit(SID)})=1"
      f" AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)})=1 AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g22p-%')=1 THEN 'ok' ELSE {FAIL} END AS guard_after"]
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {'public.legal_articles': 1},
           'report': {'new_articles': 1, 'changed_text': 0, 'article_id': AID}, 'statements': st},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), AID)
