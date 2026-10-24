#!/usr/bin/env python3
"""HKM-045 (دفعة hkm045c): حدود الوحدات للأنظمة الفارغة من نص أم القرى المخزن (uqn_stage.unit).

يقرأ نسخة من أجسام الوحدات (مخرج SELECT من الإنتاج، تُمرَّر مسارًا) ويكتب segments.json: لكل نظام بصمة الجسم
وحدود كل وحدة (إزاحات بالحروف)، بلا أي نص قانوني. الحقن يقطع النص داخل القاعدة بـ substr من الجسم نفسه
بعد التحقق من بصمته.
- وثيقة بعناوين «المادة (N)» أو «المادة الأولى…» متتابعة: مادة لكل عنوان، والنص قبل أول عنوان ديباجة (المادة 1، articleBis 100؛ القيد يمنع الرقم 0).
- غير ذلك (سياسات، أدلة، جداول): وحدة واحدة «البند 1» بالجسم كله.
يُستبعد سطر التاريخ في أول الجسم وتذييل الموقع في آخره («تنزيل الملف»، «جميع الحقوق محفوظة لجريدة أم القرى»)،
وتُحذف علامات التغليظ ** كما في المستورد سابقًا من أم القرى.
المشمول: حكم source_units مكتمل (complete) من result.jsonl بمصدر أم القرى؛ وما سواه خارج الدفعة.

    python3 -I data/review/hkm045c-empty-systems-2026-10-24/segment.py <uqn_bodies.json>
"""
import hashlib, json, re, sys
from pathlib import Path

D = Path(__file__).parent
ORD = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة']
HEAD = re.compile(r'(?m)^[ \t]*(?:\*\*)?[ \t]*المادة[ \t]*(?:\(([^)\n]{1,40})\)|((?:ال[^\s:()\n]+)(?:[ \t]+(?:و?ال[^\s:()\n]+|عشرة|عشر))*))(?:[ \t]*\((\d{1,3})\))?[ \t]*:?[ \t]*(?:\*\*)?')
FOOT = re.compile(r'(?:\s*(?:تنزيل الملف|تم نسخ الرابط))*\s*جميع الحقوق محفوظة لجريدة أم القرى © \d{4}\s*$')
DATE = re.compile(r'^\s*\d{4}-\d{1,2}-\d{1,2}\s*\n\s*الموافق\s*\n\s*\d{1,2}-\d{1,2}-\d{4}\s*')


def num_of(m, k):
    inner, word, digits = m.group(1), m.group(2), m.group(3)
    for x in (digits, inner):
        if x and x.strip().isdigit():
            return int(x.strip())
    w = (inner or word or '').strip()
    # التحقق من الترتيب بالكلمة: آحاد العدد المؤنث في أوله (الأولى/الحادية … العاشرة)
    unit = k % 10
    first = w.split()[0] if w else ''
    if k <= 10:
        return k if first == ORD[k - 1] else None
    if unit == 1:
        return k if first in ('الحادية', 'الحادي') else None
    if unit == 0:
        return k if first in ('العشرون', 'الثلاثون', 'الأربعون') else None
    return k if first.startswith(ORD[unit - 1][:-1]) else None


def segment(body):
    f = FOOT.search(body)
    stop = f.start() if f else len(body)
    d = DATE.match(body)
    begin = d.end() if d else 0
    hs = [m for m in HEAD.finditer(body) if begin <= m.start() < stop]
    nums = [num_of(m, i + 1) for i, m in enumerate(hs)]
    if len(hs) >= 2 and nums == list(range(1, len(hs) + 1)):
        segs = []
        if body[begin:hs[0].start()].strip():
            segs.append({'n': 1, 'bis': 100, 'title': 'الديباجة', 'start': begin, 'end': hs[0].start()})
        for i, m in enumerate(hs):
            end = hs[i + 1].start() if i + 1 < len(hs) else stop
            segs.append({'n': i + 1, 'bis': 0, 'title': f'المادة {i + 1}', 'start': m.end(), 'end': end})
        return 'articles', segs
    return 'single', [{'n': 1, 'bis': 0, 'title': 'البند 1', 'start': begin, 'end': stop}]


def clean(t):
    # كما يقطعه الحقن داخل القاعدة: btrim(replace(substr(...), '**', ''), E' \\n\\t\\r')
    return t.replace('**', '').strip(' \n\t\r')


def main(path):
    bodies = {b['system_id']: b for b in json.loads(Path(path).read_text(encoding='utf-8'))}
    res = [json.loads(l) for l in (D / 'result.jsonl').read_text(encoding='utf-8').splitlines() if l.strip()]
    out, skipped = [], []
    for r in res:
        b = bodies.get(r['system_id'])
        take = r['verdict'] == 'source_units' and r.get('complete') in (True, 'True') and str(r.get('source', '')).startswith('uqn:') and b
        if not take:
            skipped.append({'system_id': r['system_id'], 'name': r['name'], 'verdict': r['verdict'], 'complete': r.get('complete'), 'source': r.get('source')})
            continue
        body = b['body']
        assert hashlib.md5(body.encode()).hexdigest() == b['md5'], r['system_id']
        kind, segs = segment(body)
        segs = [s for s in segs if clean(body[s['start']:s['end']])]
        out.append({'system_id': r['system_id'], 'name': r['name'], 'source_id': b['source_id'], 'batch_id': b['batch_id'], 'seq': b['seq'],
                    'source_url': b['source_url'], 'md5': b['md5'], 'text_sha': b['text_sha'], 'kind': kind, 'segments': segs,
                    'seg_md5': [hashlib.md5(clean(body[s['start']:s['end']]).encode()).hexdigest() for s in segs]})
    (D / 'segments.json').write_text(json.dumps({'systems': out, 'skipped': skipped}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(out), sum(len(x['segments']) for x in out), {k: sum(1 for x in out if x['kind'] == k) for k in ('articles', 'single')}, len(skipped))


if __name__ == '__main__':
    main(sys.argv[1])
