const candidates = [
  "https://mc.gov.sa/ar/About/Statistics/_api/web/lists/GetByTitle('GISInfo')/items",
  "https://www.mc.gov.sa/ar/About/Statistics/_api/web/lists/GetByTitle('GISInfo')/items",
];

async function probe(url: string): Promise<boolean> {
  const endpoint = new URL(url);
  endpoint.searchParams.set("$top", "1");

  try {
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json;odata=nometadata, application/json",
        "user-agent": "Hakeem-Due-Diligence/0.1 (connectivity-probe)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

    console.log(`MC_GIS_HOST=${endpoint.host}`);
    console.log(`MC_GIS_HTTP_STATUS=${response.status}`);
    console.log(`MC_GIS_FINAL_URL=${response.url}`);
    if (!response.ok) return false;

    const contentType = response.headers.get("content-type") ?? "";
    console.log(`MC_GIS_CONTENT_TYPE=${contentType}`);
    if (!contentType.toLowerCase().includes("json")) return false;

    const json = (await response.json()) as { value?: unknown[]; d?: { results?: unknown[] } };
    const rows = Array.isArray(json.value)
      ? json.value
      : Array.isArray(json.d?.results)
        ? json.d.results
        : [];
    const shape = Array.isArray(json.value)
      ? "odata-value"
      : Array.isArray(json.d?.results)
        ? "odata-d-results"
        : "unknown";

    console.log(`MC_GIS_RESPONSE_ROWS=${rows.length}`);
    console.log(`MC_GIS_RESPONSE_SHAPE=${shape}`);
    if (rows[0] && typeof rows[0] === "object") {
      console.log(`MC_GIS_FIRST_ROW_KEYS=${Object.keys(rows[0] as Record<string, unknown>).sort().join(",")}`);
    }
    return shape !== "unknown";
  } catch (error) {
    const cause = error instanceof Error && "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
    console.log(`MC_GIS_HOST=${endpoint.host}`);
    console.log(`MC_GIS_ERROR=${error instanceof Error ? error.message : String(error)}`);
    console.log(`MC_GIS_CAUSE=${cause instanceof Error ? `${cause.name}:${cause.message}` : String(cause ?? "unknown")}`);
    return false;
  }
}

async function main() {
  for (const candidate of candidates) {
    if (await probe(candidate)) return;
  }
  throw new Error("No official Ministry of Commerce GISInfo endpoint passed the secure Node connectivity probe");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
