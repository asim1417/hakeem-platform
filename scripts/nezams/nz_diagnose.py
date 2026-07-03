# -*- coding: utf-8 -*-
"""
nz_diagnose.py — تشخيص بنية صفحة nezams: لماذا يرى المُستخرِج ٧ مواد فقط؟
يطبع: طول النص المُصيَّر، عدّ «المادة» (بنقطتين وبدونها)، عدّ «من النظام»،
وأي نداءات XHR/fetch (رابط + نوع + طول)، ومقتطفًا حيث يُفترض أن تبدأ المواد.
قراءة من المصدر فقط.
"""
import sys, re
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else "https://nezams.com/"

xhr = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--no-sandbox"])
    pg = b.new_page()
    pg.on("response", lambda r: xhr.append((r.request.method, r.status, r.url, (r.headers or {}).get("content-type", ""))) if re.search(r"/wp-json|/api|/ajax|admin-ajax|\.json", r.url) else None)
    pg.goto(url, wait_until="networkidle", timeout=60000)
    pg.wait_for_timeout(4000)
    # جرّب تمرير الصفحة لتحفيز أي تحميل كسول
    for _ in range(6):
        pg.mouse.wheel(0, 4000)
        pg.wait_for_timeout(400)
    html = pg.content()
    text = pg.inner_text("body")
    # عدّ عناصر محتملة للمواد
    n_class_article = len(pg.query_selector_all("[class*=article], [class*=mada], article, .elementor-tab-content, .wp-block"))
    b.close()

print("طول HTML:", len(html), "· طول النص:", len(text))
print("عدد «المادة»:", len(re.findall(r"الماد(?:ة|ه)", text)))
print("عدد «المادة X:» (نمط المُستخرِج):", len(re.findall(r"الماد(?:ة|ه)\s*\(?\s*[^\)\n:]{2,45}?\s*\)?\s*[:：]", text)))
print("عدد «من النظام»:", len(re.findall(r"من\s+(?:هذا\s+)?النظام", text)))
print("عدد «اللائحة»:", len(re.findall(r"اللائحة", text)), "· «الضوابط»:", len(re.findall(r"الضوابط", text)), "· «الأدلة»:", len(re.findall(r"الأدل", text)))
print("عناصر مرشّحة (article/tab/block):", n_class_article)

print("\n— نداءات XHR/JSON محتملة —")
seen = set()
for m, s, u, ct in xhr:
    if u in seen: continue
    seen.add(u)
    print(f"  {m} {s} {ct[:40]}  {u[:140]}")
if not seen:
    print("  (لا شيء — المحتوى غالبًا مُضمَّن في HTML)")

# أين تبدأ «المادة الأولى»؟
m = re.search(r"الماد(?:ة|ه)\s*\(?\s*(الاول|الأول|أول|اول)", text)
print("\n— موضع «المادة الأولى» في النص:", m.start() if m else "غير موجود")
if m:
    print(text[m.start(): m.start() + 600].replace("\n", " ⏎ "))
else:
    # اطبع مقتطفًا من منتصف النص
    mid = len(text) // 3
    print("مقتطف من ثلث النص:\n", text[mid: mid + 600].replace("\n", " ⏎ "))
