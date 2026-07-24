/**
 * تواصل خفيف عميل ↔ سوبر أدمن — جداول ذاتية idempotent (كنمط billing_events).
 * خيط واحد مفتوح لكل مستخدم؛ الرسائل محفوظة؛ بلا قنوات خارجية.
 */
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";

const DDL = [
  `CREATE TABLE IF NOT EXISTS "support_threads" (
    "id"               TEXT PRIMARY KEY,
    "user_id"          TEXT NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'open',
    "subject"          TEXT,
    "last_message_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "unread_admin"     INT NOT NULL DEFAULT 0,
    "unread_user"      INT NOT NULL DEFAULT 0,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "support_threads_open_user_uidx"
     ON "support_threads"("user_id")
     WHERE "status" = 'open'`,
  `CREATE INDEX IF NOT EXISTS "support_threads_last_idx"
     ON "support_threads"("last_message_at" DESC)`,
  `CREATE TABLE IF NOT EXISTS "support_messages" (
    "id"          TEXT PRIMARY KEY,
    "thread_id"   TEXT NOT NULL REFERENCES "support_threads"("id") ON DELETE CASCADE,
    "sender_role" TEXT NOT NULL,
    "sender_id"   TEXT,
    "body"        TEXT NOT NULL,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "support_messages_thread_idx"
     ON "support_messages"("thread_id","created_at")`,
];

let ready: Promise<boolean> | null = null;
async function ensure(): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      try {
        for (const s of DDL) await prisma.$executeRawUnsafe(s);
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
  userEmail?: string | null;
  userName?: string | null;
  preview?: string | null;
};

export type SupportMessage = {
  id: string;
  threadId: string;
  senderRole: SupportSenderRole;
  senderId: string | null;
  body: string;
  createdAt: string;
};

function mapThread(r: {
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
}): SupportThread {
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

function mapMessage(r: {
  id: string;
  thread_id: string;
  sender_role: string;
  sender_id: string | null;
  body: string;
  created_at: Date;
}): SupportMessage {
  return {
    id: r.id,
    threadId: r.thread_id,
    senderRole: r.sender_role === "admin" ? "admin" : "user",
    senderId: r.sender_id,
    body: r.body,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

/** يجلب الخيط المفتوح للمستخدم أو ينشئه. */
export async function getOrCreateOpenThread(
  userId: string,
  subject?: string | null
): Promise<SupportThread | null> {
  if (!(await ensure())) return null;
  try {
    const existing = (await prisma.$queryRawUnsafe(
      `SELECT * FROM "support_threads"
        WHERE "user_id" = $1 AND "status" = 'open'
        ORDER BY "created_at" DESC LIMIT 1`,
      userId
    )) as Array<Parameters<typeof mapThread>[0]>;
    if (existing[0]) return mapThread(existing[0]);

    const id = randomUUID();
    const subj = (subject || "محادثة دعم").slice(0, 200);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "support_threads" ("id","user_id","status","subject")
       VALUES ($1,$2,'open',$3)`,
      id,
      userId,
      subj
    );
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT * FROM "support_threads" WHERE "id" = $1`,
      id
    )) as Array<Parameters<typeof mapThread>[0]>;
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
    )) as Array<Parameters<typeof mapThread>[0]>;
    return rows[0] ? mapThread(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function getThreadById(threadId: string): Promise<SupportThread | null> {
  if (!(await ensure())) return null;
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT t.*, u.email AS user_email, u.name AS user_name
         FROM "support_threads" t
         LEFT JOIN "users" u ON u.id = t.user_id
        WHERE t."id" = $1`,
      threadId
    )) as Array<Parameters<typeof mapThread>[0]>;
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
      `SELECT * FROM "support_messages"
        WHERE "thread_id" = $1
        ORDER BY "created_at" ASC
        LIMIT $2`,
      threadId,
      take
    )) as Array<Parameters<typeof mapMessage>[0]>;
    return rows.map(mapMessage);
  } catch {
    return [];
  }
}

export async function appendMessage(input: {
  threadId: string;
  senderRole: SupportSenderRole;
  senderId: string | null;
  body: string;
}): Promise<SupportMessage | null> {
  if (!(await ensure())) return null;
  const body = input.body.trim().slice(0, 4000);
  if (!body) return null;
  const id = randomUUID();
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "support_messages" ("id","thread_id","sender_role","sender_id","body")
       VALUES ($1,$2,$3,$4,$5)`,
      id,
      input.threadId,
      input.senderRole,
      input.senderId,
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
    )) as Array<Parameters<typeof mapMessage>[0]>;
    return rows[0] ? mapMessage(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function markReadByUser(threadId: string): Promise<void> {
  if (!(await ensure())) return;
  await prisma.$executeRawUnsafe(
    `UPDATE "support_threads" SET "unread_user" = 0, "updated_at" = NOW() WHERE "id" = $1`,
    threadId
  ).catch(() => 0);
}

export async function markReadByAdmin(threadId: string): Promise<void> {
  if (!(await ensure())) return;
  await prisma.$executeRawUnsafe(
    `UPDATE "support_threads" SET "unread_admin" = 0, "updated_at" = NOW() WHERE "id" = $1`,
    threadId
  ).catch(() => 0);
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
              u.email AS user_email,
              u.name AS user_name,
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
    )) as Array<Parameters<typeof mapThread>[0]>;
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
