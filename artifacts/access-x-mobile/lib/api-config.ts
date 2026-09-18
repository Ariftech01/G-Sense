import Constants from 'expo-constants';
import { Platform } from 'react-native';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '10.0.2.2']);
const PRIVATE_LAN_PATTERN = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

export const OFFLINE_MESSAGE =
  'AI service is currently unavailable. Please check your connection and try again.';

function isLocalHostname(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname) || PRIVATE_LAN_PATTERN.test(hostname);
}

export function getExpoHost(): string | null {
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
      (Constants as any).manifest?.debuggerHost ||
      (Constants as any).experienceUrl;

    if (typeof hostUri === 'string' && hostUri.length > 0) {
      const clean = hostUri.replace(/^https?:\/\//i, '').replace(/^exp:\/\//i, '');
      const host = clean.split('/')[0].split(':')[0].trim();
      if (host && !LOOPBACK_HOSTS.has(host)) {
        return host;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Normalises a configured host into an absolute base URL.
 *
 * Plain hosts get `https` in production but `http` for loopback and private LAN
 * addresses, where TLS is not available.
 */
export function normaliseBaseUrl(configuredValue: string): string {
  let trimmed = configuredValue.trim().replace(/\/+$/, '');

  if (Platform.OS !== 'web') {
    const detectedHost = getExpoHost() || '192.168.137.242';
    trimmed = trimmed.replace(/\b(localhost|127\.0\.0\.1|0\.0\.0\.0)\b/g, detectedHost);
  }

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

  const detectedHost = getExpoHost();
  if (detectedHost) {
    return `http://${detectedHost}:5000`;
  }

  if (Platform.OS !== 'web') {
    return 'http://192.168.137.242:5000';
  }

  if (__DEV__) return 'http://localhost:5000';

  return null;
}
