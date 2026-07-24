import "server-only";
import { headers } from "next/headers";
import {
  HAKEEM_PATHNAME_HEADER,
  HAKEEM_SEARCH_HEADER,
  isBareDashboardPath,
} from "@/lib/modules/auth/request-path-headers";

export { HAKEEM_PATHNAME_HEADER, HAKEEM_SEARCH_HEADER, isBareDashboardPath };

export function getRequestPathname(): string {
  try {
    return headers().get(HAKEEM_PATHNAME_HEADER) || "";
  } catch {
    return "";
  }
}

export function getRequestSearch(): string {
  try {
    return headers().get(HAKEEM_SEARCH_HEADER) || "";
  } catch {
    return "";
  }
}
