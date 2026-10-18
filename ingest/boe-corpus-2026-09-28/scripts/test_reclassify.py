"""python3 -m unittest scripts/test_reclassify.py (من مجلد اللقطة)"""
import sys
import pathlib
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from match_and_diff import reclassify  # noqa: E402

T = ["يجب على الشركة أن تقدم البيانات المالية خلال ثلاثة أشهر من انتهاء السنة",
     "للمحكمة أن تفصل في الدعوى استقلالا متى رأت ذلك لازما لحسن سير العدالة",
     "ترفع الدعوى بصحيفة تودع لدى المحكمة المختصة وفق ما تحدده اللائحة التنفيذية",
     "يكون توزيع الدعاوى على الدوائر وفق قواعد يصدرها المجلس الأعلى للقضاء",
     "تنظم اللائحة عدد الجلسات ومواعيدها وإجراءات تأجيلها وما يتصل بذلك",
     "تكون المهلة المحددة للاعتراض ثلاثين يوما من تاريخ تسلم نسخة الحكم"]


def rec(n, verdict, body):
    return dict(seq=n, heading="", num=n, bis=False, body=body, cls="", has_notes=False, aid=None, verdict=verdict, detail=None)


class T1(unittest.TestCase):
    def test_shifted(self):
        hk = {n: (f"a{n}", f"المادة {n}\n{T[n]}") for n in range(1, 6)}  # حكيم: الرقم n يحمل نص n
        recs = [rec(1, "identical", T[1])] + [rec(n, "wording", T[n + 1]) for n in range(2, 5)]  # الهيئة n يقابلها n+1 في حكيم
        reclassify(recs, hk)
        self.assertEqual([r["verdict"] for r in recs], ["identical", "shifted", "shifted", "shifted"])
        self.assertEqual(recs[1]["detail"], "نص الهيئة في حكيم برقم 3")

    def test_version_mismatch(self):
        hk = {n: (f"a{n}", f"نص قديم مختلف تماما رقم {n} " * 3) for n in range(6)}
        recs = [rec(n, "wording", T[n]) for n in range(6)]
        reclassify(recs, hk)
        self.assertTrue(all(r["verdict"] == "version_mismatch" for r in recs))

    def test_few_wording_stay(self):
        hk = {n: (f"a{n}", T[n]) for n in range(6)}
        recs = [rec(n, "identical", T[n]) for n in range(5)] + [rec(5, "wording", "نص آخر لا يوجد في أي مادة من مواد النظام إطلاقا")]
        reclassify(recs, hk)
        self.assertEqual(recs[5]["verdict"], "wording")


if __name__ == "__main__":
    unittest.main()
