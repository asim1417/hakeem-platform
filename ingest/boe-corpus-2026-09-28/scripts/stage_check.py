"""بصمة مجمعة لصفوف دفعة من ملف التجهيز: md5 لسلسلة بصمات الصفوف مرتبة بالمعرّف، لتُقارن باستعلام واحد في الخادم.
  python3 scripts/stage_check.py <injection_dir> <chunk_name...>   (مثل work_status_03)
"""
import hashlib, json, pathlib, re, sys
D = pathlib.Path(sys.argv[1]); m = json.load(open(D / 'manifest.json'))
ids = []
for c in sys.argv[2:]:
    ids += re.findall(r"^\(?\('?(boe26-[0-9a-f]{24})'", (D / 'chunks_stage' / f'{c}.sql').read_text(), re.M) or re.findall(r"\('(boe26-[0-9a-f]{24})'", (D / 'chunks_stage' / f'{c}.sql').read_text())
ids = sorted(set(ids))
print(len(ids), hashlib.md5(''.join(m[i] for i in ids).encode()).hexdigest())
