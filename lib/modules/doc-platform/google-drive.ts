// تكامل Google Drive — استيراد مستندات المستخدم من درايف عبر OAuth من جهة الخادم.
// لا مفتاح API في الواجهة (يتجنّب كشف الأسرار)؛ السرّ يبقى خادمياً.
// مُعطّل حتى تُضبط GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET في البيئة.

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
// نطاق للقراءة فقط للملفات التي يفتحها المستخدم صراحةً
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export function isDriveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function driveRedirectUri(origin: string): string {
  return `${origin}/api/doc-platform/drive/callback`;
}

export function buildAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: driveRedirectUri(origin),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

export async function exchangeCode(origin: string, code: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: driveRedirectUri(origin),
      grant_type: "authorization_code"
    })
  });
  if (!res.ok) throw new Error(`فشل تبادل الرمز مع Google (${res.status})`);
  return (await res.json()) as TokenResponse;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

const SUPPORTED_QUERY =
  "mimeType='application/vnd.google-apps.document' or mimeType='text/plain' or mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'";

/** يسرد مستندات المستخدم القابلة للاستيراد (مستندات Google، نصوص، PDF، Word) */
export async function listFiles(accessToken: string, query?: string): Promise<DriveFile[]> {
  const q = [`(${SUPPORTED_QUERY})`, "trashed=false"];
  if (query) q.push(`name contains '${query.replace(/'/g, "\\'")}'`);
  const params = new URLSearchParams({
    q: q.join(" and "),
    pageSize: "50",
    fields: "files(id,name,mimeType)",
    orderBy: "modifiedTime desc"
  });
  const res = await fetch(`${DRIVE_FILES}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error(`تعذّر سرد ملفات Drive (${res.status})`);
  const json = (await res.json()) as { files?: DriveFile[] };
  return json.files ?? [];
}

export interface DriveImportResult {
  title: string;
  /** نص جاهز إن كان قابلاً للاستخراج خادمياً (Google Docs/نص) */
  rawText?: string;
  /** بايتات الملف إن كان يحتاج استخراجاً في المتصفح (PDF/DOCX) */
  bytesBase64?: string;
  ext?: "pdf" | "docx";
}

/** يستورد ملفاً: مستندات Google تُصدَّر نصاً خادمياً؛ PDF/DOCX تُعاد بايتاتها للمتصفح ليستخرجها */
export async function importFile(accessToken: string, file: DriveFile): Promise<DriveImportResult> {
  const auth = { Authorization: `Bearer ${accessToken}` };
  if (file.mimeType === "application/vnd.google-apps.document") {
    const res = await fetch(`${DRIVE_FILES}/${file.id}/export?mimeType=text/plain`, { headers: auth });
    if (!res.ok) throw new Error(`تعذّر تصدير المستند (${res.status})`);
    return { title: file.name, rawText: (await res.text()).trim() };
  }
  if (file.mimeType === "text/plain") {
    const res = await fetch(`${DRIVE_FILES}/${file.id}?alt=media`, { headers: auth });
    if (!res.ok) throw new Error(`تعذّر تنزيل الملف (${res.status})`);
    return { title: file.name, rawText: (await res.text()).trim() };
  }
  // PDF/DOCX: نزّل البايتات وأعدها للمتصفح ليستخرجها (نفس خطّ الرفع المحلي، بما فيه OCR)
  const res = await fetch(`${DRIVE_FILES}/${file.id}?alt=media`, { headers: auth });
  if (!res.ok) throw new Error(`تعذّر تنزيل الملف (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = file.mimeType === "application/pdf" ? "pdf" : "docx";
  return { title: file.name, bytesBase64: buf.toString("base64"), ext };
}
