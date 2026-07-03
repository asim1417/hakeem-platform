# -*- coding: utf-8 -*-
"""
nezams_parse.py — مُفكِّك خاصّ بتنسيق nezams الفعلي (بعد التشخيص):
  * المحتوى مُضمَّن في HTML لكنه يُحمَّل كسولًا ⇒ نمرّر الصفحة أولًا.
  * كل مادة نظام كتلة تنتهي ببصمة «رقم المادة N» (الرقم الموثوق، أرقام عربية/لاتينية).
  * داخل الكتلة: نصّ النظام ثم «اللائحة:» يليها بنود «س/ص» (بنود اللائحة المُزاوَجة بنيويًّا).
  * إشارات «المادة (كذا) من النظام» تبقى دليلًا صريحًا (0.98).

المخرج data/nezams_pairings.json: لكل مادة نظام رقمها وبنود لائحتها ومراجعها الصريحة —
يُدمج لاحقًا في الرسم القائم (علاقات بنيوية 0.9 بين عُقدنا). قراءة من المصدر فقط.
"""
import sys, re, json, os
from playwright.sync_api import sync_playwright

AR2EN = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
HARAKAT = re.compile(r"[ؗ-ًؚ-ْـ]")

def norm(s):
    s = HARAKAT.sub("", s or "")
    return s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي").strip()

# أعداد ترتيبية مؤنّثة (لتأكيد رقم المادة من العنوان عند غياب البصمة)
_ORD = {norm(k): v for k, v in {
 "اولي":1,"حادية":1,"واحدة":1,"ثانية":2,"ثالثة":3,"رابعة":4,"خامسة":5,"سادسة":6,"سابعة":7,"ثامنة":8,"تاسعة":9,
 "عاشرة":10,"عشرة":10,"عشر":10,"عشرون":20,"عشرين":20,"ثلاثون":30,"ثلاثين":30,"اربعون":40,"اربعين":40,"خمسون":50,
 "خمسين":50,"ستون":60,"ستين":60,"سبعون":70,"سبعين":70,"ثمانون":80,"ثمانين":80,"تسعون":90,"تسعين":90,
 "مائة":100,"مئة":100,"مائتان":200,"مئتان":200,"مائتين":200,"مئتين":200,"ثلاثمائة":300,"اربعمائة":400,
 "خمسمائة":500,"ستمائة":600,"سبعمائة":700,"ثمانمائة":800,"تسعمائة":900}.items()}
_SKIP = {"و","بعد","من","ال","المادة","الماده",""}
def parse_ord(p):
    p = norm(p).translate(AR2EN)
    m = re.search(r"\d+", p)
    if m and not re.search(r"[؀-ۿ]", re.sub(r"\d","",p)): return int(m.group())
    t, f = 0, False
    for tok in re.split(r"[\sـ]+", p):
        tok = re.sub(r"^و?ال","",tok); tok = re.sub(r"^و","",tok)
        if tok in _SKIP: continue
        if tok in _ORD: t += _ORD[tok]; f = True
    return t if f and t>0 else None

# إشارة صريحة «المادة (كذا) من النظام»
_REF = re.compile(r"الماد(?:ة|ه)\s*\(?\s*([^)\n]{2,45}?)\s*\)?\s*من\s+(?:هذا\s+)?النظام")
def explicit_refs(text):
    out=set()
    for g in _REF.findall(text):
        n=parse_ord(g)
        if n: out.add(n)
    return sorted(out)

# بنود اللائحة: «س/ص» بأرقام عربية أو لاتينية
_BYLAW_LABEL = re.compile(r"(?<![\d/])([٠-٩\d]{1,3})\s*/\s*([٠-٩\d]{1,3})(?![\d/])")

def fetch_rendered_scrolled(url):
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        pg = b.new_page()
        pg.goto(url, wait_until="networkidle", timeout=60000)
        pg.wait_for_timeout(3000)
        # تمرير متكرّر حتى يثبت طول النص (تحميل كسول)
        prev = 0
        for _ in range(40):
            pg.mouse.wheel(0, 6000)
            pg.wait_for_timeout(350)
            cur = pg.evaluate("document.body.innerText.length")
            if cur == prev: break
            prev = cur
        text = pg.inner_text("body")
        b.close()
    return text

def parse_page(text, url):
    law = norm(text.splitlines()[0]) if text.strip() else url
    # اسم النظام الحقيقي غالبًا في سطر العنوان (بعد أسطر الترويسة)
    for ln in text.splitlines()[:8]:
        if "نظام" in ln and len(ln) < 80:
            law = ln.strip(); break

    # قسّم ببصمة «رقم المادة N»
    foot = list(re.finditer(r"رقم\s+الماد(?:ة|ه)\s*([٠-٩\d]{1,4})", text))
    pairings = []
    prev_end = 0
    for m in foot:
        block = text[prev_end:m.start()]
        prev_end = m.end()
        num = int(m.group(1).translate(AR2EN))
        # افصل نصّ النظام عن قسم اللائحة
        parts = re.split(r"\n\s*اللائحة\s*[:：]?\s*\n", block, maxsplit=1)
        sys_body = parts[0]
        bylaw_body = parts[1] if len(parts) > 1 else ""
        labels = ["/".join(g.translate(AR2EN) for g in lab) for lab in _BYLAW_LABEL.findall(bylaw_body)]
        # أزل التكرار مع الحفاظ على الترتيب
        seen=set(); labels=[x for x in labels if not (x in seen or seen.add(x))]
        pairings.append({
            "sysNum": num,
            "bylawLabels": labels,
            "explicitRefs": explicit_refs(block),
            "hasBylaw": bool(bylaw_body.strip()),
        })
    return law, pairings

def main():
    if len(sys.argv) < 2:
        print("الاستعمال: python nezams_parse.py <url> [url2 ...]"); sys.exit(1)
    all_out = []
    for url in sys.argv[1:]:
        text = fetch_rendered_scrolled(url)
        law, pairings = parse_page(text, url)
        withBylaw = sum(1 for p in pairings if p["bylawLabels"])
        totLabels = sum(len(p["bylawLabels"]) for p in pairings)
        totExplicit = sum(len(p["explicitRefs"]) for p in pairings)
        print(f"\n▮ {law}  ({url})")
        print(f"   مواد نظام مُلتقَطة (رقم المادة N): {len(pairings)}")
        print(f"   مواد لها بنود لائحة مُزاوَجة: {withBylaw} · إجمالي بنود لائحة: {totLabels}")
        print(f"   إشارات صريحة «من النظام»: {totExplicit}")
        for p in pairings[:5]:
            print(f"     • مادة {p['sysNum']}: لائحة={p['bylawLabels'][:6]} صريح={p['explicitRefs']}")
        all_out.append({"law": law, "url": url, "pairings": pairings})

    os.makedirs("data", exist_ok=True)
    with open("data/nezams_pairings.json", "w", encoding="utf-8") as f:
        json.dump(all_out, f, ensure_ascii=False, indent=2)
    print(f"\n✓ كُتب data/nezams_pairings.json — {len(all_out)} صفحة، مواد={sum(len(x['pairings']) for x in all_out)}")

if __name__ == "__main__":
    main()
