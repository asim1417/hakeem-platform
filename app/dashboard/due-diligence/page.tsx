import { DueDiligenceHistory } from "@/components/due-diligence/DueDiligenceHistory";
import { DueDiligenceSourceMatrix } from "@/components/due-diligence/DueDiligenceSourceMatrix";
import { DueDiligenceWorkbench } from "@/components/due-diligence/DueDiligenceWorkbench";
import { GovernmentOpenDataHub } from "@/components/due-diligence/GovernmentOpenDataHub";

export const dynamic = "force-dynamic";

export default function DueDiligencePage() {
  return (
    <div className="wb-page">
      <DueDiligenceWorkbench />
      <GovernmentOpenDataHub />
      <DueDiligenceSourceMatrix />
      <DueDiligenceHistory />
    </div>
  );
}
