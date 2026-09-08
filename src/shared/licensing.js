export const LICENSE_KEY = "viralwebLicenseKey";
export const FREE_REPOSTS = 25;
export const LICENSE_PREFIX = "VW-";

const KEY_PARTS = 5;
const KEY_CHARS_PER_PART = 5;

export function formatLicenseKey(input = "") {
  const clean = String(input).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, KEY_PARTS * KEY_CHARS_PER_PART);
  const parts = [];
  for (let i = 0; i < clean.length; i += KEY_CHARS_PER_PART) {
    parts.push(clean.slice(i, i + KEY_CHARS_PER_PART));
  }
  return parts.join("-");
}

export function normalizeLicenseKey(input = "") {
  return String(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isLicenseKeyFormat(value = "") {
  return normalizeLicenseKey(value).length === KEY_PARTS * KEY_CHARS_PER_PART;
}

function hashCode(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function deriveChecksum(keyBody) {
  const hash = hashCode(keyBody);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let checksum = "";
  let value = hash;
  for (let i = 0; i < 6; i++) {
    checksum += chars[value % chars.length];
    value = Math.floor(value / chars.length);
  }
  return checksum;
}

export function generateLicenseKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const parts = [];
  for (let p = 0; p < KEY_PARTS; p++) {
    let part = "";
    for (let i = 0; i < KEY_CHARS_PER_PART; i++) {
      part += chars[Math.floor(Math.random() * chars.length)];
    }
    parts.push(part);
  }
  const body = parts.join("");
  return `${LICENSE_PREFIX}${parts.join("-")}-${deriveChecksum(body)}`;
}

export function validateLicenseKey(input = "") {
  const raw = String(input).trim().toUpperCase();
  if (!raw.startsWith(LICENSE_PREFIX)) return false;
  const withoutPrefix = raw.slice(LICENSE_PREFIX.length);
  const segments = withoutPrefix.split("-");
  if (segments.length !== KEY_PARTS + 1) return false;
  const body = segments.slice(0, KEY_PARTS).join("");
  const checksum = segments[KEY_PARTS];
  if (body.length !== KEY_PARTS * KEY_CHARS_PER_PART || checksum.length !== 6) return false;
  return deriveChecksum(body) === checksum;
}

export async function getLicenseState(storage) {
  const stored = await storage.local.get([LICENSE_KEY, "viralwebRepostCount"]).catch(() => ({}));
  const key = String(stored[LICENSE_KEY] || "");
  const used = Number(stored.viralwebRepostCount || 0);
  const licensed = validateLicenseKey(key);
  const remaining = licensed ? Infinity : Math.max(0, FREE_REPOSTS - used);
  return { licensed, key, used, remaining, canUse: licensed || used < FREE_REPOSTS };
}

export async function activateLicense(storage, key) {
  const candidate = String(key || "").trim().toUpperCase();
  if (!validateLicenseKey(candidate)) {
    return { ok: false, error: "That license key doesn’t look right. Check the code and try again." };
  }
  await storage.local.set({ [LICENSE_KEY]: candidate });
  return { ok: true };
}

export async function recordUsage(storage) {
  const state = await getLicenseState(storage);
  if (state.licensed) return state;
  const next = state.used + 1;
  await storage.local.set({ viralwebRepostCount: next });
  return getLicenseState(storage);
}
