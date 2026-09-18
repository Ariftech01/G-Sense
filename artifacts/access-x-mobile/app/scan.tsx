import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { analyzeEnvironmentImage, spokenFromDashboard, type LiveDashboard } from '@/lib/gsense-api';
import { OFFLINE_MESSAGE } from '@/lib/api-config';
import { speakText, stopSpeech } from '@/lib/speech';

type PermissionKind = 'granted' | 'denied' | 'can_ask_again' | 'permanently_denied' | 'undetermined';

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<LiveDashboard | null>(null);
  const [assistive, setAssistive] = useState(false);
  const [intervalMs, setIntervalMs] = useState(8000);
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
    setError('');
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.45,
        base64: true,
        skipProcessing: true,
      });
      if (!photo?.base64) {
        setError('The camera frame did not include image data. Please try again.');
        return;
      }
      const dashboard = await analyzeEnvironmentImage(photo.base64, 'image/jpeg');
      setResult(dashboard);
      if (dashboard.current.pathStatus === 'blocked' || dashboard.change.detected) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      const spoken = spokenFromDashboard(dashboard);
      if (!fromMonitor || dashboard.announce) {
        await speakText(spoken, { force: !fromMonitor });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI analysis failed.';
      const offline = /network|fetch|failed to fetch|internet/i.test(message)
        ? OFFLINE_MESSAGE
        : message.replace(/^HTTP \d+ [^:]+:\s*/, '');
      setError(offline);
      if (!fromMonitor) await speakText(offline, { force: true });
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
          G Sense uses the rear camera to understand obstacles, doors, stairs, and signs. Status: {permissionKind.replaceAll('_', ' ')}.
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

  const spoken = result ? spokenFromDashboard(result) : '';

  return (
    <View style={[styles.screen, { backgroundColor: '#000' }]}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" mode="picture" />
      <View style={[styles.overlay, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.roundBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
          <Text style={styles.overlayTitle}>Scan environment</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Stop speech" onPress={stopSpeech} style={styles.roundBtn}>
            <Ionicons name="volume-mute-outline" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.assistRow}>
          <Text style={styles.assistLabel}>Assistive monitoring</Text>
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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {result ? (
          <View style={styles.resultCard}>
            <View style={styles.hudHeader}>
              <Text style={styles.locationText}>{result.current.locationLabel || 'Route Ahead'}</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      result.current.pathStatus === 'clear' ? '#2E7D32' : '#C62828',
                  },
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {result.current.pathStatus.toUpperCase().replace('_', ' ')}
                </Text>
              </View>
            </View>

            {result.current.detectedObjects?.length ? (
              <View style={styles.tagRow}>
                {result.current.detectedObjects.map((obj, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{obj}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={styles.result}>{spoken}</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Repeat spoken guidance"
              onPress={() => void speakText(spoken, { force: true })}
              style={styles.repeatBtn}
            >
              <Ionicons name="volume-high" size={18} color="#fff" />
              <Text style={styles.repeatText}>Repeat guidance</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.hint}>Point the rear camera ahead, then scan. G Sense will speak only what matters for your path.</Text>
        )}

        {result?.demoMode ? <Text style={styles.demo}>DEMO MODE — simulated environment.</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan current camera frame"
          disabled={busy}
          onPress={() => void captureAndAnalyze(false)}
          style={[styles.scanBtn, busy && { opacity: 0.6 }]}
        >
          {busy ? <ActivityIndicator color="#001" /> : <Ionicons name="scan" size={28} color="#001" />}
          <Text style={styles.scanLabel}>{busy ? 'Analyzing…' : 'Scan'}</Text>
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
  overlayTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  assistRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  assistLabel: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  intervalRow: { flexDirection: 'row', gap: 8 },
  chip: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { backgroundColor: '#90CAF9' },
  chipText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  hint: { color: '#E3F2FD', fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium' },
  resultCard: { backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  hudHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locationText: { color: '#90CAF9', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_500Medium' },
  result: { color: '#fff', fontSize: 16, lineHeight: 22, fontFamily: 'Inter_600SemiBold' },
  repeatBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, marginTop: 4 },
  repeatText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  error: { color: '#FFCDD2', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  demo: { color: '#FFE082', fontFamily: 'Inter_700Bold' },
  scanBtn: { alignSelf: 'center', minWidth: 160, minHeight: 56, borderRadius: 28, backgroundColor: '#90CAF9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 22 },
  scanLabel: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#001' },
});
