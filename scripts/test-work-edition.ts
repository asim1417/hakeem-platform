import { editionStatus, pickEdition, type EditionWindow } from "../lib/modules/legal-core/work-edition";

let failed = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    failed += 1;
    console.error("✗ " + m);
  } else console.log("✓ " + m);
};

const oldEd: EditionWindow = {
  editionSystemId: "old",
  instrument: "م/53",
  role: "old",
  validFrom: "2012-07-03",
  validTo: "2026-10-28",
};
const newEd: EditionWindow = {
  editionSystemId: "new",
  instrument: "م/237",
  role: "new",
  validFrom: "2026-10-28",
  validTo: null,
};
const editions = [oldEd, newEd];

const today = pickEdition(editions, new Date("2026-09-25T12:00:00Z"));
ok(today?.editionSystemId === "old" && editionStatus(today, new Date("2026-09-25T12:00:00Z")) === "ساري", "اليوم يعرض النص القديم ساريًا");

const boundary = pickEdition(editions, new Date("2026-10-28T12:00:00Z"));
ok(boundary?.editionSystemId === "new" && editionStatus(boundary, new Date("2026-10-28T12:00:00Z")) === "ساري", "2026-10-28 أول يوم لسريان النص الجديد");
ok(editionStatus(oldEd, new Date("2026-10-28T12:00:00Z")) === "مستبدل", "القديم مستبدل في يوم السريان");

const after = pickEdition(editions, new Date("2026-10-29T12:00:00Z"));
ok(after?.editionSystemId === "new" && editionStatus(after, new Date("2026-10-29T12:00:00Z")) === "ساري", "بعد السريان يعرض النص الجديد");
ok(editionStatus(newEd, new Date("2026-09-25T12:00:00Z")) === "صادر لم يسرِ بعد", "الجديد قبل سريانه صادر لم يسرِ");
ok(editionStatus(oldEd, new Date("2026-10-29T12:00:00Z")) === "مستبدل", "القديم بعد السريان مستبدل");

const regOld: EditionWindow = { ...oldEd, editionSystemId: "reg-old", instrument: "م/1", validTo: "2025-04-02" };
ok(pickEdition([regOld], new Date("2024-07-07T12:00:00Z"))?.editionSystemId === "reg-old", "1446-01-01 يوافق 2024-07-07 ويعرض السجل القديم");

console.log(failed === 0 ? "✓ نوافذ الإصدار" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
