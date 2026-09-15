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
  responseLength: "brief",
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
let change = {
  detected: false,
  before: "No earlier observation",
  change: "No change detected",
  currentState: "Path is clear",
  impact: "Continue with normal caution.",
  recommendation: "Continue toward the Library.",
};
let demoMode = true;

const describeState = (state: EnvironmentState): string => {
  const path = state.pathStatus === "blocked" ? "Path blocked" : "Path clear";
  const obstacle = state.obstacles.length
    ? ` by ${state.obstacles.join(", ")}`
    : "";
  const elevator = `Elevator ${state.elevator}`;
  return `${path}${obstacle}. ${elevator}.`;
};

const recommendationFor = (state: EnvironmentState): string => {
  if (state.pathStatus === "blocked" && preferences.avoidStairs) {
    return "Pause and verify the obstruction. Take the longer east route to the Library; it avoids stairs.";
  }
  if (state.stairs && preferences.avoidStairs) {
    return "Use the elevator route instead of the stairs.";
  }
  if (state.elevator === "unavailable" && preferences.avoidStairs) {
    return "Elevator unavailable. Take the longer east route to avoid stairs.";
  }
  return "Continue toward the Library with normal caution.";
};

const compareStates = (
  before: EnvironmentState | null,
  after: EnvironmentState,
) => {
  if (!before) {
    return {
      detected: false,
      before: "No earlier observation",
      change: "No change detected",
      currentState: describeState(after),
      impact: "Continue with normal caution.",
      recommendation: recommendationFor(after),
    };
  }

  const obstacleAdded = after.obstacles.filter(
    (obstacle) => !before.obstacles.includes(obstacle),
  );
  const elevatorChanged = after.elevator !== before.elevator;
  const stairsAdded = after.stairs && !before.stairs;
  const detected = obstacleAdded.length > 0 || elevatorChanged || stairsAdded;

  let description = "No meaningful change detected.";
  if (obstacleAdded.length) {
    description = `${obstacleAdded.join(" and ")} appeared on your route.`;
  } else if (elevatorChanged) {
    description = `Elevator status changed to ${after.elevator}.`;
  } else if (stairsAdded) {
    description = "Stairs are now part of the route.";
  }

  return {
    detected,
    before: describeState(before),
    change: description,
    currentState: describeState(after),
    impact: detected
      ? "Your planned route may no longer match your accessibility preferences."
      : "No route impact detected.",
    recommendation: recommendationFor(after),
  };
};

const buildDashboard = (): Dashboard => ({
  current,
  previous,
  change,
  preferences,
  recommendation: change.recommendation,
  demoMode,
  safetyMessage:
    current.confidence < 0.7
      ? "Possible obstacle detected. Please verify before proceeding."
      : "AI confidence is an estimate. Verify the path before proceeding.",
});

export const getDashboard = (): Dashboard => buildDashboard();

export const saveObservation = (
  input: ObservationInput,
): Dashboard => {
  previous = current;
  current = stateFromObservation(input);
  change = compareStates(previous, current);
  demoMode = true;
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
  change = compareStates(previous, current);
  demoMode = true;
  preferences = { ...defaultPreferences, avoidStairs: true, preferElevator: true };
  return buildDashboard();
};

export const getPreferenceState = (): PreferenceState => preferences;

export const updatePreferenceState = (
  update: PreferencesUpdate,
): PreferenceState => {
  preferences = { ...preferences, ...update };
  change = { ...change, recommendation: recommendationFor(current) };
  return preferences;
};

export const answerCommand = (command: string) => {
  const normalized = command.toLowerCase();
  if (normalized.includes("change")) {
    return {
      intent: "changes" as const,
      response: change.detected
        ? `Change detected: ${change.change} ${change.recommendation}`
        : "No meaningful changes detected since the last observation.",
    };
  }
  if (normalized.includes("elevator")) {
    return {
      intent: "elevator" as const,
      response: `The nearest elevator is ${current.elevator}. ${recommendationFor(current)}`,
    };
  }
  if (normalized.includes("library") || normalized.includes("take me")) {
    return {
      intent: "navigate" as const,
      response: recommendationFor(current),
    };
  }
  return {
    intent: "describe" as const,
    response: `${describeState(current)} ${current.detectedObjects.join(", ")} detected.`,
  };
};