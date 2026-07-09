#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tool_app.py — أداة عامة قابلة للنشر: يرفع المستخدم وثائقه فتُستخرَج وتُنظَّف وتُفهرَس وتُعرَض للبحث.
لا تحتوي أي بيانات قضية — آمنة للتداول. تعمل على أي خادم Python (مثل خادمك «حكيم»).

الميزات: رفع ملفات (نص/‏Word/‏PDF/صور) → استخراج نص → تطبيع وتنظيف عربي → فهرسة بحث (FTS) → عرض.
الأمان (اختياري): APP_PASSWORD يقفل الأداة خلف تسجيل دخول.

التشغيل:  APP_PASSWORD=اختياري  uvicorn tool_app:app --host 0.0.0.0 --port 8080
المتطلبات الأساسية: fastapi, uvicorn, python-multipart, python-docx.
اختياري لـPDF/الصور: pdfminer.six (نص PDF) · pytesseract + pdf2image + Pillow (OCR للمسح).
"""
import os, re, io, json, hmac, hashlib, sqlite3, tempfile
from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

APP_PASSWORD = os.environ.get("APP_PASSWORD", "")
SECRET = os.environ.get("SESSION_SECRET", "") or (APP_PASSWORD + "::tool::salt")
DB = os.environ.get("TOOL_DB", os.path.join(tempfile.gettempdir(), "tool_docs.db"))
COOKIE = "tool_auth"
app = FastAPI(title="أداة معالجة الوثائق العربية", docs_url=None, redoc_url=None)

# ---------- العقل: doc_reader (وحدة مستقلة — قراءة وتنظيف وتطبيع) ----------
# المنطق كله في doc_reader.py: clean_text/norm/read_bytes — بلا تكرار هنا.
# مكسب مباشر: read_bytes يلتقط جداول Word أيضاً (كثير من الوثائق القانونية جداول).
from doc_reader import clean_text, norm, read_bytes as extract_text  # noqa: E402

# المعالجة في الخلفية (مهام) + مزوّد Gemini الإضافي
import jobs as jobstore  # noqa: E402
from gemini_provider import gemini_available  # noqa: E402

jobstore.resume_pending()  # استئناف أي مهمّة لم تكتمل قبل إعادة تشغيل الخادم

# ---------- قاعدة البيانات ----------
def _db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.executescript("""
      CREATE TABLE IF NOT EXISTS docs(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, kind TEXT,
        full_text TEXT, norm_text TEXT);
      CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(body);
    """)
    return con


# ---------- المصادقة ----------
def _token():
    return hmac.new(SECRET.encode(), b"ok", hashlib.sha256).hexdigest()


def _authed(req):
    return (not APP_PASSWORD) or req.cookies.get(COOKIE) == _token()


LOGIN = """<!doctype html><html lang=ar dir=rtl><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>دخول</title><style>body{font-family:Tahoma;background:#0f172a;color:#e5e7eb;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.b{background:#1e293b;padding:26px;border-radius:14px;width:300px}input{width:100%;padding:11px;margin:9px 0;border-radius:9px;border:1px solid #334155;background:#0f172a;color:#fff;box-sizing:border-box}
button{width:100%;padding:11px;border:0;border-radius:9px;background:#2563eb;color:#fff;font-size:16px}</style>
<div class=b><h2>أداة معالجة الوثائق</h2><form method=post id=lf><input type=password name=password placeholder="كلمة المرور" autofocus>
<div style="color:#fca5a5;font-size:13px">__E__</div><button>دخول</button></form></div>
<script>/* مسار دخول نسبي: يعمل على الجذر مباشرةً أو خلف بادئة بروكسي مثل /doc-tool */
var p=location.pathname.replace(new RegExp('/+$'),'');if(p.slice(-6)=='/login')p=p.slice(0,-6);
document.getElementById('lf').action=p+'/login';</script></html>"""


@app.post("/login")
def login(password: str = Form("")):
    if APP_PASSWORD and hmac.compare_digest(password, APP_PASSWORD):
        # إعادة توجيه نسبية (".") — تُحلّ إلى جذر الأداة سواء كانت على / أو خلف /doc-tool
        r = RedirectResponse(".", status_code=303)
        r.set_cookie(COOKIE, _token(), httponly=True, samesite="lax", max_age=604800)
        return r
    return HTMLResponse(LOGIN.replace("__E__", "كلمة مرور خاطئة"), 401)


def _guard(req):
    if not _authed(req):
        raise HTTPException(401, "غير مصرّح")


# ---------- API ----------
@app.post("/api/upload")
async def upload(req: Request, files: list[UploadFile] = File(...)):
    _guard(req)
    con = _db(); added = []
    for f in files:
        data = await f.read()
        txt, kind = extract_text(f.filename, data)
        txt = clean_text(txt or "")
        cur = con.execute("INSERT INTO docs(title,kind,full_text,norm_text) VALUES(?,?,?,?)",
                          (f.filename, kind, txt, norm(txt)))
        con.execute("INSERT INTO fts(rowid,body) VALUES(?,?)", (cur.lastrowid, norm(txt)))
        added.append({"id": cur.lastrowid, "title": f.filename, "kind": kind,
                      "chars": len(txt), "ok": bool(txt.strip())})
    con.commit(); con.close()
    return JSONResponse({"added": added})


@app.get("/api/docs")
def api_docs(req: Request):
    _guard(req)
    con = _db(); rows = con.execute("SELECT id,title,kind,length(full_text) AS n FROM docs ORDER BY id DESC").fetchall(); con.close()
    return JSONResponse([dict(r) for r in rows])


@app.get("/api/search")
def api_search(req: Request, q: str = ""):
    _guard(req)
    q = (q or "").strip()
    if not q:
        return JSONResponse([])
    toks = [t for t in re.split(r"\s+", norm(q)) if len(t) >= 2]
    con = _db()
    try:
        match = " ".join('"%s"*' % t for t in toks)
        rows = con.execute("SELECT d.id,d.title,d.kind,snippet(fts,0,'«','»','…',12) AS snip "
                           "FROM fts JOIN docs d ON d.id=fts.rowid WHERE fts MATCH ? ORDER BY rank LIMIT 300",
                           (match,)).fetchall()
    except Exception:
        rows = con.execute("SELECT id,title,kind,'' AS snip FROM docs WHERE norm_text LIKE ? LIMIT 300",
                           ("%" + norm(q) + "%",)).fetchall()
    con.close()
    return JSONResponse([dict(r) for r in rows])


@app.get("/api/doc/{i}")
def api_doc(req: Request, i: int):
    _guard(req)
    con = _db(); r = con.execute("SELECT id,title,kind,full_text FROM docs WHERE id=?", (i,)).fetchone(); con.close()
    if not r:
        raise HTTPException(404)
    return JSONResponse(dict(r))


@app.post("/api/clear")
def api_clear(req: Request):
    _guard(req)
    con = _db(); con.executescript("DELETE FROM docs; DELETE FROM fts;"); con.commit(); con.close()
    return JSONResponse({"ok": True})


# ---------- المعالجة في الخلفية (مهام) ----------
@app.get("/api/providers")
def api_providers(req: Request):
    """المزوّدون المتاحون من سجلّ المحرّكات — يظهر أي محرّك جديد تلقائياً.
    يبقي الحقول المسطّحة (local/gemini) للتوافق مع الواجهة الحالية، ويضيف
    detail غنيّاً (needs_gpu/remote) للحوكمة ولوحة الإدارة."""
    _guard(req)
    from engines import providers_status, providers_detail

    return JSONResponse({**providers_status(), "detail": providers_detail()})


@app.post("/api/jobs")
async def api_create_job(
    req: Request,
    files: list[UploadFile] = File(...),
    provider: str = Form("local"),
    model: str = Form("flash"),
):
    """يرفع وثائق ويبدأ معالجتها في الخلفية على الخادم. يعيد job_id فوراً."""
    _guard(req)
    provider = provider if provider in ("local", "gemini") else "local"
    if provider == "gemini" and not gemini_available():
        raise HTTPException(400, "مزوّد Gemini غير مُفعّل — اضبط GEMINI_API_KEY على الخادم")
    payload = [(f.filename, await f.read()) for f in files]
    if not payload:
        raise HTTPException(400, "أرفق ملفاً واحداً على الأقل")
    job_id = jobstore.start_job(payload, provider=provider, model=(model or "flash"))
    return JSONResponse({"job_id": job_id, "total": len(payload), "provider": provider})


@app.get("/api/jobs")
def api_list_jobs(req: Request):
    _guard(req)
    return JSONResponse(jobstore.list_jobs())


@app.get("/api/jobs/{job_id}")
def api_get_job(req: Request, job_id: str, text: int = 0):
    """حالة المهمّة وتقدّمها — والنصوص عند text=1. صالحٌ للاستطلاع بعد العودة للصفحة."""
    _guard(req)
    j = jobstore.get_job(job_id, include_text=bool(text))
    if not j:
        raise HTTPException(404, "المهمّة غير موجودة")
    return JSONResponse(j)


@app.post("/api/jobs/{job_id}/import")
def api_import_job(req: Request, job_id: str):
    """يستورد نتائج مهمّة مكتملة إلى فهرس البحث (docs/fts)."""
    _guard(req)
    j = jobstore.get_job(job_id, include_text=True)
    if not j:
        raise HTTPException(404, "المهمّة غير موجودة")
    con = _db(); added = 0
    for f in j["files"]:
        txt = clean_text(f.get("text") or "")
        if not txt.strip():
            continue
        cur = con.execute(
            "INSERT INTO docs(title,kind,full_text,norm_text) VALUES(?,?,?,?)",
            (f["name"], f.get("kind") or "", txt, norm(txt)),
        )
        con.execute("INSERT INTO fts(rowid,body) VALUES(?,?)", (cur.lastrowid, norm(txt)))
        added += 1
    con.commit(); con.close()
    return JSONResponse({"imported": added})


@app.get("/healthz")
def health():
    return {"ok": True}


# ---------- الواجهة ----------
PAGE = r"""<!doctype html><html lang=ar dir=rtl><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>أداة معالجة الوثائق العربية</title>
<style>
:root{--bg:#f6f7f9;--pane:#fff;--ink:#1f2937;--mut:#6b7280;--line:#e5e7eb;--accent:#2563eb}
*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial;background:var(--bg);color:var(--ink)}
header{background:var(--pane);border-bottom:1px solid var(--line);padding:9px 12px;display:flex;gap:8px;align-items:center;position:sticky;top:0;flex-wrap:wrap}
header b{font-size:15px}#q{flex:1;min-width:160px;padding:9px 11px;border:1px solid var(--line);border-radius:9px;font-size:16px}
.btn{padding:8px 12px;border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:9px;cursor:pointer;font-size:14px}
.btn.alt{background:#fff;color:var(--accent)}
.wrap{display:flex;height:calc(100vh - 56px)}
.side{width:340px;max-width:44vw;border-inline-start:1px solid var(--line);overflow:auto;background:var(--pane)}
.it{padding:9px 12px;border-bottom:1px solid var(--line);cursor:pointer}.it:hover{background:#eff6ff}
.it .t{font-size:14px}.it .s{color:var(--mut);font-size:12px}
main{flex:1;overflow:auto;padding:16px}
.drop{border:2px dashed var(--line);border-radius:12px;padding:26px;text-align:center;color:var(--mut);margin-bottom:14px}
.drop.hl{border-color:var(--accent);background:#eff6ff}
.txt{white-space:pre-wrap;line-height:1.95;font-size:18px;font-family:"Traditional Arabic","Simplified Arabic",Tahoma,serif;direction:rtl}
mark{background:#fde68a}.cnt{color:var(--mut);font-size:12px;padding:6px 12px}.kind{color:var(--accent);font-size:11px}
@media(max-width:760px){.wrap{flex-direction:column;height:auto}.side{width:auto;max-width:none;max-height:42vh}}
</style>
<header><b>أداة معالجة الوثائق العربية</b>
  <input id=q placeholder="بحث في وثائقك…">
  <select id=prov class="btn alt" title="مزوّد المعالجة" style="padding:8px"></select>
  <select id=model class="btn alt" title="نموذج Gemini" style="padding:8px;display:none"><option value=flash>flash (سريع)</option><option value=pro>pro (دقّة أعلى)</option></select>
  <label class="btn">➕ إرفاق ملفات<input id=file type=file multiple style=display:none accept=".txt,.md,.csv,.json,.docx,.pdf,.png,.jpg,.jpeg,.tif,.tiff"></label>
  <button class="btn alt" id=clr>🗑️ مسح الكل</button>
  <span id=cnt class=cnt></span>__LOGOUT__
</header>
<div class=wrap>
  <aside class=side id=list></aside>
  <main id=detail>
    <div class=drop id=drop>📎 اسحب ملفاتك هنا أو اضغط «إرفاق ملفات».<br><small>نص/‏Word/‏PDF/صور — تُستخرَج وتُفهرَس محلياً على خادمك.</small></div>
    <div id=view style="color:#6b7280;text-align:center;margin-top:20px">ارفع وثائق ثم ابحث فيها.</div>
  </main>
</div>
<script>
/* B = بادئة المسار الحالية — '' على الجذر، '/doc-tool' خلف بروكسي حكيم */
var B=location.pathname.replace(new RegExp('/+$'),'');
var lgo=document.getElementById('lgo');if(lgo)lgo.href=B+'/logout';
var listEl=document.getElementById('list'),view=document.getElementById('view'),q=document.getElementById('q'),cnt=document.getElementById('cnt'),drop=document.getElementById('drop');
var curTokens=[];
function esc(s){return (s||'').replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
function nrm(s){var o='';for(var i=0;i<s.length;i++){var ch=s[i],c=ch.charCodeAt(0);
 if(c>=0x064B&&c<=0x0652||c===0x0640||c===0x0670)continue;o+=({'أ':'ا','إ':'ا','آ':'ا','ٱ':'ا','ة':'ه','ى':'ي','ؤ':'و','ئ':'ي'}[ch]||ch.toLowerCase());}return o;}
function api(m,u,b,cb){var x=new XMLHttpRequest();x.open(m,B+u);x.onload=function(){if(x.status==200)cb(x.responseText?JSON.parse(x.responseText):null);else if(x.status==401)location=B||'/';};if(b)x.send(b);else x.send();}
function row(d){return '<div class=it data-id="'+d.id+'"><div class=t>'+esc(d.title)+' <span class=kind>['+esc(d.kind||'')+']</span></div>'+(d.snip?'<div class=s>'+esc(d.snip).replace(/«/g,'<mark>').replace(/»/g,'</mark>')+'</div>':'')+'</div>';}
function bind(){[].forEach.call(listEl.querySelectorAll('.it'),function(el){el.onclick=function(){openDoc(el.getAttribute('data-id'));};});}
function showList(a){cnt.textContent=a.length+' وثيقة';listEl.innerHTML=a.map(row).join('')||'<div class=cnt>لا نتائج.</div>';bind();}
function refresh(){var v=q.value.trim();if(!v){curTokens=[];api('GET','/api/docs',null,showList);}else{curTokens=nrm(v).split(/\s+/).filter(function(t){return t.length>=2;});api('GET','/api/search?q='+encodeURIComponent(v),null,showList);}}
function hl(t){var e=esc(t);if(!curTokens.length)return e;var nb=nrm(t),marks=[];curTokens.forEach(function(tok){var i=0;while((i=nb.indexOf(tok,i))>=0){marks.push([i,i+tok.length]);i+=tok.length;}});
 if(!marks.length)return e;marks.sort(function(a,b){return a[0]-b[0];});var o='',p=0;marks.forEach(function(m){if(m[0]<p)return;o+=esc(t.slice(p,m[0]))+'<mark>'+esc(t.slice(m[0],m[1]))+'</mark>';p=m[1];});return o+esc(t.slice(p));}
function openDoc(id){api('GET','/api/doc/'+id,null,function(d){document.getElementById('detail').innerHTML='<h2>'+esc(d.title)+' <span class=kind>['+esc(d.kind||'')+']</span></h2><hr><div class=txt>'+hl(d.full_text||'(لا نص مستخرج)')+'</div>';});}
/* المزوّدون: local دائماً، وgemini إن ضُبط المفتاح على الخادم */
var prov=document.getElementById('prov'),modelSel=document.getElementById('model');
function setupProviders(){api('GET','/api/providers',null,function(p){var o='<option value=local>محلّي (بايثون/زيني)</option>';if(p&&p.gemini)o+='<option value=gemini>Gemini (سحابي)</option>';prov.innerHTML=o;prov.onchange=function(){modelSel.style.display=prov.value=='gemini'?'':'none';};});}
/* رفع → مهمّة خلفية على الخادم → استطلاع التقدّم (يصمد أمام إغلاق التبويب) */
function pollJob(id){api('GET','/api/jobs/'+id,null,function(j){if(!j)return;cnt.textContent='معالجة في الخلفية… '+j.done+'/'+j.total;
 if(j.status=='done'){api('POST','/api/jobs/'+id+'/import',new FormData(),function(r){cnt.textContent='اكتمل — استُورد '+(r?r.imported:0)+' وثيقة';refresh();});}
 else{setTimeout(function(){pollJob(id);},1500);}});}
function upload(files){if(!files.length)return;var fd=new FormData();for(var i=0;i<files.length;i++)fd.append('files',files[i]);
 fd.append('provider',prov.value||'local');fd.append('model',modelSel.value||'flash');
 cnt.textContent='بدء المعالجة…';api('POST','/api/jobs',fd,function(r){if(r&&r.job_id){cnt.textContent='معالجة في الخلفية… (يمكنك إغلاق الصفحة والعودة)';pollJob(r.job_id);}});}
document.getElementById('file').onchange=function(e){upload(e.target.files);};
setupProviders();
['dragenter','dragover'].forEach(function(ev){drop.addEventListener(ev,function(e){e.preventDefault();drop.classList.add('hl');});});
['dragleave','drop'].forEach(function(ev){drop.addEventListener(ev,function(e){e.preventDefault();drop.classList.remove('hl');});});
drop.addEventListener('drop',function(e){upload(e.dataTransfer.files);});
document.getElementById('clr').onclick=function(){if(confirm('مسح كل الوثائق المرفوعة؟'))api('POST','/api/clear',new FormData(),function(){refresh();document.getElementById('detail').innerHTML='<div class=drop id=drop2>📎 ارفع وثائق جديدة.</div>';});};
var t;q.oninput=function(){clearTimeout(t);t=setTimeout(refresh,200);};
refresh();
</script></html>"""


@app.get("/", response_class=HTMLResponse)
def home(req: Request):
    if not _authed(req):
        return HTMLResponse(LOGIN.replace("__E__", ""))
    logout = ('<a href="#" id=lgo style="font-size:12px;margin-inline-start:auto">خروج</a>' if APP_PASSWORD else '')
    return HTMLResponse(PAGE.replace("__LOGOUT__", logout))


@app.get("/logout")
def logout():
    # "." نسبية — تعيد إلى جذر الأداة أياً كانت البادئة
    r = RedirectResponse("."); r.delete_cookie(COOKIE); return r
