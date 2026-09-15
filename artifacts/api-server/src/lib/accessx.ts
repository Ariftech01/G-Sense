import {
  type AccessibilityPreferences,
  type EnvironmentDashboard,
  type EnvironmentState,
  type ObservationInput,
  type PreferencesUpdate,
  type SpatialContext,
} from "@workspace/api-zod";

type Observation = ObservationInput;
type PreferenceState = AccessibilityPreferences;
type Dashboard = EnvironmentDashboard;

const defaultPreferences: PreferenceState = {
  avoidStairs: true,
  preferElevator: true,
  avoidCrowds: false,
  responseLength: "standard",
  accessibilityMode: "screen-reader",
  goal: "Library",
};

const clearPath: Observation = {
  pathStatus: "clear",
  obstacles: [],
  stairs: false,
  elevator: "available",
  detectedObjects: ["door", "sign"],
  signs: ["Library →"],
  confidence: 0.94,
  locationLabel: "North corridor",
};

let observationSequence = 0;

const generateSpatialContext = (observation: Observation): SpatialContext => {
  const isBlocked = observation.pathStatus === "blocked" || observation.obstacles.length > 0;
  if (isBlocked) {
    return {
      waypoints: [
        { id: "wp-origin", label: "Current Position", type: "origin", x: 50, y: 85, status: "clear" },
        { id: "wp-barrier", label: observation.obstacles[0] || "Barrier", type: "barrier", x: 50, y: 45, status: "blocked" },
        { id: "wp-fountain", label: "Fountain Turn", type: "turn", x: 75, y: 55, status: "clear" },
        { id: "wp-elevator", label: "Elevator Lobby", type: "elevator", x: 75, y: 25, status: observation.elevator === "unavailable" ? "caution" : "clear" },
        { id: "wp-destination", label: preferences.goal || "Library", type: "destination", x: 75, y: 10, status: "clear" }
      ],
      currentPoint: { x: 50, y: 85 },
      headingDegrees: 34,
      clockDirections: {
        ahead: observation.obstacles.length ? `${observation.obstacles.join(", ")} at 12 o'clock (Blocked)` : "Path blocked ahead",
        right: "Fountain turn point at 3 o'clock",
        left: "West quad lawn at 9 o'clock",
        behind: "North corridor entrance at 6 o'clock"
      }
    };
  }
  return {
    waypoints: [
      { id: "wp-origin", label: "Current Position", type: "origin", x: 50, y: 85, status: "clear" },
      { id: "wp-mid", label: "Midway Corridor", type: "turn", x: 50, y: 50, status: "clear" },
      { id: "wp-destination", label: preferences.goal || "Library", type: "destination", x: 50, y: 15, status: "clear" }
    ],
    currentPoint: { x: 50, y: 85 },
    headingDegrees: 0,
    clockDirections: {
      ahead: "Direct path to destination at 12 o'clock",
      right: "East arcade at 3 o'clock",
      left: "West garden at 9 o'clock",
      behind: "North entrance at 6 o'clock"
    }
  };
};

const stateFromObservation = (observation: Observation): EnvironmentState => ({
  ...observation,
  id: `obs-${Date.now()}-${++observationSequence}`,
  observedAt: new Date(),
  ocr: observation.ocr ?? null,
  spatialContext: generateSpatialContext(observation),
});

let preferences: PreferenceState = { ...defaultPreferences };
let current: EnvironmentState = stateFromObservation(clearPath);
let previous: EnvironmentState | null = null;
const memoryHistory: EnvironmentState[] = [current];

let change = {
  detected: false,
  before: "No earlier observation",
  change: "No change detected",
  currentState: "Path is clear",
  impact: "Continue with normal caution.",
  recommendation: "Continue toward the Library.",
};
let demoMode = true;

const getGeminiApiKey = (): string | undefined => {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_KEY
  );
};

const describeState = (state: EnvironmentState): string => {
  const path = state.pathStatus === "blocked" ? "Path blocked" : "Path clear";
  const obstacle = state.obstacles.length
    ? ` by ${state.obstacles.join(", ")}`
    : "";
  const elevator = `Elevator ${state.elevator}`;
  const stairs = state.stairs ? "Stairs present" : "No stairs";
  return `${path}${obstacle}. ${elevator}. ${stairs}.`;
};

/**
 * Dynamic Preference & Goal-Aware Route Recommendation Engine.
 * Evaluates current environment conditions against user's active Accessibility Profile preferences:
 * - goal (destination target)
 * - avoidStairs (step-free routing)
 * - preferElevator (elevator preference over stairs)
 * - avoidCrowds (low-density path selection)
 * - responseLength (brief | standard | detailed)
 */
const recommendationFor = (state: EnvironmentState): string => {
  const goal = preferences.goal.trim() || "your destination";
  const obstaclesText = state.obstacles.length ? state.obstacles.join(", ") : "an obstruction";
  let actionAdvice = "";

  if (state.pathStatus === "blocked") {
    if (preferences.avoidStairs && state.elevator === "available") {
      actionAdvice = `Path to ${goal} is blocked by ${obstaclesText}. Turn right and take the level elevator route to avoid stairs.`;
    } else if (preferences.avoidStairs && state.elevator === "unavailable") {
      actionAdvice = `Path to ${goal} is blocked by ${obstaclesText} and elevator is out of service. Take the east level concourse.`;
    } else if (preferences.avoidCrowds) {
      actionAdvice = `Path to ${goal} is blocked by ${obstaclesText}. Divert via the quiet side aisle.`;
    } else {
      actionAdvice = `Path to ${goal} is blocked by ${obstaclesText}. Pause and reorient before stepping forward.`;
    }
  } else if (state.stairs && preferences.avoidStairs) {
    if (state.elevator === "available" || preferences.preferElevator) {
      actionAdvice = `Stairs ahead on route to ${goal}. Bypass stairs by taking the elevator on your left.`;
    } else {
      actionAdvice = `Stairs ahead on route to ${goal}. Avoid stairs by taking the ramp pathway on the right.`;
    }
  } else if (state.elevator === "unavailable" && preferences.preferElevator) {
    actionAdvice = `Elevator to ${goal} is unavailable. Take the level ramp corridor ahead.`;
  } else if (preferences.avoidCrowds && state.detectedObjects.some(o => o.toLowerCase().includes("crowd") || o.toLowerCase().includes("group"))) {
    actionAdvice = `High crowd density ahead. Take the quieter side corridor toward ${goal}.`;
  } else {
    actionAdvice = `Path is clear. Proceed straight toward ${goal} with normal awareness.`;
  }

  // Adjust verbosity based on preferences.responseLength
  if (preferences.responseLength === "brief") {
    if (state.pathStatus === "blocked") return `Blocked by ${obstaclesText}. Divert via elevator to ${goal}.`;
    if (state.stairs && preferences.avoidStairs) return `Stairs ahead. Use elevator to ${goal}.`;
    return `Path clear to ${goal}.`;
  }

  if (preferences.responseLength === "detailed") {
    return `[${state.locationLabel}] ${actionAdvice} (Confidence: ${Math.round(state.confidence * 100)}%).`;
  }

  return actionAdvice;
};

/**
 * Deterministic Temporal Change Detection Engine.
 */
const compareStatesAlgorithmic = (
  before: EnvironmentState | null,
  after: EnvironmentState,
) => {
  if (!before) {
    return {
      detected: false,
      before: "No earlier observation in memory",
      change: "Initial environmental observation recorded",
      currentState: describeState(after),
      impact: "Baseline established. Continue with normal caution.",
      recommendation: recommendationFor(after),
    };
  }

  const addedObstacles = after.obstacles.filter(
    (obs) => !before.obstacles.includes(obs),
  );
  const clearedObstacles = before.obstacles.filter(
    (obs) => !after.obstacles.includes(obs),
  );
  const pathStatusChanged = before.pathStatus !== after.pathStatus;
  const elevatorChanged = before.elevator !== after.elevator;
  const stairsAppeared = after.stairs && !before.stairs;
  const stairsCleared = !after.stairs && before.stairs;
  const newSigns = after.signs.filter((s) => !before.signs.includes(s));

  const detected =
    addedObstacles.length > 0 ||
    clearedObstacles.length > 0 ||
    pathStatusChanged ||
    elevatorChanged ||
    stairsAppeared ||
    stairsCleared;

  const changeParts: string[] = [];

  if (addedObstacles.length > 0) {
    changeParts.push(`New obstacle detected: ${addedObstacles.join(", ")}`);
  }
  if (clearedObstacles.length > 0) {
    changeParts.push(`Previously detected ${clearedObstacles.join(", ")} removed`);
  }
  if (pathStatusChanged) {
    changeParts.push(
      `Path status shifted from ${before.pathStatus} to ${after.pathStatus}`,
    );
  }
  if (elevatorChanged) {
    changeParts.push(`Elevator status changed from ${before.elevator} to ${after.elevator}`);
  }
  if (stairsAppeared) {
    changeParts.push("Stairs appeared in the path");
  } else if (stairsCleared) {
    changeParts.push("Stairs no longer present in immediate path");
  }
  if (newSigns.length > 0) {
    changeParts.push(`New sign text visible: "${newSigns.join(", ")}"`);
  }

  const changeDescription = changeParts.length
    ? changeParts.join(". ") + "."
    : "No meaningful temporal changes detected in route conditions.";

  let impactDescription = "No impact on route accessibility.";
  if (addedObstacles.length > 0 || (after.pathStatus === "blocked" && before.pathStatus === "clear")) {
    impactDescription = "WARNING: Direct route is newly obstructed and poses a collision risk.";
  } else if (clearedObstacles.length > 0 && after.pathStatus === "clear") {
    impactDescription = "CLEARANCE: The previously reported barrier is cleared. Route is accessible again.";
  } else if (elevatorChanged && after.elevator === "unavailable" && preferences.preferElevator) {
    impactDescription = "ACCESSIBILITY IMPACT: Elevator is now out of service. Step-free route options are reduced.";
  } else if (stairsAppeared && preferences.avoidStairs) {
    impactDescription = "ACCESSIBILITY IMPACT: Stairs entered the route, violating your stair avoidance preference.";
  }

  return {
    detected,
    before: describeState(before),
    change: changeDescription,
    currentState: describeState(after),
    impact: impactDescription,
    recommendation: recommendationFor(after),
  };
};

/**
 * Gemini Temporal Reasoning for Deep Change Analysis
 */
const compareStatesWithGemini = async (
  before: EnvironmentState | null,
  after: EnvironmentState,
) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey || !before) {
    return compareStatesAlgorithmic(before, after);
  }

  const prompt = `You are the temporal change detection engine for G Sense, an accessibility assistant for blind and low-vision users.
Compare the PREVIOUS environment state (T_n-1) with the CURRENT environment state (T_n).

PREVIOUS STATE (T_n-1):
${JSON.stringify({
  location: before.locationLabel,
  pathStatus: before.pathStatus,
  obstacles: before.obstacles,
  stairs: before.stairs,
  elevator: before.elevator,
  signs: before.signs,
}, null, 2)}

CURRENT STATE (T_n):
${JSON.stringify({
  location: after.locationLabel,
  pathStatus: after.pathStatus,
  obstacles: after.obstacles,
  stairs: after.stairs,
  elevator: after.elevator,
  signs: after.signs,
}, null, 2)}

USER ACCESSIBILITY PROFILE & GOAL:
${JSON.stringify(preferences, null, 2)}

Analyze the differences and return JSON only:
{
  "detected": true | false,
  "change": "clear description of what physically changed between observations",
  "impact": "accessibility impact explanation tailored to blind/low-vision navigation",
  "recommendation": "personalized safe route advice for user's goal (${preferences.goal}) honoring avoidStairs: ${preferences.avoidStairs} and preferElevator: ${preferences.preferElevator}"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      }
    );

    if (!response.ok) {
      return compareStatesAlgorithmic(before, after);
    }

    const payload: any = await response.json();
    const rawText = payload.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();

    if (!rawText) return compareStatesAlgorithmic(before, after);

    const cleanedJson = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleanedJson);

    return {
      detected: Boolean(parsed.detected),
      before: describeState(before),
      change: typeof parsed.change === "string" ? parsed.change : compareStatesAlgorithmic(before, after).change,
      currentState: describeState(after),
      impact: typeof parsed.impact === "string" ? parsed.impact : compareStatesAlgorithmic(before, after).impact,
      recommendation: typeof parsed.recommendation === "string" ? parsed.recommendation : recommendationFor(after),
    };
  } catch {
    return compareStatesAlgorithmic(before, after);
  }
};

const buildDashboard = (): Dashboard => ({
  current,
  previous,
  change,
  preferences,
  recommendation: recommendationFor(current),
  demoMode,
  safetyMessage:
    current.confidence < 0.7
      ? "Possible obstacle detected. Please verify before proceeding."
      : "AI confidence is an estimate. Verify the path before proceeding.",
});

export const getDashboard = (): Dashboard => buildDashboard();

export const getObservationHistory = (): EnvironmentState[] => [...memoryHistory];

export const saveObservation = (
  input: ObservationInput,
  isLive = false,
): Dashboard => {
  previous = current;
  current = stateFromObservation(input);
  memoryHistory.push(current);
  if (memoryHistory.length > 20) {
    memoryHistory.shift();
  }
  change = compareStatesAlgorithmic(previous, current);
  demoMode = !isLive;
  return buildDashboard();
};

export const saveObservationAsync = async (
  input: ObservationInput,
  isLive = false,
): Promise<Dashboard> => {
  previous = current;
  current = stateFromObservation(input);
  memoryHistory.push(current);
  if (memoryHistory.length > 20) {
    memoryHistory.shift();
  }
  change = await compareStatesWithGemini(previous, current);
  demoMode = !isLive;
  return buildDashboard();
};

export const runDemoScenario = (): Dashboard => {
  const before = stateFromObservation(clearPath);
  const after = stateFromObservation({
    ...clearPath,
    obstacles: ["chair"],
    pathStatus: "blocked",
    elevator: "unavailable",
    confidence: 0.82,
    detectedObjects: ["chair", "door", "sign"],
    ocr: {
      text: "LIBRARY → WEST ENTRANCE",
      lines: ["LIBRARY →", "WEST ENTRANCE"],
      documentType: "sign",
      confidence: 0.82,
      demoMode: true,
      safetyMessage:
        "OCR is simulated in Demo Mode. Confirm the sign or document before acting.",
    },
  });
  previous = before;
  current = after;
  memoryHistory.push(before, after);
  if (memoryHistory.length > 20) {
    memoryHistory.splice(0, memoryHistory.length - 20);
  }
  change = compareStatesAlgorithmic(previous, current);
  demoMode = true;
  preferences = { ...defaultPreferences, avoidStairs: true, preferElevator: true, goal: "Library" };
  return buildDashboard();
};

export const getPreferenceState = (): PreferenceState => preferences;

export const updatePreferenceState = (
  update: PreferencesUpdate,
): PreferenceState => {
  preferences = { ...preferences, ...update };
  change = {
    ...change,
    recommendation: recommendationFor(current),
  };
  return preferences;
};

/**
 * Perform structured JSON scene analysis on an input image using Gemini Multimodal API.
 */
export const analyzeSceneWithGemini = async (
  imageData: string,
  mimeType: string,
): Promise<ObservationInput> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const cleanImageData = imageData.replace(/^data:[^;]+;base64,/, "");

  const prompt = `You are the spatial visual engine for G Sense, an accessibility assistant for blind and low-vision users.
Analyze the provided camera image of a pathway, room, corridor, or building entrance.
The user's current destination goal is: "${preferences.goal}".
Active Accessibility Profile Preferences:
- avoidStairs: ${preferences.avoidStairs}
- preferElevator: ${preferences.preferElevator}
- avoidCrowds: ${preferences.avoidCrowds}

Return JSON only matching this exact structure:
{
  "pathStatus": "clear" | "blocked",
  "obstacles": ["list of physical obstacles blocking or narrowing the path"],
  "stairs": true | false,
  "elevator": "available" | "unavailable" | "unknown",
  "detectedObjects": ["list of key visible objects"],
  "signs": ["readable text on any signs or doors"],
  "confidence": 0.0 to 1.0,
  "locationLabel": "short descriptive location (3-6 words)"
}
Rules:
- pathStatus MUST be "clear" or "blocked". Set "blocked" if an obstacle restricts clear walking passage.
- elevator MUST be "available", "unavailable", or "unknown".
- confidence MUST be a number between 0.0 and 1.0 reflecting visual clarity.
- locationLabel MUST be concise (e.g. "Library entrance corridor").`;

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
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: cleanImageData,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini Multimodal Scene API error (${response.status}): ${detail}`);
  }

  const payload: any = await response.json();
  const rawText = payload.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();

  if (!rawText) {
    throw new Error("Empty response received from Gemini Multimodal API.");
  }

  const cleanedJson = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(cleanedJson);

  return {
    pathStatus: parsed.pathStatus === "blocked" ? "blocked" : "clear",
    obstacles: Array.isArray(parsed.obstacles) ? parsed.obstacles.map(String) : [],
    stairs: Boolean(parsed.stairs),
    elevator: ["available", "unavailable"].includes(parsed.elevator) ? parsed.elevator : "unknown",
    detectedObjects: Array.isArray(parsed.detectedObjects) ? parsed.detectedObjects.map(String) : [],
    signs: Array.isArray(parsed.signs) ? parsed.signs.map(String) : [],
    confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.85,
    locationLabel:
      typeof parsed.locationLabel === "string" && parsed.locationLabel.trim()
        ? parsed.locationLabel.trim()
        : "Current environment",
  };
};

/**
 * Answer assistant commands using Gemini LLM contextual reasoning.
 */
export const answerCommandWithGemini = async (command: string) => {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    return answerCommandFallback(command);
  }

  const prompt = `You are G Sense, an AI accessibility assistant for blind and low-vision users.
User prompt: "${command}"

Current Environment State:
- Location: ${current.locationLabel}
- Path Status: ${current.pathStatus}
- Obstacles: ${current.obstacles.join(", ") || "None"}
- Stairs: ${current.stairs ? "Present" : "None"}
- Elevator: ${current.elevator}
- Detected Objects: ${current.detectedObjects.join(", ") || "None"}
- Signs: ${current.signs.join(", ") || "None"}
- Recent Change: ${change.change}

User Accessibility Profile & Active Goal:
- Goal: ${preferences.goal}
- Avoid Stairs: ${preferences.avoidStairs}
- Prefer Elevator: ${preferences.preferElevator}
- Avoid Crowds: ${preferences.avoidCrowds}
- Response Length: ${preferences.responseLength}
- Accessibility Mode: ${preferences.accessibilityMode}

Provide a concise, direct, spoken-style answer tailored to the user's destination goal ("${preferences.goal}") and accessibility preferences.
Return JSON only:
{
  "intent": "describe" | "navigate" | "changes" | "elevator",
  "response": "spoken response text",
  "safetyMessage": "short safety note"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      }
    );

    if (!response.ok) {
      return answerCommandFallback(command);
    }

    const payload: any = await response.json();
    const rawText = payload.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();

    if (!rawText) return answerCommandFallback(command);

    const cleanedJson = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleanedJson);

    const validIntents = ["describe", "navigate", "changes", "elevator"] as const;
    const intent = validIntents.includes(parsed.intent) ? parsed.intent : "describe";

    return {
      intent,
      response: typeof parsed.response === "string" ? parsed.response : "Path status processed.",
      safetyMessage: typeof parsed.safetyMessage === "string" ? parsed.safetyMessage : "Verify surroundings before moving.",
    };
  } catch {
    return answerCommandFallback(command);
  }
};

const answerCommandFallback = (command: string) => {
  const normalized = command.toLowerCase();
  const goal = preferences.goal || "your destination";
  if (normalized.includes("change")) {
    return {
      intent: "changes" as const,
      response: change.detected
        ? `Change detected: ${change.change} ${change.recommendation}`
        : `No meaningful changes detected on route to ${goal}.`,
      safetyMessage: "Verify before acting.",
    };
  }
  if (normalized.includes("elevator")) {
    return {
      intent: "elevator" as const,
      response: `The nearest elevator is ${current.elevator}. ${recommendationFor(current)}`,
      safetyMessage: "Verify elevator status in person.",
    };
  }
  if (normalized.includes("navigate") || normalized.includes("goal") || normalized.includes("take me") || normalized.includes(goal.toLowerCase())) {
    return {
      intent: "navigate" as const,
      response: recommendationFor(current),
      safetyMessage: "Follow tactile feedback and listen for ambient cues.",
    };
  }
  return {
    intent: "describe" as const,
    response: `${describeState(current)} ${recommendationFor(current)}`,
    safetyMessage: "Keep scanning for newly moved objects.",
  };
};