import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defaultProfile, type AccessibilityProfile } from "../accessibility/profile";
import type { ChangeRecord, ObservationRecord } from "../accessibility/engine";

export type ConversationTurn = {
  role: "user" | "assistant";
  text: string;
  at: string;
};

type PersistedStore = {
  preferences: AccessibilityProfile;
  current: ObservationRecord | null;
  previous: ObservationRecord | null;
  history: ObservationRecord[];
  changes: ChangeRecord[];
  conversation: ConversationTurn[];
  lastSpoken: string | null;
  demoMode: boolean;
};

const dataDir = path.resolve(process.cwd(), "data");
const storePath = path.resolve(dataDir, "environment-memory.json");

const revive = (value: PersistedStore): PersistedStore => {
  const reviveObs = (item: ObservationRecord | null): ObservationRecord | null => {
    if (!item) return null;
    return { ...item, observedAt: new Date(item.observedAt) };
  };
  return {
    ...value,
    current: reviveObs(value.current),
    previous: reviveObs(value.previous),
    history: value.history.map((item) => reviveObs(item)!),
  };
};

const emptyStore = (): PersistedStore => ({
  preferences: defaultProfile(),
  current: null,
  previous: null,
  history: [],
  changes: [],
  conversation: [],
  lastSpoken: null,
  demoMode: true,
});

let memory: PersistedStore = emptyStore();

function persist() {
  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(storePath, JSON.stringify(memory, null, 2), "utf8");
  } catch {
    // Persistence is best-effort; in-memory state remains authoritative.
  }
}

export function loadMemory() {
  try {
    const raw = readFileSync(storePath, "utf8");
    memory = revive(JSON.parse(raw) as PersistedStore);
    memory.preferences = { ...defaultProfile(), ...memory.preferences };
  } catch {
    memory = emptyStore();
  }
}

export function getStore(): PersistedStore {
  return memory;
}

export function getPreferences(): AccessibilityProfile {
  return memory.preferences;
}

export function updatePreferences(update: Partial<AccessibilityProfile>): AccessibilityProfile {
  memory.preferences = { ...memory.preferences, ...update };
  persist();
  return memory.preferences;
}

export function recordObservation(
  observation: ObservationRecord,
  change: ChangeRecord,
  demoMode: boolean,
) {
  memory.previous = memory.current;
  memory.current = observation;
  memory.history.push(observation);
  if (memory.history.length > 40) memory.history.shift();
  memory.changes.push(change);
  if (memory.changes.length > 40) memory.changes.shift();
  memory.demoMode = demoMode;
  persist();
}

export function getHistory(): ObservationRecord[] {
  return [...memory.history];
}

export function getChanges(): ChangeRecord[] {
  return [...memory.changes];
}

export function pushConversation(role: ConversationTurn["role"], text: string) {
  memory.conversation.push({ role, text, at: new Date().toISOString() });
  if (memory.conversation.length > 24) memory.conversation.splice(0, memory.conversation.length - 24);
  persist();
}

export function getConversation(): ConversationTurn[] {
  return [...memory.conversation];
}

export function setLastSpoken(text: string | null) {
  memory.lastSpoken = text;
  persist();
}

export function getLastSpoken(): string | null {
  return memory.lastSpoken;
}

export function setDemoMode(value: boolean) {
  memory.demoMode = value;
  persist();
}

loadMemory();
