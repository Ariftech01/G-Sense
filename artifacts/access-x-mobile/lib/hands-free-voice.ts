import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { requestAudioPermission, startAudioRecording, readAudioFileAsBase64 } from './audio-recorder';
import { transcribeAudio } from './gsense-api';
import { executeVoiceCommand, parseVoiceIntent, type VoiceIntentResult } from './voice-navigator';
import { speakText, stopSpeech } from './speech';

interface UseHandsFreeVoiceOptions {
  enabled?: boolean;
  router: { push: (route: any) => void; back?: () => void };
  isOffline?: boolean;
  setMode?: (mode: 'online' | 'offline') => Promise<void>;
  onWakeDetected?: () => void;
  onCommandHandled?: (intent: VoiceIntentResult) => void;
}

/**
 * Continuous hands-free voice listener hook.
 * Listens for "Hey G Sense" or direct voice commands ("scan the area", "navigate me")
 * and speaks aloud like Google Assistant.
 */
export function useHandsFreeVoice({
  enabled = true,
  router,
  isOffline = false,
  setMode,
  onWakeDetected,
  onCommandHandled,
}: UseHandsFreeVoiceOptions) {
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [lastHeard, setLastHeard] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('Voice standby');
  const loopActiveRef = useRef(false);
  const stopFnRef = useRef<(() => Promise<string | null>) | null>(null);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) {
      loopActiveRef.current = false;
      setIsListening(false);
      setStatusMessage('Voice standby');
      cleanupRecording();
      return;
    }

    loopActiveRef.current = true;
    void initAndStartLoop();

    return () => {
      loopActiveRef.current = false;
      setIsListening(false);
      cleanupRecording();
    };
  }, [enabled, isOffline]);

  const cleanupRecording = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (stopFnRef.current) {
      void stopFnRef.current();
      stopFnRef.current = null;
    }
  };

  const initAndStartLoop = async () => {
    const granted = await requestAudioPermission();
    setHasPermission(granted);
    if (!granted) {
      setStatusMessage('Microphone permission needed');
      return;
    }
    void startListeningCycle();
  };

  const startListeningCycle = async () => {
    if (!loopActiveRef.current) return;

    try {
      setIsListening(true);
      setStatusMessage('Listening for "Hey G Sense"…');

      const result = await startAudioRecording();
      if (!result.ok) {
        setIsListening(false);
        if (result.error === 'permission_denied') {
          setHasPermission(false);
          setStatusMessage('Microphone permission denied');
        } else if (result.error === 'native_module_unavailable') {
          setStatusMessage('Voice Assistant Ready');
          return;
        } else {
          setStatusMessage('Voice standby');
        }

        // Retry after delay
        timeoutRef.current = setTimeout(() => {
          if (loopActiveRef.current) void startListeningCycle();
        }, 5000);
        return;
      }

      stopFnRef.current = result.stop;

      // Listen for 3.5 seconds to capture speech
      timeoutRef.current = setTimeout(async () => {
        if (!loopActiveRef.current) return;
        await processAudioChunk();
      }, 3500);
    } catch {
      setIsListening(false);
      timeoutRef.current = setTimeout(() => {
        if (loopActiveRef.current) void startListeningCycle();
      }, 3000);
    }
  };

  const processAudioChunk = async () => {
    const stopFn = stopFnRef.current;
    stopFnRef.current = null;
    if (!stopFn) {
      if (loopActiveRef.current) void startListeningCycle();
      return;
    }

    try {
      const uri = await stopFn();
      if (!uri || !loopActiveRef.current) {
        if (loopActiveRef.current) void startListeningCycle();
        return;
      }

      if (isOffline) {
        // Offline mode: loop cleanly
        if (loopActiveRef.current) {
          timeoutRef.current = setTimeout(() => void startListeningCycle(), 1000);
        }
        return;
      }

      setStatusMessage('Checking speech…');
      const base64 = await readAudioFileAsBase64(uri);
      const { transcript } = await transcribeAudio(base64, 'audio/mp4');
      const text = transcript?.trim();

      if (text) {
        setLastHeard(text);
        const intent = parseVoiceIntent(text, isOffline);

        // 1. Wake word ("Hey G Sense" / "G Sense")
        if (intent.type === 'wake') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setStatusMessage('G Sense activated!');
          stopSpeech();
          const greeting =
            'Hello! I am G Sense. I am listening. Tell me what you need, like: scan the area, or navigate campus.';
          void speakText(greeting, { force: true });
          if (onWakeDetected) onWakeDetected();

          // Give time for spoken greeting before next cycle
          timeoutRef.current = setTimeout(() => {
            if (loopActiveRef.current) void startListeningCycle();
          }, 4500);
          return;
        }

        // 2. Direct command or navigation intent ("scan the area", "navigate me", etc.)
        if (intent.type !== 'unknown' && intent.type !== 'stop') {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setStatusMessage(`Executing: ${intent.type}`);
          await executeVoiceCommand({
            command: text,
            router,
            isOffline,
            setMode,
          });
          if (onCommandHandled) onCommandHandled(intent);
          return;
        }
      }

      // Restart next listening slice
      if (loopActiveRef.current) {
        timeoutRef.current = setTimeout(() => void startListeningCycle(), 500);
      }
    } catch {
      if (loopActiveRef.current) {
        timeoutRef.current = setTimeout(() => void startListeningCycle(), 2000);
      }
    }
  };

  return {
    isListening,
    hasPermission,
    lastHeard,
    statusMessage,
    requestPermission: requestAudioPermission,
  };
}
