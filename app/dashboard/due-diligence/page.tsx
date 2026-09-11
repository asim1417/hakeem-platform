import { DueDiligenceHistory } from "@/components/due-diligence/DueDiligenceHistory";
import { DueDiligenceWorkbench } from "@/components/due-diligence/DueDiligenceWorkbench";

export const dynamic = "force-dynamic";

export default function DueDiligencePage() {
  return (
    <div className="wb-page">
      <DueDiligenceWorkbench />
      <DueDiligenceHistory />
    </div>
  );
}
