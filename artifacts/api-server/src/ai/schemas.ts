import { z } from "zod";

const sceneObjectSchema = z.object({
  type: z.string().min(1),
  position: z.string().default("unknown"),
  distance: z.enum(["immediate", "near", "mid", "far", "unknown"]).or(z.string()).default("unknown"),
  relevance: z.enum(["high", "medium", "low"]).or(z.string()).default("medium"),
});

const sceneObstacleSchema = z.object({
  type: z.string().min(1),
  severity: z.enum(["high", "medium", "low"]).or(z.string()).default("medium"),
  position: z.string().default("unknown"),
});

const detectedFeatureSchema = z.object({
  detected: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(0),
  state: z.string().optional(),
  status: z.string().optional(),
});

const textItemSchema = z.object({
  content: z.string(),
  kind: z.enum(["room_number", "building", "direction", "warning", "label", "notice", "sign", "unknown"]).or(z.string()).default("unknown"),
  meaning: z.string().optional(),
});

export const visionSceneSchema = z.object({
  scene: z.string().default("unspecified environment"),
  objects: z.array(sceneObjectSchema).default([]),
  obstacles: z.array(sceneObstacleSchema).default([]),
  stairs: detectedFeatureSchema.default({ detected: false, confidence: 0 }),
  door: detectedFeatureSchema.default({ detected: false, confidence: 0, state: "unknown" }),
  elevator: detectedFeatureSchema.default({ detected: false, confidence: 0, status: "unknown" }),
  text: z.array(textItemSchema).default([]),
  crowd_level: z.enum(["none", "low", "medium", "high"]).or(z.string()).default("low"),
  path_status: z.enum(["clear", "partially_blocked", "blocked"]).or(z.string()).default("clear"),
  lighting: z.enum(["dark", "dim", "normal", "bright", "glare"]).or(z.string()).default("normal"),
  accessibility_state: z
    .object({
      accessible_path: z.boolean().default(true),
      obstacle_level: z.enum(["none", "low", "medium", "high"]).or(z.string()).default("none"),
    })
    .default({ accessible_path: true, obstacle_level: "none" }),
  confidence: z.number().min(0).max(1).default(0.5),
  locationLabel: z.string().optional(),
  spokenHint: z.string().optional(),
});

export type VisionScene = z.infer<typeof visionSceneSchema>;

export const intentSchema = z.object({
  intent: z.enum([
    "describe",
    "navigate",
    "changes",
    "elevator",
    "ocr",
    "follow_up",
    "unknown",
  ]),
  response: z.string(),
  safetyMessage: z.string().default("This is an assistive estimate. Verify before moving."),
  goal: z.string().optional(),
  shouldScan: z.boolean().default(false),
});

export type IntentAnswer = z.infer<typeof intentSchema>;

export function parseJsonObject(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}

export function validateVisionScene(value: unknown): VisionScene {
  return visionSceneSchema.parse(value);
}

export function validateIntentAnswer(value: unknown): IntentAnswer {
  return intentSchema.parse(value);
}
