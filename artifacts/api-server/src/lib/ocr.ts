import type { OcrInput, OcrResult } from "@workspace/api-zod";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

const demoOcrResult = (): OcrResult => ({
  text: "LIBRARY → WEST ENTRANCE",
  lines: ["LIBRARY →", "WEST ENTRANCE"],
  documentType: "sign",
  confidence: 0.82,
  demoMode: true,
  safetyMessage:
    "OCR is simulated in Demo Mode. Confirm the sign or document before acting.",
});

const clampConfidence = (value: unknown): number => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0.5;
  return Math.min(1, Math.max(0, numeric));
};

const normalizeText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const parseGeminiOcr = (raw: string): OcrResult => {
  const withoutFence = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(withoutFence) as Record<string, unknown>;
  } catch {
    parsed = { text: withoutFence };
  }

  const text = normalizeText(parsed.text);
  const lines = Array.isArray(parsed.lines)
    ? parsed.lines
        .filter((line): line is string => typeof line === "string")
        .map((line) => line.trim())
        .filter(Boolean)
    : text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
  const documentType =
    parsed.documentType === "sign" ||
    parsed.documentType === "document" ||
    parsed.documentType === "unknown"
      ? parsed.documentType
      : "unknown";

  return {
    text,
    lines,
    documentType,
    confidence: clampConfidence(parsed.confidence),
    demoMode: false,
    safetyMessage:
      "OCR can misread text. Confirm the sign or document before acting.",
  };
};

export const extractTextFromImage = async (
  input: OcrInput,
): Promise<OcrResult> => {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_KEY;
  if (!apiKey) return demoOcrResult();

  const imageData = input.imageData.replace(/^data:[^;]+;base64,/, "");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "Read only the visible text in this image.",
                  "It may be a wayfinding sign, label, menu, form, or document.",
                  "Do not infer or invent text that is not visible.",
                  "Return JSON only with this exact shape:",
                  '{"text":"full transcription","lines":["one line per visible line"],"documentType":"sign|document|unknown","confidence":0.0}',
                  "Use an empty string and empty lines when no text is readable.",
                  "Confidence must describe OCR readability, not safety.",
                ].join(" "),
              },
              {
                inline_data: {
                  mime_type: input.mimeType,
                  data: imageData,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini OCR request failed (${response.status}): ${detail}`);
  }

  const payload = (await response.json()) as GeminiResponse;
  const raw = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!raw) {
    throw new Error("Gemini OCR returned no readable text response.");
  }

  return parseGeminiOcr(raw);
};