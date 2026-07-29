const EASTERN_ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const WESTERN_DIGITS = "0123456789";

export function easternToWesternDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (digit) => {
    const easternIndex = EASTERN_ARABIC_DIGITS.indexOf(digit);
    if (easternIndex >= 0) return WESTERN_DIGITS[easternIndex] ?? digit;

    const persianIndex = PERSIAN_DIGITS.indexOf(digit);
    return persianIndex >= 0 ? WESTERN_DIGITS[persianIndex] ?? digit : digit;
  });
}

export function westernToEastern(input: string): string {
  return input.replace(/[0-9]/g, (digit) => EASTERN_ARABIC_DIGITS[Number(digit)] ?? digit);
}

export function normalizeDigitsForCompare(input: string): string {
  return easternToWesternDigits(input);
}
