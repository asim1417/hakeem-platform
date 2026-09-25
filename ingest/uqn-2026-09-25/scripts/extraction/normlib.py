import re
def norm(s):
    s=re.sub(r'[ً-ْـ]','',s)
    s=re.sub(r'[إأآا]','ا',s).replace('ة','ه').replace('ى','ي').replace('ؤ','و').replace('ئ','ي')
    s=re.sub(r'\(.*?\)','',s)
    s=re.sub(r'[0-9٠-٩]+\s*هـ?','',s)
    s=re.sub(r'[^ء-ي ]',' ',s)
    s=re.sub(r'\bال','',s)  # crude
    s=' '.join(w[2:] if w.startswith('ال') else w for w in s.split())
    return ' '.join(s.split())
