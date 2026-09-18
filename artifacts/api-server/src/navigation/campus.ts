import type { AccessibilityProfile } from "../accessibility/profile";
import type { ObservationRecord } from "../accessibility/engine";

export type CampusPlace = {
  id: string;
  name: string;
  aliases: string[];
  building: string;
  hasElevator: boolean;
  hasStairs: boolean;
  accessibleEntrance: string;
  notes: string;
};

export type RouteOption = {
  id: string;
  label: string;
  distanceMeters: number;
  usesStairs: boolean;
  usesElevator: boolean;
  crowd: "low" | "medium" | "high";
  accessible: boolean;
  blocked: boolean;
  summary: string;
};

export const campusPlaces: CampusPlace[] = [
  {
    id: "library",
    name: "Library",
    aliases: ["library", "lib", "west entrance"],
    building: "Library",
    hasElevator: true,
    hasStairs: true,
    accessibleEntrance: "West entrance via elevator lobby",
    notes: "West entrance is the step-free approach.",
  },
  {
    id: "block-b",
    name: "Block B",
    aliases: ["block b", "block-b", "b block"],
    building: "Block B",
    hasElevator: true,
    hasStairs: true,
    accessibleEntrance: "Ground-level corridor from Block A",
    notes: "Avoid the east stair tower if stairs must be skipped.",
  },
  {
    id: "block-a",
    name: "Block A",
    aliases: ["block a", "north corridor"],
    building: "Block A",
    hasElevator: true,
    hasStairs: true,
    accessibleEntrance: "North corridor",
    notes: "Main indoor spine toward the library.",
  },
];

export function searchCampus(query: string): CampusPlace[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return campusPlaces;
  return campusPlaces.filter(
    (place) =>
      place.name.toLowerCase().includes(needle) ||
      place.aliases.some((alias) => alias.includes(needle) || needle.includes(alias)),
  );
}

export function resolveGoalPlace(goal: string): CampusPlace {
  return searchCampus(goal)[0] ?? campusPlaces[0];
}

export function buildRoutes(
  profile: AccessibilityProfile,
  state: ObservationRecord,
): RouteOption[] {
  const destination = resolveGoalPlace(profile.goal);
  const blocked = state.pathStatus === "blocked";
  const elevatorDown = state.elevator === "unavailable";

  const direct: RouteOption = {
    id: "route-a",
    label: "Direct corridor",
    distanceMeters: 300,
    usesStairs: true,
    usesElevator: false,
    crowd: state.crowdLevel === "high" ? "high" : "medium",
    accessible: false,
    blocked,
    summary: `Shorter ${destination.name} approach using the stair corridor.`,
  };

  const accessible: RouteOption = {
    id: "route-b",
    label: "Elevator / level route",
    distanceMeters: 450,
    usesStairs: false,
    usesElevator: true,
    crowd: "low",
    accessible: !elevatorDown,
    blocked: elevatorDown && profile.avoidStairs,
    summary: `Longer level approach to ${destination.name} via ${destination.accessibleEntrance}.`,
  };

  const detour: RouteOption = {
    id: "route-c",
    label: "East concourse",
    distanceMeters: 520,
    usesStairs: false,
    usesElevator: false,
    crowd: "low",
    accessible: true,
    blocked: false,
    summary: `Level outdoor concourse toward ${destination.name} if indoor elevators are unavailable.`,
  };

  return [direct, accessible, detour];
}

export function recommendRoute(
  profile: AccessibilityProfile,
  state: ObservationRecord,
): { advice: string; selected: RouteOption; alternatives: RouteOption[] } {
  const routes = buildRoutes(profile, state);
  const scored = routes
    .map((route) => {
      let score = 100 - route.distanceMeters / 10;
      if (route.blocked) score -= 80;
      if (profile.avoidStairs && route.usesStairs) score -= 40;
      if (profile.preferElevator && route.usesElevator && !route.blocked) score += 15;
      if (profile.avoidCrowds && route.crowd === "high") score -= 20;
      if (route.accessible) score += 10;
      if (state.pathStatus === "blocked" && route.id === "route-a") score -= 50;
      return { route, score };
    })
    .sort((a, b) => b.score - a.score);

  const selected = scored[0].route;
  const destination = resolveGoalPlace(profile.goal).name;
  let advice = selected.summary;

  if (selected.id === "route-b") {
    advice = `Route B is slightly longer but avoids stairs and matches your accessibility preference for ${destination}.`;
  } else if (selected.id === "route-c") {
    advice = `Use the east concourse toward ${destination}. It is longer but stays level while the preferred indoor option is limited.`;
  } else if (state.pathStatus === "blocked") {
    advice = `Pause. The direct path to ${destination} is blocked. Reorient before stepping forward.`;
  } else {
    advice = `Continue toward ${destination} with normal caution. The shorter route is available, but this is not a guarantee of a clear path.`;
  }

  return { advice, selected, alternatives: routes.filter((route) => route.id !== selected.id) };
}

export function generateSpatialContext(
  observation: ObservationRecord,
  profile: AccessibilityProfile,
): ObservationRecord["spatialContext"] {
  const blocked = observation.pathStatus === "blocked" || observation.obstacles.length > 0;
  if (blocked) {
    return {
      waypoints: [
        { id: "wp-origin", label: "Current Position", type: "origin", x: 50, y: 85, status: "clear" },
        {
          id: "wp-barrier",
          label: observation.obstacles[0] || "Barrier",
          type: "barrier",
          x: 50,
          y: 45,
          status: "blocked",
        },
        { id: "wp-fountain", label: "Fountain Turn", type: "turn", x: 75, y: 55, status: "clear" },
        {
          id: "wp-elevator",
          label: "Elevator Lobby",
          type: "elevator",
          x: 75,
          y: 25,
          status: observation.elevator === "unavailable" ? "caution" : "clear",
        },
        { id: "wp-destination", label: profile.goal || "Library", type: "destination", x: 75, y: 10, status: "clear" },
      ],
      currentPoint: { x: 50, y: 85 },
      headingDegrees: 34,
      clockDirections: {
        ahead: observation.obstacles.length
          ? `${observation.obstacles.join(", ")} at 12 o'clock (Blocked)`
          : "Path blocked ahead",
        right: "Fountain turn point at 3 o'clock",
        left: "West quad lawn at 9 o'clock",
        behind: "North corridor entrance at 6 o'clock",
      },
    };
  }
  return {
    waypoints: [
      { id: "wp-origin", label: "Current Position", type: "origin", x: 50, y: 85, status: "clear" },
      { id: "wp-mid", label: "Midway Corridor", type: "turn", x: 50, y: 50, status: "clear" },
      { id: "wp-destination", label: profile.goal || "Library", type: "destination", x: 50, y: 15, status: "clear" },
    ],
    currentPoint: { x: 50, y: 85 },
    headingDegrees: 0,
    clockDirections: {
      ahead: "Direct path toward destination at 12 o'clock in this frame",
      right: "East arcade at 3 o'clock",
      left: "West garden at 9 o'clock",
      behind: "North entrance at 6 o'clock",
    },
  };
}
