import { isPassedGuardResult } from "../lib/modules/observability/guard-result";

const cases: Array<[string | null, boolean]> = [
  ["PASSED", true],
  ["passed", true],
  ["pass", true],
  [" Pass ", true],
  ["BLOCKED", false],
  ["fail", false],
  ["", false],
  [null, false],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = isPassedGuardResult(input);
  if (got !== expected) {
    failed += 1;
    console.error(`✗ ${JSON.stringify(input)} → ${got} (المتوقع ${expected})`);
  }
}
if (failed) {
  console.error(`فشل ${failed}`);
  process.exit(1);
}
console.log(`✓ نتائج الحارس: ${cases.length} حالات`);
