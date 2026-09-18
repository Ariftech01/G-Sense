import type { AccessibilityProfile } from "./profile";
import type { VisionScene } from "../ai/schemas";

export type ObservationRecord = {
  id: string;
  observedAt: Date;
  pathStatus: "clear" | "blocked";
  pathDetail: "clear" | "partially_blocked" | "blocked";
  obstacles: string[];
  stairs: boolean;
  elevator: "available" | "unavailable" | "unknown";
  detectedObjects: string[];
  signs: string[];
  confidence: number;
  locationLabel: string;
  scene: string;
  crowdLevel: string;
  lighting: string;
  spokenHint: string;
  vision: VisionScene;
  ocr: {
    text: string;
    lines: string[];
    documentType: "sign" | "document" | "unknown";
    confidence: number;
    demoMode: boolean;
    safetyMessage: string;
  } | null;
  spatialContext: {
    waypoints: Array<{
      id: string;
      label: string;
      type: "origin" | "turn" | "destination" | "elevator" | "stair" | "barrier";
      x: number;
      y: number;
      status: "clear" | "blocked" | "caution";
    }>;
    currentPoint: { x: number; y: number };
    headingDegrees: number;
    clockDirections: { ahead: string; right: string; left: string; behind: string };
  } | null;
};

export type ChangeRecord = {
  detected: boolean;
  type: string;
  object: string;
  accessibilityImpact: "none" | "low" | "medium" | "high";
  before: string;
  change: string;
  currentState: string;
  impact: string;
  recommendation: string;
  announce: boolean;
};

export type ReasoningResult = {
  impact: "none" | "low" | "medium" | "high";
  reason: string;
  recommendedAction: string;
  spokenSummary: string;
  safetyMessage: string;
  announce: boolean;
};

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

export function visionToObservation(
  vision: VisionScene,
  ocr?: ObservationRecord["ocr"],
): Omit<ObservationRecord, "id" | "observedAt" | "spatialContext"> {
  const obstacleNames = vision.obstacles.map((item) => item.type).filter(Boolean);
  const objectNames = vision.objects.map((item) => item.type).filter(Boolean);
  const signs = vision.text.map((item) => item.content).filter(Boolean);
  const pathDetail =
    vision.path_status === "blocked" || vision.path_status === "partially_blocked"
      ? vision.path_status
      : obstacleNames.length
        ? "partially_blocked"
        : "clear";
  const elevatorStatus =
    vision.elevator.status === "available" || vision.elevator.status === "unavailable"
      ? vision.elevator.status
      : vision.elevator.detected
        ? "available"
        : "unknown";

  return {
    pathStatus: pathDetail === "clear" ? "clear" : "blocked",
    pathDetail,
    obstacles: obstacleNames,
    stairs: Boolean(vision.stairs.detected),
    elevator: elevatorStatus,
    detectedObjects: objectNames.length ? objectNames : obstacleNames,
    signs,
    confidence: clamp(vision.confidence),
    locationLabel: vision.locationLabel?.trim() || vision.scene || "Current environment",
    scene: vision.scene,
    crowdLevel: String(vision.crowd_level),
    lighting: String(vision.lighting),
    spokenHint: vision.spokenHint?.trim() || "",
    vision,
    ocr: ocr ?? (signs.length
      ? {
          text: signs.join("\n"),
          lines: signs,
          documentType: "sign",
          confidence: clamp(vision.confidence),
          demoMode: false,
          safetyMessage: "OCR can misread text. Confirm the sign before acting.",
        }
      : null),
  };
}

export function describeState(state: ObservationRecord): string {
  const path =
    state.pathDetail === "blocked"
      ? "Path blocked"
      : state.pathDetail === "partially_blocked"
        ? "Path partially blocked"
        : "Path appears clear in this frame";
  const obstacle = state.obstacles.length ? ` Obstacle: ${state.obstacles.join(", ")}.` : "";
  const elevator = ` Elevator ${state.elevator}.`;
  const stairs = state.stairs ? " Stairs may be present." : "";
  return `${path}.${obstacle}${elevator}${stairs}`.replace(/\s+/g, " ").trim();
}

function lowConfidenceDisclaimer(state: ObservationRecord, threshold: number): string | null {
  if (state.confidence >= threshold) return null;
  const percent = Math.round(state.confidence * 100);
  if (state.stairs) {
    return `I may be detecting a staircase ahead. Confidence is ${percent}%. Please verify before moving.`;
  }
  if (state.obstacles.length) {
    return `I may be detecting ${state.obstacles.join(", ")} ahead. Confidence is ${percent}%. Please verify before moving.`;
  }
  return `This reading is uncertain. Confidence is ${percent}%. Please verify before moving.`;
}

export function compareStates(
  before: ObservationRecord | null,
  after: ObservationRecord,
  profile: AccessibilityProfile,
): ChangeRecord {
  if (!before) {
    return {
      detected: false,
      type: "baseline",
      object: "",
      accessibilityImpact: "none",
      before: "No earlier observation in memory",
      change: "Initial environmental observation recorded",
      currentState: describeState(after),
      impact: "Baseline established.",
      recommendation: "",
      announce: true,
    };
  }

  const addedObstacles = after.obstacles.filter((item) => !before.obstacles.includes(item));
  const clearedObstacles = before.obstacles.filter((item) => !after.obstacles.includes(item));
  const pathChanged = before.pathDetail !== after.pathDetail || before.pathStatus !== after.pathStatus;
  const elevatorChanged = before.elevator !== after.elevator;
  const stairsAppeared = after.stairs && !before.stairs;
  const stairsCleared = !after.stairs && before.stairs;
  const crowdIncreased =
    ["medium", "high"].includes(after.crowdLevel) && !["medium", "high"].includes(before.crowdLevel);

  let type = "none";
  let object = addedObstacles[0] || clearedObstacles[0] || "";
  let accessibilityImpact: ChangeRecord["accessibilityImpact"] = "none";

  if (addedObstacles.length || (after.pathStatus === "blocked" && before.pathStatus === "clear")) {
    type = "obstacle_added";
    accessibilityImpact = "high";
  } else if (clearedObstacles.length && after.pathStatus === "clear") {
    type = "obstacle_removed";
    accessibilityImpact = "medium";
  } else if (elevatorChanged && after.elevator === "unavailable") {
    type = "elevator_unavailable";
    object = "elevator";
    accessibilityImpact = profile.preferElevator || profile.avoidStairs ? "high" : "medium";
  } else if (elevatorChanged && after.elevator === "available") {
    type = "elevator_available";
    object = "elevator";
    accessibilityImpact = "medium";
  } else if (stairsAppeared) {
    type = "stairs_appeared";
    object = "stairs";
    accessibilityImpact = profile.avoidStairs ? "high" : "medium";
  } else if (stairsCleared) {
    type = "stairs_cleared";
    object = "stairs";
    accessibilityImpact = "low";
  } else if (crowdIncreased && profile.avoidCrowds) {
    type = "crowd_increased";
    accessibilityImpact = "medium";
  } else if (pathChanged) {
    type = after.pathStatus === "blocked" ? "route_blocked" : "route_cleared";
    accessibilityImpact = after.pathStatus === "blocked" ? "high" : "medium";
  }

  const detected = type !== "none";
  const parts: string[] = [];
  if (addedObstacles.length) parts.push(`New obstacle detected: ${addedObstacles.join(", ")}`);
  if (clearedObstacles.length) parts.push(`Previously detected ${clearedObstacles.join(", ")} removed`);
  if (pathChanged) parts.push(`Path status shifted from ${before.pathDetail} to ${after.pathDetail}`);
  if (elevatorChanged) parts.push(`Elevator status changed from ${before.elevator} to ${after.elevator}`);
  if (stairsAppeared) parts.push("Stairs appeared in the path");
  if (stairsCleared) parts.push("Stairs no longer present in the immediate path");
  if (crowdIncreased) parts.push("Crowd level increased");

  const change = parts.length ? `${parts.join(". ")}.` : "No meaningful accessibility change detected.";

  let impact = "No meaningful impact on route accessibility.";
  if (type === "obstacle_added") impact = "WARNING: Direct route is newly obstructed and poses a collision risk.";
  if (type === "obstacle_removed") impact = "The previously reported barrier appears cleared in this frame.";
  if (type === "elevator_unavailable") impact = "ACCESSIBILITY IMPACT: Elevator appears unavailable. Step-free options are reduced.";
  if (type === "stairs_appeared" && profile.avoidStairs) {
    impact = "ACCESSIBILITY IMPACT: Stairs entered the route, conflicting with stair avoidance.";
  }

  return {
    detected,
    type,
    object,
    accessibilityImpact,
    before: describeState(before),
    change,
    currentState: describeState(after),
    impact,
    recommendation: "",
    announce: detected && accessibilityImpact !== "none" && accessibilityImpact !== "low",
  };
}

export function evaluateAccessibility(
  state: ObservationRecord,
  previous: ObservationRecord | null,
  change: ChangeRecord,
  profile: AccessibilityProfile,
  routeAdvice: string,
): ReasoningResult {
  const disclaimer = lowConfidenceDisclaimer(state, profile.confidenceThreshold);
  let impact: ReasoningResult["impact"] = change.accessibilityImpact;
  let reason = change.impact;
  let recommendedAction = "continue_with_caution";

  if (state.pathStatus === "blocked" && profile.avoidStairs && state.elevator === "available") {
    impact = "high";
    reason = "preferred accessible route is blocked";
    recommendedAction = "use_alternate_route";
  } else if (state.stairs && profile.avoidStairs) {
    impact = "high";
    reason = "stairs conflict with avoid-stairs preference";
    recommendedAction = "use_elevator_or_ramp";
  } else if (state.elevator === "unavailable" && profile.preferElevator) {
    impact = "high";
    reason = "preferred elevator is unavailable";
    recommendedAction = "use_level_alternate_route";
  } else if (state.pathStatus === "blocked") {
    impact = "high";
    reason = "walking path is obstructed";
    recommendedAction = "stop_and_reorient";
  } else if (profile.avoidCrowds && ["medium", "high"].includes(state.crowdLevel)) {
    impact = "medium";
    reason = "crowd level conflicts with avoid-crowds preference";
    recommendedAction = "use_quieter_path";
  } else if (!change.detected) {
    impact = "none";
    reason = "no meaningful accessibility change in this frame";
    recommendedAction = "hold_or_continue";
  }

  const obstacle = state.obstacles[0];
  let spoken = state.spokenHint;
  if (!spoken) {
    if (state.pathStatus === "blocked" && obstacle) {
      spoken = `Obstacle ahead. A ${obstacle} is blocking the ${state.scene || "path"}.`;
    } else if (state.stairs && profile.avoidStairs) {
      spoken = "Stairs ahead. This conflicts with your preference to avoid stairs.";
    } else if (state.signs.length) {
      spoken = `Sign text: ${state.signs[0]}`;
    } else {
      spoken = `${describeState(state)} ${routeAdvice}`;
    }
  }

  if (disclaimer) spoken = `${disclaimer} ${spoken}`;

  if (profile.responseLength === "brief") {
    spoken = spoken.split(". ").slice(0, 2).join(". ");
  } else if (profile.responseLength === "detailed") {
    spoken = `${spoken} ${routeAdvice} Location: ${state.locationLabel}.`;
  } else {
    spoken = `${spoken} ${routeAdvice}`.trim();
  }

  const announce =
    Boolean(profile.assistiveMode) &&
    (impact === "high" || (change.announce && impact !== "none")) &&
    (disclaimer !== null || change.detected || state.pathStatus === "blocked" || (state.stairs && profile.avoidStairs));

  return {
    impact,
    reason,
    recommendedAction,
    spokenSummary: spoken.replace(/\s+/g, " ").trim(),
    safetyMessage:
      disclaimer ||
      "This is an assistive estimate, not a replacement for a cane, guide dog, or human assistance. Verify before moving.",
    announce: profile.assistiveMode ? announce : true,
  };
}

export function shouldAnnounceRepeat(
  previousSpoken: string | null,
  nextSpoken: string,
): boolean {
  if (!previousSpoken) return true;
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return normalize(previousSpoken) !== normalize(nextSpoken);
}
