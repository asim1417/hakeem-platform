// ─────────────────────────────────────────────────────────────────────────────
// بناء مستند Word (.docx) من إجابة «اسأل حكيم» — RTL كامل، خطّ عربي، عناوين بأنماطها،
// جداول حقيقية، ومراجع «(م/رقم المادة)». عرض/تصدير فقط — لا يمسّ المحرّك. يُبنى في الذاكرة.
// ─────────────────────────────────────────────────────────────────────────────
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
} from "docx";

export interface DocxSource {
  articleNumber?: number | string;
  systemName?: string;
}

const AR_FONT = "Traditional Arabic";
const NAVY = "1B3A5B";
const GOLD = "9A7B2E";
const BODY = 36; // 18pt (نصف-نقاط)

/** يستبدل مراجع [n] بـ«(م/رقم المادة)» من المصادر. */
function withRefs(text: string, basis: DocxSource[]): string {
  return (text || "").replace(/\[(\d{1,3})\]/g, (m, n) => {
    const num = basis[Number(n) - 1]?.articleNumber;
    if (num === undefined || num === "") return m;
    return `(م/${typeof num === "number" ? num.toLocaleString("ar-SA") : num})`;
  });
}

/** يقسّم نصًّا إلى مقاطع TextRun مع دعم الغامق (**...**). */
function inlineRuns(text: string, opts: { bold?: boolean; color?: string; size?: number } = {}): TextRun[] {
  const size = opts.size ?? BODY;
  const parts = text.split(/(\*\*)/);
  let bold = opts.bold ?? false;
  const runs: TextRun[] = [];
  for (const p of parts) {
    if (p === "**") {
      bold = !bold;
      continue;
    }
    if (p) runs.push(new TextRun({ text: p, bold: bold || undefined, font: AR_FONT, size, color: opts.color, rightToLeft: true }));
  }
  return runs.length ? runs : [new TextRun({ text: "", font: AR_FONT, size })];
}

function para(text: string, basis: DocxSource[], extra: { heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; bullet?: boolean; size?: number; bold?: boolean; color?: string } = {}): Paragraph {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    heading: extra.heading,
    bullet: extra.bullet ? { level: 0 } : undefined,
    spacing: { after: 120 },
    children: inlineRuns(withRefs(text, basis), { bold: extra.bold, color: extra.color, size: extra.size }),
  });
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}
function isSeparatorRow(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
}
function splitRow(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

function buildTable(rows: string[][], basis: DocxSource[]): Table {
  const [header, ...body] = rows;
  const cols = header.length;
  const makeCell = (text: string, isHeader: boolean) =>
    new TableCell({
      shading: isHeader ? { type: ShadingType.CLEAR, fill: NAVY, color: "auto" } : undefined,
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      children: [
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          children: inlineRuns(withRefs(text, basis), { bold: isHeader, color: isHeader ? "FFFFFF" : undefined, size: 32 }),
        }),
      ],
    });
  const headerRow = new TableRow({ tableHeader: true, children: header.map((c) => makeCell(c, true)) });
  const bodyRows = body.map((r) => {
    const cells = [...r];
    while (cells.length < cols) cells.push("");
    return new TableRow({ children: cells.slice(0, cols).map((c) => makeCell(c, false)) });
  });
  return new Table({
    visuallyRightToLeft: true,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "C9C4B8" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "C9C4B8" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "C9C4B8" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "C9C4B8" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "C9C4B8" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "C9C4B8" },
    },
    rows: [headerRow, ...bodyRows],
  });
}

/** يحوّل Markdown الإجابة إلى عناصر مستند (فقرات/عناوين/قوائم/جداول). */
function contentToBlocks(content: string, basis: DocxSource[]): (Paragraph | Table)[] {
  const lines = (content || "").replace(/\r/g, "").split("\n");
  const blocks: (Paragraph | Table)[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // جدول: اجمع الأسطر المتتابعة.
    if (isTableRow(line)) {
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        if (!isSeparatorRow(lines[i])) rows.push(splitRow(lines[i]));
        i += 1;
      }
      if (rows.length) blocks.push(buildTable(rows, basis));
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }
    // فاصل ---
    if (/^-{3,}$/.test(trimmed)) {
      blocks.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 1 } }, spacing: { after: 160 }, children: [] }));
      i += 1;
      continue;
    }
    // عناوين
    const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const size = level === 1 ? 40 : level === 2 ? 34 : 30;
      blocks.push(para(h[2], basis, { heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, size, bold: true, color: NAVY }));
      i += 1;
      continue;
    }
    // قوائم (نقطية أو مرقّمة عربية/لاتينية)
    const li = trimmed.match(/^\s*(?:[-*•]|[0-9٠-٩]+[.)])\s+(.*)$/);
    if (li) {
      blocks.push(para(li[1], basis, { bullet: true }));
      i += 1;
      continue;
    }
    // فقرة عادية
    blocks.push(para(trimmed, basis));
    i += 1;
  }
  return blocks;
}

/** يبني مستند Word كامل (ترويسة + متن) ويعيده Blob جاهزًا للتنزيل. */
export async function buildAnswerDocx(input: { content: string; basis?: DocxSource[]; title?: string }): Promise<Blob> {
  const basis = input.basis ?? [];
  const title = (input.title || "استشارة قانونية").trim().slice(0, 120);
  const dateStr = new Date().toLocaleDateString("ar-SA");

  const header: Paragraph[] = [
    new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "مكتب أمان", bold: true, font: AR_FONT, size: 28, color: GOLD })] }),
    new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { after: 40 }, children: [new TextRun({ text: title, bold: true, font: AR_FONT, size: 44, color: NAVY })] }),
    new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 2 } }, children: [new TextRun({ text: `التاريخ: ${dateStr}`, font: AR_FONT, size: 26, color: "7A7365" })] }),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: AR_FONT, size: BODY }, paragraph: { spacing: { line: 340 } } } } },
    sections: [
      {
        properties: {},
        children: [...header, ...contentToBlocks(input.content, basis)],
      },
    ],
  });

  return Packer.toBlob(doc);
}
