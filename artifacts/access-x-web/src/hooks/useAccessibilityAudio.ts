import { useCallback, useEffect, useRef, useState } from 'react';

export function useAccessibilityAudio() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const speak = useCallback(
    (text: string, priority: 'normal' | 'high' = 'normal') => {
      if (!isSupported || !synthRef.current || !enabled || !text) return;

      if (priority === 'high') {
        synthRef.current.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synthRef.current.speak(utterance);
    },
    [isSupported, enabled]
  );

  return {
    isSupported,
    isSpeaking,
    enabled,
    setEnabled,
    speak,
    stop,
  };
}
