// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 PR2 — تحقّق نموذج البيانات (نقيّ، بلا قاعدة).
// يفحص سلامة DDL، وتطابق أسماء الجداول، واشتقاق صفوف البذر من السجلّ (لا اختلاق).
//   npm run test:jds-schema
// ─────────────────────────────────────────────────────────────────────────────
import { JDS_DDL, JDS_TABLES, buildDomainPackRows, JUDICIAL_DOMAIN_PACKS } from "@/lib/modules/judicial";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass += 1;
    console.log(`✓ ${name}`);
  } else {
    fail += 1;
    console.log(`✗ ${name}`);
  }
}

function main() {
  // ① كلّ جدولٍ معلَنٍ له جملة CREATE TABLE مطابقة.
  for (const t of JDS_TABLES) {
    check(`DDL يُنشئ ${t}`, JDS_DDL.some((sql) => sql.includes(`CREATE TABLE IF NOT EXISTS "${t}"`)));
  }

  // ② كلّ DDL يستعمل IF NOT EXISTS (idempotent — سابقة المستودع).
  check("كلّ DDL يستعمل IF NOT EXISTS", JDS_DDL.every((sql) => /IF NOT EXISTS/.test(sql)));

  // ③ توازن الأقواس في كلّ جملة DDL (فحص بنيويّ بسيط).
  check(
    "أقواس DDL متوازنة",
    JDS_DDL.every((sql) => (sql.match(/\(/g) ?? []).length === (sql.match(/\)/g) ?? []).length),
  );

  // ④ الجداول المنتِجة تحمل أعمدة التتبّع (§21): law_as_of_date + created_by.
  const producerTables = ["jds_procedure_graphs", "jds_document_recipes"];
  for (const t of producerTables) {
    const ddl = JDS_DDL.find((sql) => sql.includes(`"${t}"`)) ?? "";
    check(`${t} يحمل law_as_of_date`, ddl.includes(`"law_as_of_date"`));
    check(`${t} يحمل created_by/approved_by`, ddl.includes(`"created_by"`) && ddl.includes(`"approved_by"`));
  }

  // ⑤ اشتقاق صفوف البذر: صفٌّ لكلّ حزمة، بلا تاريخ سريان مُختلَق.
  const rows = buildDomainPackRows();
  check("صفٌّ لكلّ حزمة مجال", rows.length === JUDICIAL_DOMAIN_PACKS.length);
  check("لا تاريخ سريان مُختلَق في البذر (PENDING)", rows.every((r) => r.lawAsOfDate === "PENDING"));
  check("كلّ صفٍّ يحمل معرّفًا وفئات playbooks", rows.every((r) => r.id && r.playbookCategories.length > 0));
  check("معرّفات صفوف البذر فريدة", new Set(rows.map((r) => r.id)).size === rows.length);

  console.log(`\nنتيجة JDS PR2 (schema): ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}

main();
