/** Bangladesh mobile: +880 1X XXXXXXXX (11 digits after country code). */

const BD_MOBILE = /^\+8801[3-9]\d{8}$/;

/** Normalize local BD input to E.164 (+880…). */
export function normalizeBdPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;

  let national = digits;
  if (national.startsWith("880")) national = national.slice(3);
  if (national.startsWith("0")) national = national.slice(1);
  if (national.length !== 10 || !national.startsWith("1")) return null;

  const e164 = `+880${national}`;
  return BD_MOBILE.test(e164) ? e164 : null;
}

export function isValidBdPhone(input: string): boolean {
  return normalizeBdPhone(input) !== null;
}

/** Display: +880 1711 234567 */
export function formatBdPhone(e164: string): string {
  const n = e164.replace(/\D/g, "");
  if (!n.startsWith("880") || n.length < 13) return e164;
  const local = n.slice(3);
  return `+880 ${local.slice(0, 4)} ${local.slice(4)}`;
}

export function maskBdPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^880/, "").replace(/^0/, "");
  return digits.slice(0, 10);
}

const PHONE_AUTH_DOMAIN = "phone.fleetops.local";

/** Internal Supabase email identity for phone login (no SMS / no OTP). */
export function phoneToAuthEmail(input: string): string | null {
  const e164 = normalizeBdPhone(input);
  if (!e164) return null;
  return `${e164.replace("+", "")}@${PHONE_AUTH_DOMAIN}`;
}

export function authEmailToPhone(email: string | null | undefined): string | null {
  if (!email?.endsWith(`@${PHONE_AUTH_DOMAIN}`)) return null;
  const digits = email.split("@")[0];
  if (!digits?.startsWith("880")) return null;
  return `+${digits}`;
}
