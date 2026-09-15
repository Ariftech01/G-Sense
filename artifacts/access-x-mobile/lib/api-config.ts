/**
 * Resolves the G Sense backend base URL for every runtime the app ships in.
 *
 * Precedence:
 *   1. EXPO_PUBLIC_API_URL — the production knob. Baked in at build time and
 *      used verbatim, so it can point at the deployed backend over HTTPS or at
 *      a LAN address during a hackathon demo.
 *   2. EXPO_PUBLIC_DOMAIN — the existing Expo Go / static-bundle convention
 *      (`scripts/build.js` and `start-gsense.ps1` both set it).
 *   3. `http://localhost:5000` — development only.
 *
 * A standalone APK always runs in a release build, so an unconfigured install
 * resolves to `null` and the app degrades to the offline notice instead of
 * silently calling a `localhost` backend that cannot exist on a phone.
 */

const DEV_FALLBACK_BASE_URL = 'http://localhost:5000';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '10.0.2.2']);

const PRIVATE_LAN_PATTERN = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

export const OFFLINE_MESSAGE =
  'AI service is currently unavailable. Please check your connection and try again.';

function isLocalHostname(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname) || PRIVATE_LAN_PATTERN.test(hostname);
}

/**
 * Normalises a configured host into an absolute base URL.
 *
 * Plain hosts get `https` in production but `http` for loopback and private LAN
 * addresses, where TLS is not available.
 */
export function normaliseBaseUrl(configuredValue: string): string {
  const trimmed = configuredValue.trim().replace(/\/+$/, '');

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const hostname = trimmed.split('/')[0].split(':')[0].toLowerCase();
  const scheme = isLocalHostname(hostname) ? 'http' : 'https';

  return `${scheme}://${trimmed}`;
}

function readEnv(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Returns the base URL to hand to `setBaseUrl`, or `null` when the build has no
 * backend configured.
 */
export function resolveApiBaseUrl(): string | null {
  const explicitUrl = readEnv(process.env.EXPO_PUBLIC_API_URL);
  if (explicitUrl) return normaliseBaseUrl(explicitUrl);

  const expoGoDomain = readEnv(process.env.EXPO_PUBLIC_DOMAIN);
  if (expoGoDomain) return normaliseBaseUrl(expoGoDomain);

  if (__DEV__) return DEV_FALLBACK_BASE_URL;

  return null;
}
