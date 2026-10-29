#!/usr/bin/env python3
"""gap012 (HKM-051، W1c): أنظمة سارية غير موجودة في حكيم ولا في لقطة الهيئة ولا في أم القرى المخزنة، ومصدرها نظما.
قرار المالك 28/10/2026: «اعتبر موقع نظما مصدر رسمي الا اذا خالفاه موقع هيئة الخبراء او جريدة ام القرى».
يُستخرج نص كل مادة من قاعدة نظما (provision_versions.is_latest_known)، وتُفصل منه أسطر العناوين («الفصل…» ثم عنوانه، و«المادة …:»)
إلى حقل الفصل. لا يُغيَّر حرف من المتن غير قص المسافات في أطراف الأسطر وحذف الأسطر الفارغة.

    python3 batches/gap012-nezams-laws/extract.py <nezams.sqlite>
"""
import hashlib, json, re, sqlite3, sys
from pathlib import Path
D = Path(__file__).parent
LAWS = {  # معرّف نظما → الاسم في حكيم، والنوع، والأداة، وتاريخ النفاذ وسنده
 36: dict(name='نظام البيع بالتقسيط', kind='نظام', instr='المرسوم الملكي رقم (م/13) وتاريخ 1426/03/04هـ، وقرار مجلس الوزراء رقم (57) وتاريخ 1426/03/02هـ',
          issued='1426-03-04', published='1426-04-05', eff_base='published', eff_days=120, eff_art=17, eff_must='ويعمل به بعد مائة وعشرين يومًا من تاريخ نشره'),
 381: dict(name='الأمر الملكي رقم (أ/406) وتاريخ 1442/07/27هـ بشأن من يسهل دخول المتسلل للمملكة', kind='أخرى', instr='الأمر الملكي رقم (أ/406) وتاريخ 1442/07/27هـ',
           issued='1442-07-27', published='1442-08-06', eff_base='issued', eff_days=15, eff_art=7, eff_must='بعد (خمسة عشر) يوماً من تاريخه'),
 319: dict(name='الدليل الاسترشادي لاقتراح سن أحكام المخالفة الإدارية وجزائها', kind='دليل', instr='قرار مجلس الوزراء رقم (103) وتاريخ 1443/02/07هـ',
           issued='1443-02-07', published='1443-02-17', eff_base='published', eff_days=30, eff_art=6, eff_must='ويعمل به بعد (ثلاثين) يوماً من تاريخ نشره'),
 77: dict(name='تنظيم المجمع الفقهي في المملكة العربية السعودية', kind='تنظيم', instr='قرار مجلس الوزراء رقم (322) وتاريخ 1433/09/25هـ',
          issued='1433-09-25', published='1433-11-25', eff_base='published', eff_days=31, eff_art=21, eff_must='ويعمل به في اليوم التالي لليوم الثلاثين من تاريخ نشره'),
 127: dict(name='تنظيم مركز المصالحة', kind='تنظيم', instr='قرار مجلس الوزراء رقم (103) وتاريخ 1434/04/08هـ',
           issued='1434-04-08', published='1434-06-02', eff_base='published', eff_days=90, eff_art=10, eff_must='يعمل بهذا التنظيم بعد مضي (تسعين) يوماً من تاريخ نشره'),
 370: dict(name='قواعد التوزيع الداخلي للدعاوى', kind='قواعد', instr='قرار المجلس الأعلى للقضاء رقم (39/6/221) وتاريخ 1439/04/21هـ',
           issued='1439-04-21', published=None, eff_base=None, eff_days=None, eff_art=None, eff_must=None),
 236: dict(name='لائحة الوثائق القضائية', kind='لائحة', instr='قرار وزير العدل رقم (2818) وتاريخ 1439/07/26هـ',
           issued='1439-07-26', published=None, eff_base='issued', eff_days=180, eff_art=23, eff_must='يعمل بهذه اللائحة بعد (180) يوماً من تاريخ صدورها'),
}
HEAD = re.compile(r'^(الفصل|الباب|القسم)\s+\S+(?:\s+\S+){0,3}\s*:?\s*$')
db = sqlite3.connect(sys.argv[1])
out = {}
for lid, meta in LAWS.items():
    url, nm = db.execute('SELECT source_url, official_name FROM laws WHERE law_id=?', (lid,)).fetchone()
    rows = db.execute('SELECT p.ordinal, p.number, v.title, v.text FROM provisions p JOIN provision_versions v ON v.provision_id=p.provision_id AND v.is_latest_known=1 '
                      'WHERE p.law_id=? ORDER BY p.ordinal', (lid,)).fetchall()
    arts, chapter = [], None
    for ordn, num, title, text in rows:
        lines = [l.strip() for l in (text or '').split('\n')]
        lines = [l for l in lines if l]
        # رأس المادة: «الفصل …» ثم عنوانه ثم «المادة …:» (لائحة الوثائق القضائية)
        if lines and HEAD.match(lines[0]):
            h, rest = lines[0].rstrip(':').strip(), lines[1:]
            if rest and not rest[0].startswith('المادة'):
                h, rest = f'{h}: {rest[0]}', rest[1:]
            chapter, lines = h, rest
        if lines and re.match(r'^المادة\s+[^:]{2,40}:\s*$', lines[0]):
            lines = lines[1:]
        content = '\n'.join(lines)
        assert content and not content.startswith('المادة'), (lid, ordn)
        arts.append({'n': num, 'title': title, 'chapter': chapter, 'content': content, 'sha256': hashlib.sha256(content.encode()).hexdigest()})
    assert [a['n'] for a in arts] == list(range(1, len(arts) + 1)), lid
    if meta['eff_art']:
        assert meta['eff_must'] in arts[meta['eff_art'] - 1]['content'], (lid, arts[meta['eff_art'] - 1]['content'])
    out[lid] = dict(meta, nezams_id=lid, nezams_name=nm, url=url, articles=arts)
    print(lid, meta['name'], len(arts), sorted({a['chapter'] for a in arts if a['chapter']}))
(D / 'laws.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
