// ─────────────────────────────────────────────────────────────────────────────
// تصدير الإجابة إلى PDF — نلتقط الإجابة المُصيَّرة (html2canvas) فيبقى العرض العربيّ RTL
// أمينًا كما يظهر، ثم نضعها في A4 مع ترقيم الصفحات (jsPDF). عرض/تصدير فقط، في الذاكرة.
// ─────────────────────────────────────────────────────────────────────────────

/** يبني PDF من عنصر DOM (الإجابة المُصيَّرة) ويعيده Blob. سقوط: يرمي عند تعذّر الالتقاط. */
export async function buildAnswerPdfBlob(element: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  const canvas = await html2canvas(element, {
    scale: 2, // دقّة أعلى للنصّ العربيّ
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;

  // ارتفاع الصورة بالمليمتر عند عرض المحتوى، وتقسيمها عبر الصفحات (النمط القياسيّ:
  // نضع الصورة كاملةً في كل صفحة بإزاحة رأسية سالبة، وjsPDF يقتصّها على حدود الصفحة).
  const imgH = (canvas.height * contentW) / canvas.width;
  const img = canvas.toDataURL("image/png");

  let posY = margin;
  let heightLeft = imgH;
  pdf.addImage(img, "PNG", margin, posY, contentW, imgH, undefined, "FAST");
  heightLeft -= contentH;
  let guard = 0;
  while (heightLeft > 0 && guard < 60) {
    posY -= contentH; // تحريك الصورة لأعلى بمقدار صفحة
    pdf.addPage();
    pdf.addImage(img, "PNG", margin, posY, contentW, imgH, undefined, "FAST");
    heightLeft -= contentH;
    guard += 1;
  }

  return pdf.output("blob");
}
