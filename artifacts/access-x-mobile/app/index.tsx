import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
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
import { useColors } from '@/hooks/useColors';
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
  const environment = useGetEnvironment();
  const demo = useRunDemo();
  const command = useSendAssistantCommand();
  const [dashboard, setDashboard] = useState<EnvironmentDashboard | null>(null);
  const [commandText, setCommandText] = useState('');
  const [showCommand, setShowCommand] = useState(false);
  const [lastResponse, setLastResponse] = useState('');

  useEffect(() => {
    if (environment.data) setDashboard(environment.data);
  }, [environment.data]);

  const state = dashboard ?? fallbackDashboard;
  const confidenceLabel = useMemo(
    () => `${Math.round(state.current.confidence * 100)}% confidence`,
    [state.current.confidence],
  );

  const runDemo = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    demo.mutate(undefined, {
      onSuccess: (next) => setDashboard(next),
      onError: () => Alert.alert('Demo unavailable', 'Please check the connection and try again.'),
    });
  };

  const capture = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access to capture the path ahead.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) {
      Alert.alert('Demo Mode', 'Image captured. Gemini analysis is not configured yet, so this capture is shown as a demo observation.');
      runDemo();
    }
  };

  const sendCommand = () => {
    const value = commandText.trim();
    if (!value) return;
    command.mutate(
      { data: { command: value, source: 'voice' } },
      {
        onSuccess: (response) => {
          setLastResponse(response.response);
          setCommandText('');
        },
        onError: () => setLastResponse('The assistant could not process that request. Try again.'),
      },
    );
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
                <Text style={[styles.brandMarkText, { color: colors.primaryForeground }]}>X</Text>
              </View>
              <Text style={[styles.wordmark, { color: colors.foreground }]}>ACCESS-X</Text>
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

        <View style={[styles.demoBanner, { borderColor: colors.accent, backgroundColor: `${colors.accent}18` }]}>
          <View style={[styles.demoDot, { backgroundColor: colors.accent }]} />
          <Text style={[styles.demoText, { color: colors.accent }]}>DEMO MODE</Text>
          <Text style={[styles.demoCopy, { color: colors.mutedForeground }]}>AI analysis is simulated for this MVP.</Text>
        </View>

        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statusTop}>
            <View>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CURRENT ENVIRONMENT</Text>
              <Text style={[styles.location, { color: colors.foreground }]}>{state.current.locationLabel}</Text>
            </View>
            <View style={[styles.confidencePill, { backgroundColor: colors.secondary }]}>
              <View style={[styles.confidenceDot, { backgroundColor: state.current.confidence > 0.7 ? colors.primary : colors.accent }]} />
              <Text style={[styles.confidenceText, { color: colors.foreground }]}>{confidenceLabel}</Text>
            </View>
          </View>
          <Text style={[styles.statusTitle, { color: colors.foreground }]}>
            {state.current.pathStatus === 'blocked' ? 'Path needs attention' : 'Path looks clear'}
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {state.current.obstacles.length ? `${state.current.obstacles.join(', ')} detected ahead.` : 'No obstacles detected in the current frame.'}
          </Text>
          <View style={styles.chipRow}>
            <View style={[styles.chip, { backgroundColor: colors.secondary }]}><Text style={[styles.chipText, { color: colors.foreground }]}>Elevator {state.current.elevator}</Text></View>
            <View style={[styles.chip, { backgroundColor: colors.secondary }]}><Text style={[styles.chipText, { color: colors.foreground }]}>{state.current.stairs ? 'Stairs detected' : 'No stairs'}</Text></View>
          </View>
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

        <View style={styles.actionGrid}>
          <ActionButton primary label="Scan path" icon={<Ionicons name="camera-outline" size={23} color={colors.primaryForeground} />} onPress={capture} />
          <ActionButton label="Ask ACCESS-X" icon={<Ionicons name="mic-outline" size={23} color={colors.primary} />} onPress={() => setShowCommand((value) => !value)} />
          <ActionButton label="What changed" icon={<Ionicons name="git-compare-outline" size={23} color={colors.primary} />} onPress={() => router.push('/changes')} />
          <ActionButton label="Navigate" icon={<Ionicons name="navigate-outline" size={23} color={colors.primary} />} onPress={() => setLastResponse('Navigation goal: Library. ' + state.recommendation)} />
        </View>

        {showCommand && (
          <View style={[styles.commandBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.commandHint, { color: colors.mutedForeground }]}>Try “What is in front of me?” or “Where is the elevator?”</Text>
            <View style={styles.commandRow}>
              <TextInput
                accessibilityLabel="Assistant command"
                value={commandText}
                onChangeText={setCommandText}
                onSubmitEditing={sendCommand}
                placeholder="Type a command"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.commandInput, { color: colors.foreground, borderColor: colors.border }]}
                returnKeyType="send"
              />
              <Pressable accessibilityRole="button" accessibilityLabel="Send command" onPress={sendCommand} style={[styles.sendButton, { backgroundColor: colors.primary }]}>
                <Feather name="arrow-up" size={18} color={colors.primaryForeground} />
              </Pressable>
            </View>
            {lastResponse ? <Text style={[styles.response, { color: colors.primary }]}>{lastResponse}</Text> : null}
          </View>
        )}

        <Pressable accessibilityRole="button" accessibilityLabel="Run guided demo" onPress={runDemo} style={({ pressed }) => [styles.demoButton, { borderColor: colors.border, opacity: pressed ? 0.68 : 1 }]}>
          <Ionicons name="play-circle-outline" size={20} color={colors.accent} />
          <Text style={[styles.demoButtonText, { color: colors.foreground }]}>{demo.isPending ? 'Running guided demo…' : 'Run guided demo'}</Text>
        </Pressable>

        <Text style={[styles.safety, { color: colors.mutedForeground }]}>{state.safetyMessage}</Text>
        {(environment.isLoading || demo.isPending) && <ActivityIndicator color={colors.primary} style={styles.loader} />}
      </ScrollView>
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
  safety: { textAlign: 'center', fontSize: 11, lineHeight: 16, paddingHorizontal: 10, fontFamily: 'Inter_400Regular' },
  loader: { marginTop: 2 },
});