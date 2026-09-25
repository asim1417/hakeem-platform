/**
 * lib/legal-parser — قارئ الوثيقة النظامية (آلة حالات + مراسي لفظية).
 * وحدة نقيّة بلا قاعدة بيانات ولا شبكة — قابلة للاختبار بمعزل.
 * المرجع: docs/architecture/LEGAL_SYSTEMS_UPDATE_AGENT.md (المرحلة ٢).
 */
export type { DocUnitType, DocKind, ParsedUnit, ParseResult, RecitalCitation } from "./types";
export { parseDocument, type ParseOptions } from "./parser";
export { parseArabicNumber, type ParsedNumber } from "./ordinals";
export { normalizeForIndex, stripBidi } from "./normalize";
export { classifyLine, isDefinitionsArticle } from "./anchors";
