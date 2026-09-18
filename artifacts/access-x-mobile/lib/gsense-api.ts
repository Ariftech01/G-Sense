import { customFetch } from '@workspace/api-client-react';
import type { EnvironmentDashboard } from '@workspace/api-client-react';

export type LiveDashboard = EnvironmentDashboard & {
  spokenSummary?: string;
  announce?: boolean;
  aiConfigured?: boolean;
  aiModel?: string | null;
  reasoning?: {
    impact: string;
    reason: string;
    recommendedAction: string;
    spokenSummary: string;
    safetyMessage: string;
    announce: boolean;
  } | null;
  pipeline?: string[];
};

export async function analyzeEnvironmentImage(imageData: string, mimeType: string): Promise<LiveDashboard> {
  return customFetch<LiveDashboard>('/api/environment/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData, mimeType }),
  });
}

export async function transcribeAudio(audioData: string, mimeType: string): Promise<{ transcript: string }> {
  return customFetch<{ transcript: string }>('/api/ai/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioData, mimeType }),
  });
}

export async function updateProfile(data: Record<string, unknown>) {
  return customFetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;

    const e1 = b1 >> 2;
    const e2 = ((b1 & 3) << 4) | (b2 >> 4);
    const e3 = ((b2 & 15) << 2) | (b3 >> 6);
    const e4 = b3 & 63;

    base64 += chars.charAt(e1) + chars.charAt(e2);
    base64 += i + 1 < len ? chars.charAt(e3) : '=';
    base64 += i + 2 < len ? chars.charAt(e4) : '=';
  }
  return base64;
}

export function spokenFromDashboard(dashboard: LiveDashboard): string {
  return (
    dashboard.spokenSummary ||
    dashboard.recommendation ||
    dashboard.change.change ||
    'No spoken summary was returned.'
  );
}
