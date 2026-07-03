# -*- coding: utf-8 -*-
"""
مُستخرِج nezams → رسم قانوني بأربع طبقات لحكيم
الطبقات: نظام (SYSTEM_ARTICLE) / لائحة (BYLAW_ARTICLE) / ضابط (CONTROL) / دليل إجرائي (PROCEDURE)

مهم — قيود الدقّة:
  * صفحات nezams تُصيَّر بالـ JavaScript، فالجلب يتم عبر Playwright (متصفّح بلا واجهة).
  * لا يُبنى المُفكِّك على محدّدات CSS مُخمَّنة، بل على *بنية النص المُصيَّر* + وسوم قابلة للمعايرة.
  * شغّل الوضع inspect مرة على صفحة نظام واحدة لتثبيت الوسوم قبل التعميم.

الاستخدام:
  python nezams_scraper.py inspect  <url>              # يعرض بنية الصفحة لمعايرة الوسوم
  python nezams_scraper.py extract  <url> [url2 ...]   # يبني الرسم ويصدّره sqlite/csv/json
"""
import re, sys, json, csv, sqlite3, os

# ===========================================================================
# 0) وسوم قابلة للمعايرة — عدّلها بعد تشغيل inspect على صفحة حقيقية
# ===========================================================================
MARKERS = {
    'bylaw':     ['اللائحة', 'اللائحة التنفيذية'],   # بداية مقطع مادة لائحة
    'control':   ['الضوابط', 'ضوابط', 'الضابط'],      # بداية مقطع ضابط
    'procedure': ['الأدلة الإجرائية', 'الدليل الإجرائي', 'الإجراءات', 'دليل إجرائي'],
}

# ===========================================================================
# 1) تطبيع + أعداد ترتيبية (منقولة كما هي من bylaw_link_parser المُختبَر)
# ===========================================================================
_HARAKAT = re.compile(r'[\u0617-\u061A\u064B-\u0652\u0640]')
def normalize(s):
    s = _HARAKAT.sub('', s)
    return (s.replace('أ','ا').replace('إ','ا').replace('آ','ا')
             .replace('ى','ي').replace('ؤ','و').replace('ئ','ي').strip())

_ORD_RAW = {
 'اولي':1,'حادية':1,'واحدة':1,'ثانية':2,'ثالثة':3,'رابعة':4,'خامسة':5,
 'سادسة':6,'سابعة':7,'ثامنة':8,'تاسعة':9,'عاشرة':10,'عشرة':10,'عشر':10,
 'عشرون':20,'عشرين':20,'ثلاثون':30,'ثلاثين':30,'اربعون':40,'اربعين':40,
 'خمسون':50,'خمسين':50,'ستون':60,'ستين':60,'سبعون':70,'سبعين':70,
 'ثمانون':80,'ثمانين':80,'تسعون':90,'تسعين':90,'مائة':100,'مئة':100,
 'مائتان':200,'مئتان':200,'مائتين':200,'مئتين':200,'ثلاثمائة':300,'ثلاثمئة':300,
 'اربعمائة':400,'خمسمائة':500,'ستمائة':600,'سبعمائة':700,'ثمانمائة':800,'تسعمائة':900,
}
_ORD = {normalize(k):v for k,v in _ORD_RAW.items()}
_SKIP = {'و','بعد','من','ال','المادة','الماده',''}
_ARD = str.maketrans('٠١٢٣٤٥٦٧٨٩','0123456789')

def parse_ordinal(p):
    p = normalize(p).translate(_ARD)
    m = re.search(r'\d+', p)
    if m and not re.search(r'[\u0600-\u06FF]', re.sub(r'\d','',p)): return int(m.group())
    total, found = 0, False
    for tok in re.split(r'[\s\u0640]+', p):
        tok = re.sub(r'^و?ال','', tok); tok = re.sub(r'^و','', tok)
        if tok in _SKIP: continue
        if tok in _ORD: total += _ORD[tok]; found = True
    return total if found and total>0 else None

# إشارة صريحة داخل نص لائحة إلى مادة نظام (مُدقِّق لا محرّك)
_REF = re.compile(r'الماد(?:ة|ه|تين|تي)\s*\(?\s*([^)\n]{2,45}?)\s*\)?\s*من\s+(?:هذا\s+)?النظام')
def explicit_refs(text):
    out=[]
    for g in _REF.findall(text):
        n=parse_ordinal(g)
        if n: out.append(n)
    return sorted(set(out))

# ===========================================================================
# 2) المُفكِّك — يحوّل نص الصفحة المُصيَّر إلى عُقد + علاقات
#    القاعدة: نمشي على "بنود المادة" بالترتيب، ونتتبّع المادة النظامية الحالية.
#    "المادة X" أعلى المستوى = مادة نظام. أي "المادة Y" بعد وسم لائحة/ضابط/دليل
#    ضمن نفس البلوك = تابعة لتلك الطبقة ومربوطة بالمادة النظامية الحالية.
# ===========================================================================
_ART = re.compile(r'الماد(?:ة|ه)\s*\(?\s*([^\)\n:]{2,45}?)\s*\)?\s*[:：]')

def _which_layer(prefix):
    """يحدّد طبقة البند: الوسم يجب أن يكون *ملاصقاً* لعنوان المادة (نهاية المقدّمة)،
    وإلا فكلمة مثل «اللائحة» ترد داخل متن مادة النظام وتُصنّف خطأً."""
    n = normalize(prefix)
    for lay, keys in (('bylaw',MARKERS['bylaw']),('control',MARKERS['control']),
                      ('procedure',MARKERS['procedure'])):
        for k in keys:
            if re.search(re.escape(normalize(k)) + r'\s*[:：]?\s*$', n):
                return lay
    return None

def parse_merged_text(text, law_name, source_url=''):
    nodes, rels = [], []
    matches = list(_ART.finditer(text))
    cur_sys = None                      # معرّف المادة النظامية الحالية
    sys_seq = 0
    for i, m in enumerate(matches):
        num = parse_ordinal(m.group(1))
        seg_start = m.end()
        seg_end = matches[i+1].start() if i+1 < len(matches) else len(text)
        body = text[seg_start:seg_end].strip()
        # النص الفاصل بين نهاية المادة السابقة وبداية هذه المادة يحدّد الطبقة
        prev_end = matches[i-1].end() if i>0 else 0
        prefix = text[prev_end:m.start()]
        layer = _which_layer(prefix)

        if layer is None:               # مادة نظام (أعلى المستوى)
            sys_seq += 1
            nid = f'SYS::{law_name}::{num}'
            nodes.append(dict(id=nid, type='SYSTEM_ARTICLE', law=law_name,
                              number=num, seq=sys_seq, body=body, url=source_url))
            cur_sys = nid
        else:                           # لائحة / ضابط / دليل — تابعة للمادة الحالية
            t = {'bylaw':'BYLAW_ARTICLE','control':'CONTROL','procedure':'PROCEDURE'}[layer]
            nid = f'{layer.upper()}::{law_name}::{num}::{i}'
            nodes.append(dict(id=nid, type=t, law=law_name, number=num,
                              body=body, url=source_url))
            if cur_sys:                 # ربط بالمادة النظامية الحالية
                rtype = {'bylaw':'IMPLEMENTS','control':'GOVERNED_BY',
                         'procedure':'PROCEDURE_FOR'}[layer]
                rels.append(dict(source=nid, target=cur_sys, type=rtype,
                                 evidence='محاذاة بنيوية', confidence=0.9, src='STRUCTURAL'))
            # مُدقِّق: إشارة صريحة "من النظام" تؤكّد/تصحّح الهدف
            for rn in explicit_refs(body):
                tgt = f'SYS::{law_name}::{rn}'
                rels.append(dict(source=nid, target=tgt, type='IMPLEMENTS',
                                 evidence=f'إشارة صريحة: المادة ({rn}) من النظام',
                                 confidence=0.98, src='EXPLICIT'))
    # دمج العلاقات المكرّرة مع ترجيح الأعلى ثقة (الإشارة الصريحة ترفع الثقة)
    best={}
    for r in rels:
        k=(r['source'],r['target'],r['type'])
        if k not in best or r['confidence'] > best[k]['confidence']:
            best[k]=r
    return nodes, list(best.values())

# ===========================================================================
# 3) الجلب المُصيَّر (Playwright) — يُشغَّل عند المستخدم، محجوب في هذه البيئة
# ===========================================================================
def fetch_rendered(url):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit('ثبّت أولاً:  pip install playwright && playwright install chromium')
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        pg = b.new_page()
        pg.goto(url, wait_until='networkidle', timeout=60000)
        html = pg.content()
        text = pg.inner_text('body')
        b.close()
    return html, text

# ===========================================================================
# 4) المخرجات
# ===========================================================================
def export(nodes, rels, base='nezams_graph'):
    with open(base+'.json','w',encoding='utf-8') as f:
        json.dump({'nodes':nodes,'relations':rels}, f, ensure_ascii=False, indent=2)
    with open(base+'_nodes.csv','w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f, fieldnames=['id','type','law','number','seq','body','url'])
        w.writeheader()
        for n in nodes: w.writerow({k:n.get(k,'') for k in w.fieldnames})
    with open(base+'_relations.csv','w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f, fieldnames=['source','target','type','evidence','confidence','src'])
        w.writeheader(); w.writerows(rels)
    db=sqlite3.connect(base+'.db'); c=db.cursor()
    c.execute('CREATE TABLE IF NOT EXISTS nodes(id TEXT PRIMARY KEY,type TEXT,law TEXT,number INT,seq INT,body TEXT,url TEXT)')
    c.execute('CREATE TABLE IF NOT EXISTS relations(source TEXT,target TEXT,type TEXT,evidence TEXT,confidence REAL,src TEXT,PRIMARY KEY(source,target,type))')
    for n in nodes:
        c.execute('INSERT OR REPLACE INTO nodes VALUES(?,?,?,?,?,?,?)',
                  (n['id'],n['type'],n.get('law'),n.get('number'),n.get('seq'),n.get('body'),n.get('url')))
    for r in rels:
        c.execute('INSERT OR REPLACE INTO relations VALUES(?,?,?,?,?,?)',
                  (r['source'],r['target'],r['type'],r['evidence'],r['confidence'],r['src']))
    db.commit(); db.close()
    print(f'صُدِّر: {base}.json / {base}_nodes.csv / {base}_relations.csv / {base}.db')

# ===========================================================================
# 5) واجهة الأوامر
# ===========================================================================
def cmd_inspect(url):
    html, text = fetch_rendered(url)
    arts = _ART.findall(text)
    print('عدد إشارات "المادة X:" في النص المُصيَّر:', len(arts))
    print('\nأول ٤٠ سطراً من النص (لمعايرة الوسوم):\n'+'-'*50)
    for ln in text.splitlines()[:40]:
        if ln.strip(): print(ln[:120])
    print('-'*50)
    print('راجع أن وسوم MARKERS (اللائحة/الضوابط/الأدلة) تطابق ما يظهر أعلاه.')

def cmd_extract(urls):
    all_n, all_r = [], []
    for u in urls:
        _, text = fetch_rendered(u)
        law = normalize(text.splitlines()[0]) if text.strip() else u
        n, r = parse_merged_text(text, law, u)
        all_n += n; all_r += r
        print(f'{u} → {len(n)} عقدة، {len(r)} علاقة')
    export(all_n, all_r)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__); sys.exit()
    mode = sys.argv[1]
    if mode=='inspect':  cmd_inspect(sys.argv[2])
    elif mode=='extract': cmd_extract(sys.argv[2:])
    else: print('وضع غير معروف. استخدم inspect أو extract.')
