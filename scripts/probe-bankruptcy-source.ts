const pages = [
  "https://bankruptcy.gov.sa/ar/Other/BankruptcyRecord",
  "https://www.bankruptcy.gov.sa/ar/Other/BankruptcyRecord",
  "https://bankruptcy.gov.sa/ar/Announcements",
  "https://www.bankruptcy.gov.sa/ar/Announcements",
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

function describeError(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const cause = "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
  if (cause instanceof Error) {
    const coded = cause as Error & { code?: string; errno?: string | number; syscall?: string; hostname?: string };
    return [
      error.message,
      `CAUSE_NAME=${coded.name}`,
      `CAUSE_MESSAGE=${coded.message}`,
      `CAUSE_CODE=${coded.code ?? ""}`,
      `CAUSE_ERRNO=${coded.errno ?? ""}`,
      `CAUSE_SYSCALL=${coded.syscall ?? ""}`,
      `CAUSE_HOST=${coded.hostname ?? ""}`,
    ].join("\n");
  }
  return error.stack ?? error.message;
}

async function inspect(url: string) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 Hakeem-Due-Diligence-Public-Source-Probe/0.1",
      },
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
    return `\n=== ${url} ===\nERROR=${describeError(error)}`;
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
