interface PdfTextItem {
  str: string;
}

interface PdfTextContent {
  items: Array<PdfTextItem | Record<string, unknown>>;
}

interface PdfPageProxy {
  getTextContent(): Promise<PdfTextContent>;
}

interface PdfDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
}

interface PdfLoadingTask {
  promise: Promise<PdfDocumentProxy>;
}

interface PdfJsModule {
  getDocument(input: { data: Uint8Array; useWorkerFetch?: boolean; isEvalSupported?: boolean; disableFontFace?: boolean }): PdfLoadingTask;
}

function itemText(item: PdfTextItem | Record<string, unknown>): string {
  return typeof item.str === "string" ? item.str : "";
}

export async function extractTextFromPdfBuffer(
  buffer: Buffer
): Promise<{ text: string; pageCount: number; isTextual: boolean; method: string; needsOcr: boolean }> {
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJsModule;
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const doc = await pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true
  }).promise;

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map(itemText).join(" ").replace(/\s+/g, " ").trim());
  }

  const text = pages.join("\n\n").trim();
  const isTextual = text.replace(/\s+/g, "").length >= Math.max(20, doc.numPages * 10);

  return {
    text,
    pageCount: doc.numPages,
    isTextual,
    method: "pdfjs-dist",
    needsOcr: !isTextual
  };
}
