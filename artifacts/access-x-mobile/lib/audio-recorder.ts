import { Platform, PermissionsAndroid } from 'react-native';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio';
import AudioModule from 'expo-audio/build/AudioModule';

/**
 * Checks and requests microphone permission using PermissionsAndroid on Android,
 * with expo-audio as a fallback.
 */
export async function requestAudioPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if (hasPermission) return true;

      const status = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'G Sense Microphone Permission',
          message:
            'G Sense needs microphone access to listen for "Hey G Sense", transcribe speech for deaf users, and enable voice commands.',
          buttonPositive: 'Allow Microphone',
          buttonNegative: 'Deny',
        },
      );
      if (status === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      }
    }

    const existing = await getRecordingPermissionsAsync();
    if (existing?.granted) return true;
    const requested = await requestRecordingPermissionsAsync();
    return Boolean(requested?.granted);
  } catch (err) {
    console.warn('[AudioRecorder] Permission error:', err);
    try {
      const requested = await requestRecordingPermissionsAsync();
      return Boolean(requested?.granted);
    } catch {
      return false;
    }
  }
}

/**
 * Starts audio recording session for voice commands or speech transcription.
 */
export async function startAudioRecording(): Promise<
  { ok: true; stop: () => Promise<string | null> } | { ok: false; error: string }
> {
  try {
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      return { ok: false, error: 'permission_denied' };
    }

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    } catch (modeErr) {
      console.warn('[AudioRecorder] setAudioModeAsync warning:', modeErr);
    }

    if (!AudioModule || !AudioModule.AudioRecorder) {
      return { ok: false, error: 'native_module_unavailable' };
    }

    const recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
    await recorder.prepareToRecordAsync();
    recorder.record();

    return {
      ok: true,
      stop: async () => {
        try {
          await recorder.stop();
          return recorder.uri;
        } catch (stopErr) {
          console.warn('[AudioRecorder] Stop error:', stopErr);
          return null;
        }
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Audio recording failed.';
    console.warn('[AudioRecorder] Start recording failed:', message);
    return { ok: false, error: message };
  }
}

/**
 * Safely reads a recorded audio file into a Base64 encoded string.
 * Uses native FileSystem first to bypass Android fetch('file://') limitations.
 */
export async function readAudioFileAsBase64(uri: string): Promise<string> {
  try {
    const FileSystem = await import('expo-file-system');
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });
    if (base64) return base64;
  } catch (fsErr) {
    console.warn('[readAudioFileAsBase64] FileSystem read error, trying fallback:', fsErr);
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = (reader.result as string) || '';
      const data = res.includes(',') ? res.split(',')[1] : res;
      resolve(data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
