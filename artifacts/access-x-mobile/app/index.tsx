import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConnectionNotice } from '@/components/ConnectionNotice';
import { VoiceAssistantSheet } from '@/components/VoiceAssistantSheet';
import { useColors } from '@/hooks/useColors';
import { startAudioRecording, requestAudioPermission, readAudioFileAsBase64 } from '@/lib/audio-recorder';
import { transcribeAudio, type LiveDashboard, spokenFromDashboard, uint8ArrayToBase64 } from '@/lib/gsense-api';
import { repeatLastSpeech, speakText, stopSpeech } from '@/lib/speech';
import { OFFLINE_MESSAGE } from '@/lib/api-config';
import { useAIMode, askLlamaOffline } from '@/lib/offline';
import { executeVoiceCommand, parseVoiceIntent } from '@/lib/voice-navigator';
import { useHandsFreeVoice } from '@/lib/hands-free-voice';
import {
  type EnvironmentDashboard,
  useGetEnvironment,
  useRunDemo,
  useSendAssistantCommand,
} from '@workspace/api-client-react';

const fallbackDashboard: EnvironmentDashboard = {
  current: {
    id: 'offline',
    observedAt: new Date().toISOString(),
    pathStatus: 'clear',
    obstacles: [],
    stairs: false,
    elevator: 'unknown',
    detectedObjects: [],
    signs: [],
    confidence: 0,
    locationLabel: 'Waiting for environment',
    ocr: null,
    spatialContext: null,
  },
  previous: null,
  change: {
    detected: false,
    before: 'No earlier observation',
    change: 'No change detected',
    currentState: 'Waiting for an observation',
    impact: 'Capture an image or run the guided demo.',
    recommendation: 'Point your camera toward the route ahead.',
  },
  preferences: {
    avoidStairs: true,
    preferElevator: true,
    avoidCrowds: false,
    responseLength: 'brief',
    accessibilityMode: 'screen-reader',
    goal: 'Library',
  },
  recommendation: 'Point your camera toward the route ahead.',
  demoMode: true,
  safetyMessage: 'Possible obstacle detected. Please verify before proceeding.',
};

function ActionButton({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: primary ? colors.primary : colors.secondary,
          borderColor: primary ? colors.primary : colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      {icon}
      <Text style={[styles.actionLabel, { color: primary ? colors.primaryForeground : colors.foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode, isOffline, setMode, toggleMode } = useAIMode();
  const environment = useGetEnvironment();
  const demo = useRunDemo();
  const command = useSendAssistantCommand();
  const [dashboard, setDashboard] = useState<EnvironmentDashboard | null>(null);
  const [commandText, setCommandText] = useState('');
  const [showCommand, setShowCommand] = useState(false);
  const [lastResponse, setLastResponse] = useState('');
  const [recording, setRecording] = useState(false);
  const [voiceAssistantOpen, setVoiceAssistantOpen] = useState(false);
  const [handsFreeEnabled, setHandsFreeEnabled] = useState(true);
  const micStopFnRef = useRef<(() => Promise<string | null>) | null>(null);
  const hasGreetedRef = useRef(false);
  const live = dashboard as LiveDashboard | null;

  // Continuous Hands-Free Voice Listener (Activated on Home Screen)
  const { isListening, lastHeard, statusMessage } = useHandsFreeVoice({
    enabled: handsFreeEnabled && !voiceAssistantOpen,
    router,
    isOffline,
    setMode,
    onWakeDetected: () => {
      setVoiceAssistantOpen(true);
    },
  });

  useEffect(() => {
    if (environment.data) setDashboard(environment.data);
  }, [environment.data]);

  // Request Microphone Permissions First on Mount and Speak Greeting
  useEffect(() => {
    if (!hasGreetedRef.current) {
      hasGreetedRef.current = true;
      // Prompt for microphone permissions first as requested by user
      void requestAudioPermission().then((granted) => {
        const welcome = granted
          ? 'G Sense is ready. Say Hey G Sense, tap Speak For Me, or use Live Captions.'
          : 'Welcome to G Sense. Please allow microphone access for hands-free voice assistance.';
        void speakText(welcome);
      });
    }
  }, [isOffline]);

  const state = dashboard ?? fallbackDashboard;

  // Guards against presenting placeholder environment data as a real reading.
  // Without this, an unreachable backend would still report "Path looks clear",
  // which is unsafe for a screen-reader user.
  const isEnvironmentUnavailable = !isOffline && environment.isError && dashboard === null;

  const confidenceLabel = useMemo(
    () => `${Math.round(state.current.confidence * 100)}% confidence`,
    [state.current.confidence],
  );

  const runDemo = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    demo.mutate(undefined, {
      onSuccess: (next) => {
        setDashboard(next);
        const spoken = spokenFromDashboard(next as LiveDashboard);
        setLastResponse(spoken);
        void speakText(`Demo mode. ${spoken}`, { force: true });
      },
      onError: () => Alert.alert('Demo unavailable', 'Please check the connection and try again.'),
    });
  };

  const capture = () => {
    router.push('/scan' as never);
  };

  const sendCommand = async (value = commandText.trim(), source: 'voice' | 'text' = 'text') => {
    if (!value) return;

    // Check for voice navigation intents first (e.g. "scan the area", "navigate me", "where is elevator")
    const parsedIntent = parseVoiceIntent(value, isOffline);
    if (parsedIntent.type !== 'unknown' && parsedIntent.type !== 'wake' && parsedIntent.targetRoute) {
      setCommandText('');
      await executeVoiceCommand({
        command: value,
        router,
        isOffline,
        setMode,
      });
      return;
    }

    if (isOffline) {
      // OFFLINE ROUTING: 100% on-device Llama 3.2 local reasoning
      setCommandText('');
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const offlineResult = await askLlamaOffline(value, {
          userProfile: state.preferences,
        });
        setLastResponse(offlineResult.response);
        void speakText(offlineResult.response, { force: true });
      } catch {
        const fallbackMsg = "I don't have enough local information to answer that.";
        setLastResponse(fallbackMsg);
        void speakText(fallbackMsg, { force: true });
      }
      return;
    }

    // ONLINE ROUTING: Remote API
    command.mutate(
      { data: { command: value, source } },
      {
        onSuccess: (response) => {
          setLastResponse(response.response);
          setCommandText('');
          void speakText(response.response, { force: true });
        },
        onError: () => {
          // Automatic offline fallback offer
          Alert.alert(
            'Connection Unavailable',
            'Cloud AI is unavailable. G Sense has an on-device Llama 3.2 offline mode available. Switch to Offline Mode?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Use Offline Mode',
                onPress: async () => {
                  await setMode('offline');
                  void sendCommand(value, source);
                },
              },
            ]
          );
          const message = OFFLINE_MESSAGE;
          setLastResponse(message);
          void speakText(message, { force: true });
        },
      },
    );
  };

  const inputRef = useRef<TextInput>(null);

  const toggleRecording = async () => {
    try {
      if (recording) {
        const stopFn = micStopFnRef.current;
        micStopFnRef.current = null;
        setRecording(false);
        if (!stopFn) return;

        const uri = await stopFn();
        if (!uri) return;

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const base64 = await readAudioFileAsBase64(uri);
        const { transcript } = await transcribeAudio(base64, 'audio/mp4');
        if (transcript && transcript.trim()) {
          setCommandText(transcript);
          void sendCommand(transcript, 'voice');
        } else {
          Alert.alert('No speech heard', 'Please try speaking again.');
        }
        return;
      }

      const result = await startAudioRecording();
      if (!result.ok) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Microphone Needed',
          'Please allow microphone permission to speak to G Sense.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Allow Mic',
              onPress: async () => {
                const granted = await requestAudioPermission();
                if (granted) void toggleRecording();
              },
            },
          ],
        );
        return;
      }

      micStopFnRef.current = result.stop;
      setRecording(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      setRecording(false);
      console.warn('[toggleRecording] Error:', err);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <View style={styles.brandRow}>
              <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
                <Text style={[styles.brandMarkText, { color: colors.primaryForeground }]}>G</Text>
              </View>
              <Text style={[styles.wordmark, { color: colors.foreground }]}>G Sense</Text>
            </View>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>ENVIRONMENT AWARENESS</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open accessibility profile"
            onPress={() => router.push('/profile')}
            style={({ pressed }) => [styles.iconButton, { borderColor: colors.border, opacity: pressed ? 0.65 : 1 }]}
          >
            <Feather name="sliders" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Primary Online / Offline Mode Switcher */}
        <View style={[styles.modeCard, { backgroundColor: isOffline ? '#1E293B' : colors.card, borderColor: isOffline ? '#38BDF8' : colors.border }]}>
          <View style={styles.modeTextGroup}>
            <View style={[styles.modeDot, { backgroundColor: isOffline ? '#38BDF8' : '#22C55E' }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.modeTitle, { color: isOffline ? '#F8FAFC' : colors.foreground }]}>
                {isOffline ? 'OFFLINE MODE (Local AI)' : 'ONLINE MODE (Connected AI)'}
              </Text>
              <Text style={[styles.modeSub, { color: isOffline ? '#94A3B8' : colors.mutedForeground }]}>
                {isOffline ? 'Llama 3.2 • 0 Network Calls • Airplane Mode Ready' : 'Gemini Multimodal Vision via Server'}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isOffline ? 'Switch to Online Mode' : 'Switch to Offline Mode'}
            onPress={toggleMode}
            style={({ pressed }) => [
              styles.modeSwitchBtn,
              {
                backgroundColor: isOffline ? '#38BDF8' : colors.secondary,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text style={[styles.modeSwitchBtnText, { color: isOffline ? '#0F172A' : colors.foreground }]}>
              {isOffline ? 'Go Online' : 'Go Offline'}
            </Text>
          </Pressable>
        </View>

        {isOffline ? (
          <View style={[styles.demoBanner, { borderColor: '#38BDF8', backgroundColor: '#38BDF818' }]}>
            <View style={[styles.demoDot, { backgroundColor: '#38BDF8' }]} />
            <Text style={[styles.demoText, { color: '#38BDF8' }]}>OFFLINE LLaMA 3.2</Text>
            <Text style={[styles.demoCopy, { color: colors.mutedForeground }]}>All reasoning is computed locally on this phone.</Text>
          </View>
        ) : state.demoMode ? (
          <View style={[styles.demoBanner, { borderColor: colors.accent, backgroundColor: `${colors.accent}18` }]}>
            <View style={[styles.demoDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.demoText, { color: colors.accent }]}>DEMO MODE</Text>
            <Text style={[styles.demoCopy, { color: colors.mutedForeground }]}>Simulated environment — not live camera AI.</Text>
          </View>
        ) : (
          <View style={[styles.demoBanner, { borderColor: colors.primary, backgroundColor: `${colors.primary}18` }]}>
            <View style={[styles.demoDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.demoText, { color: colors.primary }]}>LIVE AI</Text>
            <Text style={[styles.demoCopy, { color: colors.mutedForeground }]}>Gemini vision via the G Sense backend.</Text>
          </View>
        )}

        {live?.aiConfigured === false && !isOffline && (
          <View style={[styles.demoBanner, { borderColor: colors.destructive, backgroundColor: `${colors.destructive}14` }]}>
            <Feather name="key" size={14} color={colors.destructive} />
            <Text style={[styles.demoCopy, { color: colors.foreground }]}>GEMINI_API_KEY is missing on the backend. Live analysis will not be faked.</Text>
          </View>
        )}

        <ConnectionNotice visible={environment.isError && !isOffline} />

        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statusTop}>
            <View>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                {isOffline ? 'LOCAL ENVIRONMENT' : 'CURRENT ENVIRONMENT'}
              </Text>
              <Text style={[styles.location, { color: colors.foreground }]}>
                {isOffline ? 'On-Device Spatial Engine' : state.current.locationLabel}
              </Text>
            </View>
            <View style={[styles.confidencePill, { backgroundColor: colors.secondary }]}>
              <View style={[styles.confidenceDot, { backgroundColor: isOffline ? '#38BDF8' : (state.current.confidence > 0.7 ? colors.primary : colors.accent) }]} />
              <Text style={[styles.confidenceText, { color: colors.foreground }]}>
                {isOffline ? 'Offline Llama 3.2' : confidenceLabel}
              </Text>
            </View>
          </View>
          <Text style={[styles.statusTitle, { color: colors.foreground }]}>
            {isOffline
              ? 'Offline Mode Active'
              : isEnvironmentUnavailable
              ? 'Environment data unavailable'
              : state.current.pathStatus === 'blocked'
                ? 'Path needs attention'
                : 'Path looks clear'}
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {isOffline
              ? 'Local on-device reasoning engine is active. Tap Offline Scan to examine your path or Ask G Sense below.'
              : isEnvironmentUnavailable
              ? 'Reconnect to the G Sense service to analyse the route ahead.'
              : live?.spokenSummary ||
                (state.current.obstacles.length
                  ? `${state.current.obstacles.join(', ')} affecting the path ahead.`
                  : 'Scan the environment to identify obstacles, signs, and path impact.')}
          </Text>
          {!isEnvironmentUnavailable && (
            <View style={styles.chipRow}>
              <View style={[styles.chip, { backgroundColor: colors.secondary }]}><Text style={[styles.chipText, { color: colors.foreground }]}>Elevator {state.current.elevator}</Text></View>
              <View style={[styles.chip, { backgroundColor: colors.secondary }]}><Text style={[styles.chipText, { color: colors.foreground }]}>{state.current.stairs ? 'Stairs detected' : 'No stairs'}</Text></View>
            </View>
          )}
        </View>

        {state.change.detected && (
          <View style={[styles.changeCard, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
            <View style={styles.changeHeader}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.accentForeground} />
              <Text style={[styles.changeLabel, { color: colors.accentForeground }]}>CHANGE DETECTED</Text>
            </View>
            <Text style={[styles.changeTitle, { color: colors.accentForeground }]}>{state.change.change}</Text>
            <Text style={[styles.changeCopy, { color: `${colors.accentForeground}B8` }]}>{state.change.impact}</Text>
          </View>
        )}

        <View style={[styles.recommendation, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
          <View style={[styles.recommendationIcon, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons name="sign-direction" size={21} color={colors.primaryForeground} />
          </View>
          <View style={styles.recommendationText}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NEXT BEST STEP</Text>
            <Text style={[styles.recommendationCopy, { color: colors.foreground }]}>{state.recommendation}</Text>
          </View>
        </View>

        {state.current.ocr && (
          <View style={[styles.ocrCard, { borderColor: colors.primary, backgroundColor: `${colors.primary}12` }]}>
            <View style={styles.ocrHeader}>
              <Ionicons name="scan-outline" size={20} color={colors.primary} />
              <View style={styles.ocrHeaderText}>
                <Text style={[styles.sectionLabel, { color: colors.primary }]}>
                  {state.current.ocr.demoMode ? 'DEMO OCR' : 'TEXT READ'}
                </Text>
                <Text style={[styles.ocrType, { color: colors.foreground }]}>
                  {state.current.ocr.documentType === 'document' ? 'Document' : state.current.ocr.documentType === 'sign' ? 'Sign' : 'Image text'}
                </Text>
              </View>
              <Text style={[styles.ocrConfidence, { color: colors.mutedForeground }]}>
                {Math.round(state.current.ocr.confidence * 100)}%
              </Text>
            </View>
            <Text style={[styles.ocrText, { color: colors.foreground }]}>
              {state.current.ocr.text || 'No readable text found.'}
            </Text>
            <Text style={[styles.ocrSafety, { color: colors.mutedForeground }]}>{state.current.ocr.safetyMessage}</Text>
          </View>
        )}

        {/* "Hey G Sense" Accessible Voice Assistant Hero Banner */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Hey G Sense Voice Assistant. Status: ${statusMessage}. Tap to activate voice assistant or speak directly.`}
          accessibilityHint="Voice activation is live. Speak commands like scan the area or navigate me."
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setVoiceAssistantOpen(true);
          }}
          style={({ pressed }) => [
            styles.voiceAssistantBanner,
            {
              backgroundColor: isOffline ? '#1E293B' : colors.primary,
              borderColor: isOffline ? '#38BDF8' : colors.primary,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          <View style={styles.voiceAssistantLeft}>
            <View style={[styles.voiceMicBadge, { backgroundColor: isOffline ? '#38BDF8' : '#FFFFFF' }]}>
              <Ionicons
                name={isListening ? 'mic' : 'mic-outline'}
                size={22}
                color={isOffline ? '#0F172A' : (isListening ? '#EF4444' : colors.primary)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.voiceLiveDotSmall, { backgroundColor: isListening ? '#22C55E' : '#94A3B8' }]} />
                <Text style={[styles.voiceBannerTitle, { color: isOffline ? '#F8FAFC' : colors.primaryForeground }]}>
                  🎙️ "Hey G Sense" Voice Assistant
                </Text>
              </View>
              <Text style={[styles.voiceBannerSub, { color: isOffline ? '#94A3B8' : `${colors.primaryForeground}E6` }]}>
                {lastHeard
                  ? `Heard: "${lastHeard}"`
                  : isListening
                  ? 'Voice Active: Say "Hey G Sense", "Scan", or "Navigate"'
                  : 'Voice Assistant Ready • Tap to speak'}
              </Text>
            </View>
          </View>
          <Feather
            name="chevron-right"
            size={22}
            color={isOffline ? '#38BDF8' : colors.primaryForeground}
          />
        </Pressable>

        <View style={styles.actionGrid}>
          <ActionButton
            primary={!isOffline}
            label="Scan environment"
            icon={<Ionicons name="camera-outline" size={23} color={!isOffline ? colors.primaryForeground : colors.primary} />}
            onPress={capture}
          />
          <ActionButton
            primary={isOffline}
            label="Offline Scan"
            icon={<MaterialCommunityIcons name="camera-iris" size={23} color={isOffline ? colors.primaryForeground : '#38BDF8'} />}
            onPress={() => router.push('/offline-scan')}
          />
          <ActionButton
            label="Ask G Sense"
            icon={<Ionicons name="mic-outline" size={23} color={colors.primary} />}
            onPress={() => setVoiceAssistantOpen(true)}
          />
          <ActionButton
            label="Speak For Me"
            icon={<Ionicons name="volume-high-outline" size={23} color={colors.primary} />}
            onPress={() => router.push('/communicator')}
          />
          <ActionButton
            label="Live Captions"
            icon={<MaterialCommunityIcons name="ear-hearing" size={23} color={colors.primary} />}
            onPress={() => router.push('/communicator')}
          />
          <ActionButton label="What changed" icon={<Ionicons name="git-compare-outline" size={23} color={colors.primary} />} onPress={() => router.push('/changes')} />
          <ActionButton label="Navigate" icon={<Ionicons name="navigate-outline" size={23} color={colors.primary} />} onPress={() => {
            const spoken = `Navigation goal: ${state.preferences.goal}. ${state.recommendation}`;
            setLastResponse(spoken);
            void speakText(spoken, { force: true });
            router.push('/map');
          }} />
        </View>

        {showCommand && (
          <View style={[styles.commandBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.commandHint, { color: colors.mutedForeground }]}>
              Ask by voice or tap a quick question:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {[
                'Where is the elevator?',
                'Is my path clear?',
                'What is in front of me?',
                'Read visible signs',
                'How do I reach the Library?',
              ].map((query) => (
                <Pressable
                  key={query}
                  accessibilityRole="button"
                  accessibilityLabel={`Ask: ${query}`}
                  onPress={() => {
                    setCommandText(query);
                    sendCommand(query, 'voice');
                  }}
                  style={({ pressed }) => [
                    styles.chipButton,
                    {
                      backgroundColor: pressed ? colors.primary : colors.secondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.foreground }]}>
                    🎙️ {query}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.commandRow}>
              <TextInput
                ref={inputRef}
                accessibilityLabel="Assistant command"
                value={commandText}
                onChangeText={setCommandText}
                onSubmitEditing={() => sendCommand()}
                placeholder="Type or speak using keyboard mic..."
                placeholderTextColor={colors.mutedForeground}
                style={[styles.commandInput, { color: colors.foreground, borderColor: colors.border }]}
                returnKeyType="send"
              />
              <Pressable accessibilityRole="button" accessibilityLabel={recording ? 'Stop recording' : 'Record voice'} onPress={() => void toggleRecording()} style={[styles.sendButton, { backgroundColor: recording ? colors.accent : colors.secondary }]}>
                <Ionicons name={recording ? 'stop' : 'mic'} size={18} color={recording ? colors.accentForeground : colors.primary} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Send command" onPress={() => sendCommand()} style={[styles.sendButton, { backgroundColor: colors.primary }]}>
                <Feather name="arrow-up" size={18} color={colors.primaryForeground} />
              </Pressable>
            </View>
            {lastResponse ? <Text style={[styles.response, { color: colors.primary }]}>{lastResponse}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => speakText(lastResponse || spokenFromDashboard(state as LiveDashboard), { force: true })} style={[styles.demoButton, { flex: 1 }]}>
                <Ionicons name="volume-high-outline" size={18} color={colors.primary} />
                <Text style={[styles.demoButtonText, { color: colors.foreground }]}>Play</Text>
              </Pressable>
              <Pressable onPress={stopSpeech} style={[styles.demoButton, { flex: 1 }]}>
                <Ionicons name="pause-outline" size={18} color={colors.primary} />
                <Text style={[styles.demoButtonText, { color: colors.foreground }]}>Stop</Text>
              </Pressable>
              <Pressable onPress={repeatLastSpeech} style={[styles.demoButton, { flex: 1 }]}>
                <Ionicons name="refresh-outline" size={18} color={colors.primary} />
                <Text style={[styles.demoButtonText, { color: colors.foreground }]}>Repeat</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Pressable accessibilityRole="button" accessibilityLabel="Run guided demo" onPress={runDemo} style={({ pressed }) => [styles.demoButton, { borderColor: colors.border, opacity: pressed ? 0.68 : 1 }]}>
          <Ionicons name="play-circle-outline" size={20} color={colors.accent} />
          <Text style={[styles.demoButtonText, { color: colors.foreground }]}>{demo.isPending ? 'Running guided demo…' : 'Run guided demo'}</Text>
        </Pressable>

        <Text style={[styles.safety, { color: colors.mutedForeground }]}>{state.safetyMessage}</Text>
        {(environment.isLoading || demo.isPending || command.isPending) && <ActivityIndicator color={colors.primary} style={styles.loader} />}
      </ScrollView>

      {/* Accessible Voice Assistant Sheet */}
      <VoiceAssistantSheet
        visible={voiceAssistantOpen}
        onClose={() => setVoiceAssistantOpen(false)}
        router={router}
        isOffline={isOffline}
        setMode={setMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  wordmark: { fontSize: 18, letterSpacing: 1.2, fontFamily: 'Inter_700Bold' },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, marginTop: 5, fontFamily: 'Inter_600SemiBold' },
  iconButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  demoBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
  demoDot: { width: 7, height: 7, borderRadius: 4 },
  demoText: { fontSize: 10, letterSpacing: 1.1, fontFamily: 'Inter_700Bold' },
  demoCopy: { fontSize: 11, flex: 1, fontFamily: 'Inter_400Regular' },
  statusCard: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 10 },
  statusTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sectionLabel: { fontSize: 10, letterSpacing: 1.2, fontFamily: 'Inter_700Bold' },
  location: { fontSize: 14, marginTop: 4, fontFamily: 'Inter_600SemiBold' },
  confidencePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 20 },
  confidenceDot: { width: 7, height: 7, borderRadius: 4 },
  confidenceText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  statusTitle: { fontSize: 25, lineHeight: 31, marginTop: 7, fontFamily: 'Inter_700Bold' },
  body: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 5, flexWrap: 'wrap' },
  chip: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10 },
  chipText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  changeCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 8 },
  changeHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  changeLabel: { fontSize: 10, letterSpacing: 1.2, fontFamily: 'Inter_700Bold' },
  changeTitle: { fontSize: 17, lineHeight: 22, fontFamily: 'Inter_700Bold' },
  changeCopy: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_500Medium' },
  recommendation: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' },
  recommendationIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  recommendationText: { flex: 1, gap: 4 },
  recommendationCopy: { fontSize: 14, lineHeight: 19, fontFamily: 'Inter_600SemiBold' },
  ocrCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  ocrHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  ocrHeaderText: { flex: 1, gap: 3 },
  ocrType: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  ocrConfidence: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  ocrText: { fontSize: 18, lineHeight: 25, fontFamily: 'Inter_700Bold' },
  ocrSafety: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionButton: { width: '48%', minHeight: 64, borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  actionLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
  commandBox: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 10 },
  commandHint: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  commandRow: { flexDirection: 'row', gap: 8 },
  commandInput: { flex: 1, minHeight: 45, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14, fontFamily: 'Inter_400Regular' },
  sendButton: { width: 45, height: 45, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  response: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_600SemiBold' },
  demoButton: { minHeight: 50, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  demoButtonText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  chipButton: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1 },
  modeCard: { borderWidth: 1.5, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modeTextGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  modeDot: { width: 10, height: 10, borderRadius: 5 },
  modeTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  modeSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  modeSwitchBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12 },
  modeSwitchBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  voiceAssistantBanner: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  voiceAssistantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  voiceMicBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceBannerTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  voiceBannerSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  voiceLiveDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  safety: { textAlign: 'center', fontSize: 11, lineHeight: 16, paddingHorizontal: 10, fontFamily: 'Inter_400Regular' },
  loader: { marginTop: 2 },
});
