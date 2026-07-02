import type { ReactNode } from "react";
import { normalizeArabicText, stripArabicAffixes } from "@/lib/modules/legal-core/arabic-morphology";

export function HighlightedSearchText({
  text,
  terms,
  anchorPrefix
}: {
  text: string;
  terms: string[];
  anchorPrefix?: string;
}) {
  const preparedTerms = prepareHighlightTerms(terms);
  if (!preparedTerms.length) return <>{text}</>;

  // نضمّ علامات التشكيل (\p{M}) للتوكن كي لا تتقطّع الكلمة المشكولة عند كل حركة.
  const parts = text.split(/(\p{L}[\p{L}\p{M}\p{N}_-]*|\p{N}+)/gu);
  let matchIndex = 0;

  return (
    <>
      {parts.map((part, index) => {
        if (!isWordPart(part) || !matchesAnyTerm(part, preparedTerms)) return <span key={`${index}-${part}`}>{part}</span>;
        matchIndex += 1;
        return (
          <mark
            id={anchorPrefix ? `${anchorPrefix}-${matchIndex}` : undefined}
            key={`${index}-${part}`}
            className="search-highlight scroll-mt-28 rounded-md bg-[rgba(192,155,90,0.28)] px-1 font-bold text-[var(--navy)]"
          >
            {part}
          </mark>
        );
      })}
    </>
  );
}

export function countSearchMatches(text: string, terms: string[]) {
  const preparedTerms = prepareHighlightTerms(terms);
  if (!preparedTerms.length) return 0;
  return text
    .split(/(\p{L}[\p{L}\p{M}\p{N}_-]*|\p{N}+)/gu)
    .filter((part) => isWordPart(part) && matchesAnyTerm(part, preparedTerms)).length;
}

export function prepareHighlightTerms(terms: string[]) {
  const values = new Set<string>();
  for (const term of terms) {
    for (const part of term.split(/\s+/)) {
      const normalized = normalizeArabicText(part);
      const stripped = stripArabicAffixes(part);
      if (normalized.length >= 2) values.add(normalized);
      if (stripped.length >= 2) values.add(stripped);
    }
    const phrase = normalizeArabicText(term);
    if (phrase.length >= 2) values.add(phrase);
  }
  return Array.from(values).sort((a, b) => b.length - a.length);
}

function matchesAnyTerm(word: string, terms: string[]) {
  const normalizedWord = normalizeArabicText(word);
  const strippedWord = stripArabicAffixes(word);
  return terms.some((term) => normalizedWord.includes(term) || strippedWord.includes(term) || term.includes(strippedWord));
}

function isWordPart(value: string) {
  return /^[\p{L}\p{M}\p{N}_-]+$/u.test(value);
}

export function joinSearchTerms(...groups: Array<string[] | string | undefined | null>): string[] {
  const merged: ReactNode[] = [];
  for (const group of groups) {
    if (!group) continue;
    if (Array.isArray(group)) merged.push(...group);
    else merged.push(group);
  }
  return merged.map(String).filter(Boolean);
}
