#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
run_eval.py — يشغّل محرّكات الاستخراج على مجموعة القياس ويُخرج تقرير مقارنة.

بنية المجموعة (goldset/<name>/):
    <id>.png        صورة الصفحة (أو .jpg / .tif)
    <id>.gt.txt     الحقيقة الأرضية (النص الصحيح، مراجَع بشرياً)
    <id>.meta.json  اختياري: {"doc_type": "...", "entities": {"parties": [...], "amounts": [...]}}

الاستخدام:
    python run_eval.py --gold goldset/sample --engines mock
    python run_eval.py --gold goldset/legal_v1 --engines tesseract azure_di --level full

المخرجات: تقرير Markdown + CSV في مجلد reports/، يرتّب المحرّكات بأقلّ CER مُطبَّع.
"""
import argparse
import csv
import glob
import json
import os
import statistics as stats
from datetime import datetime

import metrics as M
import engines as E

IMG_EXT = (".png", ".jpg", ".jpeg", ".tif", ".tiff")


def load_gold(gold_dir):
    samples = []
    for img in sorted(glob.glob(os.path.join(gold_dir, "*"))):
        if not img.lower().endswith(IMG_EXT):
            continue
        stem = os.path.splitext(img)[0]
        gt = stem + ".gt.txt"
        if not os.path.exists(gt):
            print(f"تخطّي (لا حقيقة أرضية): {os.path.basename(img)}")
            continue
        meta = {}
        mp = stem + ".meta.json"
        if os.path.exists(mp):
            meta = json.load(open(mp, encoding="utf-8"))
        samples.append({
            "id": os.path.basename(stem), "img": img,
            "gt": open(gt, encoding="utf-8").read(), "meta": meta,
        })
    return samples


def evaluate(gold_dir, engine_names, level="full"):
    samples = load_gold(gold_dir)
    if not samples:
        raise SystemExit("لا عيّنات صالحة في المجموعة.")
    engs = E.build_engines(engine_names)
    rows = []          # صف لكل (عيّنة، محرّك)
    for eng in engs:
        if not eng.available:
            print(f"محرّك غير مفعّل (يُتخطّى): {eng.name}")
            continue
        for s in samples:
            try:
                hyp = eng.recognize(s["img"])
                rec = {
                    "engine": eng.name, "id": s["id"],
                    "cer_raw": round(M.cer(s["gt"], hyp, "raw"), 4),
                    "cer_norm": round(M.cer(s["gt"], hyp, "full"), 4),
                    "wer_norm": round(M.wer(s["gt"], hyp, "full"), 4),
                    "acc_pct": round(M.accuracy_pct(s["gt"], hyp, level), 2),
                }
                rows.append(rec)
            except Exception as ex:
                print(f"خطأ [{eng.name}/{s['id']}]: {ex}")
    return samples, rows


def aggregate(rows):
    agg = {}
    for r in rows:
        agg.setdefault(r["engine"], {"cer_raw": [], "cer_norm": [], "wer_norm": [], "acc": []})
        agg[r["engine"]]["cer_raw"].append(r["cer_raw"])
        agg[r["engine"]]["cer_norm"].append(r["cer_norm"])
        agg[r["engine"]]["wer_norm"].append(r["wer_norm"])
        agg[r["engine"]]["acc"].append(r["acc_pct"])
    summary = []
    for eng, d in agg.items():
        summary.append({
            "engine": eng, "n": len(d["acc"]),
            "cer_raw": round(stats.mean(d["cer_raw"]), 4),
            "cer_norm": round(stats.mean(d["cer_norm"]), 4),
            "wer_norm": round(stats.mean(d["wer_norm"]), 4),
            "acc_pct": round(stats.mean(d["acc"]), 2),
        })
    summary.sort(key=lambda x: x["cer_norm"])   # الأفضل = أقلّ خطأ مُطبَّع
    return summary


def write_reports(gold_dir, samples, rows, summary, out_dir="reports"):
    os.makedirs(out_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M")
    base = os.path.join(out_dir, f"eval_{ts}")
    # CSV تفصيلي
    with open(base + "_detail.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["engine", "id", "cer_raw", "cer_norm", "wer_norm", "acc_pct"])
        w.writeheader(); w.writerows(rows)
    # Markdown ملخّص
    md = [f"# تقرير قياس دقة الاستخراج", "",
          f"- المجموعة: `{gold_dir}`  |  العيّنات: {len(samples)}  |  التاريخ: {ts}",
          "- الترتيب بأقلّ **CER مُطبَّع** (يتجاهل ما لا يؤثر في الاسترجاع القانوني).", "",
          "| المحرّك | العيّنات | CER خام | CER مُطبَّع | WER مُطبَّع | الدقة % |",
          "|---|---|---|---|---|---|"]
    for s in summary:
        md.append(f"| {s['engine']} | {s['n']} | {s['cer_raw']} | **{s['cer_norm']}** | {s['wer_norm']} | {s['acc_pct']} |")
    md += ["", "> CER/WER: كلّما قلّ كان أفضل (0 = مطابقة تامة). الدقة% = (1 − CER) × 100.",
           "> «خام» يحاسب التشكيل واختلاف الهمزات؛ «مُطبَّع» يقيس ما يهمّ فعلاً في البحث القانوني."]
    open(base + "_summary.md", "w", encoding="utf-8").write("\n".join(md))
    return base


def main():
    ap = argparse.ArgumentParser(description="قياس دقة محرّكات الاستخراج النصي على مجموعة عربية قانونية.")
    ap.add_argument("--gold", required=True, help="مجلد مجموعة القياس")
    ap.add_argument("--engines", nargs="+", default=["mock"],
                    help="محرّكات: mock tesseract azure_di google_docai")
    ap.add_argument("--level", default="full", choices=["raw", "mid", "full"],
                    help="مستوى التطبيع لحساب الدقة%")
    a = ap.parse_args()
    samples, rows = evaluate(a.gold, a.engines, a.level)
    summary = aggregate(rows)
    base = write_reports(a.gold, samples, rows, summary)
    print("\n=== ملخّص القياس ===")
    print(f"{'المحرّك':<14}{'CER مُطبَّع':>12}{'WER':>10}{'الدقة%':>10}")
    for s in summary:
        print(f"{s['engine']:<14}{s['cer_norm']:>12}{s['wer_norm']:>10}{s['acc_pct']:>10}")
    print(f"\nالتقارير: {base}_summary.md  +  _detail.csv")


if __name__ == "__main__":
    main()
