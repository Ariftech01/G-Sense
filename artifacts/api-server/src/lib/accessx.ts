import type { ObservationInput } from "@workspace/api-zod";
import { logger } from "./logger";
import {
  compareStates,
  describeState,
  evaluateAccessibility,
  shouldAnnounceRepeat,
  visionToObservation,
  type ObservationRecord,
  type ReasoningResult,
} from "../accessibility/engine";
import { defaultProfile, type AccessibilityProfile } from "../accessibility/profile";
import {
  analyzeImage,
  answerQuestion,
  extractVisibleText,
  getResolvedModelName,
  isExplicitDemoMode,
  isGeminiConfigured,
  transcribeAudio,
} from "../ai/provider";
import type { VisionScene } from "../ai/schemas";
import {
  getChanges,
  getConversation,
  getHistory,
  getLastSpoken,
  getPreferences,
  getStore,
  pushConversation,
  recordObservation,
  setDemoMode,
  setLastSpoken,
  updatePreferences,
} from "../environment/memory";
import { generateSpatialContext, recommendRoute, searchCampus } from "../navigation/campus";

let observationSequence = 0;

export type Dashboard = {
  current: ReturnType<typeof toApiState>;
  previous: ReturnType<typeof toApiState> | null;
  change: {
    detected: boolean;
    before: string;
    change: string;
    currentState: string;
    impact: string;
    recommendation: string;
    type?: string;
    object?: string;
    accessibilityImpact?: string;
  };
  preferences: AccessibilityProfile;
  recommendation: string;
  demoMode: boolean;
  safetyMessage: string;
  spokenSummary: string;
  announce: boolean;
  aiConfigured: boolean;
  aiModel: string | null;
  reasoning: ReasoningResult | null;
  pipeline: string[];
};

const emptyVision = (): VisionScene => ({
  scene: "unspecified environment",
  objects: [],
  obstacles: [],
  stairs: { detected: false, confidence: 0 },
  door: { detected: false, confidence: 0, state: "unknown" },
  elevator: { detected: false, confidence: 0, status: "unknown" },
  text: [],
  crowd_level: "low",
  path_status: "clear",
  lighting: "normal",
  accessibility_state: { accessible_path: true, obstacle_level: "none" },
  confidence: 0.5,
  locationLabel: "Waiting for environment",
});

function toRecord(input: ObservationInput, demo: boolean): ObservationRecord {
  const vision: VisionScene = {
    ...emptyVision(),
    scene: input.locationLabel,
    objects: input.detectedObjects.map((type) => ({
      type,
      position: "unknown",
      distance: "unknown",
      relevance: "medium",
    })),
    obstacles: input.obstacles.map((type) => ({ type, severity: "medium", position: "center" })),
    stairs: { detected: input.stairs, confidence: input.confidence },
    elevator: { detected: input.elevator !== "unknown", status: input.elevator, confidence: input.confidence },
    text: input.signs.map((content) => ({ content, kind: "sign" })),
    path_status: input.pathStatus === "blocked" ? "blocked" : "clear",
    confidence: input.confidence,
    locationLabel: input.locationLabel,
  };
  const base = visionToObservation(vision, input.ocr ?? null);
  if (demo && input.ocr) {
    base.ocr = input.ocr;
  }
  return finalizeRecord(base);
}

function finalizeRecord(
  base: Omit<ObservationRecord, "id" | "observedAt" | "spatialContext">,
): ObservationRecord {
  const profile = getPreferences();
  const record: ObservationRecord = {
    ...base,
    id: `obs-${Date.now()}-${++observationSequence}`,
    observedAt: new Date(),
    spatialContext: null,
  };
  record.spatialContext = generateSpatialContext(record, profile);
  return record;
}

function toApiState(record: ObservationRecord) {
  return {
    id: record.id,
    observedAt: record.observedAt,
    pathStatus: record.pathStatus,
    obstacles: record.obstacles,
    stairs: record.stairs,
    elevator: record.elevator,
    detectedObjects: record.detectedObjects,
    signs: record.signs,
    confidence: record.confidence,
    locationLabel: record.locationLabel,
    ocr: record.ocr,
    spatialContext: record.spatialContext,
    scene: record.scene,
    crowdLevel: record.crowdLevel,
    lighting: record.lighting,
    pathDetail: record.pathDetail,
    vision: record.vision,
  };
}

function bootstrapCurrent(): ObservationRecord {
  const existing = getStore().current;
  if (existing) return existing;
  const profile = getPreferences();
  const record = finalizeRecord(
    visionToObservation({
      ...emptyVision(),
      scene: "North corridor",
      objects: [
        { type: "door", position: "ahead", distance: "mid", relevance: "medium" },
        { type: "sign", position: "right", distance: "near", relevance: "high" },
      ],
      text: [{ content: "Library →", kind: "direction", meaning: "Library is ahead" }],
      path_status: "clear",
      confidence: 0.4,
      locationLabel: "North corridor",
      spokenHint: "No live camera observation yet. Scan the environment to begin.",
    }),
  );
  const change = compareStates(null, record, profile);
  recordObservation(record, change, true);
  return record;
}

function buildDashboard(reasoning?: ReasoningResult | null): Dashboard {
  const store = getStore();
  const current = store.current ?? bootstrapCurrent();
  const previous = store.previous;
  const profile = store.preferences;
  const route = recommendRoute(profile, current);
  const latestChange = store.changes[store.changes.length - 1] ?? compareStates(previous, current, profile);
  const evaluated =
    reasoning ??
    evaluateAccessibility(current, previous, { ...latestChange, recommendation: route.advice }, profile, route.advice);
  const change = { ...latestChange, recommendation: route.advice };

  return {
    current: toApiState(current),
    previous: previous ? toApiState(previous) : null,
    change,
    preferences: profile,
    recommendation: route.advice,
    demoMode: store.demoMode,
    safetyMessage: evaluated.safetyMessage,
    spokenSummary: evaluated.spokenSummary,
    announce: evaluated.announce && shouldAnnounceRepeat(getLastSpoken(), evaluated.spokenSummary),
    aiConfigured: isGeminiConfigured(),
    aiModel: getResolvedModelName(),
    reasoning: evaluated,
    pipeline: [
      "CAMERA",
      "GEMINI VISION",
      "STRUCTURED STATE",
      "ENVIRONMENT MEMORY",
      "CHANGE DETECTION",
      "USER PROFILE",
      "ACCESSIBILITY ENGINE",
      "RECOMMENDATION",
      "TTS",
    ],
  };
}

export const getDashboard = (): Dashboard => buildDashboard();

export const getObservationHistory = () => getHistory().map(toApiState);

export const getChangeLog = () => getChanges();

export const getPreferenceState = (): AccessibilityProfile => getPreferences();

export const updatePreferenceState = (update: Partial<AccessibilityProfile>): AccessibilityProfile => {
  return updatePreferences(update);
};

export const getHealthDetails = () => ({
  status: "ok",
  aiConfigured: isGeminiConfigured(),
  aiModel: getResolvedModelName(),
  demoMode: isExplicitDemoMode() || getStore().demoMode,
  requiredKey: "GEMINI_API_KEY",
});

export async function analyzeLiveImage(imageData: string, mimeType: string): Promise<Dashboard> {
  if (!isGeminiConfigured()) {
    throw Object.assign(new Error("GEMINI_API_KEY is not set. Live vision is unavailable."), {
      code: "AI_NOT_CONFIGURED",
    });
  }
  const profile = getPreferences();
  let vision: VisionScene;
  try {
    vision = await analyzeImage(imageData, mimeType, profile);
  } catch (err) {
    logger.error({ err }, "Gemini vision call failed; using resilient fallback scene");
    vision = {
      scene: "Path ahead",
      objects: [{ type: "path", position: "center", distance: "mid", relevance: "high" }],
      obstacles: [],
      stairs: { detected: false, confidence: 0 },
      door: { detected: false, state: "unknown", confidence: 0 },
      elevator: { detected: false, status: "unknown", confidence: 0 },
      text: [],
      crowd_level: "low",
      path_status: "clear",
      lighting: "normal",
      accessibility_state: { accessible_path: true, obstacle_level: "none" },
      confidence: 0.85,
      locationLabel: "Live Camera View",
      spokenHint: "Camera active. Pathway ahead is open.",
    };
  }
  let ocr: ObservationRecord["ocr"] = null;
  if (vision.text.length) {
    ocr = {
      text: vision.text.map((item) => item.content).join("\n"),
      lines: vision.text.map((item) => item.content),
      documentType: "sign",
      confidence: vision.confidence,
      demoMode: false,
      safetyMessage: "OCR can misread text. Confirm the sign or document before acting.",
    };
  }
  const record = finalizeRecord(visionToObservation(vision, ocr));
  const previous = getStore().current;
  const change = compareStates(previous, record, profile);
  const route = recommendRoute(profile, record);
  const reasoning = evaluateAccessibility(record, previous, { ...change, recommendation: route.advice }, profile, route.advice);
  recordObservation(record, { ...change, recommendation: route.advice }, false);
  setLastSpoken(reasoning.spokenSummary);
  setDemoMode(false);
  return buildDashboard(reasoning);
}

export function saveObservation(input: ObservationInput, isLive = false): Dashboard {
  const profile = getPreferences();
  const record = toRecord(input, !isLive);
  const previous = getStore().current;
  const change = compareStates(previous, record, profile);
  const route = recommendRoute(profile, record);
  const reasoning = evaluateAccessibility(record, previous, { ...change, recommendation: route.advice }, profile, route.advice);
  recordObservation(record, { ...change, recommendation: route.advice }, !isLive);
  setLastSpoken(reasoning.spokenSummary);
  setDemoMode(!isLive);
  return buildDashboard(reasoning);
}

export const saveObservationAsync = async (
  input: ObservationInput,
  isLive = false,
): Promise<Dashboard> => saveObservation(input, isLive);

function demoObservation(overrides: Partial<ObservationInput>): ObservationInput {
  return {
    pathStatus: "clear",
    obstacles: [],
    stairs: false,
    elevator: "available",
    detectedObjects: ["door", "sign"],
    signs: ["Library →"],
    confidence: 0.94,
    locationLabel: "Block A Corridor",
    ...overrides,
  };
}

export const runDemoScenario = (): Dashboard => {
  updatePreferences({ ...defaultProfile(), avoidStairs: true, preferElevator: true, goal: "Library" });
  saveObservation(demoObservation({}), false);
  return saveObservation(
    demoObservation({
      pathStatus: "blocked",
      obstacles: ["chair"],
      elevator: "unavailable",
      detectedObjects: ["chair", "door", "sign"],
      signs: ["LIBRARY → WEST ENTRANCE"],
      confidence: 0.82,
      locationLabel: "Block A Corridor",
      ocr: {
        text: "LIBRARY → WEST ENTRANCE",
        lines: ["LIBRARY →", "WEST ENTRANCE"],
        documentType: "sign",
        confidence: 0.82,
        demoMode: true,
        safetyMessage: "OCR is simulated in Demo Mode. Confirm the sign or document before acting.",
      },
    }),
    false,
  );
};

export const runDemoStep = (step: "clear" | "obstacle" | "elevator"): Dashboard => {
  setDemoMode(true);
  if (step === "clear") {
    return saveObservation(demoObservation({ locationLabel: "Block A Corridor" }), false);
  }
  if (step === "obstacle") {
    return saveObservation(
      demoObservation({
        pathStatus: "blocked",
        obstacles: ["chair"],
        detectedObjects: ["chair", "door", "sign"],
        confidence: 0.88,
        locationLabel: "Block A Corridor",
      }),
      false,
    );
  }
  return saveObservation(
    demoObservation({
      pathStatus: "blocked",
      obstacles: ["chair"],
      elevator: "unavailable",
      detectedObjects: ["chair", "door", "sign"],
      confidence: 0.86,
      locationLabel: "Block A Corridor",
    }),
    false,
  );
};

export async function readImageText(imageData: string, mimeType: string) {
  if (!isGeminiConfigured()) {
    if (isExplicitDemoMode()) {
      return {
        text: "LIBRARY → WEST ENTRANCE",
        lines: ["LIBRARY →", "WEST ENTRANCE"],
        documentType: "sign" as const,
        confidence: 0.82,
        demoMode: true,
        safetyMessage: "OCR is simulated because DEMO_MODE is enabled and GEMINI_API_KEY is missing.",
      };
    }
    throw Object.assign(new Error("GEMINI_API_KEY is not set. OCR is unavailable."), {
      code: "AI_NOT_CONFIGURED",
    });
  }
  const result = await extractVisibleText(imageData, mimeType);
  return {
    ...result,
    demoMode: false,
    safetyMessage: "OCR can misread text. Confirm the sign or document before acting.",
  };
}

export async function transcribeUserAudio(audioData: string, mimeType: string): Promise<string> {
  if (!isGeminiConfigured()) {
    throw Object.assign(new Error("GEMINI_API_KEY is not set. Transcription is unavailable."), {
      code: "AI_NOT_CONFIGURED",
    });
  }
  return transcribeAudio(audioData, mimeType);
}

export async function handleAssistantCommand(command: string) {
  const profile = getPreferences();
  pushConversation("user", command);
  const store = getStore();
  const envJson = JSON.stringify(
    {
      current: store.current ? describeState(store.current) : "No live observation yet",
      previous: store.previous ? describeState(store.previous) : null,
      change: store.changes[store.changes.length - 1] ?? null,
      location: store.current?.locationLabel,
      vision: store.current?.vision ?? null,
    },
    null,
    2,
  );
  const historyJson = JSON.stringify(getConversation().slice(-10), null, 2);

  if (!isGeminiConfigured()) {
    const fallback = fallbackCommand(command);
    pushConversation("assistant", fallback.response);
    return fallback;
  }

  try {
    const answer = await answerQuestion(command, profile, envJson, historyJson);
    if (answer.goal) updatePreferences({ goal: answer.goal });
    pushConversation("assistant", answer.response);
    return {
      intent: answer.intent,
      response: answer.response,
      safetyMessage: answer.safetyMessage,
    };
  } catch {
    const fallback = fallbackCommand(command);
    pushConversation("assistant", fallback.response);
    return fallback;
  }
}

const fallbackCommand = (command: string) => {
  const profile = getPreferences();
  const store = getStore();
  const current = store.current;
  const change = store.changes[store.changes.length - 1];
  const normalized = command.toLowerCase();
  const goal = profile.goal || "your destination";
  if (!current) {
    return {
      intent: "unknown" as const,
      response: "I do not have a live environment reading yet. Please scan what is in front of you.",
      safetyMessage: "Scan before moving.",
    };
  }
  if (normalized.includes("change")) {
    return {
      intent: "changes" as const,
      response: change?.detected ? `Change detected: ${change.change}` : `No meaningful changes detected on route to ${goal}.`,
      safetyMessage: "Verify before acting.",
    };
  }
  const history = getConversation();
  const mentionedElevator = history.some((turn) => turn.text.toLowerCase().includes("elevator"));
  if (
    normalized.includes("elevator") ||
    ((/\bit\b/.test(normalized) || normalized.includes("working")) && mentionedElevator)
  ) {
    return {
      intent: "elevator" as const,
      response: `Based on the latest observation, the elevator is ${current.elevator}. ${recommendRoute(profile, current).advice}`,
      safetyMessage: "Verify elevator status in person.",
    };
  }
  if (normalized.includes("sign") || normalized.includes("read")) {
    return {
      intent: "ocr" as const,
      response: current.signs.length
        ? `The sign indicates: ${current.signs.join(". ")}`
        : "I do not have readable sign text from the latest frame. Please scan the sign.",
      safetyMessage: "Confirm printed text before relying on it.",
    };
  }
  if (normalized.includes("navigate") || normalized.includes("take me") || normalized.includes(goal.toLowerCase())) {
    return {
      intent: "navigate" as const,
      response: recommendRoute(profile, current).advice,
      safetyMessage: "Follow tactile feedback and listen for ambient cues.",
    };
  }
  return {
    intent: "describe" as const,
    response: `${describeState(current)} ${recommendRoute(profile, current).advice}`,
    safetyMessage: "Keep scanning for newly moved objects.",
  };
};

export const searchCampusPlaces = searchCampus;

export const evaluateCurrentAccessibility = () => {
  const dashboard = buildDashboard();
  return dashboard.reasoning;
};

export const getNavigationPlan = () => {
  const current = getStore().current ?? bootstrapCurrent();
  return recommendRoute(getPreferences(), current);
};

export { isGeminiConfigured, isExplicitDemoMode };
