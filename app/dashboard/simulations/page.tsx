import { requirePagePermission } from "@/lib/modules/auth/session";
import { InteractiveJudge } from "@/components/simulations/InteractiveJudge";

export const dynamic = "force-dynamic";

// القاضي التفاعليّ — الواجهة الحديثة الموحَّدة (تحلّ محلّ الـ iframe القديم):
// حالةٌ واحدة محفوظة في قاعدة البيانات (جداول Simulation)، ودماغٌ قضائيٌّ واحد مؤصَّل
// (judicial-brain عبر /api/simulations/judge-turn)، وأمانٌ كامل (مصادقة + ملكيّة).
// النسخة الكلاسيكيّة تبقى متاحةً عبر رابطٍ داخل الواجهة (لا حذف لما يعمل).
export default async function SimulationsPage() {
  await requirePagePermission("SIMULATIONS_USE");
  return <InteractiveJudge />;
}
