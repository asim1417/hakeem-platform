#!/usr/bin/env python3
"""حزم القراءة لصنف U3 من ناتج sql/u3_packets.sql، مع فرز أولي (لا حكم): يحدد ما يحتاج القارئ أن يتحقق منه أولًا.

  python3 readers/make_packets.py --raw <ناتج u3_packets.sql> --ledger out/ledger.jsonl --out out/u3_packets.jsonl

الفرز الأولي (triage) إرشاد للقارئ فقط، ولا يبني عليه أي مولّد:
  wrong_unit_suspect  الملاحظة تبدأ بعنوان مادة برقم غير رقم المادة المُسندة إليها
  regulation_suspect  الملاحظة تخص اللائحة لا النظام
  new_article         إضافة مادة مكررة أو جديدة (لا تعدّل هذه المادة)
  deletion            حذف/إلغاء المادة نفسها
  full_replacement    «لتكون بالنص الآتي» على المادة كلها
  partial             تعديل فقرة أو عبارة
"""
import argparse, json, pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / 'scripts'))
from arabic import norm, ordinal  # noqa: E402


def triage(p):
    lines = [norm(x) for x in (p.get('note_text') or '').split('\n')]
    first = next((x for x in lines if x.strip(' •-–')), '')
    t = ' '.join(lines)
    head = re.fullmatch(r'[\s•\-–]*الماده\s+([^:،.]{3,60}?)\s*:?', first)
    if head:
        n = ordinal(head.group(1))
        if n and n != p['article_number']:
            return 'wrong_unit_suspect', f'عنوان الملاحظة «المادة {head.group(1)}» = {n}'
    nt = norm(p.get('note_new_text') or '')
    if nt and len(nt) > 20 and nt in norm(p.get('boe_body') or ''):
        return 'reflected_suspect', 'النص الجديد في الملاحظة موجود في نص الهيئة'
    if re.search(r'من (هذه )?اللايحه', t) and 'لايحه' not in norm(p.get('law') or ''):
        return 'regulation_suspect', 'الملاحظة تذكر اللائحة'
    if re.search(r'اضافه ماده|اضافه مواد|مكررا?\)|مكرر', t) and not re.search(r'عدلت هذه الماده', t):
        return 'new_article', 'إضافة مادة'
    if re.search(r'(حذفت|الغيت|ألغيت|تلغي|تلغى) هذه الماده', t) and not re.search(r'بالنص الاتي', t):
        return 'deletion', 'حذف المادة'
    if re.search(r'عدلت هذه الماده|تعديل هذه الماده', t) and re.search(r'بالنص الاتي', t) and not re.search(r'الفقره|البند|عباره', t.split('بالنص الاتي')[0]):
        return 'full_replacement', 'إحلال المادة كلها'
    return 'partial', 'تعديل جزئي أو غير محدد'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', required=True)
    ap.add_argument('--ledger', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    raw = json.loads(open(a.raw, encoding='utf-8').read())
    packets = raw[0]['packets'] if isinstance(raw, list) else raw['packets']
    led = {}
    for line in open(a.ledger, encoding='utf-8'):
        it = json.loads(line)
        if it['gap'] == 'U3':
            led[(it['detail'] or {}).get('note')] = it
    out, counts = [], {}
    for p in packets:
        it = led.get(p['note_id'])
        if not it or it['status'] != 'open':
            continue
        code, why = triage(p)
        counts[code] = counts.get(code, 0) + 1
        out.append(dict(item=it['id'], prio=it['prio'], triage=code, triage_reason=why, **p))
    out.sort(key=lambda x: (x['prio'], x['law'], x['article_number']))
    with open(a.out, 'w', encoding='utf-8') as f:
        for p in out:
            f.write(json.dumps(p, ensure_ascii=False) + '\n')
    print(len(out), counts)


if __name__ == '__main__':
    main()
