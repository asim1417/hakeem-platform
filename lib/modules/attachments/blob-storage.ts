import { randomUUID } from "crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";

type UploadInput = {
  file: File;
  prefix?: string;
};

export type StreamUploadInput = {
  filePath: string;
  fileName: string;
  mimeType: string;
  size: number;
  prefix?: string;
};

export type StorageBackend = "azure-blob" | "sharepoint" | "metadata-only";

export type UploadResult = {
  storageMode: StorageBackend;
  storageKey: string;
  url?: string;
};

export function azureConfigured() {
  return Boolean(process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_CONTAINER && process.env.AZURE_STORAGE_SAS_TOKEN);
}

/** SharePoint/Microsoft 365 عبر Graph: توكن جاهز أو بيانات اعتماد التطبيق. */
export function sharePointConfigured() {
  const hasCreds = Boolean(
    process.env.SHAREPOINT_ACCESS_TOKEN ||
      (process.env.SHAREPOINT_TENANT_ID && process.env.SHAREPOINT_CLIENT_ID && process.env.SHAREPOINT_CLIENT_SECRET)
  );
  return Boolean(process.env.SHAREPOINT_DRIVE_ID && hasCreds);
}

/** خلفية التخزين الفعّالة (Azure أولاً، ثم SharePoint، ثم metadata-only). */
export function storageBackend(): StorageBackend {
  if (azureConfigured()) return "azure-blob";
  if (sharePointConfigured()) return "sharepoint";
  return "metadata-only";
}

async function graphToken(): Promise<string> {
  if (process.env.SHAREPOINT_ACCESS_TOKEN) return process.env.SHAREPOINT_ACCESS_TOKEN;
  const tenant = process.env.SHAREPOINT_TENANT_ID!;
  const body = new URLSearchParams({
    client_id: process.env.SHAREPOINT_CLIENT_ID!,
    client_secret: process.env.SHAREPOINT_CLIENT_SECRET!,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`تعذّر الحصول على توكن Microsoft Graph: ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("لم يُرجِع Graph توكناً صالحاً.");
  return data.access_token;
}

function buildStorageKey(prefix: string | undefined, fileName: string) {
  const safeName = fileName.replace(/[^\w.\-ء-ي]+/g, "-");
  return `${prefix || "attachments"}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
}

async function uploadToSharePoint(input: UploadInput) {
  const driveId = process.env.SHAREPOINT_DRIVE_ID!;
  const pathKey = buildStorageKey(input.prefix, input.file.name);
  const token = await graphToken();
  const url = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${pathKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}:/content`;
  const response = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": input.file.type || "application/octet-stream" },
    body: Buffer.from(await input.file.arrayBuffer()),
  });
  if (!response.ok) throw new Error(`تعذّر رفع الملف إلى SharePoint: ${response.status}`);
  const item = (await response.json()) as { webUrl?: string };
  return { storageMode: "sharepoint" as const, storageKey: `sharepoint/${pathKey}`, url: item.webUrl };
}

export async function uploadAttachmentBlob(input: UploadInput): Promise<UploadResult> {
  if (!azureConfigured()) {
    if (sharePointConfigured()) return uploadToSharePoint(input);
    const storageKey = `metadata-only/${Date.now()}-${input.file.name}`;
    return { storageMode: "metadata-only", storageKey, url: undefined };
  }

  const account = process.env.AZURE_STORAGE_ACCOUNT!;
  const container = process.env.AZURE_STORAGE_CONTAINER!;
  const sas = normalizeSas(process.env.AZURE_STORAGE_SAS_TOKEN!);
  const storageKey = buildStorageKey(input.prefix, input.file.name);
  const url = `https://${account}.blob.core.windows.net/${container}/${encodeURIComponent(storageKey).replace(/%2F/g, "/")}${sas}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "Content-Type": input.file.type || "application/octet-stream"
    },
    body: Buffer.from(await input.file.arrayBuffer())
  });
  if (!response.ok) throw new Error(`تعذر رفع الملف إلى Azure Blob: ${response.status}`);
  return { storageMode: "azure-blob", storageKey, url: publicBlobUrl(storageKey) };
}

/**
 * رفع من مسار ملف مؤقت.
 * Azure: دفق من القرص. SharePoint: قراءة ملف مرة للـ PUT (قيد Graph الحالي).
 * يُبقي uploadAttachmentBlob دون كسر.
 */
export async function uploadAttachmentFromPath(input: StreamUploadInput): Promise<UploadResult> {
  if (!azureConfigured()) {
    if (sharePointConfigured()) {
      const buf = await readFile(input.filePath);
      const file = new File([buf], input.fileName, { type: input.mimeType });
      return uploadToSharePoint({ file, prefix: input.prefix });
    }
    const storageKey = `metadata-only/${Date.now()}-${input.fileName}`;
    return { storageMode: "metadata-only", storageKey, url: undefined };
  }

  const account = process.env.AZURE_STORAGE_ACCOUNT!;
  const container = process.env.AZURE_STORAGE_CONTAINER!;
  const sas = normalizeSas(process.env.AZURE_STORAGE_SAS_TOKEN!);
  const storageKey = buildStorageKey(input.prefix, input.fileName);
  const url = `https://${account}.blob.core.windows.net/${container}/${encodeURIComponent(storageKey).replace(/%2F/g, "/")}${sas}`;
  const stream = createReadStream(input.filePath);
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "Content-Type": input.mimeType || "application/octet-stream",
      "Content-Length": String(input.size)
    },
    body: stream as unknown as BodyInit,
    // undici يتطلب duplex عند إرسال جسم متدفق
    duplex: "half"
  } as RequestInit & { duplex: "half" });
  if (!response.ok) throw new Error(`تعذر رفع الملف إلى Azure Blob: ${response.status}`);
  return { storageMode: "azure-blob", storageKey, url: publicBlobUrl(storageKey) };
}

export function signedDownloadUrl(storageKey: string) {
  if (!azureConfigured() || storageKey.startsWith("metadata-only/")) return null;
  const account = process.env.AZURE_STORAGE_ACCOUNT!;
  const container = process.env.AZURE_STORAGE_CONTAINER!;
  return `https://${account}.blob.core.windows.net/${container}/${encodeURIComponent(storageKey).replace(/%2F/g, "/")}${normalizeSas(process.env.AZURE_STORAGE_SAS_TOKEN!)}`;
}

/**
 * يجلب بايتات المرفق من التخزين للاستخدام الخادمي (Adapter/doc-node).
 * metadata-only → null.
 * SharePoint: Graph drive content من storageKey فقط — لا يُرسل التوكين إلى webUrl/metadata عام.
 */
export async function downloadAttachmentBytes(
  storageKey: string,
  opts?: { sharePointUrl?: string | null }
): Promise<Uint8Array | null> {
  if (!storageKey || storageKey.startsWith("metadata-only/")) return null;

  if (storageKey.startsWith("sharepoint/")) {
    const { decideSharePointDownloadUrl, fetchGraphContentFollowingRedirects } = await import(
      "@/lib/modules/attachments/sharepoint-download"
    );
    const decision = decideSharePointDownloadUrl({
      storageKey,
      metadataUrl: opts?.sharePointUrl,
    });
    if (!decision.allow) return null;
    const token = await graphToken().catch(() => null);
    if (!token) return null;
    const result = await fetchGraphContentFollowingRedirects(decision.url, token);
    if (!result.ok) return null;
    return result.body;
  }

  const url = signedDownloadUrl(storageKey);
  if (!url) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

function publicBlobUrl(storageKey: string) {
  if (!azureConfigured()) return undefined;
  return `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${process.env.AZURE_STORAGE_CONTAINER}/${encodeURIComponent(storageKey).replace(/%2F/g, "/")}`;
}

function normalizeSas(sas: string) {
  return sas.startsWith("?") ? sas : `?${sas}`;
}
