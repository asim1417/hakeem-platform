/**
 * HTTP transport abstraction for Rasd connectors.
 * Cloud uses this module's default fetch; local agent uses LocalHttpTransport;
 * tests use FixtureTransport.
 */
import { rasdFetch, type RasdFetchOptions } from "../http";
import type { FetchResult } from "../../types";

export type RasdHttpTransport = {
  fetch(url: string, opts?: RasdFetchOptions): Promise<FetchResult>;
};

export const cloudHttpTransport: RasdHttpTransport = {
  fetch: rasdFetch
};

export function createFixtureTransport(map: Record<string, string>): RasdHttpTransport {
  return {
    async fetch(url, opts) {
      const fixturePath = opts?.fixturePath ?? map[url];
      if (!fixturePath) {
        return { ok: false, status: 0, headers: {}, bodyText: "", error: "FIXTURE_MISS" };
      }
      return rasdFetch(url, { ...opts, fixturePath, allowFixtureFileUrl: true });
    }
  };
}

/** Local agent transport — identical security rules, runs on the agent host network. */
export const localHttpTransport: RasdHttpTransport = {
  fetch: rasdFetch
};
