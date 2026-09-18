import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { speakText, stopSpeech } from '@/lib/speech';
import { startAudioRecording, readAudioFileAsBase64 } from '@/lib/audio-recorder';
import { transcribeAudio, uint8ArrayToBase64 } from '@/lib/gsense-api';
import { executeVoiceCommand } from '@/lib/voice-navigator';

interface VoiceAssistantSheetProps {
  visible: boolean;
  onClose: () => void;
  router: { push: (route: any) => void; back?: () => void };
  isOffline?: boolean;
  setMode?: (mode: 'online' | 'offline') => Promise<void>;
  initialQuery?: string;
}

export function VoiceAssistantSheet({
  visible,
  onClose,
  router,
  isOffline = false,
  setMode,
  initialQuery,
}: VoiceAssistantSheetProps) {
  const colors = useColors();
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState('');
  const [aiSpeech, setAiSpeech] = useState('');
  const [manualInput, setManualInput] = useState('');
  const stopFnRef = useRef<(() => Promise<string | null>) | null>(null);
  const inputRef = useRef<TextInput>(null);
  const autoStopTimeoutRef = useRef<any>(null);

  // Greeting and auto-listen on assistant open
  useEffect(() => {
    let autoListenTimer: any;

    if (visible) {
      setTranscript('');
      setAiSpeech('');
      setStatus('idle');

      const greeting = isOffline
        ? 'Hello! I am G Sense in offline mode. Tell me what you need, like: scan the area, or navigate campus.'
        : 'Hello! I am G Sense. I am listening. Tell me what you need: scan the area, or navigate campus.';
      setAiSpeech(greeting);
      void speakText(greeting, { force: true });

      if (initialQuery) {
        setTranscript(initialQuery);
        void handleExecute(initialQuery);
      } else {
        // Automatically activate listening 1.8s after greeting starts
        autoListenTimer = setTimeout(() => {
          void startListening();
        }, 1800);
      }
    } else {
      cleanupTimers();
      if (stopFnRef.current) {
        void stopFnRef.current();
        stopFnRef.current = null;
      }
    }

    return () => {
      if (autoListenTimer) clearTimeout(autoListenTimer);
      cleanupTimers();
    };
  }, [visible]);

  const cleanupTimers = () => {
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
  };

  const handleExecute = async (commandText: string) => {
    if (!commandText.trim()) return;
    cleanupTimers();
    setStatus('processing');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const { intent } = await executeVoiceCommand({
      command: commandText,
      router,
      isOffline,
      setMode,
    });

    setAiSpeech(intent.suggestedSpeech);
    setStatus('speaking');

    if (intent.targetRoute) {
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  const startListening = async () => {
    try {
      cleanupTimers();
      const result = await startAudioRecording();
      if (!result.ok) {
        setStatus('idle');
        return;
      }
      stopFnRef.current = result.stop;
      setStatus('listening');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Automatically stop and process after 4.5 seconds of listening
      autoStopTimeoutRef.current = setTimeout(async () => {
        await stopAndProcess();
      }, 4500);
    } catch {
      setStatus('idle');
    }
  };

  const stopAndProcess = async () => {
    cleanupTimers();
    const stopFn = stopFnRef.current;
    stopFnRef.current = null;
    if (!stopFn) {
      setStatus('idle');
      return;
    }

    setStatus('processing');
    try {
      const uri = await stopFn();
      if (!uri) {
        setStatus('idle');
        return;
      }

      const base64 = await readAudioFileAsBase64(uri);
      const { transcript: text } = await transcribeAudio(base64, 'audio/mp4');

      if (!text?.trim()) {
        setStatus('idle');
        const fallbackMsg = "I'm listening. Try saying: scan the area, or tap an option below.";
        setAiSpeech(fallbackMsg);
        void speakText(fallbackMsg, { force: true });
        return;
      }

      setTranscript(text);
      void handleExecute(text);
    } catch (err) {
      console.warn('[VoiceAssistantSheet] Processing error:', err);
      setStatus('idle');
      const errorMsg = "Tap an option below like Scan Area or Navigate.";
      setAiSpeech(errorMsg);
      void speakText(errorMsg, { force: true });
    }
  };

  const toggleRecording = async () => {
    if (status === 'listening') {
      await stopAndProcess();
    } else {
      await startListening();
    }
  };

  const quickCommands = [
    { label: '📸 Scan the area', cmd: 'scan the area' },
    { label: '🧭 Navigate through the area', cmd: 'navigate me through the area' },
    { label: '📴 Offline scan', cmd: 'offline scan' },
    { label: '🛗 Where is the elevator?', cmd: 'where is the elevator' },
    { label: '📚 How to reach Library?', cmd: 'how do i reach the library' },
    { label: '🔍 What changed?', cmd: 'what changed' },
    { label: isOffline ? '🌐 Go online' : '📴 Go offline', cmd: isOffline ? 'go online' : 'go offline' },
    { label: '⚙️ Accessibility settings', cmd: 'profile' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Sheet Header */}
          <View style={styles.headerRow}>
            <View style={styles.assistantBadge}>
              <View style={[styles.pulseDot, { backgroundColor: status === 'listening' ? '#EF4444' : '#22C55E' }]} />
              <Text style={[styles.assistantTitle, { color: colors.foreground }]}>Hey G Sense</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close voice assistant"
              onPress={onClose}
              style={[styles.closeBtn, { borderColor: colors.border }]}
            >
              <Feather name="x" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Animated Mic Visualizer */}
            <View style={styles.visualizerContainer}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={status === 'listening' ? 'Listening... Tap to finish early' : 'Start speaking to G Sense'}
                onPress={toggleRecording}
                style={[
                  styles.micCircle,
                  {
                    backgroundColor:
                      status === 'listening'
                        ? '#EF4444'
                        : status === 'speaking'
                        ? colors.primary
                        : colors.secondary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                {status === 'processing' ? (
                  <ActivityIndicator color={colors.primaryForeground} size="large" />
                ) : (
                  <Ionicons
                    name={status === 'listening' ? 'mic' : status === 'speaking' ? 'volume-high' : 'mic-outline'}
                    size={42}
                    color={status === 'listening' || status === 'speaking' ? '#FFFFFF' : colors.primary}
                  />
                )}
              </Pressable>
              <Text style={[styles.statusText, { color: colors.foreground }]}>
                {status === 'listening'
                  ? 'Listening now… Speak your request!'
                  : status === 'processing'
                  ? 'G Sense is thinking…'
                  : status === 'speaking'
                  ? 'G Sense speaking…'
                  : 'Tap microphone to speak'}
              </Text>
            </View>

            {/* Spoken AI Response Message Box */}
            <View style={[styles.speechBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <View style={styles.speechHeader}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
                <Text style={[styles.speechLabel, { color: colors.mutedForeground }]}>G SENSE RESPONSE</Text>
              </View>
              <Text style={[styles.speechText, { color: colors.foreground }]}>
                {aiSpeech || "I'm listening. Say 'scan the area' or 'navigate me'."}
              </Text>
              {transcript ? (
                <Text style={[styles.transcriptText, { color: colors.mutedForeground }]}>
                  Heard: "{transcript}"
                </Text>
              ) : null}
            </View>

            {/* Quick Command Suggestions */}
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              QUICK COMMANDS (TAP OR SPEAK)
            </Text>
            <View style={styles.chipGrid}>
              {quickCommands.map((item) => (
                <Pressable
                  key={item.cmd}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => {
                    setTranscript(item.cmd);
                    void handleExecute(item.cmd);
                  }}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: pressed ? colors.primary : colors.secondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.foreground }]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Direct Text / Keyboard Dictation Fallback */}
            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                ref={inputRef}
                value={manualInput}
                onChangeText={setManualInput}
                onSubmitEditing={() => {
                  if (manualInput.trim()) {
                    setTranscript(manualInput);
                    void handleExecute(manualInput);
                    setManualInput('');
                  }
                }}
                placeholder="Type command or use phone mic..."
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground }]}
                returnKeyType="send"
              />
              <Pressable
                accessibilityLabel="Send command"
                onPress={() => {
                  if (manualInput.trim()) {
                    setTranscript(manualInput);
                    void handleExecute(manualInput);
                    setManualInput('');
                  }
                }}
                style={[styles.sendBtn, { backgroundColor: colors.primary }]}
              >
                <Feather name="arrow-up" size={18} color={colors.primaryForeground} />
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    maxHeight: '88%',
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  assistantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  assistantTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  visualizerContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  micCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  speechBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginVertical: 12,
  },
  speechHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  speechLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  speechText: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  transcriptText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  input: {
    flex: 1,
    height: 46,
    fontSize: 15,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
