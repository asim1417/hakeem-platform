/**
 * تواصل خفيف عميل ↔ سوبر أدمن — جداول ذاتية idempotent.
 * يخزّن اسم وبريد المرسل على الخيط حتى يظهر دائماً في صندوق المراسلات.
 */
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";

const TABLE_DDL = [
  `CREATE TABLE IF NOT EXISTS "support_threads" (
    "id"               TEXT PRIMARY KEY,
    "user_id"          TEXT NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'open',
    "subject"          TEXT,
    "user_name"        TEXT,
    "user_email"       TEXT,
    "last_message_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "unread_admin"     INT NOT NULL DEFAULT 0,
    "unread_user"      INT NOT NULL DEFAULT 0,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS "support_messages" (
    "id"          TEXT PRIMARY KEY,
    "thread_id"   TEXT NOT NULL REFERENCES "support_threads"("id") ON DELETE CASCADE,
    "sender_role" TEXT NOT NULL,
    "sender_id"   TEXT,
    "sender_name" TEXT,
    "body"        TEXT NOT NULL,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

const INDEX_DDL = [
  `CREATE INDEX IF NOT EXISTS "support_threads_last_idx"
     ON "support_threads"("last_message_at" DESC)`,
  `CREATE INDEX IF NOT EXISTS "support_threads_user_idx"
     ON "support_threads"("user_id")`,
  `CREATE INDEX IF NOT EXISTS "support_messages_thread_idx"
     ON "support_messages"("thread_id","created_at")`,
];

const ALTER_DDL = [
  `ALTER TABLE "support_threads" ADD COLUMN IF NOT EXISTS "user_name" TEXT`,
  `ALTER TABLE "support_threads" ADD COLUMN IF NOT EXISTS "user_email" TEXT`,
  `ALTER TABLE "support_messages" ADD COLUMN IF NOT EXISTS "sender_name" TEXT`,
];

let ready: Promise<boolean> | null = null;

async function ensure(): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      try {
        for (const s of TABLE_DDL) await prisma.$executeRawUnsafe(s);
        for (const s of ALTER_DDL) {
          try {
            await prisma.$executeRawUnsafe(s);
          } catch {
            /* عمود موجود أو صلاحية — نكمل */
          }
        }
        for (const s of INDEX_DDL) {
          try {
            await prisma.$executeRawUnsafe(s);
          } catch {
            /* فهرس اختياري */
          }
        }
        return true;
      } catch {
        ready = null;
        return false;
      }
    })();
  }
  return ready;
}

export type SupportThreadStatus = "open" | "closed";
export type SupportSenderRole = "user" | "admin";

export type SupportThread = {
  id: string;
  userId: string;
  status: SupportThreadStatus;
  subject: string | null;
  lastMessageAt: string;
  unreadAdmin: number;
  unreadUser: number;
  createdAt: string;
  userEmail: string | null;
  userName: string | null;
  preview?: string | null;
};

export type SupportMessage = {
  id: string;
  threadId: string;
  senderRole: SupportSenderRole;
  senderId: string | null;
  senderName: string | null;
  body: string;
  createdAt: string;
};

type ThreadRow = {
  id: string;
  user_id: string;
  status: string;
  subject: string | null;
  last_message_at: Date;
  unread_admin: number;
  unread_user: number;
  created_at: Date;
  user_email?: string | null;
  user_name?: string | null;
  preview?: string | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender_role: string;
  sender_id: string | null;
  sender_name?: string | null;
  body: string;
  created_at: Date;
};

function mapThread(r: ThreadRow): SupportThread {
  return {
    id: r.id,
    userId: r.user_id,
    status: r.status === "closed" ? "closed" : "open",
    subject: r.subject,
    lastMessageAt: new Date(r.last_message_at).toISOString(),
    unreadAdmin: Number(r.unread_admin) || 0,
    unreadUser: Number(r.unread_user) || 0,
    createdAt: new Date(r.created_at).toISOString(),
    userEmail: r.user_email ?? null,
    userName: r.user_name ?? null,
    preview: r.preview ?? null,
  };
}

function mapMessage(r: MessageRow): SupportMessage {
  return {
    id: r.id,
    threadId: r.thread_id,
    senderRole: r.sender_role === "admin" ? "admin" : "user",
    senderId: r.sender_id,
    senderName: r.sender_name ?? null,
    body: r.body,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

async function resolveUserProfile(userId: string): Promise<{ name: string | null; email: string | null }> {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "name","email" FROM "users" WHERE "id" = $1 LIMIT 1`,
      userId
    )) as Array<{ name: string | null; email: string | null }>;
    return { name: rows[0]?.name ?? null, email: rows[0]?.email ?? null };
  } catch {
    return { name: null, email: null };
  }
}

/** يجلب الخيط المفتوح للمستخدم أو ينشئه — مع حفظ الاسم/البريد. */
export async function getOrCreateOpenThread(
  userId: string,
  opts?: { subject?: string | null; userName?: string | null; userEmail?: string | null }
): Promise<SupportThread | null> {
  if (!(await ensure())) return null;
  try {
    const existing = (await prisma.$queryRawUnsafe(
      `SELECT * FROM "support_threads"
        WHERE "user_id" = $1 AND "status" = 'open'
        ORDER BY "created_at" DESC LIMIT 1`,
      userId
    )) as ThreadRow[];
    if (existing[0]) {
      const profile = await resolveUserProfile(userId);
      const name = opts?.userName || profile.name;
      const email = opts?.userEmail || profile.email;
      if (name || email) {
        await prisma.$executeRawUnsafe(
          `UPDATE "support_threads"
              SET "user_name" = COALESCE($2, "user_name"),
                  "user_email" = COALESCE($3, "user_email"),
                  "updated_at" = NOW()
            WHERE "id" = $1`,
          existing[0].id,
          name,
          email
        );
      }
      const refreshed = (await prisma.$queryRawUnsafe(
        `SELECT * FROM "support_threads" WHERE "id" = $1`,
        existing[0].id
      )) as ThreadRow[];
      return refreshed[0] ? mapThread(refreshed[0]) : mapThread(existing[0]);
    }

    const profile = await resolveUserProfile(userId);
    const id = randomUUID();
    const subj = (opts?.subject || "محادثة دعم").slice(0, 200);
    const name = opts?.userName || profile.name;
    const email = opts?.userEmail || profile.email;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "support_threads" ("id","user_id","status","subject","user_name","user_email")
       VALUES ($1,$2,'open',$3,$4,$5)`,
      id,
      userId,
      subj,
      name,
      email
    );
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT * FROM "support_threads" WHERE "id" = $1`,
      id
    )) as ThreadRow[];
    return rows[0] ? mapThread(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function getThreadForUser(
  threadId: string,
  userId: string
): Promise<SupportThread | null> {
  if (!(await ensure())) return null;
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT * FROM "support_threads" WHERE "id" = $1 AND "user_id" = $2`,
      threadId,
      userId
    )) as ThreadRow[];
    return rows[0] ? mapThread(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function getThreadById(threadId: string): Promise<SupportThread | null> {
  if (!(await ensure())) return null;
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT t.*,
              COALESCE(t."user_email", u.email) AS user_email,
              COALESCE(t."user_name", u.name) AS user_name
         FROM "support_threads" t
         LEFT JOIN "users" u ON u.id = t.user_id
        WHERE t."id" = $1`,
      threadId
    )) as ThreadRow[];
    return rows[0] ? mapThread(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function listMessages(threadId: string, limit = 100): Promise<SupportMessage[]> {
  if (!(await ensure())) return [];
  const take = Math.min(Math.max(limit, 1), 200);
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT m.*,
              COALESCE(m."sender_name", u.name,
                CASE WHEN m."sender_role" = 'admin' THEN 'دعم حكيم' ELSE NULL END
              ) AS sender_name
         FROM "support_messages" m
         LEFT JOIN "users" u ON u.id = m.sender_id
        WHERE m."thread_id" = $1
        ORDER BY m."created_at" ASC
        LIMIT $2`,
      threadId,
      take
    )) as MessageRow[];
    return rows.map(mapMessage);
  } catch {
    return [];
  }
}

export async function appendMessage(input: {
  threadId: string;
  senderRole: SupportSenderRole;
  senderId: string | null;
  senderName?: string | null;
  body: string;
}): Promise<SupportMessage | null> {
  if (!(await ensure())) return null;
  const body = input.body.trim().slice(0, 4000);
  if (!body) return null;
  const id = randomUUID();
  const senderName =
    input.senderName ||
    (input.senderRole === "admin" ? "دعم حكيم" : null);
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "support_messages" ("id","thread_id","sender_role","sender_id","sender_name","body")
       VALUES ($1,$2,$3,$4,$5,$6)`,
      id,
      input.threadId,
      input.senderRole,
      input.senderId,
      senderName,
      body
    );
    if (input.senderRole === "user") {
      await prisma.$executeRawUnsafe(
        `UPDATE "support_threads"
            SET "last_message_at" = NOW(),
                "updated_at" = NOW(),
                "status" = 'open',
                "unread_admin" = "unread_admin" + 1
          WHERE "id" = $1`,
        input.threadId
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE "support_threads"
            SET "last_message_at" = NOW(),
                "updated_at" = NOW(),
                "status" = 'open',
                "unread_user" = "unread_user" + 1
          WHERE "id" = $1`,
        input.threadId
      );
    }
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT * FROM "support_messages" WHERE "id" = $1`,
      id
    )) as MessageRow[];
    return rows[0] ? mapMessage(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function markReadByUser(threadId: string): Promise<void> {
  if (!(await ensure())) return;
  await prisma
    .$executeRawUnsafe(
      `UPDATE "support_threads" SET "unread_user" = 0, "updated_at" = NOW() WHERE "id" = $1`,
      threadId
    )
    .catch(() => 0);
}

export async function markReadByAdmin(threadId: string): Promise<void> {
  if (!(await ensure())) return;
  await prisma
    .$executeRawUnsafe(
      `UPDATE "support_threads" SET "unread_admin" = 0, "updated_at" = NOW() WHERE "id" = $1`,
      threadId
    )
    .catch(() => 0);
}

export async function closeThread(threadId: string): Promise<boolean> {
  if (!(await ensure())) return false;
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "support_threads"
          SET "status" = 'closed', "updated_at" = NOW()
        WHERE "id" = $1`,
      threadId
    );
    return true;
  } catch {
    return false;
  }
}

export async function listThreadsForAdmin(limit = 50): Promise<SupportThread[]> {
  if (!(await ensure())) return [];
  const take = Math.min(Math.max(limit, 1), 100);
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT t.*,
              COALESCE(t."user_email", u.email) AS user_email,
              COALESCE(t."user_name", u.name) AS user_name,
              (
                SELECT m.body FROM "support_messages" m
                 WHERE m.thread_id = t.id
                 ORDER BY m.created_at DESC LIMIT 1
              ) AS preview
         FROM "support_threads" t
         LEFT JOIN "users" u ON u.id = t.user_id
        ORDER BY t."last_message_at" DESC
        LIMIT $1`,
      take
    )) as ThreadRow[];
    return rows.map(mapThread);
  } catch {
    return [];
  }
}

export async function countUnreadForAdmin(): Promise<number> {
  if (!(await ensure())) return 0;
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM("unread_admin"),0)::int AS n FROM "support_threads" WHERE "status" = 'open'`
    )) as Array<{ n: number }>;
    return Number(rows[0]?.n) || 0;
  } catch {
    return 0;
  }
}

/**
 * عداد غير مقروء للعميل — لا ينشئ خيطًا ولا يصفّر العداد.
 * للشارة على زر «تواصل معنا» والويدجت مغلق.
 */
export async function countUnreadForUser(userId: string): Promise<number> {
  if (!(await ensure()) || !userId) return 0;
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM("unread_user"),0)::int AS n
         FROM "support_threads"
        WHERE "user_id" = $1 AND "status" = 'open'`,
      userId
    )) as Array<{ n: number }>;
    return Number(rows[0]?.n) || 0;
  } catch {
    return 0;
  }
}
