import * as Speech from 'expo-speech';

let lastUtterance = '';

export async function speakText(
  text: string,
  options?: { force?: boolean; rate?: number; pitch?: number; language?: string }
) {
  const value = text.trim();
  if (!value) return;
  if (!options?.force && value === lastUtterance) return;
  lastUtterance = value;
  Speech.stop();
  Speech.speak(value, {
    rate: options?.rate ?? 0.94,
    pitch: options?.pitch ?? 1.0,
    language: options?.language ?? 'en-US',
  });
}

export function stopSpeech() {
  Speech.stop();
}

export function repeatLastSpeech() {
  if (lastUtterance) Speech.speak(lastUtterance, { rate: 0.94, pitch: 1.0, language: 'en-US' });
}

export function getLastSpoken() {
  return lastUtterance;
}
