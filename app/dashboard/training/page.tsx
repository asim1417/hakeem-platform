import { TrainingWorkspace } from "@/components/TrainingWorkspace";
import { prisma } from "@/lib/prisma";
import { getSystemUser } from "@/lib/modules/auth/system-user";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const progress = await getSystemUser()
    .then((user) => prisma.trainingProgress.findFirst({ where: { userId: user.id } }))
    .catch(() => null);

  return (
    <div>
      <p className="text-sm font-semibold text-gold">تعلم وتقييم</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">التدريب</h1>
      <p className="mt-3 max-w-3xl leading-8 text-gray-700">
        تجربة تدريب قانوني مبدئية لمسارات الصياغة والتكييف والدفوع والبينات والحكم التدريبي.
      </p>
      <div className="mt-6">
        <TrainingWorkspace initialPoints={progress?.points ?? 0} />
      </div>
    </div>
  );
}
