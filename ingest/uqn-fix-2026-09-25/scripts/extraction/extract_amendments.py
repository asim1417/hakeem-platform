"""
استخراج عمليات التعديل من نصوص أدوات أم القرى إلى عمليات مهيكلة قابلة للتطبيق كنسخ جديدة للمواد.
الناتج: data/amendment_operations.jsonl (كل عملية بدليلها) + data/amendment_manual_queue.jsonl (ما لم يُستخرج بثقة).
لا يطبّق شيئًا على أي نص؛ التطبيق يتم لاحقًا بإضافة نسخ في unit_version.
"""
import json, re, sys, csv, collections, datetime, warnings
warnings.filterwarnings('ignore')
sys.path.insert(0, '/home/claude/rasd_anzima')
from parse_articles import ordnum as _ord
from normlib import norm
from hijri_converter import Hijri, Gregorian

D = '/home/claude/pkg/hakeem-uqn-ingest/data/'
E = [json.loads(l) for l in open(D + 'legal_effects.jsonl', encoding='utf-8')]
REAL = ('amend', 'insert', 'delete', 'repeal', 'replace')
FULL = json.load(open('/home/claude/fixpack/raw/effect_fulltexts.json', encoding='utf-8'))
def prep(t):
    t = re.sub(r'"([^"\n]{1,4000}?)"', r'“\1”', t)          # علامات التنصيص الإنجليزية
    return t
def full_operative(e):
    """النص في الحزمة مقطوع عند 500 حرف؛ يُستبدل بالنص الكامل من الصفحة المحفوظة ابتداءً من موضعه"""
    t = e['operative_text']; F = FULL.get(e['source_url'])
    if not F: return t, False
    key = re.sub(r'\s+', ' ', t.strip())[:60]
    Fn = re.sub(r'[ \t]+', ' ', F)
    i = Fn.find(key[:40])
    if i < 0: return t, False
    body = Fn[i:]
    j = body.find('جميع الحقوق محفوظة'); body = body[:j] if j > 0 else body
    return body, True

AR_DIG = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
def ordnum(s):
    s = re.sub(r'[ً-ْ]', '', s or '').strip().translate(AR_DIG)
    if s.isdigit(): return int(s)
    s = re.sub(r'\sعشر$', ' عشرة', s)
    s = re.sub(r'(العشر|الثلاث|الأربع|الخمس|الست|السبع|الثمان|التسع)ين\b', r'\1ون', s)
    s = re.sub(r'المائتين', 'المائتين', s)
    s = re.sub(r'^ال?حادي(?=\s)', 'الحادية', s)
    return _ord(s)

# خريطة حكيم المرجعية: الاسم ← الرمز
REF = {}
for r in csv.DictReader(open(D + 'hakeem_reference_list_500.csv', encoding='utf-8')):
    REF[norm(r['اسم النظام / الأداة'])] = (r['الرمز'], r['اسم النظام / الأداة'], r.get('عدد المواد'))
UQN = {norm(json.loads(l)['title']): json.loads(l)['title'] for l in open(D + 'laws.jsonl', encoding='utf-8')}
def clean_law(t):
    t = t or ''
    if 'الاطلاع على' in t: t = t.split('الاطلاع على')[-1]
    return t.strip(' .،,-–')
def resolve(title):
    title = clean_law(title)
    n = norm(title or '')
    if not n: return None, None
    if n in REF: return REF[n][0], REF[n][1]
    if n in UQN: return 'uqn', UQN[n]
    # أطول تطابق بادئة
    best = max(((k, v) for k, v in REF.items() if n.startswith(k) or k.startswith(n)), key=lambda kv: len(kv[0]), default=None)
    if best and len(best[0]) >= 12: return best[1][0], best[1][1]
    return None, None

Q = r'[«“"]'; QE = r'[»”"]'
QUOTE = re.compile(r'[«“]((?:[^«»“”]|«[^»]*»)*)[»”]', re.S)
def _tat(w): return 'ـ*'.join(w)
_ORDW = '|'.join(_tat(w) for w in 'أولاً|أولًا|ثانياً|ثانيًا|ثالثاً|ثالثًا|رابعاً|رابعًا|خامساً|خامسًا|سادساً|سادسًا|سابعاً|سابعًا|ثامناً|ثامنًا|تاسعاً|تاسعًا|عاشراً|عاشرًا'.split('|')) + '|' + '|'.join(_tat(a)+r'\s+'+_tat('عشر') for a in ['حادي','ثاني','ثالث','رابع','خامس','سادس','سابع','ثامن','تاسع']) + '|' + _tat('العشرون')
ORD_ITEM = re.compile(r'(?:^|\n|(?<=[:.]))\s*(' + _ORDW + r')\s*[:：-]')
NUM_ITEM = re.compile(r'(?:^|\n)\s*(\d{1,2})\s*[-–)]\s+')
LAW_NAME = re.compile(r'((?:النظام الأساس(?:ي)?|النظام (?!المشار|الصادر|المرافق|المعدل|الآتي)|نظام|تنظيم|الترتيبات التنظيمية|اللائحة التنفيذية|اللوائح التنفيذية|لائحة|قواعد)\s[^،,\n(]{3,140}?)\s*[،,]?\s*(?:-|–)?\s*(?:الصادر|الصادرة|الموافق عليه|الموافق عليها|المعدل|المعدلة)')
INSTR = re.compile(r'(?:بالمرسوم الملكي|بالأمر الملكي|بقرار مجلس الوزراء|بالقرار الوزاري)\s*رقم\s*\(?\s*([^\s)]+(?:\s*/\s*\d+)?)\s*\)?\s*(?:و|ب)تاريخ\s*([\d/ ]+)ه')
ART = r'(?:ال)?ماد(?:ة|تين|تان|ات)\s*((?:\(\s*[^)]{1,40}\)\s*(?:و\s*|،\s*)?)+)'
PARA = r'(?:ال)?(?:فقرة|فقرتين|بند|البند)\s*\(\s*([^)]{1,12})\s*\)'

def mask(t):
    """يخفي ما بين علامات التنصيص حتى لا يُقسَّم النص داخل النص المقتبس"""
    out=list(t); depth=0
    for i,ch in enumerate(t):
        if ch in '«“': depth+=1; continue
        if ch in '»”': depth=max(0,depth-1); continue
        if depth: out[i]='§' if ch!='\n' else '\n'
    return ''.join(out)
def split_at(t, rx):
    mt=mask(t); idx=[m.start() for m in rx.finditer(mt)]
    if not idx: return None
    return t[:idx[0]], [t[a:b].strip() for a,b in zip(idx, idx[1:]+[len(t)])]
def split_items(t):
    r=split_at(t, ORD_ITEM)
    return [('', t)] if not r else [(r[0], p) for p in r[1]]
PREFIX=re.compile(r'^\s*(?:(?:' + _ORDW + r')|\d{1,2}|[أ-ي])\s*[:：\-–)]\s*')
SUB_NUM=re.compile(r'(?:^|\n|[.:：»”])\s*\d{1,2}\s*[-–]\s*(?=(?:تعديل|إضافة|حذف|إلغاء|استبدال|إحلال|الفقرة|البند|المادة|ال?فقرة))')
SUB_LET=re.compile(r'(?:^|\n|[.:：»”])\s*[أ-ي]\s*[-–]\s*(?=(?:تعديل|إضافة|حذف|إلغاء|استبدال|إحلال))')
def arts_of(s):
    return [n for n in (ordnum(x) for x in re.findall(r'\(\s*([^)]{1,40})\s*\)', s)) if n]

OPS = []; MANUAL = []; MISSED = []
def instr_no(e):
    if e.get('instrument_no'): return e['instrument_no'], None
    F_ = FULL.get(e['source_url'], '')
    if e['instrument_kind'] == 'royal_decree':
        m = re.search(r'(?:مرسوم ملكي|المرسوم الملكي)\s+رقم\s*\(?\s*(م\s*/\s*\d+)', F_)
    elif e['instrument_kind'] == 'cabinet_decision':
        m = re.search(r'قرار\s+رقم\s*\(\s*(\d+)\s*\)', F_)
    else: m = None
    return (re.sub(r'\s', '', m.group(1)), 'recovered_from_page') if m else (None, None)
def emit(e, law_title, code, op, item, **k):
    risks = []
    if re.search(r'(?:ما\s+)?عدا\s|باستثناء|إلا ما ورد|إلا ما نصت', item): risks.append('exception_clause')
    if re.search(r'تعديل\s+(?:صدر|عجز)', item): risks.append('partial_opening_or_ending'); 
    if re.search(r'إعادة ترقيم|إعادة ترتيب', item): k['renumber'] = True
    if len(re.findall(ART, item)) > 1 and op in ('substitute_phrase', 'append_text', 'insert_paragraph', 'delete_paragraph'): risks.append('multiple_targets_in_item')
    mi = mask(item)
    if re.search(r'الفقرة الفرعية|البند الفرعي|فقرة فرعية', mi): risks.append('sub_paragraph')
    if len(re.findall(PARA, mi)) > 1: risks.append('multiple_paragraph_refs')
    if re.search(r'حذف|إلغاء', mi) and re.search(r'تعديل|إضافة', mi): risks.append('mixed_delete_and_amend')
    if re.search(r'(?:ال)?بند\s*\(\s*(?:أولاً|ثانياً|ثالثاً|رابعاً|خامساً)', mi): risks.append('clause_vs_paragraph')
    if e.get('_explicit_effective'): risks.append('explicit_effective_date')
    if e.get('_instrument_effective_clauses'):
        risks.append('instrument_has_effective_clause'); k['effective_clauses_in_instrument'] = e['_instrument_effective_clauses'][:3]
    if re.search(r'حذف\s+تعريف|إلغاء\s+تعريف', mi): risks.append('definition_deletion')
    if re.search(r'العنوان|عنوان\s', mi): risks.append('heading_change')
    if op == 'substitute_phrase' and re.search(PARA, mi) and not k.get('paragraph_label'): risks.append('paragraph_scope_not_captured')
    if re.search(r'الفقرتين|الفقرات|البندين|المادتين', mi): risks.append('multiple_units_named')
    if re.search(r'حذف\s+(?:عبارة|كلمة|جملة)', mi): risks.append('phrase_deletion')
    nt = (k.get('new_text') or '').strip()
    if nt.endswith(('...', '…')) or nt.startswith(('...', '…')): risks.append('partial_quoted_text')
    if op in ('insert_paragraph', 'append_text') and re.match(r'(?:ال)?مادة\s', nt): risks.append('quoted_whole_article_in_insert'); k['effective_clause_in_instrument'] = e['_explicit_effective']
    if e.get('_conditional_effective'): risks.append('conditional_effective_date')
    if e.get('_companion_decree') and e['instrument_kind'] == 'cabinet_decision': risks.append('operative_instrument_is_companion_royal_decree')
    if risks:
        k['risks'] = risks
        k['confidence'] = 'needs_review'
    _no, _src = instr_no(e)
    if _src: k['instrument_no_source'] = _src
    OPS.append(dict(effect_id=e['effect_id'], instrument_kind=e['instrument_kind'], instrument_no=_no,
                    instrument_date_hijri=e.get('instrument_date_hijri'), published_hijri=e.get('published_hijri'),
                    source_url=e['source_url'], target_law_title=law_title, target_hakeem_code=code, op_type=op,
                    evidence_quote=item.strip()[:3000], **k))

def parse_item(e, ctx_law, item, depth=0):
    """يعيد عدد العمليات المستخرجة من البند؛ ينزل إلى البنود الفرعية المرقمة"""
    item = PREFIX.sub('', re.sub(r'^[\s.:：»”،,]+', '', item), count=1)
    hm = LAW_NAME.search(mask(item)[:400]) and LAW_NAME.search(item[:400])
    if depth < 2 and re.search(r'النحو الآتي|بما يأتي|ما يأتي|ما يلي', item[:500]):
        for rx in (SUB_NUM, SUB_LET):
            r = split_at(item, rx)
            if r and len(r[1]) >= 1:
                law2 = hm.group(1).strip() if hm else ctx_law
                tot = 0
                for sub in r[1]:
                    k = parse_item(e, law2, sub, depth+1)
                    if k < 0: k = 0; continue
                    if k == 0 and re.search(r'تعديل|إضافة|حذف|إلغاء|استبدال|إحلال', sub[:80]): MISSED.append(sub[:1500])
                    tot += k
                if tot: return tot
    if re.match(r'\s*(?:الموافقة على\s+)?(?:تعديل|إلغاء|إضافة|حذف)[^\n]{0,80}?من\s+(?:قرار مجلس الوزراء|الأمر الملكي|المرسوم الملكي|القرار)\s+رقم', item):
        MISSED.append('[البند يعدّل قرارًا أو أمرًا لا نص نظام] ' + item[:1400]); return -1
    if re.search(r'بالصيغة المرافقة|وفق الصيغة المرافقة|بالصيغة المرفقة', item) and re.search(r'تعديل|إضافة|حذف', item):
        MISSED.append('[النص الجديد في ملحق «بالصيغة المرافقة» غير منشور في الصفحة] ' + item[:1400]); return -1
    n0 = len(OPS)
    mdef = list(re.finditer(r'إحلال\s+تعريف\s*[«“(]([^»”)]+)[»”)]\s*محل\s+تعريف\s*[«“(]([^»”)]+)[»”)]', item))
    for d in mdef:
        amd = re.search(ART, item[d.end():d.end()+120])
        emit(e, ctx_law, resolve(ctx_law)[0], 'replace_definition_entry', item, new_text=d.group(1).strip(), old_term=d.group(2).strip(),
             article_number=(arts_of(amd.group(1))[0] if amd and arts_of(amd.group(1)) else 1), confidence='rule_exact' if amd else 'needs_review')
    mr = re.search(r'تعديل\s+اسم\s+(.{3,160}?)\s*[،,]?\s*(?:-|–)?\s*الصادر.{0,120}?(?:ليكون|ليصبح)\s*[(«“]([^)»”]+)[)»”]', item)
    if mr:
        c0, t0 = resolve(mr.group(1)); emit(e, t0 or mr.group(1), c0, 'rename_law', item, new_title=mr.group(2).strip(), confidence='rule_exact'); return 1
    md = re.search(r'تعديل\s+تعريف\s+(?:عبارة|كلمة|مصطلح)?\s*[«“(]([^»”)]+)[»”)].{0,160}?(?:ليكون|ليصبح|لتكون)\s+بالنص\s+الآتي\s*[:：]?\s*[«“]((?:[^«»“”]|«[^»]*»)*)[»”]', item, re.S)
    if md:
        amd = re.search(ART, item[:md.start()+200])
        emit(e, ctx_law if not LAW_NAME.search(item) else LAW_NAME.search(item).group(1).strip(), resolve(ctx_law)[0], 'replace_definition', item,
             article_number=(arts_of(amd.group(1))[0] if amd and arts_of(amd.group(1)) else 1), term=md.group(1).strip(), new_text=md.group(2).strip(),
             confidence='rule_exact' if amd else 'needs_review')
        return 1
    m = LAW_NAME.search(item)
    law = m.group(1).strip() if m else ctx_law
    code, canon = resolve(law)
    law_title = canon or clean_law(law)
    # (1) استبدال عبارة بعبارة
    for mm in re.finditer(r'(?:استبدال|إحلال)\s+(?:عبارة|كلمة)\s*[«“(]([^»”)]+)[»”)]\s*(?:ب(?:عبارة|كلمة)\s*[«“(]([^»”)]+)[»”)]|محل\s+(?:عبارة|كلمة|العبارات التالية:?)\s*[«“(]([^»”)]+)[»”)])', item):
        if mm.group(2): old, new = mm.group(1), mm.group(2)
        else: new, old = mm.group(1), mm.group(3)
        tail = item[mm.end():mm.end()+160]
        scope = 'wherever' if re.search(r'أينما وردت?', item) else 'item'
        am2 = re.search(ART, tail) or re.search(ART, item)
        pm2 = re.search(PARA, tail)
        emit(e, law_title, code, 'substitute_phrase', item, old_phrase=old.strip(), new_phrase=new.strip(), scope=scope,
             article_number=(arts_of(am2.group(1))[0] if am2 and scope=='item' and arts_of(am2.group(1)) else None),
             paragraph_label=(pm2.group(1) if pm2 and scope=='item' else None), confidence='rule_exact' if scope=='wherever' or am2 else 'needs_review')
    if len(OPS) > n0: return len(OPS) - n0
    quotes = [q.strip() for q in QUOTE.findall(item)]
    mitem = mask(item)
    am = re.search(ART, mitem); pm = re.search(PARA, mitem)
    if am: am = re.search(ART, item[am.start():am.end()+5])
    if pm: pm = re.search(PARA, item[pm.start():pm.end()+5])
    arts = arts_of(am.group(1)) if am else []
    para = pm.group(1).strip() if pm else None
    # (2) إلغاء نظام كامل / إحلال نظام محل نظام
    if re.match(r'\s*(?:الموافقة على\s+)?إلغاء\s+(?:نظام|تنظيم|الترتيبات|اللائحة|النظام|لائحة|قواعد)', item) and not am:
        emit(e, law_title, code, 'repeal_law', item, saving_clause=bool(re.search(r'استمرار العمل|يستمر العمل', item)),
             conditional=bool(re.search(r'اعتباراً من تاريخ نفاذ|اعتبارًا من تاريخ نفاذ|بعد صدور|عند نفاذ', item)), confidence='rule_exact')
        return 1
    if re.search(r'(?:يحل|تحل)\s.{0,80}محل\s', item) and not am:
        mm = re.search(r'محل\s+(.{3,160}?)\s*[،,]?\s*(?:الصادر|الصادرة)', item)
        tgt = mm.group(1) if mm else law
        c2, t2 = resolve(tgt)
        emit(e, t2 or tgt, c2, 'replace_law', item, conditional=bool(re.search(r'عند نفاذه', item)), confidence='rule_exact')
        return 1
    # (3) إلغاء / حذف مادة أو فقرة
    if re.search(r'(?:إلغاء|حذف)\s', item) and arts and not quotes and not re.search(r'تعديل|إضافة|استبدال|إحلال|(?:حذف|إلغاء)\s+(?:عبارة|كلمة|جملة|تعريف)', item):
        op = ('delete_paragraph' if para else 'repeal_article')
        for a in arts:
            emit(e, law_title, code, op, item, article_number=a, paragraph_label=para,
                 renumber=bool(re.search(r'إعادة ترقيم|إعادة ترتيب', item)), confidence='rule_exact')
        return len(arts)
    # (4) إضافة مادة/فقرة بنص
    if re.search(r'إضافة\s', item) and quotes:
        newpara = re.search(r'إضافة\s+(?:فقرة|بند)\s*(?:جديدة\s*)?(?:تحمل الرقم\s*)?\(\s*([^)]{1,12})\s*\)', item)
        newart = re.search(r'إضافة\s+مادة\s*(?:جديدة\s*)?(?:برقم|تحمل الرقم)?\s*\(\s*([^)]{1,40})\s*\)', item)
        if re.search(r'إلى عجز|في آخر|في نهاية', item) and arts and not re.search(r'(?:لتكون|لتصبح|ليكون|ليصبح)\s+(?:بالنص|على النحو)', item):
            emit(e, law_title, code, 'append_text', item, article_number=arts[-1], paragraph_label=para, new_text=quotes[0], confidence='rule_exact')
            return 1
        if newart:
            emit(e, law_title, code, 'insert_article', item, article_label=newart.group(1), new_text=quotes[0],
                 after_article=(arts[-1] if arts else None), confidence='rule_exact' if len(quotes)==1 else 'needs_review')
            return 1
        if arts and len(quotes) > 1:
            return 0   # عدة نصوص مقتبسة لعمليات مختلفة في بند واحد — للمعالجة اليدوية
        if arts:
            emit(e, law_title, code, 'insert_paragraph', item, article_number=arts[-1],
                 paragraph_label=(newpara.group(1) if newpara else None), new_text='\n'.join(quotes),
                 confidence='rule_exact' if newpara and len(quotes)==1 else 'needs_review')
            return 1
    # (5أ) نص جديد غير مقتبس بعد «بالنص الآتي:» في سطر مستقل — يُؤخذ حتى نهاية البند ويُعلَّم للمراجعة
    mu = re.search(r'(?:لتكون|لتصبح|ليكون|ليصبح)\s+(?:بالنص|على النحو)\s+الآتي\s*[:：]\s*\n(.+)', item, re.S)
    if mu and not quotes and arts and len(arts) == 1:
        body = re.split(r'\n\s*(?:رئيس مجلس الوزراء|وقد أعد|وقد أُعد|سلمان بن عبدالعزيز)', mu.group(1))[0].strip()
        if len(body) > 20:
            emit(e, law_title, code, 'replace_paragraph_text' if para else 'replace_article_text', item,
                 article_number=arts[0], paragraph_label=para, new_text=body, confidence='needs_review', note='نص غير مقتبس — حدوده مستنتجة')
            return 1
    # (5) تعديل مادة/فقرة لتكون بالنص الآتي
    if re.search(r'تعديل|لتكون|لتصبح|ليكون|ليصبح', item) and quotes and arts:
        subs = list(re.finditer(r'(?:^|\n)\s*\d{1,2}\s*[-–]\s*((?:ال)?(?:فقرة|بند)\s*\(\s*([^)]{1,12})\s*\)\s*من\s*)?(?:ال)?مادة\s*\(\s*([^)]{1,40})\s*\)\s*[:：]?\s*[«“]((?:[^«»“”]|«[^»]*»)*)[»”]', item))
        if subs:
            for s in subs:
                emit(e, law_title, code, 'replace_paragraph_text' if s.group(2) else 'replace_article_text', item,
                     article_number=ordnum(s.group(3)), paragraph_label=s.group(2), new_text=s.group(4).strip(), confidence='rule_exact')
            return len(subs)
        if len(arts) == 1 and len(quotes) == 1:
            emit(e, law_title, code, 'replace_paragraph_text' if para else 'replace_article_text', item,
                 article_number=arts[0], paragraph_label=para, new_text=quotes[0], confidence='rule_exact')
            return 1
        if len(arts) == len(quotes) and not para and len(arts) > 1:
            for a, q in zip(arts, quotes):
                emit(e, law_title, code, 'replace_article_text', item, article_number=a, new_text=q, confidence='needs_review')
            return len(arts)
    return 0

for e in E:
    if e['effect_type'] not in REAL: continue
    ft, ok = full_operative(e)
    t = prep(ft).translate(AR_DIG)
    _mk = re.search(r'يقرر\s*(?:ما يلي|ما يأتي)?\s*[:：]|رسمنا بما هو آت|أمرنا بما هو آت|يقرر\s*\n', t)
    k0 = _mk.start() if _mk else -1
    op_part = t[k0:] if k0 > 0 else t
    hm = LAW_NAME.search(op_part[:800])
    ctx = hm.group(1).strip() if hm else (e.get('target_title_as_cited') or '')
    e['_companion_decree'] = bool(re.search(r'وقد أعد مشروع مرسوم ملكي|وقد أُعد مشروع مرسوم ملكي', t))
    mdate = re.search(r'(?:(?:اعتباراً|اعتبارًا|ابتداءً)\s+من|(?:يسري|يُعمل|يعمل)\s+(?:العمل\s+)?ب[^\n]{0,120}?من)\s+(?:تاريخ\s+)?(\d{1,2}\s*/\s*\d{1,2}\s*/\s*\d{4})\s*هـ?', t)
    e['_explicit_effective'] = mdate.group(0) if mdate else None
    e['_conditional_effective'] = bool(re.search(r'(?:اعتباراً|اعتبارًا|ابتداءً)\s+من\s+تاريخ\s+(?:نفاذ|صدور|استكمال)|عند نفاذ', t))
    _ec = [m.group(0).strip() for m in re.finditer(r'[^\n.]{0,160}(?:يكون نفاذ|يسري|يُعمل ب|يعمل ب|تسري|ويعمل ب|نفاذ\s+(?:هذا|ما ورد|التعديل))[^\n.]{0,200}', t)
           if not re.search(r'تنفيذ مرسومنا|تنفيذ هذا', m.group(0))]
    e['_instrument_effective_clauses'] = _ec
    t = op_part
    items = split_items(t)
    got = 0; missed = []; MISSED.clear()
    for head, it in items:
        if re.match(r'\s*\S+\s*[:：-]\s*(?:على\s+(?:صاحب|سمو|أصحاب|الوزراء|رئيس)|يُبلَّغ|يبلغ|تُنشر|ينشر|يُنشر)', it): continue
        k = parse_item(e, ctx, it)
        if k < 0: continue
        got += k
        if k == 0 and re.search(r'تعديل|إضافة|حذف|إلغاء|استبدال|إحلال|يحل|تحل', it): missed.append(it[:1500])
    missed += MISSED
    if missed or got == 0:
        MANUAL.append(dict(effect_id=e['effect_id'], effect_type=e['effect_type'], instrument_kind=e['instrument_kind'],
                           instrument_no=e.get('instrument_no'), instrument_date_hijri=e.get('instrument_date_hijri'),
                           source_url=e['source_url'], target_title_as_cited=e.get('target_title_as_cited'),
                           unparsed_items=missed or [t[:1500]], ops_extracted=got))

# تاريخ السريان: من تاريخ النشر ما لم يُنص على غيره (يُعلَّم محسوبًا)
def h2g(h):
    y, m, d = map(int, h.split('-')); return Hijri(y, m, d).to_gregorian()
for o in OPS:
    txt = next(x['operative_text'] for x in E if x['effect_id'] == o['effect_id'])
    mm = re.search(r'يُ?عمل\s+ب\S*\s+(?:بعد|بمضي)\s*(?:مضي\s*)?\(?\s*(\d+|تسعين|مائة وثمانين|مائة وعشرين|ستين|ثلاثين)\s*\)?\s*يوم', txt)
    days = {'تسعين': 90, 'مائة وثمانين': 180, 'مائة وعشرين': 120, 'ستين': 60, 'ثلاثين': 30}
    if o.get('published_hijri'):
        g = h2g(o['published_hijri'])
        if mm:
            n = int(mm.group(1)) if mm.group(1).isdigit() else days[mm.group(1)]
            g = g + datetime.timedelta(days=n); o['effective_rule'] = f'النشر + {n} يومًا (محسوب)'
        else:
            o['effective_rule'] = 'من تاريخ النشر (افتراض — لم يُنص على مهلة في الأداة)'
        h = Gregorian(g.year, g.month, g.day).to_hijri()
        o['effective_from_gregorian'] = g.isoformat(); o['effective_from_hijri'] = f'{h.year:04d}-{h.month:02d}-{h.day:02d}'
    o['status'] = 'extracted_pending_apply'

# إزالة التكرار: الصفحة الواحدة قد تحمل المرسوم وقرار مجلس الوزراء بالنص نفسه
import hashlib
RANK = {'royal_decree': 0, 'royal_order': 1, 'cabinet_decision': 2, 'ministerial_or_authority_decision': 3}
groups = collections.OrderedDict()
for o in OPS:
    k = (norm(o['target_law_title'] or ''), o['op_type'], o.get('article_number'), o.get('paragraph_label'), o.get('term'),
         hashlib.sha1(re.sub(r'\s+', '', (o.get('new_text') or '') + (o.get('old_phrase') or '') + (o.get('new_phrase') or '') + (o.get('new_title') or '')).encode()).hexdigest()[:12])
    groups.setdefault(k, []).append(o)
DEDUP = []
for k, g in groups.items():
    g.sort(key=lambda o: RANK.get(o['instrument_kind'], 9))
    best = dict(g[0]); best['also_in'] = sorted({f"{x['instrument_kind']}:{x.get('instrument_no')}:{x['effect_id']}" for x in g[1:]})
    DEDUP.append(best)
rd = {(norm(o['target_law_title'] or ''), o['op_type'], o.get('article_number')) for o in DEDUP if o['instrument_kind'] == 'royal_decree'}
_keep = []
for o in DEDUP:
    if o['instrument_kind'] == 'cabinet_decision' and 'operative_instrument_is_companion_royal_decree' in o.get('risks', []) \
       and (norm(o['target_law_title'] or ''), o['op_type'], o.get('article_number')) in rd:
        continue
    _keep.append(o)
_seen=set(); DEDUP=[]
for o in _keep:
    kk=json.dumps([o['effect_id'], o['op_type'], o.get('article_number'), o.get('paragraph_label'), o.get('new_text'), o.get('old_phrase'), o.get('new_phrase')], ensure_ascii=False)
    if kk in _seen: continue
    _seen.add(kk); DEDUP.append(o)
# معرّف ثابت عبر التشغيلات: بصمة المحتوى لا الترتيب
for o in DEDUP:
    o['op_id'] = 'OP-' + hashlib.sha1(json.dumps([o['effect_id'], o['op_type'], o.get('article_number'), o.get('paragraph_label'), o.get('new_text'), o.get('old_phrase'), o.get('new_phrase')], ensure_ascii=False).encode()).hexdigest()[:10]
print('before dedup', len(OPS), 'after', len(DEDUP))
# تحقق آلي: كل نص جديد أو عبارة يجب أن توجد حرفيًا في صفحة المصدر (بعد توحيد المسافات)
def ws(x): return re.sub(r'\s+', ' ', prep(x or '')).strip()
for o in DEDUP:
    src = ws(FULL.get(o['source_url'], ''))
    frag = [o.get(k) for k in ('new_text', 'old_phrase', 'new_phrase') if o.get(k)]
    o['verbatim_in_source'] = all(ws(f)[:400] in src for f in frag) if frag else None
    if o['verbatim_in_source'] is False: o['confidence'] = 'needs_review'
    bad = re.search(r'[)(]|محل |ما عدا|وتعديل', o['target_law_title'] or '')
    if not o['target_hakeem_code']:
        o['target_resolution'] = 'resolve_by_title_in_hakeem'
        if bad: o['confidence'] = 'needs_review'
    elif o['target_hakeem_code'] == 'uqn': o['target_resolution'] = 'uqn_package_work'
    else: o['target_resolution'] = 'hakeem_reference_code'
print('verbatim check:', collections.Counter(o['verbatim_in_source'] for o in DEDUP))
OPS = DEDUP
with open('/home/claude/fixpack/data/amendment_operations.jsonl', 'w', encoding='utf-8') as f:
    for o in OPS: f.write(json.dumps(o, ensure_ascii=False) + '\n')
with open('/home/claude/fixpack/data/amendment_manual_queue.jsonl', 'w', encoding='utf-8') as f:
    for m in MANUAL: f.write(json.dumps(m, ensure_ascii=False) + '\n')
eff_with_ops = {o['effect_id'] for o in OPS}
st = dict(real_effects=sum(1 for e in E if e['effect_type'] in REAL), effects_with_ops=len(eff_with_ops),
          operations=len(OPS), by_op=collections.Counter(o['op_type'] for o in OPS),
          by_confidence=collections.Counter(o['confidence'] for o in OPS),
          resolved_to_hakeem=sum(1 for o in OPS if o['target_hakeem_code'] and o['target_hakeem_code'] != 'uqn'),
          resolved_to_uqn_new=sum(1 for o in OPS if o['target_hakeem_code'] == 'uqn'),
          unresolved_target=sum(1 for o in OPS if not o['target_hakeem_code']),
          manual_queue=len(MANUAL))
json.dump(st, open('/home/claude/fixpack/data/amendment_stats.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=dict)
print(json.dumps(st, ensure_ascii=False, indent=1, default=dict))
