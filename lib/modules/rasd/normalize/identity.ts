import { sha256Hex } from "../hash";
import { normalizeForCompare } from "./arabic";
import { normalizeDateForIdentity, normalizeInstrumentNumber } from "./dates";

export interface CanonicalIdentityInput {
  documentType: string;
  title: string;
  instrumentType?: string;
  instrumentNumber?: string;
  instrumentDate?: string;
  authority?: string;
  uqnIssue?: string;
  publicationDate?: string;
  textPartialHash?: string;
}

function part(label: string, value?: string): string {
  const normalized = value ? normalizeForCompare(value) : "";
  return `${label}:${normalized}`;
}

export function buildCanonicalIdentityKey(input: CanonicalIdentityInput): string {
  const normalizedInstrumentNumber = input.instrumentNumber
    ? normalizeInstrumentNumber(input.instrumentNumber)
    : undefined;
  const normalizedInstrumentDate = normalizeDateForIdentity(input.instrumentDate);
  const normalizedPublicationDate = normalizeDateForIdentity(input.publicationDate);

  const semanticKey = [
    part("type", input.documentType),
    part("title", input.title),
    part("instrumentType", input.instrumentType),
    part("instrumentNumber", normalizedInstrumentNumber),
    part("instrumentDate", normalizedInstrumentDate),
    part("authority", input.authority),
    part("uqnIssue", input.uqnIssue),
    part("publicationDate", normalizedPublicationDate),
    part("text", input.textPartialHash)
  ].join("|");

  return sha256Hex(semanticKey);
}
