/**
 * كاشف مزوّد أولي — PR-2 يدعم DIRECT_URL فقط.
 * روابط Google/Microsoft تُكتشف للتحذير لكن لا تُستورد هنا.
 */
export type DetectedProvider =
  | "DIRECT_URL"
  | "GOOGLE_DRIVE"
  | "MICROSOFT_ONEDRIVE"
  | "MICROSOFT_SHAREPOINT"
  | "DROPBOX"
  | "BOX"
  | "UNKNOWN";

export function detectProviderFromUrl(rawUrl: string): DetectedProvider {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return "UNKNOWN";
  }
  if (host === "drive.google.com" || host === "docs.google.com" || host.endsWith(".googleusercontent.com")) {
    return "GOOGLE_DRIVE";
  }
  if (host.endsWith("sharepoint.com") || host.endsWith("sharepointonline.com")) {
    return "MICROSOFT_SHAREPOINT";
  }
  if (host.endsWith("onedrive.live.com") || host === "1drv.ms" || host.endsWith(".sharepoint.com")) {
    return "MICROSOFT_ONEDRIVE";
  }
  if (host === "www.dropbox.com" || host === "dropbox.com" || host.endsWith(".dropbox.com")) {
    return "DROPBOX";
  }
  if (host === "www.box.com" || host === "app.box.com" || host.endsWith(".box.com")) {
    return "BOX";
  }
  return "DIRECT_URL";
}
