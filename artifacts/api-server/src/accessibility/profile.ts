export type AccessibilityProfile = {
  avoidStairs: boolean;
  preferElevator: boolean;
  avoidCrowds: boolean;
  responseLength: "brief" | "standard" | "detailed";
  accessibilityMode: "screen-reader" | "high-contrast" | "standard";
  goal: string;
  visionMode: "blind" | "low-vision" | "sighted-support";
  language: string;
  voiceEnabled: boolean;
  monitoringIntervalMs: number;
  confidenceThreshold: number;
  assistiveMode: boolean;
  storeRawImages: boolean;
};

export const defaultProfile = (): AccessibilityProfile => ({
  avoidStairs: true,
  preferElevator: true,
  avoidCrowds: true,
  responseLength: "standard",
  accessibilityMode: "screen-reader",
  goal: "Library",
  visionMode: "blind",
  language: "English",
  voiceEnabled: true,
  monitoringIntervalMs: 8000,
  confidenceThreshold: 0.7,
  assistiveMode: false,
  storeRawImages: false,
});

export type ProfileUpdate = Partial<AccessibilityProfile>;
