/** Dial codes offered in the phone field's country picker. Greece first
 * (the default), then the countries customers are most likely to come from. */
export const DIAL_CODES: { code: string; country: string }[] = [
  { code: "+30", country: "GR" },
  { code: "+357", country: "CY" },
  { code: "+44", country: "GB" },
  { code: "+49", country: "DE" },
  { code: "+33", country: "FR" },
  { code: "+39", country: "IT" },
  { code: "+34", country: "ES" },
  { code: "+351", country: "PT" },
  { code: "+31", country: "NL" },
  { code: "+32", country: "BE" },
  { code: "+41", country: "CH" },
  { code: "+43", country: "AT" },
  { code: "+353", country: "IE" },
  { code: "+45", country: "DK" },
  { code: "+46", country: "SE" },
  { code: "+47", country: "NO" },
  { code: "+358", country: "FI" },
  { code: "+48", country: "PL" },
  { code: "+420", country: "CZ" },
  { code: "+36", country: "HU" },
  { code: "+40", country: "RO" },
  { code: "+359", country: "BG" },
  { code: "+381", country: "RS" },
  { code: "+355", country: "AL" },
  { code: "+389", country: "MK" },
  { code: "+90", country: "TR" },
  { code: "+972", country: "IL" },
  { code: "+971", country: "AE" },
  { code: "+1", country: "US/CA" },
  { code: "+61", country: "AU" },
];

export const DEFAULT_DIAL_CODE = "+30";

/** Same rule as the backend (bookings/schemas.py): E.164, 8–15 digits. */
export const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/** Country code + what the user typed → E.164. Spaces/dashes are dropped,
 * and so is a leading 0 (the national trunk prefix, e.g. UK "07…"), which
 * isn't dialled after a country code. */
export function joinPhone(dialCode: string, national: string): string {
  const digits = national.replace(/\D/g, "").replace(/^0+/, "");
  return digits ? `${dialCode}${digits}` : "";
}

/** E.164 → the picker's code and the national part, for prefilling. Longest
 * matching code wins ("+357…" is Cyprus, not "+35…"). */
export function splitPhone(value: string | null | undefined): { dialCode: string; national: string } {
  const compact = (value ?? "").replace(/[\s().-]/g, "");
  const match = DIAL_CODES.filter((d) => compact.startsWith(d.code)).sort((a, b) => b.code.length - a.code.length)[0];
  if (match) return { dialCode: match.code, national: compact.slice(match.code.length) };
  // No (known) country code: keep what they had under the default code.
  return { dialCode: DEFAULT_DIAL_CODE, national: compact.replace(/^\+/, "") };
}
