import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { setOfflineFirewallActive } from './network-firewall';

export type AIMode = 'online' | 'offline';

const STORAGE_KEY = '@gsense_ai_mode';

let _currentMode: AIMode = 'online';
const _listeners = new Set<(mode: AIMode) => void>();

export function getAIMode(): AIMode {
  return _currentMode;
}

export function isOfflineMode(): boolean {
  return _currentMode === 'offline';
}

export async function setAIMode(mode: AIMode): Promise<void> {
  _currentMode = mode;
  setOfflineFirewallActive(mode === 'offline');
  try {
    await AsyncStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
  _listeners.forEach((listener) => {
    try {
      listener(mode);
    } catch {
      // ignore
    }
  });
}

// Initialize mode from storage on module load
void AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
  if (saved === 'offline' || saved === 'online') {
    _currentMode = saved;
    setOfflineFirewallActive(saved === 'offline');
    _listeners.forEach((listener) => listener(_currentMode));
  }
});

/**
 * React hook to observe and toggle the active AI mode.
 */
export function useAIMode(): {
  mode: AIMode;
  isOffline: boolean;
  setMode: (mode: AIMode) => Promise<void>;
  toggleMode: () => Promise<void>;
} {
  const [mode, setLocalMode] = useState<AIMode>(_currentMode);

  useEffect(() => {
    setLocalMode(_currentMode);
    const listener = (next: AIMode) => setLocalMode(next);
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  }, []);

  const setMode = async (next: AIMode) => {
    await setAIMode(next);
  };

  const toggleMode = async () => {
    const next: AIMode = mode === 'online' ? 'offline' : 'online';
    await setAIMode(next);
  };

  return {
    mode,
    isOffline: mode === 'offline',
    setMode,
    toggleMode,
  };
}
