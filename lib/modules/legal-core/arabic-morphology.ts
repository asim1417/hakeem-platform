const diacritics = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const tatweel = /\u0640/g;

const prefixes = ["وال", "فال", "بال", "كال", "لل", "ال", "و", "ف", "ب", "ك", "ل"];
const suffixes = ["كما", "هما", "هم", "هن", "نا", "ها", "ه", "ون", "ين", "ات", "ان", "ة", "ي", "ك"];

export type ArabicSearchType = "exact" | "contains" | "derivatives" | "root" | "stem" | "affixes";

export function removeDiacritics(text: string) {
  return text.replace(diacritics, "").replace(tatweel, "");
}

export function normalizeHamza(text: string) {
  return text.replace(/[أإآٱ]/g, "ا").replace(/[ؤ]/g, "و").replace(/[ئ]/g, "ي");
}

export function normalizeTaMarbuta(text: string) {
  return text.replace(/ة/g, "ه");
}

export function normalizeAlefMaqsura(text: string) {
  return text.replace(/ى/g, "ي");
}

export function normalizeArabicText(text: string) {
  return normalizeAlefMaqsura(normalizeTaMarbuta(normalizeHamza(removeDiacritics(text))))
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripArabicAffixes(word: string) {
  let normalized = normalizeArabicText(word);
  for (const prefix of prefixes) {
    if (normalized.length - prefix.length >= 3 && normalized.startsWith(prefix)) {
      normalized = normalized.slice(prefix.length);
      break;
    }
  }
  for (const suffix of suffixes) {
    if (normalized.length - suffix.length >= 3 && normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, -suffix.length);
      break;
    }
  }
  return normalized;
}

export function getArabicStem(word: string) {
  const stripped = stripArabicAffixes(word);
  return stripped
    .replace(/^(است|مست|مت|ت|ي|ن|ا)/, "")
    .replace(/(ات|ون|ين|ان|يه|ية|ه|ة)$/g, "")
    .replace(/(.)\1+/g, "$1");
}

export function findRootCandidates(word: string) {
  const stem = getArabicStem(word);
  const letters = stem.replace(/[اوي]/g, "");
  const candidates = new Set<string>();
  if (stem.length >= 3) candidates.add(stem.slice(0, 3));
  if (letters.length >= 3) candidates.add(letters.slice(0, 3));
  if (stem.length >= 4) candidates.add(stem.slice(0, 4));
  return [...candidates].filter(Boolean);
}

export function expandArabicDerivatives(word: string) {
  const normalized = normalizeArabicText(word);
  const stem = getArabicStem(normalized);
  const roots = findRootCandidates(normalized);
  const variants = new Set<string>([normalized, stem, stripArabicAffixes(normalized)]);

  for (const base of [stem, ...roots]) {
    if (!base || base.length < 2) continue;
    variants.add(base);
    variants.add(`ال${base}`);
    variants.add(`ب${base}`);
    variants.add(`و${base}`);
    variants.add(`ل${base}`);
    variants.add(`${base}ه`);
    variants.add(`${base}ها`);
    variants.add(`${base}ات`);
    variants.add(`${base}ون`);
    variants.add(`${base}ين`);
    variants.add(`م${base}`);
    variants.add(`ت${base}`);
    variants.add(`ي${base}`);
    variants.add(`است${base}`);
    variants.add(`ان${base}`);
  }

  return [...variants].filter((item) => item.length >= 2);
}

export function buildArabicSearchVariants(query: string, searchType: ArabicSearchType = "contains") {
  const normalized = normalizeArabicText(query);
  const words = normalized.split(/\s+/).filter(Boolean);
  const variants = new Set<string>();

  if (normalized) variants.add(normalized);

  for (const word of words) {
    if (searchType === "exact" || searchType === "contains") {
      variants.add(word);
    } else if (searchType === "stem" || searchType === "affixes") {
      variants.add(stripArabicAffixes(word));
      variants.add(getArabicStem(word));
    } else if (searchType === "root") {
      findRootCandidates(word).forEach((root) => variants.add(root));
    } else {
      expandArabicDerivatives(word).forEach((variant) => variants.add(variant));
    }
  }

  return [...variants].filter((variant) => variant.length >= 2).slice(0, 32);
}
