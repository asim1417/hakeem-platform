// HKM-028: مفتاح المادة ووسمها مع درجة «مكرر». المفتاح «20» أو «20_bis» (كـart_N_bis في hkn-uri).

/** مفتاح الرابط: «20» للأصل، «20_bis» لـ«مكرر»، «20_bis2» لـ«مكرر مرتين». */
export function articleKey(n: number, bis = 0): string {
  return bis > 0 ? `${n}_bis${bis > 1 ? bis : ""}` : String(n);
}

/** وسم العرض: «20» أو «20 مكرر» (وبالأرقام العربية الهندية عند الطلب). */
export function articleLabel(n: number, bis = 0, arabicDigits = false): string {
  const num = arabicDigits ? n.toLocaleString("ar-SA") : String(n);
  return bis > 0 ? `${num} مكرر${bis > 1 ? ` ${bis}` : ""}` : num;
}
