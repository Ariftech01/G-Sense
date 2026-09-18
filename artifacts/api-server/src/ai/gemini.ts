import { logger } from "../lib/logger";
import {
  parseJsonObject,
  validateIntentAnswer,
  validateVisionScene,
  type IntentAnswer,
  type VisionScene,
} from "./schemas";
import { chatSystemPrompt, ocrPrompt, transcribePrompt, visionSystemPrompt } from "./prompts";
import type { AccessibilityProfile } from "../accessibility/profile";

type GeminiPart = { text?: string; inline_data?: { mime_type: string; data: string } };

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string };
};

const PREFERRED_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-transcribe",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
];

let resolvedModel: string | null = null;

export const getGeminiApiKey = (): string | undefined => {
  const key =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_KEY;
  return key?.trim() || undefined;
};

export const isGeminiConfigured = (): boolean => Boolean(getGeminiApiKey());

export const isExplicitDemoMode = (): boolean => {
  const value = (process.env.DEMO_MODE || "").toLowerCase();
  return value === "1" || value === "true" || value === "yes";
};

const stripBase64 = (data: string): string => data.replace(/^data:[^;]+;base64,/, "");

async function listModelIds(apiKey: string): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Gemini model list failed (${response.status})`);
  }
  const payload = (await response.json()) as {
    models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
  };
  return (payload.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => (model.name || "").replace(/^models\//, ""))
    .filter(Boolean);
}

export async function resolveGeminiModel(): Promise<string> {
  if (resolvedModel) return resolvedModel;
  const configured = process.env.GEMINI_MODEL?.trim();
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  if (configured) {
    resolvedModel = configured.replace(/^models\//, "");
    return resolvedModel;
  }

  try {
    const available = await listModelIds(apiKey);
    const match = PREFERRED_MODELS.find((candidate) => available.includes(candidate));
    if (match) {
      resolvedModel = match;
      logger.info({ model: match }, "Resolved Gemini model from live catalog");
      return match;
    }
    const flash = available.find((id) => id.includes("flash") && !id.includes("image") && !id.includes("tts"));
    if (flash) {
      resolvedModel = flash;
      logger.info({ model: flash }, "Resolved fallback Gemini flash model");
      return flash;
    }
  } catch (error) {
    logger.warn({ err: error }, "Could not list Gemini models; using preferred default");
  }

  resolvedModel = PREFERRED_MODELS[0];
  return resolvedModel;
}

export function getResolvedModelName(): string | null {
  return resolvedModel || process.env.GEMINI_MODEL?.trim() || null;
}

async function generateContent(parts: GeminiPart[]): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }
  const preferred = await resolveGeminiModel();
  const attempts = [preferred, ...PREFERRED_MODELS.filter((model) => model !== preferred)];
  let lastError = "Gemini request failed.";

  for (const model of attempts) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      });

      const detail = await response.text();
      if (!response.ok) {
        lastError = `Gemini API error (${response.status}) using ${model}: ${detail}`;
        logger.warn({ model, status: response.status, detail }, "Gemini model attempt failed; trying next fallback model");
        resolvedModel = null;
        continue;
      }

      const payload = JSON.parse(detail) as GeminiResponse;
      const text = payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();
      if (!text) {
        lastError = `Gemini returned an empty response from ${model}.`;
        logger.warn({ model }, "Gemini returned empty response; trying next fallback");
        continue;
      }
      resolvedModel = model;
      return text;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      logger.warn({ model, err: lastError }, "Error invoking Gemini model; trying next fallback");
      resolvedModel = null;
      continue;
    }
  }

  throw new Error(lastError);
}

export async function analyzeImage(
  imageData: string,
  mimeType: string,
  profile: AccessibilityProfile,
): Promise<VisionScene> {
  const raw = await generateContent([
    { text: visionSystemPrompt(profile) },
    { inline_data: { mime_type: mimeType, data: stripBase64(imageData) } },
  ]);
  return validateVisionScene(parseJsonObject(raw));
}

export async function analyzeEnvironment(
  imageData: string,
  mimeType: string,
  profile: AccessibilityProfile,
): Promise<VisionScene> {
  return analyzeImage(imageData, mimeType, profile);
}

export async function answerQuestion(
  command: string,
  profile: AccessibilityProfile,
  environmentJson: string,
  historyJson: string,
): Promise<IntentAnswer> {
  const raw = await generateContent([
    {
      text: `${chatSystemPrompt(profile, environmentJson, historyJson)}\n\nUser: ${command}`,
    },
  ]);
  return validateIntentAnswer(parseJsonObject(raw));
}

export async function extractVisibleText(
  imageData: string,
  mimeType: string,
): Promise<{ text: string; lines: string[]; documentType: "sign" | "document" | "unknown"; confidence: number; meaning?: string }> {
  const raw = await generateContent([
    { text: ocrPrompt },
    { inline_data: { mime_type: mimeType, data: stripBase64(imageData) } },
  ]);
  const parsed = parseJsonObject(raw) as Record<string, unknown>;
  const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
  const lines = Array.isArray(parsed.lines)
    ? parsed.lines.filter((line): line is string => typeof line === "string").map((line) => line.trim()).filter(Boolean)
    : text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const documentType =
    parsed.documentType === "sign" || parsed.documentType === "document" ? parsed.documentType : "unknown";
  const confidence =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0.5;
  return {
    text,
    lines,
    documentType,
    confidence,
    meaning: typeof parsed.meaning === "string" ? parsed.meaning : undefined,
  };
}

export async function transcribeAudio(
  audioData: string,
  mimeType: string,
): Promise<string> {
  try {
    let normalizedMime = (mimeType || "audio/mp4").toLowerCase();
    if (
      normalizedMime.includes("m4a") ||
      normalizedMime.includes("aac") ||
      normalizedMime.includes("caf")
    ) {
      normalizedMime = "audio/mp4";
    }

    const raw = await generateContent([
      { text: transcribePrompt },
      { inline_data: { mime_type: normalizedMime, data: stripBase64(audioData) } },
    ]);
    const parsed = parseJsonObject(raw) as { transcript?: string };
    return typeof parsed.transcript === "string" ? parsed.transcript.trim() : "";
  } catch (err) {
    console.warn("[transcribeAudio] Transcription warning:", err instanceof Error ? err.message : err);
    return "";
  }
}
