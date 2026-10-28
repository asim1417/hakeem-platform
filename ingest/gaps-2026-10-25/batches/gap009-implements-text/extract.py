#!/usr/bin/env python3
"""gap009 (HKM-051، الصنف L1): استخراج النظام الأم للائحة من نصها المخزن في حكيم — فرز لا حكم.

المدخل: out/l1_packets_<date>.json (ناتج packets.sql) وout/systems_<date>.json.
لكل لائحة: كل نظام أو تنظيم في حكيم يرد اسمه في اسم اللائحة أو ديباجتها أو موادها، مع سياقه:
  def     في مادة التعريفات: «النظام: نظام …» أو «التنظيم: تنظيم …»
  name    في اسم اللائحة: «اللائحة التنفيذية لنظام …»
  enable  في عبارة سند: «بناءً على/استنادًا إلى/تنفيذًا لـ … المادة … من نظام …»
  mention ذكر مجرد
الفئة A: سند واحد من نص اللائحة نفسها (def أو name) لنظام واحد غير ملغى، ولا سند آخر ينازعه.
ما عدا ذلك يُحال إلى القارئين بحزمة مختصرة.

  python3 batches/gap009-implements-text/extract.py --packets out/l1_packets_2026-10-28.json --systems out/systems_2026-10-28.json
"""
import argparse, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'scripts'))
from arabic import norm, law_key  # noqa: E402

PARENT_KINDS = {'نظام', 'تنظيم', 'أخرى', 'ترتيبات تنظيمية'}
PROCLITICS = {'', 'ل', 'ب', 'و', 'ف', 'ك', 'ول', 'وب', 'فل', 'فب'}
DEAD = {'مستبدل', 'ملغى', 'ملغاة', 'سجل مخلوط — لا يُعرض'}
ENABLE = re.compile(r'(بناء علي|استنادا الي|استنادا ل|تنفيذا ل|وفقا ل|عملا ب|طبقا ل|بموجب|المخوله|نصت عليه|قضت به)')
REF = re.compile(r'(الماده|المادتين|المواد|الفقره|البند)[^.؛]{0,90}\sمن\s*$')


def aliases(name):
    """مفتاح الاسم، وصيغه المتداولة في نصوص اللوائح: بلا «(قانون)»، وبلا وصف «بالمملكة العربية السعودية»
    أو «لدول مجلس التعاون…»، ولتنظيم الجهة باسمها الآخر بين القوسين."""
    out = [(law_key(name), False)]
    n = norm(name)
    m = re.match(r'^(نظام|تنظيم)\s+(.*?)\s*\(([^()]+)\)\s*(.*)$', n)
    if m:
        inner = m.group(3).strip()
        if inner == 'قانون':
            out.append((law_key(f'{m.group(1)} {m.group(2)} {m.group(4)}'), True))
        else:
            out.append((law_key(f'{m.group(1)} {m.group(2)} {m.group(4)}'), True))
            out.append((law_key(f'{m.group(1)} {inner}'), True))
    for k, _ in list(out):
        for suf in (' بالمملكه العربيه السعوديه', ' في المملكه العربيه السعوديه', ' لدول مجلس التعاون لدول الخليج العربيه', ' السعودي'):
            if k.endswith(suf) and len(k[:-len(suf)].split()) >= 3:
                out.append((k[:-len(suf)], True))
    return out


def word_find(key, text):
    out, i = [], 0
    while True:
        j = text.find(key, i)
        if j < 0:
            return out
        b = text[j + len(key)] if j + len(key) < len(text) else ' '
        tok = re.split(r'[^ء-ي]', text[max(0, j - 3):j])[-1]  # سابقة ملتصقة: لنظام، بنظام، ولنظام
        if tok in PROCLITICS and not ('ء' <= b <= 'ي'):
            out.append(j)
        i = j + 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--packets', required=True)
    ap.add_argument('--systems', required=True)
    ap.add_argument('--phrases', help='عبارات «نظام/تنظيم …» من كل المواد (phrases.sql)')
    ap.add_argument('--out', default=str(HERE / 'extract.jsonl'))
    a = ap.parse_args()
    packets = json.load(open(a.packets, encoding='utf-8'))
    phrases = json.load(open(a.phrases, encoding='utf-8')) if a.phrases else {}
    systems = json.load(open(a.systems, encoding='utf-8'))
    parents = {}
    for sid, name, _inst, status, kind, *_ in systems:
        if kind not in PARENT_KINDS:
            continue
        rec = {'id': sid, 'name': name, 'status': status or '', 'kind': kind}
        for k, alias in aliases(name):
            if len(k.split()) >= 2:
                lst = parents.setdefault(k, [])
                if all(m['id'] != sid for m in lst):
                    lst.append(dict(rec, alias=alias))
    keys = sorted(parents, key=len, reverse=True)
    rows, counts = [], {}
    for p in packets:
        segs = [('name', None, norm(p['name']))]
        if p.get('preamble'):
            segs.append(('preamble', None, norm(p['preamble'])))
        for art in p.get('arts') or []:
            segs.append(('art', art, norm(art['t'])))
        seen_aids = {art['id'] for art in p.get('arts') or []}
        for n, aid, ph in phrases.get(p['id']) or []:
            if aid not in seen_aids:
                segs.append(('phrase', {'n': n, 'id': aid, 'bis': 0}, norm(ph)))
        found = {}
        for where, art, text in segs:
            taken = []
            for k in keys:
                for j in word_find(k, text):
                    if any(s <= j < e or s < j + len(k) <= e for s, e in taken):
                        continue
                    taken.append((j, j + len(k)))
                    before = text[max(0, j - 160):j]
                    if where == 'name':
                        sig = 'name'
                    elif where == 'art' and art['n'] <= 3 and not art['bis'] and re.search(r'(النظام|التنظيم)\s*[:：\-–]\s*$', before[-25:]):
                        rest = re.split(r'[،.؛\n(]|\sالصادر|\sولايحته|\sولوايحه', text[j + len(k):])[0].strip()
                        sig = 'def' if rest in ('', 'السعودي', 'بالمملكه العربيه السعوديه', 'في المملكه العربيه السعوديه') else 'def_longer'
                    elif ENABLE.search(before[-140:]) or REF.search(before):
                        sig = 'enable'
                    else:
                        sig = 'mention'
                    f = found.setdefault(k, {'key': k, 'matches': parents[k], 'signals': {}})
                    f['signals'].setdefault(sig, []).append({'where': where, 'article_id': art and art['id'], 'n': art and art['n'],
                                                            'ctx': text[max(0, j - 120):j + len(k) + 40]})
        cands = list(found.values())
        strong = [c for c in cands if {'def', 'name'} & set(c['signals'])]
        live = lambda c: [m for m in c['matches'] if m['status'] not in DEAD]
        cat, why = 'B', ''
        if len(strong) == 1 and len(strong[0]['matches']) == 1 and strong[0]['matches'][0]['status'] == 'ساري' \
                and not strong[0]['matches'][0].get('alias') and not strong[0]['signals'].get('def_longer') \
                and not re.search(r'\sو(نظام|تنظيم)\s', norm(p['name'])):
            c = strong[0]
            others_enable = [o for o in cands if o is not c and 'enable' in o['signals']]
            cat, why = ('A', 'def' if 'def' in c['signals'] else 'name') if not others_enable else ('B', 'سند آخر في الديباجة')
        elif len(strong) == 1 and len(strong[0]['matches']) == 1:
            why = 'النظام الأم ملغى أو مستبدل في حكيم'
        elif len(strong) == 1:
            why = 'اسم النظام الأم مكرر في حكيم'
        elif len(strong) > 1:
            why = 'أكثر من سند في نص اللائحة'
        elif strong:
            why = 'سند بصيغة مختلفة عن اسم حكيم أو أكثر من نظام'
        elif cands:
            why = 'لا تعريف ولا اسم؛ ذكر في الديباجة أو المواد'
        else:
            cat, why = 'C', 'لا يسمّي نص اللائحة نظامًا في حكيم'
        counts[(cat, why)] = counts.get((cat, why), 0) + 1
        rows.append({'id': p['id'], 'name': p['name'], 'kind': p['kind'], 'cat': cat, 'why': why,
                     'parent': (strong[0]['matches'][0] if cat == 'A' else None), 'basis': (why if cat == 'A' else None),
                     'candidates': cands, 'uqn': p.get('uqn'), 'boe': p.get('boe'), 'art_count': p.get('art_count')})
    with open(a.out, 'w', encoding='utf-8') as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + '\n')
    for k, v in sorted(counts.items(), key=lambda x: -x[1]):
        print(v, *k)


if __name__ == '__main__':
    main()
