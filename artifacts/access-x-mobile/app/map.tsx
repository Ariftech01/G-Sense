import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetEnvironment } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { speakText, stopSpeech, repeatLastSpeech } from '@/lib/speech';

type RouteContext = {
  waypoints: Array<{
    id: string;
    label: string;
    type: string;
    x: number;
    y: number;
    status: 'clear' | 'blocked' | 'caution';
  }>;
  currentPoint: { x: number; y: number };
  headingDegrees: number;
  clockDirections: {
    ahead: string;
    right: string;
    left: string;
    behind: string;
  };
};

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const environment = useGetEnvironment();

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(true);

  const current = environment.data?.current;
  const spatial: RouteContext = (current as { spatialContext?: RouteContext } | undefined)?.spatialContext ?? {
    waypoints: [
      { id: 'wp-origin', label: 'Current Position', type: 'origin', x: 50, y: 85, status: 'clear' },
      { id: 'wp-barrier', label: current?.obstacles[0] || 'Barrier', type: 'barrier', x: 50, y: 45, status: current?.pathStatus === 'blocked' ? 'blocked' : 'clear' },
      { id: 'wp-fountain', label: 'Fountain Turn', type: 'turn', x: 75, y: 55, status: 'clear' },
      { id: 'wp-elevator', label: 'Elevator Lobby', type: 'elevator', x: 75, y: 25, status: 'clear' },
    ],
    currentPoint: { x: 50, y: 85 },
    headingDegrees: 34,
    clockDirections: {
      ahead: current?.obstacles.length ? `${current.obstacles.join(', ')} at 12 o'clock` : 'Path clear ahead',
      right: "Fountain turn point at 3 o'clock",
      left: "West quad lawn at 9 o'clock",
      behind: "North corridor entrance at 6 o'clock",
    },
  };

  const destination = environment.data?.preferences?.goal || current?.locationLabel || 'Campus Destination';
  const recommendation = environment.data?.recommendation || 'Proceed along the main corridor toward your destination.';

  // Comprehensive Spoken Route Guidance on Screen Mount
  useEffect(() => {
    const isBlocked = current?.pathStatus === 'blocked';
    const speechLines = [
      `Campus Navigation Active. Goal: ${destination}.`,
      `Recommended next step: ${recommendation}.`,
      isBlocked
        ? `Caution: Path is currently blocked ahead by ${current.obstacles.join(', ')} at 12 o'clock.`
        : 'Path ahead looks clear at 12 o\'clock.',
      `To your right at 3 o'clock: ${spatial.clockDirections.right}.`,
      `To your left at 9 o'clock: ${spatial.clockDirections.left}.`,
      `Upcoming waypoints: ${spatial.waypoints.map((w) => `${w.label} is ${w.status}`).join('. ')}.`,
      'Tap any step on screen to hear it spoken individually.',
    ];

    const fullBriefing = speechLines.join(' ');
    setIsSpeaking(true);
    void speakText(fullBriefing, { force: true });

    return () => {
      stopSpeech();
    };
  }, [environment.data]);

  const triggerHaptic = () => {
    if (current?.pathStatus === 'blocked') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleReadNextStep = () => {
    const nextIndex = (activeStepIndex + 1) % spatial.waypoints.length;
    setActiveStepIndex(nextIndex);
    const wp = spatial.waypoints[nextIndex];
    const stepSpeech = `Step ${nextIndex + 1} of ${spatial.waypoints.length}: ${wp.label}. Status: ${wp.status}. ` +
      (wp.status === 'blocked' ? 'Warning: Path is blocked here. Prepare to turn toward alternate route.' : 'Path is accessible.');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void speakText(stepSpeech, { force: true });
  };

  const handleRepeatBriefing = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const speech = `Repeating navigation route to ${destination}. Recommended step: ${recommendation}. ` +
      `Ahead at 12 o'clock: ${spatial.clockDirections.ahead}. ` +
      `At 3 o'clock: ${spatial.clockDirections.right}.`;
    void speakText(speech, { force: true });
  };

  const handleToggleMute = () => {
    if (isSpeaking) {
      stopSpeech();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      handleRepeatBriefing();
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to Home"
          onPress={() => {
            stopSpeech();
            router.back();
          }}
          style={styles.back}
        >
          <Feather name="arrow-left" size={21} color={colors.foreground} />
        </Pressable>
        <Feather name="map-pin" size={24} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Campus Navigation</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Goal: {destination} • {current?.locationLabel ?? 'Live campus read'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Trigger haptic orientation alert"
          onPress={triggerHaptic}
          style={[styles.hapticBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="vibrate" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {/* Voice Delivery & Audio Navigation Control Bar */}
      <View style={[styles.voiceBar, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        <View style={styles.voiceBarTop}>
          <View style={styles.voiceBarIndicator}>
            <View style={styles.voiceLiveDot} />
            <Ionicons name="volume-high" size={18} color={colors.primaryForeground} />
            <Text style={[styles.voiceBarTitle, { color: colors.primaryForeground }]}>
              VOICE NAVIGATION ACTIVE
            </Text>
          </View>
          <Text style={[styles.voiceBarSub, { color: `${colors.primaryForeground}E6` }]}>
            All guidance is delivered over voice & screen
          </Text>
        </View>

        <View style={styles.voiceControlRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Repeat voice guidance"
            onPress={handleRepeatBriefing}
            style={[styles.voiceBtn, { backgroundColor: '#FFFFFF' }]}
          >
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={[styles.voiceBtnText, { color: colors.primary }]}>Repeat Route</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Read next navigation step"
            onPress={handleReadNextStep}
            style={[styles.voiceBtn, { backgroundColor: '#FFFFFF' }]}
          >
            <Ionicons name="play-forward" size={16} color={colors.primary} />
            <Text style={[styles.voiceBtnText, { color: colors.primary }]}>Next Step</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSpeaking ? 'Stop voice' : 'Play voice'}
            onPress={handleToggleMute}
            style={[styles.voiceBtn, { backgroundColor: '#FFFFFF' }]}
          >
            <Ionicons name={isSpeaking ? 'pause' : 'volume-high'} size={16} color={colors.primary} />
            <Text style={[styles.voiceBtnText, { color: colors.primary }]}>
              {isSpeaking ? 'Stop' : 'Play'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Recommended Path Card (Tap to Speak) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Recommended step: ${recommendation}. Tap to hear.`}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          void speakText(`Recommended Step: ${recommendation}`, { force: true });
        }}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>RECOMMENDED STEP (TAP TO HEAR)</Text>
          <Ionicons name="volume-medium-outline" size={16} color={colors.primary} />
        </View>
        <Text style={[styles.recommendation, { color: colors.foreground }]}>
          {recommendation}
        </Text>
      </Pressable>

      {/* Clock Face Spatial Directions (Tap any row to Speak) */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
            CLOCK-FACE ORIENTATION (SPOKEN & VISUAL)
          </Text>
          <Ionicons name="compass-outline" size={16} color={colors.mutedForeground} />
        </View>
        <View style={styles.clockGrid}>
          <ClockRow
            label="12 o'clock (Ahead)"
            value={spatial.clockDirections.ahead}
            danger={current?.pathStatus === 'blocked'}
            onPress={() => speakText(`At 12 o'clock ahead: ${spatial.clockDirections.ahead}`, { force: true })}
          />
          <ClockRow
            label="3 o'clock (Right)"
            value={spatial.clockDirections.right}
            onPress={() => speakText(`At 3 o'clock to your right: ${spatial.clockDirections.right}`, { force: true })}
          />
          <ClockRow
            label="9 o'clock (Left)"
            value={spatial.clockDirections.left}
            onPress={() => speakText(`At 9 o'clock to your left: ${spatial.clockDirections.left}`, { force: true })}
          />
          <ClockRow
            label="6 o'clock (Behind)"
            value={spatial.clockDirections.behind}
            onPress={() => speakText(`At 6 o'clock behind you: ${spatial.clockDirections.behind}`, { force: true })}
          />
        </View>
      </View>

      {/* Waypoints List with Active Spoken Highlight */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
            SPATIAL WAYPOINTS (TURN-BY-TURN)
          </Text>
          <Text style={[styles.stepIndicator, { color: colors.primary }]}>
            Step {activeStepIndex + 1} of {spatial.waypoints.length}
          </Text>
        </View>

        {spatial.waypoints.map((wp, index) => {
          const isSelected = index === activeStepIndex;
          return (
            <Pressable
              key={wp.id}
              accessibilityRole="button"
              accessibilityLabel={`Waypoint ${index + 1}: ${wp.label}, status ${wp.status}. Tap to hear.`}
              onPress={() => {
                setActiveStepIndex(index);
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                void speakText(`Step ${index + 1}: ${wp.label}. Status: ${wp.status}.`, { force: true });
              }}
              style={[
                styles.waypointRow,
                isSelected && { backgroundColor: `${colors.primary}18`, borderRadius: 12, paddingHorizontal: 8 },
              ]}
            >
              <Ionicons
                name={wp.status === 'blocked' ? 'alert-circle' : wp.status === 'caution' ? 'warning' : 'checkmark-circle'}
                size={20}
                color={wp.status === 'blocked' ? colors.destructive : wp.status === 'caution' ? colors.accent : colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.wpLabel, { color: colors.foreground, fontWeight: isSelected ? '700' : '500' }]}>
                  {wp.label}
                </Text>
                {isSelected && (
                  <Text style={[styles.wpActiveTag, { color: colors.primary }]}>
                    🔊 Speaking guidance
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.wpStatus,
                  { color: wp.status === 'blocked' ? colors.destructive : colors.mutedForeground },
                ]}
              >
                {wp.status.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function ClockRow({
  label,
  value,
  danger = false,
  onPress,
}: {
  label: string;
  value: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. Tap to hear.`}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onPress) onPress();
      }}
      style={[styles.clockRow, { borderColor: colors.border }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="volume-low-outline" size={14} color={colors.mutedForeground} />
        <Text style={[styles.clockLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </View>
      <Text style={[styles.clockValue, { color: danger ? colors.destructive : colors.foreground }]}>
        {value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  hapticBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  voiceBar: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  voiceBarTop: { gap: 4 },
  voiceBarIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voiceLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  voiceBarTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  voiceBarSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  voiceControlRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  voiceBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  voiceBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  stepIndicator: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  recommendation: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_600SemiBold' },
  clockGrid: { gap: 6, marginTop: 4 },
  clockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  clockLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  clockValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold', maxWidth: '60%', textAlign: 'right' },
  waypointRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  wpLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  wpActiveTag: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  wpStatus: { fontSize: 11, fontFamily: 'Inter_700Bold' },
});
