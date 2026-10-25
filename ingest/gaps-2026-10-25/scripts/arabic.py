"""أدوات عربية صغيرة لآلية النواقص: تطبيع، أعداد ترتيبية بالتذكير والتأنيث، وتفكيك عبارات الإلغاء بالإحالة."""
import re

_HARAKAT = re.compile(r'[ؐ-ًؚ-ٰٟـ]')
_AR_DIGITS = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')


def norm(s):
    """تطبيع للمطابقة فقط (لا يُكتب في القاعدة)."""
    s = _HARAKAT.sub('', s or '').translate(_AR_DIGITS)
    s = s.replace(' ', ' ')
    for a, b in (('أ', 'ا'), ('إ', 'ا'), ('آ', 'ا'), ('ٱ', 'ا'), ('ى', 'ي'), ('ة', 'ه'), ('ؤ', 'و'), ('ئ', 'ي')):
        s = s.replace(a, b)
    return re.sub(r'\s+', ' ', s).strip()


def law_key(name):
    """مفتاح اسم النظام: بلا «الصادر…» ولا سنة لاحقة ولا أقواس فارغة."""
    s = norm(name)
    s = re.split(r'\s*،?\s*الصادر', s)[0]
    s = re.sub(r'\(\s*القديم\s*\)|القديم$', '', s)
    s = re.sub(r'\s*\d{4}\s*ه?\s*$', '', s)
    s = re.sub(r'[()\[\].,،:«»"]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


_UNITS = {
    'اول': 1, 'اولي': 1, 'حادي': 1, 'حاديه': 1, 'واحد': 1, 'واحده': 1,
    'ثاني': 2, 'ثانيه': 2, 'ثالث': 3, 'ثالثه': 3, 'رابع': 4, 'رابعه': 4, 'خامس': 5, 'خامسه': 5,
    'سادس': 6, 'سادسه': 6, 'سابع': 7, 'سابعه': 7, 'ثامن': 8, 'ثامنه': 8, 'تاسع': 9, 'تاسعه': 9,
    'عاشر': 10, 'عاشره': 10,
}
_TEENS = {'عشر': 10, 'عشره': 10}
_TENS = {'عشرون': 20, 'عشرين': 20, 'ثلاثون': 30, 'ثلاثين': 30, 'اربعون': 40, 'اربعين': 40, 'خمسون': 50, 'خمسين': 50,
         'ستون': 60, 'ستين': 60, 'سبعون': 70, 'سبعين': 70, 'ثمانون': 80, 'ثمانين': 80, 'تسعون': 90, 'تسعين': 90}
_HUND = {'مايه': 100, 'ميه': 100, 'مايتين': 200, 'مايتان': 200, 'ميتين': 200, 'ميتان': 200,
         'ثلاثمايه': 300, 'ثلاثميه': 300, 'اربعمايه': 400, 'اربعميه': 400, 'خمسمايه': 500, 'خمسميه': 500,
         'ستمايه': 600, 'سبعمايه': 700, 'ثمانمايه': 800, 'تسعمايه': 900}
_SKIP = {'و', 'بعد', 'من', ''}


def ordinal(phrase):
    """«التاسع» → 9، «الحادية والعشرين بعد المائة» → 121، «(37)» → 37؛ وإلا None."""
    p = norm(phrase).strip('() ')
    if re.fullmatch(r'\d+', p):
        return int(p)
    total, seen = 0, False
    for w in re.split(r'[\s\-]+', p):
        w = w[2:] if w.startswith('ال') and len(w) > 3 else w
        w = w[1:] if w.startswith('و') and (w[1:] in _UNITS or w[1:] in _TENS or w[1:] in _HUND or w[1:].startswith('ال')) else w
        w = w[2:] if w.startswith('ال') and len(w) > 3 else w
        if w in _SKIP:
            continue
        if w in _UNITS:
            total += _UNITS[w]
        elif w in _TEENS:
            total += 10
        elif w in _TENS:
            total += _TENS[w]
        elif w in _HUND:
            total += _HUND[w]
        else:
            return None
        seen = True
    return total if seen else None


_TARGET = re.compile(r'من\s+(?P<law>(?:نظام|النظام|لايحه|اللايحه|تنظيم|قواعد)\s[^،]+?)(?=\s*،?\s*الصادر|\s*،|\s*$)')
_INSTR = re.compile(r'الصادر[^،]*?رقم\s*\(?\s*(?P<no>م\s*/\s*\d+|\d+)\s*\)?[^،]*?(?:وتاريخ|والتاريخ|بتاريخ)\s*(?P<date>[\d\s/]+)')


_VERB = re.compile(r'(يلغي|يلغى|تلغي|تلغى)')


def _numbers_in(div):
    """كل المديات والقوائم في مقطع التقسيم: «المواد من (31) إلى (46) والمادة (48)» → 31..46 + 48."""
    nums, bad = [], False
    for r in re.finditer(r'(?:المواد|احكام المواد)\s+من\s*\(?([^()]+?)\)?\s*(?:الي|حتي)\s*\(?([^()]+?)\)', div):
        a, b = ordinal(r.group(1)), ordinal(r.group(2))
        if a and b and a <= b:
            nums += list(range(a, b + 1))
        else:
            bad = True
    rest = re.sub(r'(?:المواد|احكام المواد)\s+من\s*\(?[^()]+?\)?\s*(?:الي|حتي)\s*\(?[^()]+?\)', ' ', div)
    for r in re.finditer(r'(?:المواد|المادتين|المادتان|الماده)\s*\(([^()]+)\)', rest):
        for x in re.split(r'[،,]|\sو', r.group(1)):
            if x.strip():
                n = ordinal(x)
                if n is None:
                    bad = True
                else:
                    nums.append(n)
    return sorted(set(nums)), bad


def parse_repeal_clause(clause):
    """يفكك عبارة إلغاء بالإحالة إلى أهداف: [{law, instrument_no, year, kind, numbers|part}].
    يشترط أن يسبق فعلُ الإلغاء التقسيمَ المُلغى (لا «… ما ورد في المادة (5) من نظام X، وتُلغي ما يتعارض»)."""
    c = norm(clause).replace(',', '،')
    out, start = [], 0
    for m in _TARGET.finditer(c):
        div = c[start:m.start()]
        if not out:
            v = _VERB.search(div)
            if not v:
                return []
            div = div[v.end():]
            # المُلغى يلي الفعل مباشرة («يلغي هذا النظام الباب…»)، لا «وتلغى المزايدة … المادة (55) من اللائحة»
            lead = re.sub(r'^\s*(هذا النظام|النظام|هذه اللايحه|هذه القواعد|احكام)?\s*(احكام)?\s*(العمل ب|كلا من|كل من)?\s*', '', div)
            if lead and not re.match(r'(الباب|الفصل|المواد|الماده|المادتين|المادتان|الفقره|الفقرات|البند|البنود|حكم)', lead):
                return []
        tail = c[m.end(): m.end() + 160]
        im = _INSTR.match(tail.lstrip(' ،')) or _INSTR.search(tail[:120])
        no = re.sub(r'\s', '', im.group('no')) if im else None
        yr = None
        if im:
            y = re.findall(r'1[34]\d\d', im.group('date'))
            yr = y[-1] if y else None
        t = {'law': m.group('law').strip(' ،'), 'instrument_no': no, 'year': yr}
        div = re.sub(r'^\s*(هذا النظام|النظام|هذه اللايحه)?\s*', '', div).strip(' ،و')
        nums, bad = _numbers_in(div)
        if re.search(r'الفقر|البند|\d+\s*/\s*[اأ-ي]', div):
            t['kind'] = 'paragraph'
        elif nums and not bad:
            t.update(kind='articles', numbers=nums)
        elif (r := re.search(r'الفصل\s*\(?\s*([^()]+?)\s*\)?\s*من\s*الباب\s*\(?\s*([^()]+?)\s*\)?\s*$', div)):
            t.update(kind='chapter_in_part', chapter=ordinal(r.group(1)), part=ordinal(r.group(2)))
        elif (r := re.search(r'الباب\s*\(?\s*([^()]+?)\s*\)?\s*$', div)) and ordinal(r.group(1)):
            t.update(kind='part', part=ordinal(r.group(1)))
        elif not div or re.fullmatch(r'(احكام)?', div):
            t['kind'] = 'whole'
        else:
            t['kind'] = 'unknown'
        out.append(t)
        start = m.end()
        nxt = c.find('،', m.end())
        if im and nxt != -1:
            start = nxt + 1
    return out


def masc_ordinal_word(n):
    words = {1: 'الاول', 2: 'الثاني', 3: 'الثالث', 4: 'الرابع', 5: 'الخامس', 6: 'السادس', 7: 'السابع', 8: 'الثامن',
             9: 'التاسع', 10: 'العاشر', 11: 'الحادي عشر', 12: 'الثاني عشر', 13: 'الثالث عشر', 14: 'الرابع عشر', 15: 'الخامس عشر'}
    return words.get(n)
