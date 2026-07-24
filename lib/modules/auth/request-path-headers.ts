/** أسماء رؤوس المسار — مشتركة بين middleware والـ layout (بلا server-only). */
export const HAKEEM_PATHNAME_HEADER = "x-hakeem-pathname";
export const HAKEEM_SEARCH_HEADER = "x-hakeem-search";

export function isBareDashboardPath(pathname: string, search: string): boolean {
  const path = (pathname || "").split("?")[0].replace(/\/$/, "") || "";
  if (path !== "/dashboard") return false;
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const platform = params.get("platform");
  return platform !== "1" && platform !== "true";
}
