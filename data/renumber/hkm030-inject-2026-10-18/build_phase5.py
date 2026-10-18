"""HKM-030 — المرحلة 5: حقن البنود غير المنعكسة من الفحص الشامل (review/فجوات-التعديل-الفحص-الشامل-2026-10-18.xlsx)
بموافقة المالك 18/10/2026 («نعم»).
  python3 data/renumber/hkm030-inject-2026-10-18/build_phase5.py BATCH
التركيب داخل القاعدة بالدالة uqn_fix.hkm30_compose (phase5_fn.sql): الأساس (نص المادة المخزن أو آخر نسخة) لا يغادر
القاعدة؛ عمليات التحرير (استبدال عبارة موجودة مرة واحدة بالضبط، أو مقطع بين مرساتين، أو تعبير نمطي بمطابقة واحدة،
أو إلحاق، أو استبدال كامل) تُمرر مواصفةَ JSON مع بصمتها، والنص الجديد يُقتطع من uqn_fix.source_snapshot بموضعه وبصمته؛
أي خطأ نسخ أو عدم تطابق يرفع استثناءً يلغي المعاملة كلها. العبارات القديمة في المواصفة تُكتب بـ ⏎ للسطر الجديد.
النص الجديد يُقتطع حرفيًّا من لقطة صفحة الأداة (source_snapshots.json)؛ العبارات القديمة منقولة من نص القاعدة المعروض."""
import json, re, sys, hashlib, unicodedata
D = "ingest/uqn-fix-2026-09-25/data/"
OUT = "data/renumber/hkm030-inject-2026-10-18/"
SRC = json.load(open(D + "source_snapshots.json", encoding="utf-8"))
nfc = lambda s: unicodedata.normalize("NFC", s)
dec = lambda s: s.replace("⏎", "\n").replace("⍽", "\xa0")
md5 = lambda s: hashlib.md5(s.encode()).hexdigest()

class Inst:
    def __init__(s, p, ins, frm, pub):
        s.url = p if p.startswith("http") else "https://www.uqn.gov.sa/details?p=" + p
        s.src = SRC[s.url]; s.ins = ins; s.frm = frm; s.pub = pub; s.units = []
    def Q(s, start, end='"', after=None):  # النص بعد علامة البداية حتى علامة الإغلاق من صفحة الأداة، يُقتطع داخل القاعدة بموضعه
        o = s.src.index(after) if after else 0  # after: مرساة البند حين تتكرر العبارة في بنود عدة
        if after: assert s.src.count(after) == 1, after
        assert s.src.count(start, o) >= 1 and (after or s.src.count(start) == 1), (start, s.src.count(start))
        i = s.src.index(start, o) + len(start)
        while s.src[i] in " \n\t": i += 1  # النص المقتبس قد يبدأ في سطر تالٍ: «…بالنص الآتي:⏎"1- …»
        if s.src[i] == '"' and not start.endswith('"'): i += 1
        j = s.src.index(end, i)
        return [("src", s.url, i, j - i, s.src[i:j])]
    def item(s, a, b):  # نص البند في الأداة (سند الاقتباس) بموضعه في اللقطة
        assert s.src.count(a) == 1, a; i = s.src.index(a); j = s.src.index(b, i)
        return ("src", s.url, i, j - i, s.src[i:j])
    def unit(s, uid, key, base_md5, ev, edits, prev=None, frm=None):
        """prev: معرّف آخر نسخة إن كان الأساس نسخة، وإلا None فالأساس نص legal_articles بلا نسخ.
        frm: تاريخ سريان خاص بالوحدة (تكملة نسخة بالتاريخ نفسه تأخذ 00:00:01 لأن العرض يرتب بـ valid_from ويرفض التساوي)."""
        flat = [x for e in edits for x in (e if isinstance(e, list) else [e])]
        s.units.append(dict(unit=uid, key=key, base_md5=base_md5, prev=prev, ev=ev, edits=flat, frm=frm or s.frm))

def P(*xs):  # نص مركب: أجزاء حرفية قصيرة وأجزاء مقتطعة من اللقطة
    out = []
    for x in xs: out += x if isinstance(x, list) else [("lit", x)]
    return out
def W(t): return ("whole", P(t))
def S(old, new): return ("sub", P(dec(old)), P(new))
def A(*t): return ("append", P(*t))
def SP(a, b, new): return ("span", P(dec(a)), P(dec(b)), P(new))
def FR(a, new): return ("from", P(dec(a)), P(new))  # من المرساة حتى آخر النص
def RE(pat, rep): return ("re", P(pat), P(rep))  # تعبير نمطي يجب أن يطابق مرة واحدة بالضبط
def RENUM(lo, hi, d=-1):  # إعادة ترقيم الفقرات lo..hi بإزاحة d («.4 - » ← «.3 - »)؛ الترتيب يمنع التصادم
    ns = range(lo, hi + 1) if d < 0 else range(hi, lo - 1, -1)
    return [RE(rf"([.:]\s?){n}(\s?-\s)", rf"\1{n + d}\2") for n in ns]
text = lambda parts: "".join(x[-1] if x[0] == "src" else x[1] for x in parts)

BATCHES = {}
# ── الدفعة 1 ──
b1 = []
I = Inst("26925", "قرار مجلس الوزراء رقم 430 وتاريخ 1446/6/23هـ", "2025-01-17T00:00:00Z", "1446/7/17")
SEP = "  \n  "
I.unit("own26-7e3400b1d807e01fa07af38b", "430-1", "c58196763c110a857d1be635a926896f", I.item("أولاً: تعديل المادة (الأولى)", "ثانياً:"),
       [S("  ⏎  النظام : نظام الاتصالات .", ""), A(SEP, I.Q('2- إضافة التعريف الآتي: "'))])
I.unit("own26-3306b9c9e16086a0cd0f99e7", "430-3", "58d6d8c80b819f1fd0f903d23fe83991", I.item("ثانياً: تعديل المادة (الثالثة)", "ثالثاً:"),
       [W(I.Q('ثانياً: تعديل المادة (الثالثة) لتكون بالنص الآتي: "'))])
I.unit("own26-7dfb50df4bb80dbe2fd40da9", "430-5", "b57c2bde48cadaae10fa23704d035f86", I.item("رابعاً: تعديل المادة (الخامسة)", "خامساً:"),
       [S("ب – تحديد المقابل المالي الذي تتقاضاه الهيئة عن أية أعمال أو خدمات تقدمها للمشغلين وأمثالهم وفقا للنظام.", P("ب – ", I.Q('1- تعديل الفقرة (ب) لتكون بالنص الآتي: "'), ".")),
        S("ج – الموافقة على منح التراخيص التي تدخل في اختصاص الهيئة.", P("ج – ", I.Q('2- تعديل الفقرة (ج) لتكون بالنص الآتي: "'), ".")),
        S("  ⏎  ط – تشكيل اللجان وتخويلها الصلاحيات اللازمة لإنجاز المهام المناطة بها.", ""),
        A(SEP, I.Q('4- إضافة النص الآتي إلى عجز المادة: "'))])
I.unit("own26-2ca4255948dddd66bc8228a7", "430-8", "49e72dbff86cdc4d6bab46e53da869cf", I.item("خامساً: تعديل المادة (الثامنة)", "سادساً:"),
       [A(SEP, "ي – ", I.Q('تكون الفقرة (ي) بالنص الآتي: "'), "." + SEP + "ك – ", I.Q('تكون الفقرة (ك) بالنص الآتي: "'), "." + SEP + "ل – ", I.Q('تكون الفقرة (ل) بالنص الآتي: "'), ".")])
b1.append(I)

# تنظيم هيئة تنمية الصادرات السعودية — قرار 539. البند 1 (الرئيس التنفيذي) طُبّق في المرحلة 3، والمادة 14 من هيئة الخبراء.
# مستبقى: المادة 4 (الأداة تحذف الفقرة (12) والنص المخزن ينتهي بالفقرة 11، فالأساس ينقصه تعديل سابق).
I = Inst("19422", "قرار مجلس الوزراء رقم 539 وتاريخ 1443/9/18هـ", "2022-05-13T00:00:00Z", "1443/10/12")
I.unit("cmpz64v9004cbcwg253xrnolj", "539-3", "16a9295744eaf33cb6c947d1c3997dd0", I.item("2- تعديل المادة (الثالثة)", "3- تعديل المادة (الرابعة)"),
       [S("تعنى الهيئة بشؤون تنمية الصادرات غير النفطية في المملكة، ولها على سبيل المثال ما يلي :", P(I.Q('أ- تعديل صدرها ليكون بالنص الآتي: "', ':...', after="2- تعديل المادة (الثالثة)"), ":")),
        A(" ", I.Q('ب- إضافة الفقرات الآتية إليها:"', after="2- تعديل المادة (الثالثة)"), ".")])
I.unit("cmpz64vqx04chcwg2m338983w", "539-6", "86a559a76396933fc2d597c29a5d5b2c", I.item("4- تعديل المادة (السادسة)", "5- تعديل المادة (السابعة)"),
       [SP("2 - يجتمع مجلس الإدارة بدعوة من الرئيس", "3 - للمجلس أن يدعو", P(I.Q('أ- تعديل الفقرة (2) منها لتكون بالنص الآتي: "', after="4- تعديل المادة (السادسة)"), ".")),
        A(" ", I.Q('ب- إضافة الفقرتين الآتيتين إليها:"', after="4- تعديل المادة (السادسة)"), ".")])
I.unit("cmpz64vwv04cjcwg235fowno9", "539-7", "7edf6573e4bcdd1eeef78644178ad12b", I.item("5- تعديل المادة (السابعة)", "6- تعديل المادة (العاشرة)"),
       [SP("يكون للهيئة رئيس تنفيذي لا تقل مرتبته", " 1 - الإشراف على الخطط", P(I.Q('أ- تعديل صدرها ليكون بالنص الآتي: "', ':...', after="5- تعديل المادة (السابعة)"), ":")),
        S("7 - تعيين العاملين في الهيئة، وفقًا للقواعد المنظمة لذلك.", P(I.Q('ج- تعديل الفقرة (7) منها لتكون بالنص الآتي: "'), ".")),
        S("8 - إصدار الأوامر بمصروفات الهيئة، بموجب الميزانية السنوية المعتمدة ولوائح المؤسسة ذات العلاقة.", P(I.Q('د- تعديل الفقرة (8) منها لتكون بالنص الآتي: "'), ".")),
        S("3 - الإشراف على الإعداد لاجتماعات مجلس الإدارة.", ""),
        RENUM(4, 14)],  # «وإعادة ترتيب فقرات المادة تبعاً لذلك»
       prev="hkm30u-e5cdf4f84835b4d8643a00fa", frm="2022-05-13T00:00:01Z")
I.unit("cmpz64weq04cpcwg2rl87n6g8", "539-10", "23ac2bcbf7f29be1b4e329f927062d95", I.item("6- تعديل المادة (العاشرة)", "7- تعديل المادة (الرابعة عشرة)"),
       [S("2 - المقابل المالي الذي تتقاضاه عن الأعمال التي تقدمها وفقًا للتنظيم.", P(I.Q('أ- تعديل الفقرة (2) منها لتكون بالنص الآتي: "', after="6- تعديل المادة (العاشرة)"), ".")),
        S("3 - التبرعات والهبات والمساعدات التي تقدم لها.", P(I.Q('ب- تعديل الفقرة (3) منها لتكون بالنص الآتي: "', after="6- تعديل المادة (العاشرة)"), ".")),
        A(" ", I.Q('ج- إضافة الفقرات الآتية:"'), ".")])
b1.append(I)

# نظام مراقبة شركات التمويل — المرسوم الملكي م/272 (عملياته السبع المستخرجة لم تُطبّق قط، فتُركّب هنا مع بنود الطابور EFF-00046).
# خارج النطاق: البند 11 (عنوان الفصل الخامس، ليس مادة). مستبقى: البند 14 (مادة جديدة «السادسة والثلاثون مكرر» تحتاج إنشاء وحدة).
# ملاحظة: الأساس ما زال بلفظ «المؤسسة» (الإحلال العام بـ«البنك» غير مطبّق)، والنصوص الجديدة بلفظ «البنك» كما وردت.
I = Inst("25139", "المرسوم الملكي رقم م/272 وتاريخ 1445/12/4هـ", "2024-06-20T00:00:00Z", "1445/12/14")
it = lambda n, m: I.item(f"\n{n}- {'إضافة' if n in (2, 14) else 'تعديل'}", f"\n{m}- {'إضافة' if m in (2, 14) else 'تعديل'}")
I.unit("cmpzcvci30brhvtrk6cwuvl9y", "m272-1", "94013d72d2c8a45b2915bff70137b6b3", it(1, 2),
       [S("شركة التمويل : الشركة المساهمة الحاصلة على ترخيص لممارسة نشاط التمويل.", P(I.Q('ليكون بالنص الآتي: "', after="\n1- تعديل تعريف"), "."))])
I.unit("cmpzcvci30brlvtrkr9eyzb3m", "m272-5", "ce95b8d2a4243f60e50872078a445947", it(2, 3),
       [S("استيفاء أي شرط آخر تحدده اللائحة لإصدار الترخيص.", P(I.Q('أولاً) من المادة (الخامسة) من النظام، تنص على الآتي: "'), ". استيفاء أي شرط آخر تحدده اللائحة لإصدار الترخيص."))])
I.unit("cmpzcvci30brrvtrk9ilb4gge", "m272-11", "c73a49f2d00bc29e5f58a8fbf5f9359e", it(3, 4),
       [S("مزاولة أي نشاط آخر غير التمويل. امتلاك منشأة تزاول نشاطاً آخر غير التمويل سواء بشكل مباشر أو غير مباشر.", P(I.Q("من المادة (الحادية عشرة) من النظام، لتكونا بالنص الآتي:"), "."))])
I.unit("cmpzcvci30brsvtrkr9ohpxwd", "m272-12", "e04c4fbbc4dc3b7507872968a7e031a6", I.item("\n4- تعديل الفقرة الفرعية", "\n6- تعديل صدر"),
       [S("د - أن تمول أو تمنح تسهيلات للأشخاص أو المنشآت إذا كان أحد أعضاء مجلس إدارة شركة التمويل، أو أحد مراقبي حساباتها الخارجيين كفيلاً للحصول على التمويل أو التسهيلات.",
          P("د - ", I.Q('من الفقرة (1) من المادة (الثانية عشرة) من النظام، لتكون بالنص الآتي: "'), ".")),
        FR("دون إخلال بالحق العام والخاص اللذين تقررهما الأنظمة؛", P(I.Q('5- تعديل الفقرة (2) من (المادة الثانية عشرة) من النظام، لتكون بالنص الآتي: "'), "."))])
I.unit("cmpzcvci30brwvtrk2pd3wjg4", "m272-16", "79ea6f153e08754ec678854b84c02f8b", it(6, 7),
       [SP("يشترط لعضوية مجلس إدارة شركة التمويل ما يأتي:", "ألاّ يكون قد عزل تأديبيًا", P(I.Q('والفقرتين (1) و(2) منها، لتكون بالنص الآتي: "'), ". "))])
for uid, n, ord_, m in (("cmpzcvci30brxvtrkiyw1jowm", 17, "السابعة عشرة", "eeb8d5241b90e06de39aaf9270a267e1"), ("cmpzcvci30bryvtrkzw25w2h2", 18, "الثامنة عشرة", "a95df1cdac4884e99b9367af9bc6ed86"),
                        ("cmpzcvci30brzvtrke1w1h0hi", 19, "التاسعة عشرة", "1cd09d1a08c38ffbe537828353015c62"), ("cmpzcvci30bs0vtrkkly7yme2", 20, "العشرين", "b88706d854c2364efea94c462f45486d"),
                        ("cmpzcvci30bs1vtrkdrqm7t2c", 21, "الحادية والعشرين", "bc4aa2be19a88bb208a5d936324694e5"), ("cmpzcvci30bs9vtrka4u0ecbk", 29, "التاسعة والعشرين", "512f0cb36216e0aab7234143c8d5b6a7")):
    k = f"تعديل المادة ({ord_}) من النظام، لتكون بالنص الآتي: \""
    a0 = I.src.index(k); a1 = I.src.rindex("\n", 0, a0) + 1
    I.unit(uid, f"m272-{n}", m, ("src", I.url, a1, I.src.index('".', a0) + 2 - a1, I.src[a1:I.src.index('".', a0) + 2]), [W(I.Q(k))])
b1.append(I)
BATCHES["1"] = b1

q = lambda s: "'" + s.replace("'", "''") + "'"
def jpart(parts):  # أجزاء النص إلى JSON: نص حرفي، أو ["@", url, موضع, طول, md5] لما يُقتطع من اللقطة
    out = [x[1] if x[0] == "lit" else ["@", x[1], x[2], x[3], md5(x[4])] for x in parts]
    return out[0] if len(out) == 1 else out
def jspec(edits):  # المسافة غير المنقسمة تُكتب \u00a0 لتبقى مرئية عند النقل
    return json.dumps([[e[0]] + [jpart(p) for p in e[1:]] for e in edits], ensure_ascii=False).replace("\xa0", "\\u00a0")
def compose(base_sql, edits):
    sp = jspec(edits); assert "$j$" not in sp
    return f"uqn_fix.hkm30_compose({base_sql}, $j${sp}$j$, '{md5(sp)}')"

def build(batch):
    rows, st = [], []
    for I in BATCHES[batch]:
        for u in I.units:
            vid = "hkm30u-" + hashlib.sha256(f"{u['unit']}@{u['frm'][:10]}@{u['key']}".encode()).hexdigest()[:24]
            note = f"؛ نُشر في أم القرى {I.pub}هـ (HKM-030 المرحلة 5)"
            if u["prev"]:
                base = f"(SELECT body FROM unit_version WHERE id={q(u['prev'])} AND unit_id={q(u['unit'])} AND md5(body)={q(u['base_md5'])})"
            else:
                base = f"(SELECT normalize(content, NFC) FROM legal_articles WHERE id={q(u['unit'])} AND md5(content)={q(u['base_md5'])})"
            quote = f"left(btrim(regexp_replace({compose(chr(39) * 2, [('append', [u['ev']])])}, '\\s+', ' ', 'g')), 560) || {q(note)}"
            st.append(f"INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at) "
                      f"SELECT {q(vid)}, {q(u['unit'])}, {compose(base, u['edits'])}, {q(u['frm'])}, {q(I.ins)}, {q(I.url)}, {quote}, now() "
                      f"WHERE (SELECT id FROM unit_version WHERE unit_id={q(u['unit'])} ORDER BY valid_from DESC LIMIT 1) IS NOT DISTINCT FROM {q(u['prev']) if u['prev'] else 'NULL'}")
            whole = u["edits"][0][0] == "whole" and len(u["edits"]) == 1
            rows.append(dict(id=vid, unit=u["unit"], url=I.url, frm=u["frm"], edits=len(u["edits"]), prev=u["prev"],
                             expected_md5=md5(nfc(text(u["edits"][0][1]))) if whole else None))
    ids = ",".join(q(r["id"]) for r in rows)
    st.append(f"SELECT 1/(CASE WHEN (SELECT count(*) FROM unit_version WHERE id IN ({ids}))={len(rows)} THEN 1 ELSE 0 END) AS guard_after")
    st.append(f"SELECT md5(string_agg(id||':'||md5(body), ',' ORDER BY id)) fp, string_agg(id||':'||md5(body), ',' ORDER BY id) rows FROM unit_version WHERE id IN ({ids})")
    json.dump(rows, open(OUT + f"plan5_{batch}.json", "w"), ensure_ascii=False, indent=1)
    json.dump(st, open(OUT + f"statements5_{batch}.json", "w"), ensure_ascii=False, indent=1)
    print("batch", batch, "versions", len(rows), "statements", len(st), "chars", sum(map(len, st)))

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "1")
