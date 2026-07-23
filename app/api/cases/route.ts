import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { isSystemAdmin } from "@/lib/modules/auth/ownership";

export const dynamic = "force-dynamic";

const caseSchema = z.object({
  title: z.string().min(3, "عنوان القضية مطلوب."),
  caseType: z.string().optional(),
  clientRole: z.string().optional(),
  factsSummary: z.string().optional(),
  requests: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]).default("DRAFT")
});

const statusMap = {
  DRAFT: "OPEN",
  ACTIVE: "UNDER_REVIEW",
  CLOSED: "CLOSED"
} as const;

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("CONSULTATIONS_LIMITED", request);
  if (gate.response) return gate.response;

  // [إصلاح تدقيق SEC-003: كان يعيد قضايا جميع المستخدمين — قُصِر على مالكها (أو المدير).]
  const isAdmin = isSystemAdmin(gate.user!);
  const cases = await prisma.caseFile.findMany({
    where: isAdmin ? undefined : { ownerId: gate.user!.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { owner: { select: { name: true, email: true } } }
  });

  return NextResponse.json({ cases: cases.map(toCaseDto) });
}

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("CONSULTATIONS_FULL", request);
  if (gate.response) return gate.response;
  const user = gate.user!;
  const payload = caseSchema.parse(await request.json());
  const summary = JSON.stringify({
    caseType: payload.caseType,
    clientRole: payload.clientRole,
    factsSummary: payload.factsSummary,
    requests: payload.requests
  });

  const created = await prisma.caseFile.create({
    data: {
      title: payload.title,
      summary,
      status: statusMap[payload.status],
      ownerId: user.id
    },
    include: { owner: { select: { name: true, email: true } } }
  });

  await auditEvent({
    actorId: user.id,
    subject: "CASE",
    action: "CASE_CREATED",
    entityId: created.id,
    metadata: {
      description: `تم إنشاء قضية: ${created.title}`,
      caseType: payload.caseType,
      clientRole: payload.clientRole,
      status: payload.status
    }
  });

  return NextResponse.json({ case: toCaseDto(created) }, { status: 201 });
}

function toCaseDto(caseFile: {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  owner?: { name: string; email: string } | null;
}) {
  const parsed = parseSummary(caseFile.summary);
  return {
    id: caseFile.id,
    title: caseFile.title,
    status: caseFile.status,
    createdAt: caseFile.createdAt,
    updatedAt: caseFile.updatedAt,
    owner: caseFile.owner,
    ...parsed
  };
}

function parseSummary(summary: string | null) {
  if (!summary) return {};
  try {
    return JSON.parse(summary) as Record<string, unknown>;
  } catch {
    return { factsSummary: summary };
  }
}
