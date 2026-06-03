import { extractClaim } from "@/lib/modules/simulations/hakeem-judge";

type ExportSession = {
  id: string;
  title: string;
  stage: string;
  createdAt: Date;
  messages: Array<{ role: string; content: string; createdAt: Date }>;
  decisions: Array<{ decisionType: string; content: string; stage: string; createdAt: Date }>;
  judgments: Array<{ content: string; disclaimer: string; createdAt: Date }>;
};

const disclaimer = "هذا المستند صادر في بيئة محاكاة تدريبية بمنصة حكيم، ولا يعد حكمًا قضائيًا، ولا رأيًا قانونيًا نهائيًا، ولا يغني عن مراجعة محام مختص.";

export function buildSimulationExport(session: ExportSession, type: string) {
  const claim = extractClaim(session.messages);
  const hearingRecord = session.decisions.find((item) => item.decisionType.includes("ضبط") || item.stage === "HEARING_RECORD");
  const settlement = session.decisions.find((item) => item.decisionType.includes("صلح"));
  const judgment = session.judgments[0];

  const sections: Array<{ heading: string; body: string }> = [
    {
      heading: "بيانات الجلسة",
      body: [`رقم الجلسة: ${session.id}`, `العنوان: ${session.title}`, `المرحلة: ${session.stage}`, `تاريخ الإنشاء: ${session.createdAt.toLocaleString("ar-SA")}`].join("\n")
    }
  ];

  if (claim) {
    sections.push({
      heading: "صحيفة الدعوى",
      body: [
        `نوع الدعوى: ${claim.caseType || "غير محدد"}`,
        `المدعي: ${claim.plaintiffName || "غير محدد"} - ${claim.plaintiffCapacity || "غير محدد"}`,
        `المدعى عليه: ${claim.defendantName || "غير محدد"} - ${claim.defendantCapacity || "غير محدد"}`,
        `موضوع الدعوى: ${claim.subject || "غير محدد"}`,
        `الوقائع:\n${claim.facts || "غير محددة"}`,
        `الطلبات:\n${claim.requests || "غير محددة"}`
      ].join("\n\n")
    });
  }

  if (type === "claim-sheet") return documentPayload("صحيفة الدعوى", sections);
  if (hearingRecord && (type === "hearing-record" || type === "full-report")) sections.push({ heading: "ضبط الجلسة", body: hearingRecord.content });
  if (settlement && (type === "settlement" || type === "full-report")) sections.push({ heading: "مسودة الصلح", body: settlement.content });
  if (type === "full-report") {
    sections.push({
      heading: "الرسائل والمرافعات",
      body: session.messages
        .filter((item) => !item.content.startsWith("HAKEEM_CLAIM::") && !item.content.startsWith("HAKEEM_STRENGTH::"))
        .map((item) => `${item.role} - ${item.createdAt.toLocaleString("ar-SA")}\n${item.content}`)
        .join("\n\n")
    });
    sections.push({
      heading: "القرارات الإجرائية",
      body: session.decisions.map((item) => `${item.decisionType} - ${item.createdAt.toLocaleString("ar-SA")}\n${item.content}`).join("\n\n") || "لا توجد قرارات مسجلة."
    });
  }
  if (judgment && (type === "judgment" || type === "full-report")) {
    sections.push({ heading: "مسودة حكم قضائي مسبب", body: ensureReasonedJudgment(judgment.content) });
  }

  const titles: Record<string, string> = {
    "hearing-record": "ضبط جلسة",
    judgment: "مسودة حكم قضائي مسبب",
    settlement: "مسودة صلح",
    "full-report": "تقرير المحاكاة القضائية كاملًا",
    "consultation-summary": "ملخص قانوني تدريبي"
  };

  return documentPayload(titles[type] ?? "مستند من حكيم", sections);
}

function documentPayload(title: string, sections: Array<{ heading: string; body: string }>) {
  return {
    title,
    exportedAt: new Date(),
    disclaimer,
    sections
  };
}

function ensureReasonedJudgment(content: string) {
  return content.includes("مسودة حكم قضائي مسبب") ? content : `مسودة حكم قضائي مسبب\n\n${content}`;
}

export function toDocx(payload: ReturnType<typeof documentPayload>) {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
${paragraph("حكيم", "title")}
${paragraph(payload.title, "heading")}
${paragraph(`تاريخ ووقت التصدير: ${payload.exportedAt.toLocaleString("ar-SA")}`)}
${payload.sections.map((section) => `${paragraph(section.heading, "heading2")}${section.body.split("\n").map((line) => paragraph(line || " ")).join("")}`).join("")}
${paragraph(payload.disclaimer, "warning")}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body></w:document>`;

  return zipStore({
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/document.xml": documentXml
  });
}

function paragraph(text: string, style: "title" | "heading" | "heading2" | "warning" | "normal" = "normal") {
  const sizes = { title: "44", heading: "36", heading2: "28", warning: "24", normal: "24" };
  const color = style === "warning" ? "8C2233" : style === "normal" ? "0D1321" : "0B1F3A";
  const bold = style !== "normal" ? "<w:b/>" : "";
  return `<w:p><w:pPr><w:bidi/><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:rtl/>${bold}<w:color w:val="${color}"/><w:sz w:val="${sizes[style]}"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
}

export function toPdf(payload: ReturnType<typeof documentPayload>) {
  const lines = [
    "حكيم",
    payload.title,
    `تاريخ ووقت التصدير: ${payload.exportedAt.toLocaleString("ar-SA")}`,
    "",
    ...payload.sections.flatMap((section) => [section.heading, ...section.body.split("\n"), ""]),
    payload.disclaimer
  ];
  const objects: string[] = [];
  const pages: string[] = [];
  const perPage = 34;
  for (let i = 0; i < lines.length; i += perPage) {
    const pageLines = lines.slice(i, i + perPage);
    const stream = `BT /F1 12 Tf 540 790 Td ${pageLines.map((line, index) => `${index ? "0 -22 Td " : ""}<${utf16Hex(line.slice(0, 95))}> Tj`).join(" ")} ET`;
    const streamId = objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    const pageId = objects.push(`<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 3 0 R >> >> /MediaBox [0 0 595 842] /Contents ${streamId} 0 R >>`);
    pages.push(`${pageId} 0 R`);
  }
  objects.unshift(`<< /Type /Catalog /Pages 2 0 R >>`);
  objects.splice(1, 0, `<< /Type /Pages /Kids [${pages.join(" ")}] /Count ${pages.length} >>`);
  objects.splice(2, 0, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);
  return buildPdf(objects);
}

function buildPdf(objects: string[]) {
  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(chunks.join("")));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });
  const xrefOffset = Buffer.byteLength(chunks.join(""));
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((offset) => chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`));
  chunks.push(`trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return Buffer.from(chunks.join(""), "binary");
}

function utf16Hex(text: string) {
  return Buffer.from(`\uFEFF${text}`, "utf16le").swap16().toString("hex").toUpperCase();
}

function xml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function zipStore(files: Record<string, string>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  Object.entries(files).forEach(([name, content]) => {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(content, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  });
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function crc32(buffer: Buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
