"""HKM-057: اختبارات محلل لقطات هيئة الخبراء على لقطات فعلية من data/boe_snapshots.jsonl.gz (لا اصطناع).

التشغيل (من مجلد اللقطة؛ يحتاج lxml وcssselect؛ لا شبكة ولا قاعدة):
    python3 scripts/test_parse_snapshots_real.py
"""
import gzip
import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import parse_snapshots as ps  # noqa: E402

SNAPS = ps.ROOT / "data" / "boe_snapshots.jsonl.gz"
G = {
    "cabinet_only": "0041fa37-4a6d-4b68-a9ab-a9a700f2e88f",       # تنظيم مؤسسة البريد السعودي: قرار مجلس وزراء فقط (29 / 3 / 1423)
    "royal_order": "02dbc4d4-4763-41f9-9039-a9a700f1c0c1",        # تنظيم المجلس الاقتصادي الأعلى: أمر ملكي (17 / 5 / 1420)
    "decree_vs_cabinet": "23b12c1f-6823-4759-982e-a9a700f2031a",  # الأئمة والمؤذنون: قرار الوزراء 1 / 1 / 1392 والمرسوم 9 / 1 / 1392
    "unresolved": "2072c9ff-5a70-444e-91cc-a9a700f26346",         # تركيز مسؤوليات القضاء الشرعي: سندان بلا تاريخ
    "real_jan1": "bf9e0aae-6df6-4785-a305-ac2300bd0856",          # مكافحة التستر: م/4 وتاريخ 1442/1/1هـ
    "normal": "08381293-6388-48e2-8ad2-a9a700f2aa94",             # نظام العمل: تاريخ إصدار عادي، وملاحظات «ألغيت» على مواد كثيرة
    "nested": "0838afd4-ca76-4b4a-b1d1-a9a700f22afd",             # التقاعد العسكري: مواد متعشّشة
    "judiciary": "ea1765a3-dec3-41a0-a32f-a9a700f26d58",          # نظام القضاء: مواد متعشّشة
}
NAMED_LAWS = ("نظام جباية الزكاة", "نظام الإذاعة الأساسي")  # رقم السند فيهما بشرطات مائلة: «17 /2 /28 /8634»


def _load() -> tuple[dict, dict, list]:
    """مسح واحد للقطات: لقطات الاختبار بمعرّفها وبالاسم، وقانون كل صفحة محلَّلة (530)."""
    want = set(G.values())
    by_guid: dict = {}
    by_name: dict = {}
    laws: list = []
    with gzip.open(SNAPS, "rt", encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            if rec["guid"] in want:
                by_guid[rec["guid"]] = rec
            try:
                law = ps.parse_page(rec, None)["law"]
            except LookupError:
                continue
            laws.append(law)
            if law["name"] in NAMED_LAWS:
                by_name[law["name"]] = rec
    return by_guid, by_name, laws


RECS, NAMED, ALL_LAWS = _load()


def parsed(key: str) -> dict:
    return ps.parse_page(RECS[G[key]], None)


class IssueDateOnRealSnapshots(unittest.TestCase):
    def test_cabinet_only_replaces_placeholder_and_drops_gregorian(self):
        law = parsed("cabinet_only")["law"]
        self.assertIn("1423/01/01", law["issued_raw"])
        self.assertEqual(law["issued_hijri"], "1423/03/29")
        self.assertIsNone(law["issued_gregorian"])
        self.assertIn("issued_placeholder:from_instrument", law["parse_flags"])

    def test_royal_order(self):
        self.assertEqual(parsed("royal_order")["law"]["issued_hijri"], "1420/05/17")

    def test_decree_wins_even_when_cabinet_is_jan1(self):
        self.assertEqual(parsed("decree_vs_cabinet")["law"]["issued_hijri"], "1392/01/09")

    def test_unresolved_is_null_and_flagged(self):
        law = parsed("unresolved")["law"]
        self.assertIsNone(law["issued_hijri"])
        self.assertIsNone(law["issued_gregorian"])
        self.assertIn("issued_placeholder:unresolved", law["parse_flags"])

    def test_real_jan1_instrument_kept_not_replaced_by_cabinet(self):
        law = parsed("real_jan1")["law"]
        self.assertEqual((law["issued_hijri"], law["issued_gregorian"]), ("1442/01/01", "2020-08-20"))
        self.assertIn("issued_placeholder:confirmed_by_instrument", law["parse_flags"])

    def test_normal_date_untouched(self):
        law = parsed("normal")["law"]
        self.assertEqual((law["issued_hijri"], law["issued_gregorian"]), ("1426/08/23", "2005-09-27"))
        self.assertFalse([f for f in law["parse_flags"] if f.startswith("issued_placeholder")])

    def test_instrument_number_with_slashes_not_read_as_date(self):
        for name, want in (("نظام جباية الزكاة", "1370/06/29"), ("نظام الإذاعة الأساسي", "1374/06/17")):
            rec = NAMED.get(name)
            self.assertIsNotNone(rec, name)
            self.assertEqual(ps.parse_page(rec, None)["law"]["issued_hijri"], want, name)

    def test_no_placeholder_left_across_all_snapshots(self):
        confirmed = [x for x in ALL_LAWS if "issued_placeholder:confirmed_by_instrument" in x["parse_flags"]]
        unresolved = [x for x in ALL_LAWS if "issued_placeholder:unresolved" in x["parse_flags"]]
        left = [x["name"] for x in ALL_LAWS if ps.is_placeholder_hijri(x["issued_hijri"]) and x not in confirmed]
        self.assertGreater(len(ALL_LAWS), 500)
        self.assertEqual(left, [])
        self.assertEqual((len(confirmed), len(unresolved)), (1, 3))


class NotesOnRealSnapshots(unittest.TestCase):
    def test_nested_articles_keep_their_own_notes_only(self):
        p = parsed("nested")
        by: dict = {}
        for n in p["notes"]:
            by[n["unit_seq"]] = by.get(n["unit_seq"], 0) + 1
        self.assertEqual(by, {2: 1, 3: 1, 4: 1, 5: 2, 7: 1, 8: 1, 10: 1, 13: 1, 18: 1, 20: 1, 23: 1, 28: 2, 29: 1})
        self.assertEqual(len(p["notes"]), 15)  # كانت 25 (10 ملاحظات مادة داخلية نُسبت للمادة 5 أيضًا)

    def test_judiciary_no_duplicate_per_unit(self):
        p = parsed("judiciary")
        keys = [(n["unit_seq"], n["note_text"]) for n in p["notes"]]
        self.assertEqual(len(p["notes"]), 6)  # كانت 10
        self.assertEqual(len(keys), len(set(keys)))

    def test_same_note_text_on_many_separate_articles_is_kept(self):
        by_text: dict = {}
        for n in parsed("normal")["notes"]:
            by_text.setdefault(n["note_text"], set()).add(n["unit_seq"])
        self.assertTrue(any(len(s) > 5 for s in by_text.values()))


class CardAndEnglishOnRealSnapshots(unittest.TestCase):
    def test_english_name_and_description_read_from_h4(self):
        law = parsed("normal")["law"]
        self.assertEqual(law["name_en"], "Labor Law")
        self.assertTrue(law["description_en"])
        self.assertEqual(parsed("real_jan1")["law"]["name_en"], "Anti-Concealment Law")
        self.assertIsNone(parsed("cabinet_only")["law"]["name_en"])  # لا English في الصفحة؛ لا تخمين

    def test_english_count_across_snapshots(self):
        self.assertEqual(sum(bool(x["name_en"]) for x in ALL_LAWS), 161)

    def test_card_found_by_labels_without_container_class(self):
        rec = dict(RECS[G["normal"]])
        rec["html"] = rec["html"].replace("system_info", "renamed_card")
        law = ps.parse_page(rec, None)["law"]
        ref = parsed("normal")["law"]
        for k in ("name", "issued_hijri", "status_at_source", "instruments"):
            self.assertEqual(law[k], ref[k], k)

    def test_all_snapshots_have_full_card(self):
        self.assertEqual(len(ALL_LAWS), 530)
        for law in ALL_LAWS:
            self.assertTrue(law["name"] and law["issued_raw"] and law["status_at_source"], law["guid"])


if __name__ == "__main__":
    unittest.main()
