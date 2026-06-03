import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const caseFile = await prisma.caseFile.findUnique({
    where: { id: params.id },
    include: {
      owner: {
        select: { name: true, email: true }
      },
      attachments: true
    }
  });

  if (!caseFile) {
    return NextResponse.json({ message: "لم يتم العثور على القضية." }, { status: 404 });
  }

  return NextResponse.json({ case: caseFile });
}
