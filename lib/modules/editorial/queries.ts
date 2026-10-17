import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  Actor,
  DeskConfig,
  PERMISSIONS,
  TargetType,
  allowed,
  demand,
  targetSchema,
} from "./contracts";

export function visible(
  actor: Actor,
  c: DeskConfig,
  target: TargetType,
  domain = "",
) {
  return PERMISSIONS.filter(
    (p) =>
      p !== "LEGAL_CONFIG_MANAGE" &&
      p !== "LEGAL_AGENT_PROPOSE" &&
      p !== "LEGAL_TASK_MANAGE",
  ).some((p) => allowed(actor, c, p, { target, domain }));
}
export function changeWhere(
  actor: Actor,
  c: DeskConfig,
): Prisma.EditorialChangeWhereInput {
  if (actor.role === "SUPER_ADMIN") return {};
  const scopes = c.bindings.filter(
    (b) =>
      b.enabled &&
      b.userId === actor.id &&
      b.kind === "human" &&
      c.roles.some(
        (r) =>
          r.id === b.roleId &&
          r.enabled &&
          r.permissions.some(
            (p) =>
              ![
                "LEGAL_AGENT_PROPOSE",
                "LEGAL_CONFIG_MANAGE",
                "LEGAL_TASK_MANAGE",
              ].includes(p),
          ),
      ),
  );
  return {
    OR: [
      { authorId: actor.id },
      ...scopes.map((b) => ({
        targetType: { in: b.targets },
        ...(b.domains.length ? { domain: { in: b.domains } } : {}),
      })),
    ],
  };
}
export type RecordFilters = {
  target?: string;
  author?: string;
  status?: string;
  olderDays?: string;
  action?: string;
  since?: string;
};
export async function queue(
  actor: Actor,
  c: DeskConfig,
  page: number,
  filters: RecordFilters = {},
) {
  const where: Prisma.EditorialChangeSetWhereInput = {
    changes: {
      every: changeWhere(actor, c),
      some: filters.target ? { targetType: filters.target } : {},
    },
    ...(filters.author ? { authorId: filters.author } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(Number(filters.olderDays) > 0
      ? {
          createdAt: {
            lte: new Date(
              Date.now() - Math.min(Number(filters.olderDays), 3650) * 86400000,
            ),
          },
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.editorialChangeSet.findMany({
      where,
      include: { changes: true, decisions: true },
      orderBy: { createdAt: "desc" },
      take: 30,
      skip: (page - 1) * 30,
    }),
    prisma.editorialChangeSet.count({ where }),
  ]);
  // Mixed scope batches are shown only when every target is visible.
  return {
    items: items.filter((s) =>
      s.changes.every(
        (ch) =>
          ch.authorId === actor.id ||
          visible(actor, c, targetSchema.parse(ch.targetType), ch.domain),
      ),
    ),
    total,
  };
}
export async function intakeQueue(actor: Actor, c: DeskConfig, page: number) {
  const offset = (page - 1) * 30;
  const canAmend = visible(actor, c, "amendment");
  const canPrinciple = visible(actor, c, "principle");
  const amendments = canAmend
    ? await prisma.$queryRaw<
        Array<{
          id: string;
          title: string;
          quote: string;
          confidence: string;
          verbatim: boolean;
          source_url: string;
        }>
      >`SELECT o.op_id AS id,o.target_law_title AS title,o.evidence_quote AS quote,o.confidence,o.verbatim_in_source AS verbatim,o.source_url FROM uqn_fix.amendment_op o LEFT JOIN uqn_fix.amendment_decision d USING(op_id) WHERE d.op_id IS NULL ORDER BY o.op_id LIMIT 30 OFFSET ${offset}`
    : [];
  const amendmentCount = canAmend
    ? await prisma.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT count(*) FROM uqn_fix.amendment_op o LEFT JOIN uqn_fix.amendment_decision d USING(op_id) WHERE d.op_id IS NULL`
    : [{ count: 0n }];
  const principles = canPrinciple
    ? await prisma.judicialPrinciple.findMany({
        where: { reviewStatus: "needs_review" },
        select: {
          id: true,
          title: true,
          principleText: true,
          confidence: true,
        },
        orderBy: { id: "asc" },
        take: 30,
        skip: offset,
      })
    : [];
  const principlesTotal = canPrinciple
    ? await prisma.judicialPrinciple.count({
        where: { reviewStatus: "needs_review" },
      })
    : 0;
  return {
    amendments,
    principles,
    amendmentTotal: Number(amendmentCount[0].count),
    principlesTotal,
  };
}
export async function systems(
  actor: Actor,
  c: DeskConfig,
  filters: {
    q: string;
    domain: string;
    status: string;
    kind: string;
    source?: string;
    completeness?: string;
    conflict?: string;
    page: number;
  },
) {
  const started = performance.now();
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      domain: string | null;
      articleCount: number;
      status: string | null;
      data: Prisma.JsonObject | null;
      conflict: boolean;
    }>
  >`
    SELECT s.id,s.name,s.domain,s."articleCount",v.verified_status AS status,
      jsonb_strip_nulls(jsonb_build_object('officialName',s.name,'domain',s.domain,'code',s.code,'externalIdentifier',s.eli_slug,'sourceUrl',card.source_url,'issuedOn',card.issued_gregorian,'publishedOn',card.published_gregorian,'issuedHijri',card.issued_hijri)) || COALESCE(w.data,'{}'::jsonb) AS data,
      EXISTS(SELECT 1 FROM editorial_change ec WHERE ec.target_type='work' AND ec.target_id=s.id AND ec.status='checks_failed' AND ec.checks @> '[{"code":"conflict"}]'::jsonb) AS conflict
    FROM legal_systems s
    LEFT JOIN LATERAL (SELECT verified_status FROM verification WHERE object_type='work' AND object_id=s.id ORDER BY verified_at DESC,id DESC LIMIT 1) v ON true
    LEFT JOIN LATERAL (SELECT data FROM editorial_work_version WHERE work_id=s.id ORDER BY created_at DESC,id DESC LIMIT 1) w ON true
    LEFT JOIN LATERAL (SELECT source_url,issued_gregorian,published_gregorian,issued_hijri FROM law_card WHERE system_id=s.id ORDER BY created_at DESC,id DESC LIMIT 1) card ON true
    WHERE (${filters.q}='' OR s.name ILIKE ${`%${filters.q}%`} OR w.data->>'officialName' ILIKE ${`%${filters.q}%`})
      AND (${filters.domain}='' OR COALESCE(w.data->>'domain',s.domain)= ${filters.domain})
      AND (${filters.status}='' OR v.verified_status=${filters.status} OR (${filters.status}='unverified' AND v.verified_status IS NULL))
      AND (${filters.kind}='' OR w.data->>'documentKind'=${filters.kind}) ORDER BY s.name`;
  const scoped = rows.filter((r) =>
    visible(actor, c, "work", String(r.data?.domain ?? r.domain ?? "")),
  );
  const complete = (r: (typeof rows)[number]) =>
    [
      "officialName",
      "documentKind",
      "instrumentKind",
      "instrumentNumber",
      "issuedOn",
      "issuer",
      "sourceUrl",
    ].every((k) => !!r.data?.[k]);
  const facets = {
    complete: scoped.filter(complete).length,
    incomplete: scoped.filter((r) => !complete(r)).length,
    conflicts: scoped.filter((r) => r.conflict).length,
  };
  const filtered = scoped.filter(
    (r) =>
      (!filters.source ||
        String(r.data?.sourceUrl ?? "").includes(filters.source)) &&
      (!filters.completeness ||
        (filters.completeness === "complete" ? complete(r) : !complete(r))) &&
      (!filters.conflict || r.conflict),
  );
  return {
    items: filtered.slice((filters.page - 1) * 30, filters.page * 30),
    total: filtered.length,
    facets,
    elapsedMs: Math.round(performance.now() - started),
  };
}
export async function records(
  actor: Actor,
  c: DeskConfig,
  view: "audit" | "index" | "tasks",
  page: number,
  filters: RecordFilters = {},
) {
  demand(actor, c, "LEGAL_QA_VIEW");
  const scoped = { changes: { every: changeWhere(actor, c), some: {} } };
  const skip = (page - 1) * 30;
  if (view === "audit")
    return {
      items: await prisma.editorialAuditEvent.findMany({
        where: {
          ...(actor.role === "SUPER_ADMIN" ? {} : { changeSet: scoped }),
          ...(filters.author ? { actorId: filters.author } : {}),
          ...(filters.action ? { action: filters.action } : {}),
          ...(filters.since &&
          /^\d{4}-\d{2}-\d{2}$/.test(filters.since) &&
          !Number.isNaN(Date.parse(filters.since))
            ? { at: { gte: new Date(filters.since) } }
            : {}),
        },
        orderBy: { id: "desc" },
        skip,
        take: 30,
      }),
    };
  if (view === "index")
    return {
      items: await prisma.editorialIndexSync.findMany({
        where: { changeSet: scoped },
        orderBy: { createdAt: "desc" },
        skip,
        take: 30,
      }),
    };
  return {
    items: await prisma.editorialTask.findMany({
      where: { changeSet: scoped },
      orderBy: { createdAt: "desc" },
      skip,
      take: 30,
    }),
  };
}
