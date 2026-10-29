#!/usr/bin/env python3
"""gap022 (HKM-052): نص مواد نظام تأديب الموظفين (م/7 لعام 1391هـ) من قاعدة نظما (provision_versions.is_latest_known)، بطريقة gap012 نفسها:
تُفصل أسطر العناوين إلى حقل الفصل، ولا يُغيَّر حرف من المتن غير قص المسافات في أطراف الأسطر وحذف الأسطر الفارغة.

    python3 batches/gap022-discipline-law/extract.py <nezams.sqlite>
"""
import hashlib, json, re, sqlite3, sys
from pathlib import Path
D = Path(__file__).parent
HEAD = re.compile(r'^(الفصل|الباب|القسم)\s+\S+(?:\s+\S+){0,3}\s*:?\s*$')
db = sqlite3.connect(sys.argv[1])
LID = 427
url, nm = db.execute('SELECT source_url, official_name FROM laws WHERE law_id=?', (LID,)).fetchone()
rows = db.execute('SELECT p.ordinal, p.number, v.title, v.text FROM provisions p JOIN provision_versions v ON v.provision_id=p.provision_id AND v.is_latest_known=1 '
                  'WHERE p.law_id=? ORDER BY p.ordinal', (LID,)).fetchall()
arts, chapter = [], None
for ordn, num, title, text in rows:
    lines = [l.strip() for l in (text or '').split('\n')]
    lines = [l for l in lines if l]
    if lines and HEAD.match(lines[0]):
        h, rest = lines[0].rstrip(':').strip(), lines[1:]
        if rest and not rest[0].startswith('المادة'):
            h, rest = f'{h}: {rest[0]}', rest[1:]
        chapter, lines = h, rest
    if lines and re.match(r'^المادة\s+[^:]{2,40}:\s*$', lines[0]):
        lines = lines[1:]
    content = '\n'.join(lines)
    assert content and not content.startswith('المادة'), ordn
    arts.append({'n': num, 'title': title, 'chapter': chapter, 'content': content, 'sha256': hashlib.sha256(content.encode()).hexdigest()})
assert [a['n'] for a in arts] == list(range(1, 51)), [a['n'] for a in arts]
(D / 'law.json').write_text(json.dumps(dict(nezams_id=LID, nezams_name=nm, url=url, articles=arts), ensure_ascii=False, indent=1), encoding='utf-8')
print(nm, url, len(arts), sorted({a['chapter'] for a in arts if a['chapter']}))
