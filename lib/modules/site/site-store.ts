/**
 * مخزن إعدادات الموقع — DDL ذاتي (كنمط support/billing).
 * لا يتطلب Prisma migration على Vercel.
 */
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import {
  type CustomSitePage,
  type SiteConfig,
  type SiteConfigPatch,
  defaultSiteConfig,
  mergeSiteConfig,
  slugifyAr,
} from "@/lib/modules/site/defaults";

const DDL = [
  `CREATE TABLE IF NOT EXISTS "site_config" (
    "id"         TEXT PRIMARY KEY DEFAULT 'default',
    "payload"    JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS "site_pages" (
    "id"         TEXT PRIMARY KEY,
    "slug"       TEXT NOT NULL UNIQUE,
    "title"      TEXT NOT NULL,
    "body"       TEXT NOT NULL DEFAULT '',
    "enabled"    BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "site_pages_enabled_idx" ON "site_pages"("enabled")`,
];

let ready: Promise<boolean> | null = null;
async function ensure(): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      try {
        for (const s of DDL) {
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

export async function getSiteConfig(): Promise<SiteConfig> {
  if (!(await ensure())) return defaultSiteConfig();
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "payload" FROM "site_config" WHERE "id" = 'default' LIMIT 1`
    )) as Array<{ payload: unknown }>;
    const raw = rows[0]?.payload;
    if (!raw || typeof raw !== "object") return defaultSiteConfig();
    return mergeSiteConfig(raw as SiteConfigPatch);
  } catch {
    return defaultSiteConfig();
  }
}

export async function saveSiteConfig(input: SiteConfigPatch): Promise<SiteConfig> {
  const current = await getSiteConfig();
  const next = mergeSiteConfig({
    theme: { ...current.theme, ...(input.theme || {}) },
    home: { ...current.home, ...(input.home || {}) },
    pages: { ...current.pages, ...(input.pages || {}) },
  });
  if (!(await ensure())) return next;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "site_config" ("id","payload","updated_at")
       VALUES ('default', $1::jsonb, NOW())
       ON CONFLICT ("id") DO UPDATE
         SET "payload" = EXCLUDED."payload", "updated_at" = NOW()`,
      JSON.stringify(next)
    );
  } catch {
    /* سقوط آمن — نُرجع المدمج محلياً */
  }
  return next;
}

function mapPage(r: {
  id: string;
  slug: string;
  title: string;
  body: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}): CustomSitePage {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    body: r.body,
    enabled: Boolean(r.enabled),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function listCustomPages(): Promise<CustomSitePage[]> {
  if (!(await ensure())) return [];
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT * FROM "site_pages" ORDER BY "updated_at" DESC LIMIT 100`
    )) as Array<{
      id: string;
      slug: string;
      title: string;
      body: string;
      enabled: boolean;
      created_at: Date;
      updated_at: Date;
    }>;
    return rows.map(mapPage);
  } catch {
    return [];
  }
}

export async function getCustomPageBySlug(
  slug: string,
  opts?: { onlyEnabled?: boolean }
): Promise<CustomSitePage | null> {
  if (!(await ensure())) return null;
  const s = slugifyAr(slug);
  if (!s) return null;
  try {
    const rows = (await prisma.$queryRawUnsafe(
      opts?.onlyEnabled
        ? `SELECT * FROM "site_pages" WHERE "slug" = $1 AND "enabled" = TRUE LIMIT 1`
        : `SELECT * FROM "site_pages" WHERE "slug" = $1 LIMIT 1`,
      s
    )) as Array<{
      id: string;
      slug: string;
      title: string;
      body: string;
      enabled: boolean;
      created_at: Date;
      updated_at: Date;
    }>;
    return rows[0] ? mapPage(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function upsertCustomPage(input: {
  id?: string;
  slug: string;
  title: string;
  body: string;
  enabled?: boolean;
}): Promise<CustomSitePage | null> {
  if (!(await ensure())) return null;
  const slug = slugifyAr(input.slug);
  const title = input.title.trim().slice(0, 160);
  const body = input.body.slice(0, 50000);
  if (!slug || !title) return null;
  const id = input.id || randomUUID();
  const enabled = input.enabled !== false;
  try {
    if (input.id) {
      await prisma.$executeRawUnsafe(
        `UPDATE "site_pages"
            SET "slug" = $2, "title" = $3, "body" = $4, "enabled" = $5, "updated_at" = NOW()
          WHERE "id" = $1`,
        id,
        slug,
        title,
        body,
        enabled
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "site_pages" ("id","slug","title","body","enabled")
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT ("slug") DO UPDATE
           SET "title" = EXCLUDED."title",
               "body" = EXCLUDED."body",
               "enabled" = EXCLUDED."enabled",
               "updated_at" = NOW()`,
        id,
        slug,
        title,
        body,
        enabled
      );
    }
    return getCustomPageBySlug(slug);
  } catch {
    return null;
  }
}

export async function deleteCustomPage(id: string): Promise<boolean> {
  if (!(await ensure()) || !id) return false;
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "site_pages" WHERE "id" = $1`, id);
    return true;
  } catch {
    return false;
  }
}

export async function isBuiltinPageEnabled(
  key: "home" | "pricing" | "privacy" | "terms"
): Promise<boolean> {
  const cfg = await getSiteConfig();
  return cfg.pages[key] !== false;
}
