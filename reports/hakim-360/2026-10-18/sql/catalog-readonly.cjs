#!/usr/bin/env node
/**
 * HKM-031 read-only catalog. SELECT / catalog reads only.
 * Refuses any statement that is not a read.
 */
const fs = require("fs");
const path = require("path");
let Client;
try {
  ({ Client } = require("pg"));
} catch {
  ({ Client } = require("/tmp/pgwork/node_modules/pg"));
}

const OUT = process.env.HKM031_OUT || "/tmp/hakim-audit/out";
const SCHEMA_PATH = path.join(__dirname, "../../../../prisma/schema.prisma");
const MEASURED = new Date().toISOString();

function assertReadOnly(sql) {
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .trim();
  if (!/^(select|with|show|explain|values)\b/i.test(stripped)) {
    throw new Error("refused non-read statement");
  }
  if (/\b(insert|update|delete|alter|drop|truncate|grant|revoke|vacuum|reindex)\b/i.test(stripped)) {
    throw new Error("refused mutating keyword");
  }
  if (/\bcreate\s+(table|index|schema|extension|role|function|trigger|view|materialized|database|user|policy)\b/i.test(stripped)) {
    throw new Error("refused create statement");
  }
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(name, rows) {
  if (!rows.length) {
    fs.writeFileSync(path.join(OUT, name), "");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  fs.writeFileSync(path.join(OUT, name), lines.join("\n") + "\n");
}

function parsePrisma(text) {
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLine = noBlock
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");

  const enums = [];
  const enumRe = /enum\s+(\w+)\s*\{([^}]*)\}/g;
  let m;
  while ((m = enumRe.exec(noLine))) {
    const values = m[2]
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("@@"));
    enums.push({ name: m[1], values });
  }
  const enumNames = new Set(enums.map((e) => e.name));

  const models = [];
  const modelRe = /model\s+(\w+)\s*\{/g;
  while ((m = modelRe.exec(noLine))) {
    const name = m[1];
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < noLine.length && depth > 0) {
      if (noLine[i] === "{") depth += 1;
      else if (noLine[i] === "}") depth -= 1;
      i += 1;
    }
    const body = noLine.slice(start, i - 1);
    models.push({ name, body });
  }
  const modelNames = new Set(models.map((x) => x.name));

  const parsed = models.map((model) => {
    let table = model.name;
    const fields = [];
    const modelAttrs = [];
    const lines = model.body.split("\n");
    let buf = "";
    const flush = (raw) => {
      const line = raw.trim();
      if (!line) return;
      if (line.startsWith("@@")) {
        modelAttrs.push(line);
        const map = line.match(/@@map\(\s*"([^"]+)"\s*\)/);
        if (map) table = map[1];
        return;
      }
      const fm = line.match(
        /^(\w+)\s+(Unsupported\(\s*"(.*?)"\s*\)|\w+)(\[\])?(\?)?(?:\s+(.*))?$/,
      );
      if (!fm) {
        fields.push({ parseError: line });
        return;
      }
      const [, fname, typeToken, unsupportedInner, list, optional, rest = ""] = fm;
      const isUnsupported = typeToken.startsWith("Unsupported");
      const typeName = isUnsupported ? unsupportedInner : typeToken;
      const isEnum = enumNames.has(typeName);
      const isRelation = !isUnsupported && !isEnum && modelNames.has(typeName);
      const colMap = rest.match(/@map\(\s*"([^"]+)"\s*\)/);
      const column = colMap ? colMap[1] : fname;
      const hasId = /@id\b/.test(rest);
      const hasUnique = /@unique\b/.test(rest);
      const hasUpdatedAt = /@updatedAt\b/.test(rest);
      const def = rest.match(/@default\((.*)\)\s*$/);
      let defaultExpr = null;
      if (/@default\(/.test(rest)) {
        const idx = rest.indexOf("@default(");
        let d = 1;
        let j = idx + "@default(".length;
        const begin = j;
        while (j < rest.length && d > 0) {
          if (rest[j] === "(") d += 1;
          else if (rest[j] === ")") d -= 1;
          j += 1;
        }
        defaultExpr = rest.slice(begin, j - 1);
      }
      fields.push({
        name: fname,
        column,
        typeName,
        isUnsupported,
        isEnum,
        isList: Boolean(list),
        optional: Boolean(optional),
        isRelation,
        hasId,
        hasUnique,
        hasUpdatedAt,
        defaultExpr,
        rest,
      });
    };
    for (const line of lines) {
      buf = buf ? `${buf} ${line.trim()}` : line.trim();
      if (!buf) continue;
      const parens = (buf.match(/\(/g) || []).length - (buf.match(/\)/g) || []).length;
      if (parens > 0) continue;
      flush(buf);
      buf = "";
    }
    if (buf) flush(buf);
    return { name: model.name, table, fields, modelAttrs };
  });
  return { enums, models: parsed };
}

async function q(client, sql, params) {
  assertReadOnly(sql);
  const res = await client.query(sql, params);
  return res.rows;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const conn = process.env.DATABASE_URL || process.env.DATABASE_UR;
  if (!conn) throw new Error("missing connection env");
  let host = "unknown";
  let database = "unknown";
  try {
    const u = new URL(conn);
    host = u.hostname;
    database = u.pathname.replace(/^\//, "");
  } catch {
    host = "unparsed";
  }
  const client = new Client({
    connectionString: conn,
    application_name: "hkm031-readonly-audit",
    statement_timeout: 30000,
    query_timeout: 30000,
  });
  await client.connect();
  await client.query("SET default_transaction_read_only = on");
  await client.query("SET statement_timeout = '25s'");
  await client.query("SET lock_timeout = '3s'");

  const identity = await q(
    client,
    `SELECT current_database() AS database_name,
            current_user AS db_user,
            current_schema() AS schema_name,
            inet_server_addr()::text AS server_addr,
            inet_server_port() AS server_port,
            version() AS server_version,
            now() AS measured_utc,
            current_setting('transaction_read_only') AS transaction_read_only,
            current_setting('statement_timeout') AS statement_timeout,
            current_setting('default_transaction_read_only') AS default_ro`,
  );
  const settings = await q(
    client,
    `SELECT name, setting, unit, source
     FROM pg_settings
     WHERE name IN (
       'server_version','server_version_num','data_directory',
       'statement_timeout','lock_timeout','idle_in_transaction_session_timeout',
       'max_connections','shared_buffers','work_mem','maintenance_work_mem',
       'effective_cache_size','random_page_cost',
       'autovacuum','autovacuum_naptime','autovacuum_vacuum_scale_factor',
       'neon.project_id','neon.branch_id','neon.timeline_id'
     )
     OR name LIKE 'neon.%'`,
  );
  fs.writeFileSync(
    path.join(OUT, "identity.json"),
    JSON.stringify(
      {
        measured_utc: MEASURED,
        host,
        url_database: database,
        identity: identity[0],
        settings,
      },
      null,
      2,
    ),
  );

  const schemas = await q(
    client,
    `SELECT n.nspname AS schema,
            pg_catalog.obj_description(n.oid,'pg_namespace') AS description
     FROM pg_namespace n
     WHERE n.nspname NOT IN ('pg_catalog','information_schema')
       AND n.nspname NOT LIKE 'pg_toast%'
       AND n.nspname NOT LIKE 'pg_temp%'
     ORDER BY 1`,
  );
  writeCsv("schemas.csv", schemas);

  const tables = await q(
    client,
    `SELECT n.nspname AS schema,
            c.relname AS name,
            CASE c.relkind
              WHEN 'r' THEN 'table'
              WHEN 'p' THEN 'partitioned_table'
              WHEN 'v' THEN 'view'
              WHEN 'm' THEN 'materialized_view'
              WHEN 'f' THEN 'foreign_table'
              ELSE c.relkind::text
            END AS kind,
            c.reltuples::bigint AS estimate_rows,
            pg_total_relation_size(c.oid) AS total_bytes,
            pg_relation_size(c.oid) AS heap_bytes,
            pg_indexes_size(c.oid) AS index_bytes,
            c.relhasindex AS has_index,
            c.relrowsecurity AS rls_enabled,
            c.relforcerowsecurity AS rls_forced,
            pg_get_userbyid(c.relowner) AS owner
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind IN ('r','p','v','m','f')
       AND n.nspname NOT IN ('pg_catalog','information_schema')
       AND n.nspname NOT LIKE 'pg_toast%'
     ORDER BY 1,2`,
  );
  writeCsv("relations.csv", tables);

  const columns = await q(
    client,
    `SELECT n.nspname AS schema,
            c.relname AS table_name,
            a.attname AS column_name,
            a.attnum AS ordinal,
            pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
            t.typname AS udt_name,
            NOT a.attnotnull AS is_nullable,
            pg_get_expr(ad.adbin, ad.adrelid) AS column_default,
            a.attidentity AS identity,
            a.attgenerated AS generated,
            col_description(a.attrelid, a.attnum) AS comment
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_type t ON t.oid = a.atttypid
     LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
     WHERE a.attnum > 0
       AND NOT a.attisdropped
       AND c.relkind IN ('r','p','v','m','f')
       AND n.nspname NOT IN ('pg_catalog','information_schema')
       AND n.nspname NOT LIKE 'pg_toast%'
     ORDER BY 1,2,4`,
  );
  writeCsv("columns.csv", columns);

  const constraints = await q(
    client,
    `SELECT n.nspname AS schema,
            r.relname AS table_name,
            c.conname AS constraint_name,
            c.contype AS type_code,
            CASE c.contype
              WHEN 'p' THEN 'PRIMARY KEY'
              WHEN 'f' THEN 'FOREIGN KEY'
              WHEN 'u' THEN 'UNIQUE'
              WHEN 'c' THEN 'CHECK'
              WHEN 'x' THEN 'EXCLUDE'
              ELSE c.contype::text
            END AS constraint_type,
            pg_get_constraintdef(c.oid) AS definition,
            c.convalidated AS validated,
            c.condeferrable AS deferrable,
            fn.nspname AS ref_schema,
            fr.relname AS ref_table
     FROM pg_constraint c
     JOIN pg_class r ON r.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = r.relnamespace
     LEFT JOIN pg_class fr ON fr.oid = c.confrelid
     LEFT JOIN pg_namespace fn ON fn.oid = fr.relnamespace
     WHERE n.nspname NOT IN ('pg_catalog','information_schema')
     ORDER BY 1,2,3`,
  );
  writeCsv("constraints.csv", constraints);

  const indexes = await q(
    client,
    `SELECT n.nspname AS schema,
            t.relname AS table_name,
            i.relname AS index_name,
            ix.indisunique AS is_unique,
            ix.indisprimary AS is_primary,
            ix.indisvalid AS is_valid,
            ix.indisready AS is_ready,
            am.amname AS access_method,
            pg_get_indexdef(ix.indexrelid) AS index_def,
            pg_relation_size(i.oid) AS index_bytes,
            s.idx_scan,
            s.idx_tup_read,
            s.idx_tup_fetch
     FROM pg_index ix
     JOIN pg_class i ON i.oid = ix.indexrelid
     JOIN pg_class t ON t.oid = ix.indrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     JOIN pg_am am ON am.oid = i.relam
     LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = ix.indexrelid
     WHERE n.nspname NOT IN ('pg_catalog','information_schema')
     ORDER BY 1,2,3`,
  );
  writeCsv("indexes.csv", indexes);

  const enums = await q(
    client,
    `SELECT n.nspname AS schema,
            t.typname AS enum_name,
            e.enumsortorder AS sort_order,
            e.enumlabel AS label
     FROM pg_type t
     JOIN pg_enum e ON e.enumtypid = t.oid
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname NOT IN ('pg_catalog','information_schema')
     ORDER BY 1,2,3`,
  );
  writeCsv("enums.csv", enums);

  const extensions = await q(
    client,
    `SELECT e.extname, e.extversion, n.nspname AS schema
     FROM pg_extension e
     JOIN pg_namespace n ON n.oid = e.extnamespace
     ORDER BY 1`,
  );
  writeCsv("extensions.csv", extensions);

  const functions = await q(
    client,
    `SELECT n.nspname AS schema,
            p.proname AS name,
            pg_get_function_identity_arguments(p.oid) AS args,
            CASE p.prokind WHEN 'f' THEN 'function' WHEN 'p' THEN 'procedure' WHEN 'a' THEN 'aggregate' WHEN 'w' THEN 'window' ELSE p.prokind::text END AS kind,
            l.lanname AS language,
            p.prosecdef AS security_definer
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     JOIN pg_language l ON l.oid = p.prolang
     WHERE n.nspname NOT IN ('pg_catalog','information_schema')
       AND n.nspname NOT LIKE 'pg_toast%'
     ORDER BY 1,2`,
  );
  writeCsv("functions.csv", functions);

  const triggers = await q(
    client,
    `SELECT n.nspname AS schema,
            c.relname AS table_name,
            t.tgname AS trigger_name,
            NOT t.tgisinternal AS is_user,
            pg_get_triggerdef(t.oid) AS definition
     FROM pg_trigger t
     JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE NOT t.tgisinternal
       AND n.nspname NOT IN ('pg_catalog','information_schema')
     ORDER BY 1,2,3`,
  );
  writeCsv("triggers.csv", triggers);

  const policies = await q(
    client,
    `SELECT schemaname AS schema, tablename AS table_name, policyname, permissive, roles, cmd, qual, with_check
     FROM pg_policies
     ORDER BY 1,2,3`,
  );
  writeCsv("policies.csv", policies);

  const roles = await q(
    client,
    `SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin,
            rolreplication, rolbypassrls, rolconnlimit
     FROM pg_roles
     WHERE rolname NOT LIKE 'pg_%'
     ORDER BY 1`,
  );
  writeCsv("roles.csv", roles);

  const grants = await q(
    client,
    `SELECT table_schema, table_name, grantee, privilege_type, is_grantable
     FROM information_schema.role_table_grants
     WHERE table_schema NOT IN ('pg_catalog','information_schema')
     ORDER BY 1,2,3,4`,
  );
  writeCsv("grants.csv", grants);

  const sequences = await q(
    client,
    `SELECT n.nspname AS schema, c.relname AS sequence_name
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind = 'S'
       AND n.nspname NOT IN ('pg_catalog','information_schema')
     ORDER BY 1,2`,
  );
  writeCsv("sequences.csv", sequences);

  const views = await q(
    client,
    `SELECT n.nspname AS schema, c.relname AS name,
            CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized_view' END AS kind,
            pg_get_viewdef(c.oid, true) AS definition
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind IN ('v','m')
       AND n.nspname NOT IN ('pg_catalog','information_schema')
     ORDER BY 1,2`,
  );
  // definitions may be long; keep them but they are schema not data
  writeCsv(
    "views.csv",
    views.map((v) => ({ ...v, definition: (v.definition || "").slice(0, 2000) })),
  );

  let migrations = [];
  try {
    migrations = await q(
      client,
      `SELECT id, migration_name, checksum, finished_at, rolled_back_at, started_at, applied_steps_count, logs
       FROM _prisma_migrations
       ORDER BY started_at`,
    );
  } catch (err) {
    migrations = [{ error: String(err.message || err).slice(0, 300) }];
  }
  writeCsv(
    "prisma_migrations.csv",
    migrations.map((row) => ({
      ...row,
      logs: row.logs ? String(row.logs).slice(0, 200) : row.logs,
      checksum: row.checksum ? String(row.checksum).slice(0, 16) + "…" : row.checksum,
    })),
  );

  const dbSize = await q(
    client,
    `SELECT pg_database_size(current_database()) AS database_bytes,
            (SELECT count(*) FROM pg_stat_activity) AS sessions_visible,
            (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') AS active_sessions`,
  );
  const bloat = await q(
    client,
    `SELECT schemaname AS schema, relname AS table_name, n_live_tup, n_dead_tup,
            last_vacuum, last_autovacuum, last_analyze, last_autoanalyze,
            vacuum_count, autovacuum_count, seq_scan, idx_scan, n_tup_ins, n_tup_upd, n_tup_del
     FROM pg_stat_user_tables
     ORDER BY n_dead_tup DESC NULLS LAST
     LIMIT 80`,
  );
  writeCsv("table_stats.csv", bloat);
  fs.writeFileSync(path.join(OUT, "db_size.json"), JSON.stringify(dbSize[0], null, 2));

  let statStatements = { available: false };
  try {
    const ext = extensions.find((e) => e.extname === "pg_stat_statements");
    if (ext) {
      const top = await q(
        client,
        `SELECT queryid::text AS queryid, calls, rows,
                round(total_exec_time::numeric,1) AS total_ms,
                round(mean_exec_time::numeric,1) AS mean_ms,
                round(max_exec_time::numeric,1) AS max_ms,
                left(regexp_replace(query, '\\s+', ' ', 'g'), 220) AS query_sample
         FROM pg_stat_statements
         ORDER BY total_exec_time DESC
         LIMIT 25`,
      );
      statStatements = { available: true, top };
      writeCsv("slow_statements.csv", top);
    }
  } catch (err) {
    statStatements = { available: false, error: String(err.message || err).slice(0, 240) };
  }

  const prisma = parsePrisma(fs.readFileSync(SCHEMA_PATH, "utf8"));
  const publicCols = columns.filter((c) => c.schema === "public");
  const colKey = (schema, table, column) => `${schema}.${table}.${column}`;
  const pgColMap = new Map(publicCols.map((c) => [colKey(c.schema, c.table_name, c.column_name), c]));
  const pgTables = new Set(tables.filter((t) => t.schema === "public" && t.kind === "table").map((t) => t.name));

  const drift = [];
  const prismaTables = new Set();
  for (const model of prisma.models) {
    prismaTables.add(model.table);
    const scalar = model.fields.filter((f) => !f.isRelation && !f.parseError);
    if (!pgTables.has(model.table)) {
      drift.push({
        schema: "public",
        table_name: model.table,
        prisma_model: model.name,
        column_name: "",
        finding: "prisma_table_missing_in_pg",
        prisma_type: "",
        pg_type: "",
        prisma_nullable: "",
        pg_nullable: "",
        notes: "",
      });
      continue;
    }
    for (const field of scalar) {
      const pg = pgColMap.get(colKey("public", model.table, field.column));
      if (!pg) {
        drift.push({
          schema: "public",
          table_name: model.table,
          prisma_model: model.name,
          column_name: field.column,
          finding: "prisma_column_missing_in_pg",
          prisma_type: field.typeName,
          pg_type: "",
          prisma_nullable: field.optional,
          pg_nullable: "",
          notes: field.isList ? "list" : "",
        });
        continue;
      }
      const pgNullable = pg.is_nullable === true || pg.is_nullable === "t" || pg.is_nullable === "true";
      if (Boolean(field.optional) !== Boolean(pgNullable)) {
        drift.push({
          schema: "public",
          table_name: model.table,
          prisma_model: model.name,
          column_name: field.column,
          finding: "nullability_mismatch",
          prisma_type: field.typeName,
          pg_type: pg.data_type,
          prisma_nullable: field.optional,
          pg_nullable: pgNullable,
          notes: `default_pg=${pg.column_default || ""}`,
        });
      }
    }
    const prismaCols = new Set(scalar.map((f) => f.column));
    for (const pg of publicCols.filter((c) => c.table_name === model.table)) {
      if (!prismaCols.has(pg.column_name)) {
        drift.push({
          schema: "public",
          table_name: model.table,
          prisma_model: model.name,
          column_name: pg.column_name,
          finding: "pg_column_not_in_prisma",
          prisma_type: "",
          pg_type: pg.data_type,
          prisma_nullable: "",
          pg_nullable: pg.is_nullable,
          notes: `default=${pg.column_default || ""}`,
        });
      }
    }
  }
  for (const table of pgTables) {
    if (!prismaTables.has(table)) {
      drift.push({
        schema: "public",
        table_name: table,
        prisma_model: "",
        column_name: "",
        finding: "pg_table_not_in_prisma",
        prisma_type: "",
        pg_type: "",
        prisma_nullable: "",
        pg_nullable: "",
        notes: "",
      });
    }
  }
  writeCsv("schema_drift.csv", drift);

  const prismaEnums = [];
  for (const en of prisma.enums) {
    for (const value of en.values) {
      prismaEnums.push({ prisma_enum: en.name, label: value });
    }
  }
  writeCsv("prisma_enums.csv", prismaEnums);
  const pgEnumMap = new Map();
  for (const row of enums.filter((e) => e.schema === "public")) {
    const key = row.enum_name;
    if (!pgEnumMap.has(key)) pgEnumMap.set(key, []);
    pgEnumMap.get(key).push(row.label);
  }
  const enumDrift = [];
  for (const en of prisma.enums) {
    const pgVals = pgEnumMap.get(en.name) || null;
    if (!pgVals) {
      enumDrift.push({ enum_name: en.name, finding: "prisma_enum_missing_in_pg", label: "", notes: "" });
      continue;
    }
    for (const label of en.values) {
      if (!pgVals.includes(label)) {
        enumDrift.push({ enum_name: en.name, finding: "prisma_value_missing_in_pg", label, notes: "" });
      }
    }
    for (const label of pgVals) {
      if (!en.values.includes(label)) {
        enumDrift.push({ enum_name: en.name, finding: "pg_value_not_in_prisma", label, notes: "" });
      }
    }
  }
  for (const [name] of pgEnumMap) {
    if (!prisma.enums.find((e) => e.name === name)) {
      enumDrift.push({ enum_name: name, finding: "pg_enum_not_in_prisma", label: "", notes: (pgEnumMap.get(name) || []).join("|") });
    }
  }
  writeCsv("enum_drift.csv", enumDrift);

  const countTargets = [
    "legal_systems",
    "legal_articles",
    "judicial_cases",
    "judicial_principles",
    "legal_article_case_links",
    "legal_relations",
    "legal_graph_edges",
    "legal_graph_nodes",
    "embeddings",
    "ruling_segments",
    "ruling_segment_embeddings",
    "law_card",
    "unit_version",
    "article_versions",
    "article_amendments",
    "users",
    "change_set",
    "editorial_change",
    "review_decision",
    "audit_event",
    "index_sync",
    "editorial_config",
    "search_surface",
  ];
  const counts = [];
  for (const table of countTargets) {
    const exists = tables.some((t) => t.schema === "public" && t.name === table && t.kind === "table");
    if (!exists) {
      counts.push({ schema: "public", table_name: table, exists: false, exact_count: null, estimate_rows: null });
      continue;
    }
    const est = tables.find((t) => t.schema === "public" && t.name === table);
    try {
      const rows = await q(client, `SELECT count(*)::bigint AS n FROM public.${quoteIdent(table)}`);
      counts.push({
        schema: "public",
        table_name: table,
        exists: true,
        exact_count: rows[0].n,
        estimate_rows: est ? est.estimate_rows : null,
      });
    } catch (err) {
      counts.push({
        schema: "public",
        table_name: table,
        exists: true,
        exact_count: null,
        estimate_rows: est ? est.estimate_rows : null,
        error: String(err.message || err).slice(0, 200),
      });
    }
  }
  writeCsv("key_counts.csv", counts);

  const quality = [];
  const qualitySql = [
    ["articles_empty_search_norm", `SELECT count(*)::bigint AS n FROM legal_articles WHERE search_norm IS NULL OR btrim(search_norm)=''`],
    ["articles_nonpositive_number", `SELECT count(*)::bigint AS n FROM legal_articles WHERE "articleNumber" <= 0`],
    ["articles_blank_content", `SELECT count(*)::bigint AS n FROM legal_articles WHERE content IS NULL OR btrim(content)=''`],
    ["systems_missing_kind", `SELECT count(*)::bigint AS n FROM legal_systems WHERE instrument_kind IS NULL OR btrim(instrument_kind)=''`],
    ["systems_missing_slug", `SELECT count(*)::bigint AS n FROM legal_systems WHERE eli_slug IS NULL OR btrim(eli_slug::text)=''`],
    ["article_count_mismatch_systems", `WITH a AS (SELECT "legalSystemId" id, count(*) n FROM legal_articles GROUP BY 1) SELECT count(*)::bigint AS n FROM legal_systems s LEFT JOIN a ON a.id=s.id WHERE s."articleCount" <> coalesce(a.n,0)`],
    ["systems_without_articles", `SELECT count(*)::bigint AS n FROM legal_systems s WHERE NOT EXISTS (SELECT 1 FROM legal_articles a WHERE a."legalSystemId"=s.id)`],
    ["duplicate_article_keys", `SELECT count(*)::bigint AS n FROM (SELECT 1 FROM legal_articles GROUP BY "legalSystemId","articleNumber","articleBis" HAVING count(*)>1) d`],
    ["users_total", `SELECT count(*)::bigint AS n FROM users`],
  ];
  for (const [name, sql] of qualitySql) {
    try {
      const rows = await q(client, sql);
      quality.push({ check: name, result: rows[0].n, status: "ok" });
    } catch (err) {
      quality.push({ check: name, result: "", status: "error", error: String(err.message || err).slice(0, 240) });
    }
  }
  writeCsv("quality_checks.csv", quality);

  const summary = {
    measured_utc: identity[0].measured_utc,
    host,
    database: identity[0].database_name,
    user: identity[0].db_user,
    version: identity[0].server_version,
    read_only: identity[0].default_ro,
    prisma_models: prisma.models.length,
    prisma_enums: prisma.enums.length,
    public_tables: tables.filter((t) => t.schema === "public" && t.kind === "table").length,
    all_relations: tables.length,
    public_columns: publicCols.length,
    drift_counts: countBy(drift, "finding"),
    enum_drift_counts: countBy(enumDrift, "finding"),
    extensions: extensions.map((e) => `${e.extname} ${e.extversion}`),
    schemas: schemas.map((s) => s.schema),
    migration_rows: migrations.length,
    migration_names: migrations.map((m) => m.migration_name).filter(Boolean),
    db_size: dbSize[0],
    stat_statements: statStatements.available ? statStatements.top.length : statStatements,
    key_counts: counts,
    quality,
    rls_tables: tables.filter((t) => t.rls_enabled).map((t) => `${t.schema}.${t.name}`),
    invalid_indexes: indexes.filter((i) => i.is_valid === false || i.is_valid === "f").length,
    unvalidated_constraints: constraints.filter((c) => c.validated === false || c.validated === "f").length,
    trigger_count: triggers.length,
    function_count: functions.length,
    policy_count: policies.length,
  };
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  await client.end();
}

function quoteIdent(name) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error("bad ident");
  return `"${name}"`;
}

function countBy(rows, key) {
  const out = {};
  for (const row of rows) out[row[key]] = (out[row[key]] || 0) + 1;
  return out;
}

main().catch((err) => {
  const msg = String(err && err.message ? err.message : err);
  console.error(msg.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://REDACTED"));
  process.exit(1);
});
