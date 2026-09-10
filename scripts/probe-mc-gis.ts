const endpoint = new URL("https://mc.gov.sa/_api/web/lists/GetByTitle('GIS')/items");
endpoint.searchParams.set("$top", "1");

async function main() {
  const response = await fetch(endpoint, {
    headers: {
      accept: "application/json;odata=nometadata, application/json",
      "user-agent": "Hakeem-Due-Diligence/0.1 (connectivity-probe)",
    },
    signal: AbortSignal.timeout(15_000),
  });

  console.log(`MC_GIS_HTTP_STATUS=${response.status}`);
  if (!response.ok) throw new Error(`Ministry of Commerce GIS endpoint returned HTTP ${response.status}`);

  const json = (await response.json()) as { value?: unknown[]; d?: { results?: unknown[] } };
  const rows = Array.isArray(json.value)
    ? json.value
    : Array.isArray(json.d?.results)
      ? json.d.results
      : [];

  console.log(`MC_GIS_RESPONSE_ROWS=${rows.length}`);
  console.log(`MC_GIS_RESPONSE_SHAPE=${Array.isArray(json.value) ? "odata-value" : Array.isArray(json.d?.results) ? "odata-d-results" : "unknown"}`);

  if (!Array.isArray(json.value) && !Array.isArray(json.d?.results)) {
    throw new Error("Unexpected Ministry of Commerce GIS response shape");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
