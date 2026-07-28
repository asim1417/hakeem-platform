import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { RASD_SNAPSHOT_DIR } from "../flags";
import { contentFingerprint } from "../hash";
import type { RasdSourceCode } from "../types";

export interface SaveSnapshotLocalInput {
  runId: string;
  sourceCode: RasdSourceCode | string;
  url: string;
  body: string | Buffer;
  contentType?: string;
}

function extensionFor(contentType: string | undefined, body: string | Buffer): string {
  if (contentType?.includes("pdf")) return ".pdf";
  if (contentType?.includes("json")) return ".json";
  if (contentType?.includes("xml")) return ".xml";
  if (contentType?.includes("html")) return ".html";
  if (Buffer.isBuffer(body)) return ".bin";
  return ".txt";
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "snapshot";
}

export async function saveSnapshotLocal(input: SaveSnapshotLocalInput): Promise<{ path: string; contentHash: string }> {
  const contentHash = contentFingerprint(input.body);
  const root =
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
      ? path.join("/tmp", "rasd-snapshots")
      : path.join(process.cwd(), RASD_SNAPSHOT_DIR);
  const dir = path.join(root, safeSegment(input.runId), safeSegment(input.sourceCode));
  await mkdir(dir, { recursive: true });

  const urlKey = contentFingerprint(input.url).slice(0, 16);
  const filePath = path.join(dir, `${Date.now()}-${urlKey}-${contentHash.slice(0, 16)}${extensionFor(input.contentType, input.body)}`);
  await writeFile(filePath, input.body);
  return { path: filePath, contentHash };
}

export async function loadSnapshot(snapshotPath: string): Promise<Buffer> {
  const resolved = path.isAbsolute(snapshotPath) ? snapshotPath : path.join(process.cwd(), snapshotPath);
  return readFile(resolved);
}
