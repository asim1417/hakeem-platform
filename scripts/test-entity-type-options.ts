/**
 * خيارات المهنة منفصلة: محامٍ / متدرب / ممارس / مكتب / أخرى.
 * npx tsx scripts/test-entity-type-options.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_ENTITY_TYPE,
  ENTITY_TYPE_OPTIONS,
  entityOptionsForValue,
} from "../config/entity-types";

assert.equal(DEFAULT_ENTITY_TYPE, "LAWYER");
assert.ok(ENTITY_TYPE_OPTIONS.some((o) => o.value === "LAWYER" && o.label.includes("محامٍ")));
assert.ok(ENTITY_TYPE_OPTIONS.some((o) => o.value === "TRAINEE_LAWYER" && o.label.includes("متدرب")));
assert.ok(ENTITY_TYPE_OPTIONS.some((o) => o.value === "LEGAL_PRACTITIONER"));
assert.ok(ENTITY_TYPE_OPTIONS.some((o) => o.value === "OTHER" && o.label === "أخرى"));
assert.equal(
  ENTITY_TYPE_OPTIONS.some((o) => /محامٍ فرد \/ متدرب|محامٍ \/ متدرب/.test(o.label)),
  false,
  "لا دمج محامٍ ومتدرب في خيار واحد"
);

const withLegacy = entityOptionsForValue("INDIVIDUAL");
assert.ok(withLegacy.some((o) => o.value === "INDIVIDUAL"));

const wizard = fs.readFileSync(path.join(process.cwd(), "components/onboarding/OnboardingWizard.tsx"), "utf8");
const essentials = fs.readFileSync(
  path.join(process.cwd(), "components/onboarding/EssentialsPrompt.tsx"),
  "utf8"
);
assert.ok(wizard.includes("entityOptionsForValue"));
assert.ok(essentials.includes("entityOptionsForValue"));
assert.ok(!wizard.includes("محامٍ فرد / متدرب"));
assert.ok(!essentials.includes("محامٍ / متدرب"));

console.log("test-entity-type-options: OK");
