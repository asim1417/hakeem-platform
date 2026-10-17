import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser, isAuthDisabled } from "../auth/session";
import {
  PERMISSIONS,
  DeskError,
  allowed,
  assertWriteEnabled,
} from "./contracts";
import { readConfig, missingTable } from "./repository";
import { Prisma } from "@prisma/client";

export async function gate(request: NextRequest, write = false) {
  // Runs before auth resolution: a disabled mutation cannot sync users or log into the DB.
  if (write) {
    assertWriteEnabled();
    if (request.headers.get("origin") !== request.nextUrl.origin)
      throw new DeskError(403, "مصدر الطلب غير مسموح.");
  }
  if (isAuthDisabled())
    throw new DeskError(401, "مكتب التحرير يتطلب تسجيل دخول حقيقيًا.");
  const actor = await getApiUser(request);
  if (!actor?.isActive)
    throw new DeskError(401, "يلزم تسجيل الدخول بحساب فعال.");
  const config = await readConfig();
  if (!PERMISSIONS.some((p) => allowed(actor, config.data, p)))
    throw new DeskError(403, "لا تملك صلاحية مكتب التحرير.");
  return {
    actor,
    config,
    sessionId: randomUUID(),
    writeEnabled: process.env.EDITORIAL_DESK_WRITE === "1" && config.installed,
  };
}
export function response(value: unknown, status = 200) {
  return new NextResponse(
    JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
export function failure(error: unknown) {
  if (error instanceof DeskError)
    return response({ message: error.message }, error.status);
  if (error instanceof z.ZodError)
    return response(
      {
        message: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("؛ "),
      },
      400,
    );
  if (missingTable(error))
    return response(
      { message: "لم يُطبّق ترحيل مكتب التحرير في هذه البيئة." },
      503,
    );
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return response({ message: "طلب مكرر أو عنصر له تغيير مفتوح." }, 409);
    if (error.code === "P2025")
      return response({ message: "العنصر غير موجود." }, 404);
  }
  return response(
    {
      message:
        "تعذر إكمال العملية؛ لم يُعتمد نجاحها. أعد المحاولة أو راجع سجل الخدمة.",
    },
    500,
  );
}
