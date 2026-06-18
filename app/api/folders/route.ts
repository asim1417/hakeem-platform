import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { createFolder, listFolders } from "@/lib/modules/knowledge-graph/folders";

export const dynamic = "force-dynamic";

// GET — مجلدات المستخدم الحالي.
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("LIBRARY_READ", request);
  if (gate.response || !gate.user) return gate.response ?? NextResponse.json({ ok: false }, { status: 401 });

  const folders = await listFolders(gate.user.id);
  return NextResponse.json({ ok: true, count: folders.length, folders });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().max(64).optional().nullable(),
});

// POST — إنشاء مجلد للمستخدم الحالي.
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("LIBRARY_READ", request);
  if (gate.response || !gate.user) return gate.response ?? NextResponse.json({ ok: false }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "بيانات المجلد غير صحيحة." }, { status: 400 });
  }

  const created = await createFolder(gate.user.id, parsed.data);
  return NextResponse.json({ ok: true, folder: created }, { status: 201 });
}
