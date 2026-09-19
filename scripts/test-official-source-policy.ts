import {
  assertOfficialSourceUrl,
  mayAutomateSource,
  sha256Text,
} from "../lib/modules/legal-core/official-source-policy";

let failed = 0;
function expect(label: string, ok: boolean) {
  if (ok) console.log("✓", label);
  else { failed++; console.error("✗", label); }
}

expect("NCAR https مسموح", assertOfficialSourceUrl("NCAR", "https://ncar.gov.sa/rules-regulations").hostname === "ncar.gov.sa");
expect("BOE laws مسموح", assertOfficialSourceUrl("BOE", "https://laws.boe.gov.sa/BoeLaws/Laws/LawsHome").hostname === "laws.boe.gov.sa");

for (const [label, source, url] of [
  ["يرفض http", "NCAR", "http://ncar.gov.sa/rules-regulations"],
  ["يرفض نطاقاً خارجياً", "BOE", "https://example.com/laws"],
  ["يرفض userinfo", "NCAR", "https://u:p@ncar.gov.sa/rules-regulations"],
] as const) {
  let rejected = false;
  try { assertOfficialSourceUrl(source, url); } catch { rejected = true; }
  expect(label, rejected);
}

expect("UQN لا يُكشط افتراضياً", mayAutomateSource("UQN", false) === false);
expect("UQN يقبل مدخلاً آلياً صريحاً", mayAutomateSource("UQN", true) === true);
expect("SHA-256 ثابت", sha256Text("حكيم") === sha256Text("حكيم") && sha256Text("حكيم") !== sha256Text("حكيم."));

process.exit(failed ? 1 : 0);
