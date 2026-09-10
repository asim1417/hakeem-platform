const pages = [
  "https://bankruptcy.gov.sa/ar/Other/BankruptcyRecord",
  "https://bankruptcy.gov.sa/ar/Other/BankruptcyRecord/Pages/default.aspx",
  "https://bankruptcy.gov.sa/ar/Announcements",
  "https://bankruptcy.gov.sa/ar/Announcements/Pages/default.aspx",
];

function extractInteresting(html: string) {
  const patterns = [
    /[^\n\r]{0,140}_api[^\n\r]{0,220}/gi,
    /[^\n\r]{0,140}GetByTitle[^\n\r]{0,220}/gi,
    /[^\n\r]{0,140}\$.{0,20}(?:filter|select|top|orderby)[^\n\r]{0,220}/gi,
    /[^\n\r]{0,140}(?:ajax|fetch\(|XMLHttpRequest)[^\n\r]{0,220}/gi,
    /[^\n\r]{0,140}(?:BankruptcyRecord|Announcements|announcementDetails|recordDetails)[^\n\r]{0,220}/gi,
  ];
  const found = new Set<string>();
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const text = match[0].replace(/\s+/g, " ").trim();
      if (text.length > 0) found.add(text.slice(0, 500));
      if (found.size >= 80) break;
    }
    if (found.size >= 80) break;
  }
  return [...found];
}

async function inspect(url: string) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "Hakeem-Due-Diligence/0.1 (public-source-probe)" },
      signal: AbortSignal.timeout(12_000),
    });
    const html = await response.text();
    const lines = [
      `\n=== ${url} ===`,
      `STATUS=${response.status}`,
      `FINAL_URL=${response.url}`,
      `CONTENT_TYPE=${response.headers.get("content-type") ?? ""}`,
      `LENGTH=${html.length}`,
      ...extractInteresting(html),
    ];
    const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
    lines.push("SCRIPT_SRCS=" + scripts.slice(0, 80).join(" | "));
    return lines.join("\n");
  } catch (error) {
    return `\n=== ${url} ===\nERROR=${error instanceof Error ? error.message : String(error)}`;
  }
}

async function main() {
  const results = await Promise.all(pages.map(inspect));
  for (const result of results) console.log(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
