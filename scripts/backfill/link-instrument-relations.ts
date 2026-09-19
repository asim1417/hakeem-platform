import { prisma } from "@/lib/prisma";
import { linkCouncilDecisionReferences } from "@/lib/modules/legal-core/instrument-relations";

const APPLY = process.argv.includes("--apply");

async function main() {
  const systems = await prisma.legalSystem.findMany({
    where: { documents: { some: { docType: "ROYAL_DECREE" } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  let created = 0, existing = 0, unresolved = 0;
  for (const system of systems) {
    if (!APPLY) {
      console.log("→ " + system.name);
      continue;
    }
    const r = await linkCouncilDecisionReferences(system.id);
    created += r.created;
    existing += r.existing;
    unresolved += r.unresolved.length;
    console.log("✓ " + system.name + " created=" + r.created + " existing=" + r.existing + " unresolved=" + r.unresolved.length);
  }

  console.log("systems=" + systems.length + " created=" + created + " existing=" + existing + " unresolved=" + unresolved);
  if (!APPLY) console.log("معاينة فقط؛ أضف --apply بعد تطبيق الهجرة وإدخال الوثائق.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect().catch(() => undefined));
