/**
 * G Sense Offline Environmental Memory & Local Change Detection
 *
 * Persists visual observations and tracks spatial changes entirely on-device
 * using AsyncStorage with zero cloud synchronization required.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocalPerceptionResult } from './local-perception';
import type { OfflineLlamaResponse } from './llama-offline-engine';

export interface OfflineObservationRecord {
  id: string;
  timestamp: string;
  perception: LocalPerceptionResult;
  reasoning: OfflineLlamaResponse;
}

export interface OfflineChangeResult {
  detected: boolean;
  summary: string;
  impact: string;
  recommendation: string;
}

const MEMORY_STORAGE_KEY = '@gsense_offline_memory';
const MAX_HISTORY_ITEMS = 15;

let _cachedHistory: OfflineObservationRecord[] = [];

// Hydrate on module load
void AsyncStorage.getItem(MEMORY_STORAGE_KEY).then((raw) => {
  if (raw) {
    try {
      _cachedHistory = JSON.parse(raw);
    } catch {
      _cachedHistory = [];
    }
  }
});

export async function saveOfflineObservation(
  perception: LocalPerceptionResult,
  reasoning: OfflineLlamaResponse
): Promise<{ record: OfflineObservationRecord; change: OfflineChangeResult }> {
  const previous = _cachedHistory[0] || null;

  const record: OfflineObservationRecord = {
    id: `offline-${Date.now()}`,
    timestamp: new Date().toISOString(),
    perception,
    reasoning,
  };

  const change = detectOfflineChange(previous?.perception || null, perception);

  _cachedHistory = [record, ..._cachedHistory.slice(0, MAX_HISTORY_ITEMS - 1)];

  try {
    await AsyncStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(_cachedHistory));
  } catch (err) {
    console.warn('[OFFLINE MEMORY] Failed to persist offline observation:', err);
  }

  return { record, change };
}

export function getLatestOfflineObservation(): OfflineObservationRecord | null {
  return _cachedHistory[0] || null;
}

export function getOfflineObservationHistory(): OfflineObservationRecord[] {
  return [..._cachedHistory];
}

/**
 * Compares two consecutive offline observations to identify route changes.
 */
export function detectOfflineChange(
  prev: LocalPerceptionResult | null,
  curr: LocalPerceptionResult
): OfflineChangeResult {
  if (!prev) {
    return {
      detected: false,
      summary: 'Initial offline scan recorded.',
      impact: 'Baseline established for change detection.',
      recommendation: curr.spokenHint,
    };
  }

  // 1. Obstacle cleared
  if (prev.pathStatus === 'blocked' && curr.pathStatus === 'clear') {
    return {
      detected: true,
      summary: 'Previous obstacle has been removed.',
      impact: 'Your forward walking path is now open.',
      recommendation: 'You can now proceed along the central path.',
    };
  }

  // 2. New obstacle appeared
  if (prev.pathStatus === 'clear' && curr.pathStatus === 'blocked') {
    const obstacle = curr.obstacles[0]?.type || 'object';
    return {
      detected: true,
      summary: `New obstacle detected: ${obstacle}.`,
      impact: 'The route ahead is now obstructed.',
      recommendation: `Check with your cane and navigate around the ${obstacle}.`,
    };
  }

  // 3. Door state change
  if (prev.door.detected && curr.door.detected && prev.door.state !== curr.door.state) {
    return {
      detected: true,
      summary: `Door status changed from ${prev.door.state} to ${curr.door.state}.`,
      impact: curr.door.state === 'open' ? 'Entryway is accessible.' : 'Doorway is closed.',
      recommendation: curr.door.state === 'open' ? 'Proceed through the doorway.' : 'Locate door handle on right side.',
    };
  }

  return {
    detected: false,
    summary: 'Environment remains consistent with previous scan.',
    impact: 'No new spatial hazards observed.',
    recommendation: curr.spokenHint,
  };
}
