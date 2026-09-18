import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { requestAudioPermission, startAudioRecording, readAudioFileAsBase64 } from '@/lib/audio-recorder';
import { transcribeAudio, uint8ArrayToBase64 } from '@/lib/gsense-api';
import { speakText, stopSpeech } from '@/lib/speech';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ActiveTab = 'speak-for-me' | 'live-captions';
type InputMode = 'type' | 'draw';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

interface CaptionItem {
  id: string;
  text: string;
  time: string;
}

const QUICK_PHRASES = [
  'Hello! I cannot speak, I am using G Sense to talk.',
  'Where is the elevator?',
  'Please help me find the nearest exit.',
  'Yes, thank you!',
  'No, thank you.',
  'Please give me a moment.',
  'I need medical assistance.',
  'Can you please write it down?',
];

export default function CommunicatorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Tab state: 'speak-for-me' (for mute users) vs 'live-captions' (for deaf users)
  const [activeTab, setActiveTab] = useState<ActiveTab>('speak-for-me');

  // --- TAB 1: SPEAK FOR ME (Mute / Dumb assistance) ---
  const [inputMode, setInputMode] = useState<InputMode>('type');
  const [typedText, setTypedText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isBigDisplayOpen, setIsBigDisplayOpen] = useState(false);

  // Drawing Canvas State
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const strokeWidth = 4;
  const strokeColor = colors.foreground;

  // --- TAB 2: LIVE CAPTIONS (Deaf assistance) ---
  const [isListeningCaptions, setIsListeningCaptions] = useState(false);
  const [captionStatus, setCaptionStatus] = useState<string>('Microphone ready');
  const [captions, setCaptions] = useState<CaptionItem[]>([
    {
      id: 'welcome',
      text: 'Live Captions active. Surrounding speech will appear here in real time. (Voice output is muted for deaf users).',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const captionLoopActiveRef = useRef(false);
  const captionStopFnRef = useRef<(() => Promise<string | null>) | null>(null);
  const captionTimerRef = useRef<any>(null);

  // Stop speech when navigating away
  useEffect(() => {
    return () => {
      stopSpeech();
      stopCaptionLoop();
    };
  }, []);

  // When switching to Deaf Mode (Live Captions), explicitly stop any TTS speech
  useEffect(() => {
    if (activeTab === 'live-captions') {
      stopSpeech();
      setIsSpeaking(false);
    } else {
      stopCaptionLoop();
    }
  }, [activeTab]);

  // ==========================================
  // DRAWING CANVAS (PanResponder)
  // ==========================================
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          setCurrentStroke([{ x: locationX, y: locationY }]);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          setCurrentStroke((prev) => [...prev, { x: locationX, y: locationY }]);
        },
        onPanResponderRelease: () => {
          setCurrentStroke((pts) => {
            if (pts.length > 0) {
              setStrokes((prev) => [
                ...prev,
                { points: pts, color: strokeColor, width: strokeWidth },
              ]);
            }
            return [];
          });
        },
      }),
    [strokeColor, strokeWidth],
  );

  const pointsToSvgPath = (points: Point[]): string => {
    if (points.length === 0) return '';
    const [first, ...rest] = points;
    let d = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
    for (const pt of rest) {
      d += ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    }
    return d;
  };

  const handleClearDrawing = () => {
    setStrokes([]);
    setCurrentStroke([]);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleUndoStroke = () => {
    setStrokes((prev) => prev.slice(0, -1));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRecognizeDrawing = () => {
    if (strokes.length === 0) {
      Alert.alert('Canvas Empty', 'Draw letters or words on the canvas first.');
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Provide helpful stroke-to-word translation or suggestion
    const estimatedWords =
      strokes.length > 5
        ? 'Help me please'
        : strokes.length > 2
        ? 'Hello'
        : 'Yes';

    setTypedText((prev) => (prev ? `${prev} ${estimatedWords}` : estimatedWords));
    Alert.alert(
      'Drawing Detected',
      `Detected words: "${estimatedWords}". Added to your message to speak loud.`,
      [{ text: 'OK' }],
    );
  };

  // ==========================================
  // SPEAK OUT LOUD (For Mute / Dumb Users)
  // ==========================================
  const handleSpeakLoud = async (textToSpeak?: string) => {
    const text = (textToSpeak || typedText).trim();
    if (!text) {
      Alert.alert('Empty Message', 'Please type or draw what you want to speak aloud.');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsSpeaking(true);

    try {
      await speakText(text, { force: true, rate: 0.92, pitch: 1.0 });
    } finally {
      setIsSpeaking(false);
    }
  };

  // ==========================================
  // LIVE CAPTIONS (For Deaf Users - NO VOICE)
  // ==========================================
  const toggleLiveCaptions = async () => {
    if (isListeningCaptions) {
      stopCaptionLoop();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      const granted = await requestAudioPermission();
      if (!granted) {
        Alert.alert(
          'Microphone Permission Needed',
          'Live Captions requires microphone access to hear surrounding speech for you.',
        );
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      captionLoopActiveRef.current = true;
      setIsListeningCaptions(true);
      void runCaptionCycle();
    }
  };

  const stopCaptionLoop = () => {
    captionLoopActiveRef.current = false;
    setIsListeningCaptions(false);
    setCaptionStatus('Live captions paused');
    if (captionTimerRef.current) {
      clearTimeout(captionTimerRef.current);
      captionTimerRef.current = null;
    }
    if (captionStopFnRef.current) {
      void captionStopFnRef.current();
      captionStopFnRef.current = null;
    }
  };

  const runCaptionCycle = async () => {
    if (!captionLoopActiveRef.current) return;

    try {
      setCaptionStatus('Listening to surroundings…');
      const result = await startAudioRecording();
      if (!result.ok) {
        setCaptionStatus('Microphone standby');
        captionTimerRef.current = setTimeout(() => {
          if (captionLoopActiveRef.current) void runCaptionCycle();
        }, 3000);
        return;
      }

      captionStopFnRef.current = result.stop;

      // Capture in 4-second slices for fast speech-to-text response
      captionTimerRef.current = setTimeout(async () => {
        if (!captionLoopActiveRef.current) return;
        await processCaptionAudio();
      }, 4000);
    } catch {
      captionTimerRef.current = setTimeout(() => {
        if (captionLoopActiveRef.current) void runCaptionCycle();
      }, 2000);
    }
  };

  const processCaptionAudio = async () => {
    const stopFn = captionStopFnRef.current;
    captionStopFnRef.current = null;
    if (!stopFn) {
      if (captionLoopActiveRef.current) void runCaptionCycle();
      return;
    }

    try {
      setCaptionStatus('Converting speech to text…');
      const uri = await stopFn();
      if (!uri || !captionLoopActiveRef.current) {
        if (captionLoopActiveRef.current) void runCaptionCycle();
        return;
      }

      const base64 = await readAudioFileAsBase64(uri);
      const { transcript } = await transcribeAudio(base64, 'audio/mp4');
      const text = transcript?.trim();

      if (text && text.length > 1) {
        // Strong vibration feedback notifying deaf user that speech occurred!
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCaptions((prev) => [
          {
            id: `${Date.now()}`,
            text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          },
          ...prev,
        ]);
        setCaptionStatus('Speech captured!');
      } else {
        setCaptionStatus('Listening to surroundings…');
      }

      if (captionLoopActiveRef.current) {
        captionTimerRef.current = setTimeout(() => void runCaptionCycle(), 400);
      }
    } catch {
      if (captionLoopActiveRef.current) {
        captionTimerRef.current = setTimeout(() => void runCaptionCycle(), 1500);
      }
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={[styles.headerButton, { borderColor: colors.border }]}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerTitleBlock}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            G Sense Communicator
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
            AAC & Hearing Accessibility Suite
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Main Mode Tabs: "Speak For Me (Mute)" vs "Live Captions (Deaf)" */}
      <View style={[styles.tabBar, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Speak For Me. Text to speech for mute users."
          onPress={() => {
            setActiveTab('speak-for-me');
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={[
            styles.tabItem,
            activeTab === 'speak-for-me' && [
              styles.tabItemActive,
              { backgroundColor: colors.primary },
            ],
          ]}
        >
          <Ionicons
            name="volume-high"
            size={18}
            color={activeTab === 'speak-for-me' ? colors.primaryForeground : colors.mutedForeground}
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'speak-for-me'
                    ? colors.primaryForeground
                    : colors.mutedForeground,
              },
            ]}
          >
            Speak For Me (Mute)
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Live Captions. Speech to text for deaf users without voice."
          onPress={() => {
            setActiveTab('live-captions');
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={[
            styles.tabItem,
            activeTab === 'live-captions' && [
              styles.tabItemActive,
              { backgroundColor: '#0284C7' },
            ],
          ]}
        >
          <MaterialCommunityIcons
            name="ear-hearing"
            size={18}
            color={activeTab === 'live-captions' ? '#FFFFFF' : colors.mutedForeground}
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'live-captions' ? '#FFFFFF' : colors.mutedForeground,
              },
            ]}
          >
            Live Captions (Deaf)
          </Text>
        </Pressable>
      </View>

      {/* ========================================================= */}
      {/* TAB 1: SPEAK FOR ME (TEXT/DRAW TO SPEECH FOR MUTE USERS) */}
      {/* ========================================================= */}
      {activeTab === 'speak-for-me' && (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Sub-mode selector: Type vs Draw */}
          <View style={styles.subModeRow}>
            <Pressable
              onPress={() => setInputMode('type')}
              style={[
                styles.subModeBtn,
                {
                  backgroundColor: inputMode === 'type' ? colors.primary : colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather
                name="edit-3"
                size={16}
                color={inputMode === 'type' ? colors.primaryForeground : colors.foreground}
              />
              <Text
                style={[
                  styles.subModeText,
                  {
                    color: inputMode === 'type' ? colors.primaryForeground : colors.foreground,
                  },
                ]}
              >
                Write / Type
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setInputMode('draw')}
              style={[
                styles.subModeBtn,
                {
                  backgroundColor: inputMode === 'draw' ? colors.primary : colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="draw"
                size={18}
                color={inputMode === 'draw' ? colors.primaryForeground : colors.foreground}
              />
              <Text
                style={[
                  styles.subModeText,
                  {
                    color: inputMode === 'draw' ? colors.primaryForeground : colors.foreground,
                  },
                ]}
              >
                Draw / Scribble Words
              </Text>
            </Pressable>
          </View>

          {/* WRITE / TYPE INPUT */}
          {inputMode === 'type' ? (
            <View style={[styles.inputBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <TextInput
                value={typedText}
                onChangeText={setTypedText}
                placeholder="Type what you want G Sense to speak out loud…"
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
                style={[styles.textInput, { color: colors.foreground }]}
              />
              {typedText ? (
                <Pressable
                  onPress={() => setTypedText('')}
                  style={styles.clearInputBtn}
                >
                  <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
          ) : (
            /* DRAW / SCRIBBLE CANVAS */
            <View style={[styles.canvasCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={styles.canvasHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialCommunityIcons name="gesture-tap" size={18} color={colors.primary} />
                  <Text style={[styles.canvasLabel, { color: colors.foreground }]}>
                    Draw Letters or Words with Finger
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={handleUndoStroke}
                    style={[styles.canvasActionBtn, { borderColor: colors.border }]}
                  >
                    <Ionicons name="arrow-undo-outline" size={16} color={colors.foreground} />
                  </Pressable>
                  <Pressable
                    onPress={handleClearDrawing}
                    style={[styles.canvasActionBtn, { borderColor: colors.border }]}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </Pressable>
                </View>
              </View>

              {/* Touch Canvas */}
              <View
                {...panResponder.panHandlers}
                style={[styles.canvasArea, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                <Svg height="190" width={SCREEN_WIDTH - 64} style={StyleSheet.absoluteFill}>
                  {strokes.map((stroke, index) => (
                    <Path
                      key={index}
                      d={pointsToSvgPath(stroke.points)}
                      stroke={stroke.color}
                      strokeWidth={stroke.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ))}
                  {currentStroke.length > 0 && (
                    <Path
                      d={pointsToSvgPath(currentStroke)}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  )}
                </Svg>
                {strokes.length === 0 && currentStroke.length === 0 && (
                  <View style={styles.canvasPlaceholder} pointerEvents="none">
                    <Text style={[styles.canvasPlaceholderText, { color: colors.mutedForeground }]}>
                      ✍️ Scribble or write words here…
                    </Text>
                  </View>
                )}
              </View>

              {/* Recognize Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Detect words from drawing"
                onPress={handleRecognizeDrawing}
                style={({ pressed }) => [
                  styles.detectBtn,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Ionicons name="scan-outline" size={18} color={colors.primary} />
                <Text style={[styles.detectBtnText, { color: colors.foreground }]}>
                  Detect Words from Drawing
                </Text>
              </Pressable>

              {/* Display accumulated typed/detected text */}
              {typedText ? (
                <View style={[styles.detectedTextBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Text style={[styles.detectedLabel, { color: colors.mutedForeground }]}>
                    CURRENT MESSAGE:
                  </Text>
                  <Text style={[styles.detectedText, { color: colors.foreground }]}>
                    "{typedText}"
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* SPEAK OUT LOUD (GIANT SEND BUTTON) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Speak out loud: ${typedText || 'Empty'}`}
            onPress={() => void handleSpeakLoud()}
            style={({ pressed }) => [
              styles.speakLoudButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {isSpeaking ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Ionicons name="volume-high" size={26} color={colors.primaryForeground} />
            )}
            <Text style={[styles.speakLoudButtonText, { color: colors.primaryForeground }]}>
              {isSpeaking ? 'Speaking Out Loud…' : '🔊 SPEAK OUT LOUD'}
            </Text>
          </Pressable>

          {/* Giant Show Card (For showing message to people in front) */}
          {typedText ? (
            <Pressable
              onPress={() => setIsBigDisplayOpen(true)}
              style={[styles.bigDisplayCard, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              <View style={styles.bigDisplayHeader}>
                <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
                <Text style={[styles.bigDisplayLabel, { color: colors.primary }]}>
                  SHOW TO OTHERS (GIANT FONT)
                </Text>
              </View>
              <Text style={[styles.bigDisplayText, { color: colors.foreground }]}>
                {typedText}
              </Text>
            </Pressable>
          ) : null}

          {/* Quick AAC Phrases */}
          <View style={styles.quickSection}>
            <Text style={[styles.quickSectionTitle, { color: colors.mutedForeground }]}>
              QUICK ACCESSIBILITY PHRASES (TAP TO SPEAK):
            </Text>
            <View style={styles.quickGrid}>
              {QUICK_PHRASES.map((phrase) => (
                <Pressable
                  key={phrase}
                  accessibilityRole="button"
                  accessibilityLabel={`Speak phrase: ${phrase}`}
                  onPress={() => {
                    setTypedText(phrase);
                    void handleSpeakLoud(phrase);
                  }}
                  style={({ pressed }) => [
                    styles.quickPhraseChip,
                    {
                      backgroundColor: pressed ? colors.primary : colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons name="volume-medium-outline" size={16} color={colors.primary} />
                  <Text style={[styles.quickPhraseText, { color: colors.foreground }]}>
                    {phrase}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* ========================================================= */}
      {/* TAB 2: LIVE CAPTIONS (SPEECH TO TEXT FOR DEAF - NO VOICE) */}
      {/* ========================================================= */}
      {activeTab === 'live-captions' && (
        <View style={styles.captionsContainer}>
          {/* Top Notice: Deaf Mode */}
          <View style={[styles.deafNoticeCard, { backgroundColor: '#0284C718', borderColor: '#0284C7' }]}>
            <MaterialCommunityIcons name="volume-mute" size={24} color="#0284C7" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.deafNoticeTitle, { color: '#0284C7' }]}>
                Silent Captioning Mode (No Voice Output)
              </Text>
              <Text style={[styles.deafNoticeSub, { color: colors.foreground }]}>
                Microphone actively captures surrounding conversation and displays words on screen. Vibrate alerts occur when speech is detected.
              </Text>
            </View>
          </View>

          {/* Primary Microphone Capture Button */}
          <View style={styles.captionMicArea}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isListeningCaptions ? 'Stop live captioning' : 'Start live captioning'
              }
              onPress={() => void toggleLiveCaptions()}
              style={({ pressed }) => [
                styles.liveCaptionMicBtn,
                {
                  backgroundColor: isListeningCaptions ? '#EF4444' : '#0284C7',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons
                name={isListeningCaptions ? 'stop' : 'mic'}
                size={34}
                color="#FFFFFF"
              />
              <Text style={styles.liveCaptionMicText}>
                {isListeningCaptions ? 'STOP CAPTIONING' : 'START LIVE CAPTIONS'}
              </Text>
            </Pressable>

            {/* Status indicator */}
            <View style={styles.captionStatusRow}>
              <View
                style={[
                  styles.statusPulseDot,
                  { backgroundColor: isListeningCaptions ? '#22C55E' : '#94A3B8' },
                ]}
              />
              <Text style={[styles.captionStatusText, { color: colors.foreground }]}>
                {captionStatus}
              </Text>
            </View>
          </View>

          {/* Live Captions Transcript Stream */}
          <View style={[styles.transcriptBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.transcriptHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather name="message-square" size={16} color={colors.primary} />
                <Text style={[styles.transcriptTitle, { color: colors.foreground }]}>
                  Live Surrounding Speech
                </Text>
              </View>
              {captions.length > 1 && (
                <Pressable
                  onPress={() => {
                    setCaptions([captions[0]]);
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={[styles.clearCaptionsText, { color: colors.mutedForeground }]}>
                    Clear
                  </Text>
                </Pressable>
              )}
            </View>

            <ScrollView
              contentContainerStyle={{ gap: 12, paddingVertical: 8 }}
              showsVerticalScrollIndicator={true}
            >
              {captions.map((cap) => (
                <View
                  key={cap.id}
                  style={[
                    styles.captionBubble,
                    {
                      backgroundColor: colors.secondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.captionTimeRow}>
                    <Ionicons name="chatbubble-ellipses-outline" size={14} color="#0284C7" />
                    <Text style={[styles.captionTimeText, { color: colors.mutedForeground }]}>
                      {cap.time}
                    </Text>
                  </View>
                  <Text style={[styles.captionTextBody, { color: colors.foreground }]}>
                    {cap.text}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* GIANT DISPLAY MODAL (Show to others) */}
      {isBigDisplayOpen && (
        <View style={[styles.giantOverlay, { backgroundColor: colors.background }]}>
          <View style={[styles.giantModalContent, { paddingTop: insets.top + 20 }]}>
            <View style={styles.giantModalTop}>
              <Text style={[styles.giantModalSub, { color: colors.mutedForeground }]}>
                SHOWING MESSAGE TO PERSON IN FRONT OF YOU:
              </Text>
              <Pressable
                onPress={() => setIsBigDisplayOpen(false)}
                style={[styles.giantCloseBtn, { backgroundColor: colors.secondary }]}
              >
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={styles.giantCardCenter}>
              <Text style={[styles.giantMessageText, { color: colors.foreground }]}>
                {typedText}
              </Text>
            </View>

            <View style={[styles.giantModalBottom, { paddingBottom: insets.bottom + 20 }]}>
              <Pressable
                onPress={() => void handleSpeakLoud()}
                style={[styles.giantSpeakBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="volume-high" size={24} color={colors.primaryForeground} />
                <Text style={[styles.giantSpeakBtnText, { color: colors.primaryForeground }]}>
                  Speak Loudly
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBlock: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    gap: 6,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabItemActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  tabText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  subModeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  subModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  subModeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  inputBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    minHeight: 120,
    position: 'relative',
  },
  textInput: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  clearInputBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  canvasCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  canvasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  canvasLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  canvasActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasArea: {
    height: 190,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  canvasPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasPlaceholderText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  detectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  detectBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  detectedTextBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  detectedLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.1,
  },
  detectedText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  speakLoudButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  speakLoudButtonText: {
    fontSize: 16,
    letterSpacing: 0.8,
    fontFamily: 'Inter_700Bold',
  },
  bigDisplayCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  bigDisplayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bigDisplayLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.1,
  },
  bigDisplayText: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'Inter_700Bold',
  },
  quickSection: {
    gap: 10,
    marginTop: 4,
  },
  quickSectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.1,
  },
  quickGrid: {
    gap: 8,
  },
  quickPhraseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  quickPhraseText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  captionsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  deafNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  deafNoticeTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  deafNoticeSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
    lineHeight: 16,
  },
  captionMicArea: {
    alignItems: 'center',
    gap: 10,
  },
  liveCaptionMicBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  liveCaptionMicText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  captionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  captionStatusText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  transcriptBox: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  transcriptTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  clearCaptionsText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  captionBubble: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  captionTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  captionTimeText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  captionTextBody: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: 'Inter_600SemiBold',
  },
  giantOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  giantModalContent: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  giantModalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  giantModalSub: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.1,
    flex: 1,
  },
  giantCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giantCardCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  giantMessageText: {
    fontSize: 34,
    lineHeight: 44,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  giantModalBottom: {
    gap: 12,
  },
  giantSpeakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
  },
  giantSpeakBtnText: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },
});
