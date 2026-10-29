#!/usr/bin/env python3
"""gap009: حزم القراءة لصنف L1 من extract.jsonl، بمقتطفات من النص الأصلي كما في حكيم (لا المطبّع) ليقتبس منها القارئ حرفيًا.

  python3 batches/gap009-implements-text/make_packets.py --packets out/l1_packets_2026-10-28.json \
      --phrases out/l1_phrases_2026-10-28.json --nezams <nezams.sqlite> --parts 2
"""
import argparse, json, pathlib, re, sqlite3, sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'scripts'))
from arabic import norm, law_key, _HARAKAT  # noqa: E402

_H = _HARAKAT
_MAP = {'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي'}


def norm_map(s):
    """مثل norm مع خريطة: موضع كل حرف مطبّع في الأصل."""
    out, idx, prev_sp = [], [], True
    for i, ch in enumerate(s or ''):
        if _H.match(ch):
            continue
        ch = ch.translate(str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789'))
        ch = _MAP.get(ch, ch)
        if ch.isspace():
            if prev_sp:
                continue
            ch, prev_sp = ' ', True
        else:
            prev_sp = False
        out.append(ch); idx.append(i)
    while out and out[-1] == ' ':
        out.pop(); idx.pop()
    return ''.join(out), idx


def orig_window(orig, key, before=220, after=160):
    n, idx = norm_map(orig)
    j = n.find(key)
    if j < 0:
        return None
    s = idx[max(0, j - before)] if j - before > 0 else 0
    e = idx[min(len(idx) - 1, j + len(key) + after)] + 1
    return orig[s:e]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--packets', required=True)
    ap.add_argument('--phrases', required=True)
    ap.add_argument('--extract', default=str(HERE / 'extract.jsonl'))
    ap.add_argument('--nezams')
    ap.add_argument('--parts', type=int, default=2)
    a = ap.parse_args()
    P = {p['id']: p for p in json.load(open(a.packets, encoding='utf-8'))}
    PH = json.load(open(a.phrases, encoding='utf-8'))
    nz = {}
    if a.nezams:
        db = sqlite3.connect(a.nezams)
        for f, t, src in db.execute("SELECT f.official_name, t.official_name, r.source_code FROM law_relations r JOIN laws f ON f.law_id=r.from_law_id "
                                    "JOIN laws t ON t.law_id=r.to_law_id WHERE r.relation_code='implements'"):
            nz[law_key(f)] = {'parent_name': t, 'basis': src}
    rows = [json.loads(l) for l in open(a.extract, encoding='utf-8')]
    rows.sort(key=lambda r: ({'A': 0, 'B': 1, 'C': 2}[r['cat']], r['name']))
    out = []
    for i, r in enumerate(rows, 1):
        p = P[r['id']]
        arts = {x['id']: x for x in p.get('arts') or []}
        defs = next((x for x in p.get('arts') or [] if x['n'] == 1 and not x['bis']), None)
        cands = []
        rank = {'def': 0, 'name': 1, 'def_longer': 2, 'enable': 3, 'mention': 4}
        ordered = sorted(r['candidates'], key=lambda c: min(rank[k] for k in c['signals']))[:6]
        for c in ordered:
            snippets, seen = [], set()
            best = min(rank[k] for k in c['signals'])
            for sig, lst in sorted(c['signals'].items(), key=lambda kv: rank[kv[0]]):
                if sig == 'mention' and best < 4:
                    continue
                for s in lst[:2]:
                    if s['where'] == 'name':
                        src, txt = 'name', p['name']
                    elif s['where'] == 'preamble':
                        src, txt = 'preamble', p.get('preamble') or ''
                    elif s['article_id'] in arts:
                        src, txt = f"article {s['n']} ({s['article_id']})", arts[s['article_id']]['t']
                    else:
                        ph = next((x for x in PH.get(p['id']) or [] if x[1] == s['article_id']), None)
                        src, txt = f"article {s['n']} ({s['article_id']}) — مقتطف", ph[2] if ph else ''
                    w = orig_window(txt, c['key'], 170, 120) if src != 'name' else txt
                    if w in seen:
                        continue
                    seen.add(w)
                    snippets.append({'signal': sig, 'source': src, 'text': w})
            cands.append({'hakeem_matches': [{k: m[k] for k in ('id', 'name', 'status', 'kind')} for m in c['matches']],
                          'name_variant': any(m.get('alias') for m in c['matches']), 'snippets': snippets})
        item = {'item': f'L1-{i:03d}', 'system_id': r['id'], 'name': p['name'], 'kind': p['kind'], 'articles': r['art_count'],
                'triage': {'cat': r['cat'], 'why': r['why'], 'proposed_parent': r['parent'] and {k: r['parent'][k] for k in ('id', 'name')}},
                'uqn': [u['url'] for u in p.get('uqn') or []], 'boe': [b['url'] for b in p.get('boe') or []],
                'nezams_hint': nz.get(law_key(p['name'])),
                'preamble_head': (p.get('preamble') or '')[:600],
                'article_1': defs and defs['t'][:700],
                'candidates': cands}
        if r['cat'] == 'C':
            item['law_like_phrases'] = sorted({x[2].strip()[:110] for x in PH.get(p['id']) or [] if re.search(r'(نظام|تنظيم)\s', x[2])})[:12]
        out.append(item)
    for k in range(a.parts):
        part = out[k::a.parts]
        with open(HERE / f'packets_part{k + 1}.jsonl', 'w', encoding='utf-8') as fh:
            for it in part:
                fh.write(json.dumps(it, ensure_ascii=False) + '\n')
        print(f'part{k + 1}', len(part), sum(len(json.dumps(x, ensure_ascii=False)) for x in part))


if __name__ == '__main__':
    main()
