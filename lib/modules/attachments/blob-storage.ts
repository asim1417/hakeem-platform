import { randomUUID } from "crypto";

type UploadInput = {
  file: File;
  prefix?: string;
};

export type StorageBackend = "azure-blob" | "sharepoint" | "metadata-only";

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

async function uploadToSharePoint(input: UploadInput) {
  const driveId = process.env.SHAREPOINT_DRIVE_ID!;
  const safeName = input.file.name.replace(/[^\w.\-ء-ي]+/g, "-");
  const path = `${input.prefix || "attachments"}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
  const token = await graphToken();
  const url = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${path
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
  return { storageMode: "sharepoint" as const, storageKey: `sharepoint/${path}`, url: item.webUrl };
}

export async function uploadAttachmentBlob(input: UploadInput) {
  if (!azureConfigured()) {
    if (sharePointConfigured()) return uploadToSharePoint(input);
    const storageKey = `metadata-only/${Date.now()}-${input.file.name}`;
    return { storageMode: "metadata-only", storageKey, url: undefined };
  }

  const account = process.env.AZURE_STORAGE_ACCOUNT!;
  const container = process.env.AZURE_STORAGE_CONTAINER!;
  const sas = normalizeSas(process.env.AZURE_STORAGE_SAS_TOKEN!);
  const safeName = input.file.name.replace(/[^\w.\-ء-ي]+/g, "-");
  const storageKey = `${input.prefix || "attachments"}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
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

export function signedDownloadUrl(storageKey: string) {
  if (!azureConfigured() || storageKey.startsWith("metadata-only/")) return null;
  const account = process.env.AZURE_STORAGE_ACCOUNT!;
  const container = process.env.AZURE_STORAGE_CONTAINER!;
  return `https://${account}.blob.core.windows.net/${container}/${encodeURIComponent(storageKey).replace(/%2F/g, "/")}${normalizeSas(process.env.AZURE_STORAGE_SAS_TOKEN!)}`;
}

function publicBlobUrl(storageKey: string) {
  if (!azureConfigured()) return undefined;
  return `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${process.env.AZURE_STORAGE_CONTAINER}/${encodeURIComponent(storageKey).replace(/%2F/g, "/")}`;
}

function normalizeSas(sas: string) {
  return sas.startsWith("?") ? sas : `?${sas}`;
}
