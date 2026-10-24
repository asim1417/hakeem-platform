#!/usr/bin/env python3
"""HKM-045 (دفعة hkm045d): إزالة تذييل موقع أم القرى الملتصق بآخر مادة في 440 نظامًا.

كُشف أثناء البند 7: استيراد أم القرى السابق (25/9/2026) أبقى سطر الموقع «جميع الحقوق محفوظة لجريدة أم القرى © 2026»
(ومعه أحيانًا «تنزيل الملف» أو «تم نسخ الرابط») في آخر مادة من كل وثيقة. ليس نصًا قانونيًا.
- 439 مادة: تُزال العبارة من آخرها بالعبارة الثابتة UQN_FOOTER_STRIP في scripts/apply-statements.py، ويُعاد search_norm.
  المجموعة قبلها وبعدها مثبتة ببصمتين (id:md5(content)) حُسبتا من الإنتاج قراءةً.
- مادة واحدة نصها التذييل وحده («المادة 7» في قواعد عدم خضوع الجمعيات … لجباية الزكاة): تُعلَّم صفًا ليس مادة (articleBis 100)
  ولا يُغيَّر نصها؛ وعدد مواد النظام (7) يبقى كما هو لأن نمط تعبئة العدد لا يستبدل عددًا قائمًا.
لا مادة منها لها نسخة في unit_version (فحص 24/10/2026).

    python3 data/review/hkm045d-uqn-footer-2026-10-24/build.py
"""
import hashlib, importlib.util, json
from pathlib import Path

D = Path(__file__).parent
ROOT = D.parents[2]
BY = 'hkm045d-uqn-footer-2026-10-24'
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"
N = 439
BEFORE_FP = 'a21ead3305f8e531adffba7ded0eca2f'
AFTER_FP = '28479db771a8b4c4649fb15d64879782'
ONLY_FOOTER = '620814fc813847f095ee65af6c66be8e'

spec = importlib.util.spec_from_file_location('apply_statements', ROOT / 'scripts' / 'apply-statements.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
RE, STRIP = mod.UQN_FOOTER_RE, mod.UQN_FOOTER_STRIP


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def build():
    sel = (f"FROM legal_articles a WHERE a.content ~ {lit(RE)} AND btrim(regexp_replace(a.content, {lit(RE)}, '')) <> '' AND a.\"articleBis\" < 100")
    fp_now = f"(SELECT md5(string_agg(a.id || ':' || md5(a.content), ',' ORDER BY a.id)) {sel})"
    fp_new = f"(SELECT md5(string_agg(a.id || ':' || md5(regexp_replace(a.content, {lit(RE)}, '')), ',' ORDER BY a.id)) {sel})"
    st = [f"SELECT CASE WHEN (SELECT count(*) {sel}) = {N} AND {fp_now} = {lit(BEFORE_FP)} AND {fp_new} = {lit(AFTER_FP)} "
          f"AND (SELECT count(*) FROM legal_articles WHERE id = {lit(ONLY_FOOTER)} AND \"articleBis\" = 0 AND btrim(regexp_replace(content, {lit(RE)}, '')) = '') = 1 "
          f"THEN 'ok' ELSE {GUARD_FAIL} END AS guard_before",
          STRIP,
          f'UPDATE legal_articles SET "articleBis" = 100, "updatedAt" = now() WHERE id = {lit(ONLY_FOOTER)} AND content = $hk$جميع الحقوق محفوظة لجريدة أم القرى © 2026$hk$ AND "articleBis" = 0']
    st.append(f"SELECT CASE WHEN (SELECT count(*) FROM legal_articles WHERE content ~ {lit(RE)} AND \"articleBis\" < 100) = 0 "
              f"AND (SELECT count(*) FROM legal_articles WHERE content LIKE '%جميع الحقوق محفوظة لجريدة أم القرى%' AND \"articleBis\" < 100) = 0 "
              f"AND (SELECT count(*) FROM legal_articles WHERE id = {lit(ONLY_FOOTER)} AND \"articleBis\" = 100) = 1 THEN 'ok' ELSE {GUARD_FAIL} END AS guard_after")
    md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
    (D / 'statements.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(st), 'report': {'stripped': N, 'footer_only_marked': 1},
                                                   'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(st), md5)


if __name__ == '__main__':
    build()
