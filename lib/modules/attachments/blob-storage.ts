import { randomUUID } from "crypto";

type UploadInput = {
  file: File;
  prefix?: string;
};

export function azureConfigured() {
  return Boolean(process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_CONTAINER && process.env.AZURE_STORAGE_SAS_TOKEN);
}

export async function uploadAttachmentBlob(input: UploadInput) {
  if (!azureConfigured()) {
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
