"""HKM-056 (وتعديلات HKM-057): محلل لقطات الهيئة — التاريخ الوهمي /01/01، وإسناد الملاحظة لمادتها، والبطاقة من رأس النسخة الحالية.
python3 -m unittest scripts/test_parse_snapshots.py (من مجلد اللقطة). صفحات اصطناعية بصيغة الهيئة؛ لا شبكة ولا قاعدة.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from parse_snapshots import instrument_date_hijri, is_placeholder_hijri, parse_page  # noqa: E402


def page(issued: str, instruments: list[str], articles: str = "", extra_before: str = "") -> dict:
    lis = "".join(f"<li>{x}</li>" for x in instruments)
    html = f"""<html><body>{extra_before}
<div class="col system_info">
 <div><label for="">الاسم</label> <span>نظام الاختبار</span></div>
 <div><label for="">تاريخ الإصدار</label> <span>{issued}</span></div>
 <div><label for="">تاريخ النشر</label> <span> 1423/04/10 هـ الموافق : 21/06/2002 مـ </span></div>
 <div><label for="">الحالة</label> <span>ساري</span></div>
 <div><label for="">أدوات إصدار النظام</label> <ul>{lis}</ul></div>
</div>
<div class="body">{articles}</div></body></html>"""
    return {"guid": "00000000-0000-0000-0000-000000000001", "sha256": "x", "url": "u", "html": html}


def art(heading: str, body: str, notes: list[str], inner: str = "") -> str:
    pops = "".join(f'<div class="article_item_popup"><div class="HTMLContainer">{n}</div></div>' for n in notes)
    return f'<div class="article_item"><h3>{heading}</h3><div class="HTMLContainer">{body}</div>{pops}{inner}</div>'


class IssueDate(unittest.TestCase):
    def test_placeholder_detected(self):
        self.assertTrue(is_placeholder_hijri("1423/01/01"))
        self.assertFalse(is_placeholder_hijri("1423/01/09"))
        self.assertFalse(is_placeholder_hijri(None))

    def test_instrument_date_both_orders(self):
        self.assertEqual(instrument_date_hijri(["قرار مجلس الوزراء رقم 78 بتاريخ 29 / 3 / 1423"]), "1423/03/29")
        self.assertEqual(instrument_date_hijri(["مرسوم ملكي رقم ( م/50) وتاريخ 1439/5/28هـ"]), "1439/05/28")
        self.assertEqual(instrument_date_hijri(["مرسوم ملكي رقم م/٤٥ بتاريخ ٥ / ٨ / ١٣٩٢"]), "1392/08/05")

    def test_instrument_prefers_decree_then_order_then_cabinet(self):
        # HKM-057: الأولوية بنوع السند لا بترتيبه في البطاقة؛ وأداة بلا «مرسوم/أمر/قرار … رقم» لا تحدد تاريخ الإصدار.
        got = instrument_date_hijri(["قرار مجلس الوزراء رقم 9 بتاريخ 7 / 2 / 1400", "ملحق بتاريخ 2 / 2 / 1400", "مرسوم ملكي رقم م/1 بتاريخ 9 / 3 / 1400"])
        self.assertEqual(got, "1400/03/09")
        self.assertEqual(instrument_date_hijri(["أمر ملكي رقم أ/1 بتاريخ 3 / 4 / 1400", "قرار مجلس الوزراء رقم 9 بتاريخ 7 / 2 / 1400"]), "1400/04/03")
        self.assertIsNone(instrument_date_hijri(["ملحق بتاريخ 2 / 2 / 1400"]))
        self.assertIsNone(instrument_date_hijri(["بلا تاريخ"]))

    def test_instrument_jan1_is_a_real_date(self):
        # سند الإصدار نفسه بتاريخ 1/1 (نظام مكافحة التستر م/4 وتاريخ 1442/1/1هـ) تاريخ حقيقي لا يُتخطى.
        self.assertEqual(instrument_date_hijri(["مرسوم ملكي رقم (م/4) وتاريخ 1442/1/1هـ", "قرار مجلس الوزراء رقم (785) وتاريخ 1441/12/28هـ."]), "1442/01/01")

    def test_instrument_number_is_not_read_as_date(self):
        self.assertEqual(instrument_date_hijri(["مرسوم ملكي رقم 17 /2 /28 /8634 بتاريخ 29 / 6 / 1370"]), "1370/06/29")

    def test_placeholder_confirmed_by_real_jan1_instrument(self):
        law = parse_page(page("1442/01/01 هـ الموافق : 20/08/2020 مـ", ["مرسوم ملكي رقم (م/4) وتاريخ 1442/1/1هـ", "قرار مجلس الوزراء رقم (785) وتاريخ 1441/12/28هـ."]), None)["law"]
        self.assertEqual((law["issued_hijri"], law["issued_gregorian"]), ("1442/01/01", "2020-08-20"))
        self.assertIn("issued_placeholder:confirmed_by_instrument", law["parse_flags"])

    def test_placeholder_replaced_from_instrument(self):
        law = parse_page(page("1423/01/01 هـ  الموافق : 15/03/2002 مـ", ["قرار مجلس الوزراء رقم 78 بتاريخ 29 / 3 / 1423"]), None)["law"]
        self.assertEqual(law["issued_hijri"], "1423/03/29")
        self.assertIsNone(law["issued_gregorian"])  # الميلادي تحويل التاريخ الوهمي فلا يُبقى
        self.assertIn("issued_placeholder:from_instrument", law["parse_flags"])
        self.assertTrue(law["issued_raw"].startswith("1423/01/01"))  # الأصل كما ورد

    def test_placeholder_without_dated_instrument(self):
        law = parse_page(page("1423/01/01 هـ  الموافق : 15/03/2002 مـ", ["قرار بلا تاريخ"]), None)["law"]
        self.assertIsNone(law["issued_hijri"])
        self.assertIn("issued_placeholder:unresolved", law["parse_flags"])

    def test_real_date_untouched(self):
        law = parse_page(page("1443/05/26 هـ الموافق : 30/12/2021 مـ", ["مرسوم ملكي رقم (م/43) وتاريخ 1443/5/26هـ"]), None)["law"]
        self.assertEqual((law["issued_hijri"], law["issued_gregorian"]), ("1443/05/26", "2021-12-30"))
        self.assertFalse(any(f.startswith("issued_placeholder") for f in law["parse_flags"]))


class NoteAttribution(unittest.TestCase):
    def test_nested_article_note_belongs_to_inner_only(self):
        inner = art("المادة الثانية", "نص المادة الثانية", ["عدلت هذه المادة بموجب المرسوم الملكي رقم (م/5) وتاريخ 1430/1/9هـ"])
        outer = art("المادة الأولى", "نص المادة الأولى", ["عدلت هذه المادة بموجب المرسوم الملكي رقم (م/4) وتاريخ 1429/2/3هـ"], inner=inner)
        p = parse_page(page("1423/04/10 هـ الموافق : 21/06/2002 مـ", ["مرسوم ملكي رقم م/1 بتاريخ 10 / 4 / 1423"], outer), None)
        by_unit = {}
        for n in p["notes"]:
            by_unit.setdefault(n["unit_seq"], []).append(n["instrument_no"])
        self.assertEqual(by_unit, {1: ["م/4"], 2: ["م/5"]})  # كانت م/5 تُسند للمادتين

    def test_duplicate_note_in_same_article_once(self):
        a = art("المادة الأولى", "نص", ["عدلت هذه المادة بموجب المرسوم الملكي رقم (م/4) وتاريخ 1429/2/3هـ"] * 2)
        p = parse_page(page("1423/04/10 هـ الموافق : 21/06/2002 مـ", [], a), None)
        self.assertEqual([(n["unit_seq"], n["note_seq"]) for n in p["notes"]], [(1, 1)])

    def test_same_text_in_two_separate_articles_kept_for_each(self):
        note = "عدلت هذه المادة بموجب المرسوم الملكي رقم (م/4) وتاريخ 1429/2/3هـ"
        arts = art("المادة الأولى", "نص أ", [note]) + art("المادة الثانية", "نص ب", [note])
        p = parse_page(page("1423/04/10 هـ الموافق : 21/06/2002 مـ", [], arts), None)
        self.assertEqual(sorted(n["unit_seq"] for n in p["notes"]), [1, 2])


class CardFromCurrentHead(unittest.TestCase):
    def test_card_ignores_labels_outside_system_info(self):
        stray = '<div class="related"><label>تاريخ الإصدار</label><span>1390/02/02 هـ الموافق : 09/04/1970 مـ</span><label>الحالة</label><span>ملغى</span></div>'
        law = parse_page(page("1443/05/26 هـ الموافق : 30/12/2021 مـ", ["مرسوم ملكي رقم (م/43) وتاريخ 1443/5/26هـ"], extra_before=stray), None)["law"]
        self.assertEqual(law["issued_hijri"], "1443/05/26")
        self.assertEqual(law["status_at_source"], "ساري")

    def test_page_without_head_falls_back_to_whole_page(self):
        rec = page("1443/05/26 هـ الموافق : 30/12/2021 مـ", [])
        rec["html"] = rec["html"].replace('class="col system_info"', 'class="col other"')
        law = parse_page(rec, None)["law"]
        self.assertEqual(law["issued_hijri"], "1443/05/26")


if __name__ == "__main__":
    unittest.main()
