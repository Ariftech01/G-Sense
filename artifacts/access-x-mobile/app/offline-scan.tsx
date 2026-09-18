import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import {
  runLocalPerception,
  reasonOverLocalPerception,
  saveOfflineObservation,
  type LocalPerceptionResult,
  type OfflineLlamaResponse,
  type OfflineChangeResult,
} from '@/lib/offline';
import { speakText, stopSpeech } from '@/lib/speech';

type PermissionKind = 'granted' | 'denied' | 'can_ask_again' | 'permanently_denied' | 'undetermined';

export default function OfflineScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [perception, setPerception] = useState<LocalPerceptionResult | null>(null);
  const [reasoning, setReasoning] = useState<OfflineLlamaResponse | null>(null);
  const [change, setChange] = useState<OfflineChangeResult | null>(null);
  const [assistive, setAssistive] = useState(false);
  const [intervalMs, setIntervalMs] = useState(5000);
  const analyzing = useRef(false);

  const permissionKind: PermissionKind = !permission
    ? 'undetermined'
    : permission.granted
    ? 'granted'
    : permission.canAskAgain
    ? 'can_ask_again'
    : 'permanently_denied';

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const captureAndAnalyze = async (fromMonitor = false) => {
    if (analyzing.current || !cameraRef.current) return;
    analyzing.current = true;
    setBusy(true);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        base64: true,
        skipProcessing: true,
      });

      if (!photo?.base64) {
        return;
      }

      // 1. Run local visual perception (100% on-device, 0 network)
      const localScene = await runLocalPerception(photo.base64);
      setPerception(localScene);

      // 2. Run Llama 3.2 offline accessibility reasoning
      const llamaReasoning = await reasonOverLocalPerception(localScene, {
        avoidStairs: true,
        preferElevator: true,
        goal: 'Library',
      });
      setReasoning(llamaReasoning);

      // 3. Save to offline environmental memory & detect changes
      const { change: detectedChange } = await saveOfflineObservation(localScene, llamaReasoning);
      setChange(detectedChange);

      // 4. Haptic feedback
      if (localScene.pathStatus === 'blocked') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // 5. Speak aloud using local Android TTS
      let spokenMessage = llamaReasoning.spokenSummary;
      if (detectedChange.detected) {
        spokenMessage = `${detectedChange.summary} ${spokenMessage}`;
      }
      await speakText(spokenMessage, { force: !fromMonitor });
    } catch (err) {
      console.warn('[OFFLINE SCAN ERROR]', err);
    } finally {
      analyzing.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!assistive || permissionKind !== 'granted') return undefined;
    const timer = setInterval(() => {
      void captureAndAnalyze(true);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [assistive, intervalMs, permissionKind]);

  if (permissionKind !== 'granted') {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Camera permission needed</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Offline Scan uses your camera for on-device obstacle detection.
        </Text>
        {permissionKind === 'permanently_denied' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openSettings()}
            style={[styles.primary, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>Open Android settings</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => void requestPermission()}
            style={[styles.primary, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>Allow camera</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: '#000' }]}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" mode="picture" />

      <View style={[styles.overlay, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        {/* Header Bar */}
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.roundBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>

          <View style={styles.titleContainer}>
            <Text style={styles.overlayTitle}>Offline Scan</Text>
            <View style={styles.modeBadge}>
              <View style={styles.greenDot} />
              <Text style={styles.modeBadgeText}>LOCAL AI • 0 NETWORK</Text>
            </View>
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel="Stop speech" onPress={stopSpeech} style={styles.roundBtn}>
            <Ionicons name="volume-mute-outline" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Continuous Monitoring Controls */}
        <View style={styles.assistRow}>
          <View style={styles.assistTextGroup}>
            <MaterialCommunityIcons name="radar" size={18} color="#90CAF9" />
            <Text style={styles.assistLabel}>Continuous offline radar</Text>
          </View>
          <Switch value={assistive} onValueChange={setAssistive} />
        </View>

        {assistive && (
          <View style={styles.intervalRow}>
            {[3000, 5000, 8000].map((ms) => (
              <Pressable key={ms} onPress={() => setIntervalMs(ms)} style={[styles.chip, intervalMs === ms && styles.chipOn]}>
                <Text style={styles.chipText}>{ms / 1000}s</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Change Detection Banner */}
        {change?.detected ? (
          <View style={styles.changeBanner}>
            <Ionicons name="git-compare" size={16} color="#FFD54F" />
            <Text style={styles.changeBannerText}>{change.summary}</Text>
          </View>
        ) : null}

        {/* Perception & Reasoning HUD */}
        {reasoning && perception ? (
          <View style={styles.resultCard}>
            <View style={styles.hudHeader}>
              <Text style={styles.locationText}>{perception.locationLabel}</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      perception.pathStatus === 'clear' ? '#2E7D32' : '#C62828',
                  },
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {perception.pathStatus === 'clear' ? 'CLEAR PATH' : 'PATH BLOCKED'}
                </Text>
              </View>
            </View>

            {perception.detectedObjects.length ? (
              <View style={styles.tagRow}>
                {perception.detectedObjects.map((obj, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{obj}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={styles.result}>{reasoning.spokenSummary}</Text>

            <View style={styles.cardFooter}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Repeat spoken guidance"
                onPress={() => void speakText(reasoning.spokenSummary, { force: true })}
                style={styles.repeatBtn}
              >
                <Ionicons name="volume-high" size={18} color="#fff" />
                <Text style={styles.repeatText}>Repeat</Text>
              </Pressable>
              <Text style={styles.modelTag}>Llama 3.2 Offline</Text>
            </View>
          </View>
        ) : (
          <View style={styles.hintBox}>
            <Ionicons name="scan-outline" size={24} color="#90CAF9" />
            <Text style={styles.hint}>
              Point camera forward. G Sense analyzes your path locally without sending images to the internet.
            </Text>
          </View>
        )}

        {/* Primary Scan Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Capture and analyze surroundings offline"
          disabled={busy}
          onPress={() => void captureAndAnalyze(false)}
          style={[styles.scanBtn, busy && { opacity: 0.6 }]}
        >
          {busy ? <ActivityIndicator color="#001" /> : <Ionicons name="scan" size={28} color="#001" />}
          <Text style={styles.scanLabel}>{busy ? 'Processing Locally…' : 'Offline Scan'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, gap: 14 },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  body: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  primary: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  overlay: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleContainer: { alignItems: 'center' },
  overlayTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },
  modeBadgeText: { color: '#B0BEC5', fontSize: 10, letterSpacing: 0.8, fontFamily: 'Inter_600SemiBold' },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  assistRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  assistTextGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assistLabel: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  intervalRow: { flexDirection: 'row', gap: 8 },
  chip: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { backgroundColor: '#90CAF9' },
  chipText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  changeBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255, 193, 7, 0.25)', borderWidth: 1, borderColor: '#FFC107', borderRadius: 12, padding: 10 },
  changeBannerText: { color: '#FFF8E1', fontSize: 13, fontFamily: 'Inter_600SemiBold', flex: 1 },
  resultCard: { backgroundColor: 'rgba(0,0,0,0.80)', borderRadius: 18, padding: 16, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  hudHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locationText: { color: '#90CAF9', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_500Medium' },
  result: { color: '#fff', fontSize: 16, lineHeight: 22, fontFamily: 'Inter_600SemiBold' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  repeatBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
  repeatText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  modelTag: { color: '#B0BEC5', fontSize: 11, fontFamily: 'Inter_500Medium' },
  hintBox: { backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 16, padding: 16, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  hint: { color: '#E3F2FD', fontSize: 14, lineHeight: 20, textAlign: 'center', fontFamily: 'Inter_500Medium' },
  scanBtn: { alignSelf: 'center', minWidth: 180, minHeight: 56, borderRadius: 28, backgroundColor: '#90CAF9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  scanLabel: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#001' },
});
