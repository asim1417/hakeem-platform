import { notFound } from "next/navigation";
import { EditorialDesk } from "@/components/editorial/EditorialDesk";
export default function Page({ params }: { params: { view: string } }) {
  if (
    ![
      "queue",
      "intake",
      "systems",
      "tasks",
      "audit",
      "index",
      "settings",
    ].includes(params.view)
  )
    notFound();
  return <EditorialDesk view={params.view} />;
}
