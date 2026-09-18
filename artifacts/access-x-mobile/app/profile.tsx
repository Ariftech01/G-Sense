import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetPreferences, useUpdatePreferences } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useAIMode, getLlamaModelStatus } from '@/lib/offline';

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode, isOffline, toggleMode } = useAIMode();
  const llamaStatus = getLlamaModelStatus();
  const preferences = useGetPreferences();
  const update = useUpdatePreferences();
  const [goal, setGoal] = useState('');
  const current = preferences.data;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={21} color={colors.foreground} /></Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Accessibility & AI Profile</Text>
      </View>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>G Sense uses these preferences to explain impact and choose the safer route for your goal.</Text>

      {/* Offline Mode Switch */}
      <View style={[styles.card, { backgroundColor: isOffline ? '#1E293B' : colors.card, borderColor: isOffline ? '#38BDF8' : colors.border }]}>
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceCopy}>
            <Text style={[styles.label, { color: isOffline ? '#F8FAFC' : colors.foreground }]}>Primary Offline Mode</Text>
            <Text style={[styles.copy, { color: isOffline ? '#94A3B8' : colors.mutedForeground }]}>
              {isOffline ? 'Active: Local Llama 3.2 & on-device perception with 0 network calls.' : 'Inactive: Cloud Gemini AI is active when network is available.'}
            </Text>
          </View>
          <Switch
            value={isOffline}
            onValueChange={toggleMode}
            trackColor={{ false: colors.muted, true: '#38BDF8' }}
            thumbColor={isOffline ? '#0F172A' : colors.foreground}
          />
        </View>
      </View>

      {/* Offline AI Model Management */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.modelHeader}>
          <MaterialCommunityIcons name="chip" size={22} color={colors.primary} />
          <Text style={[styles.label, { color: colors.foreground }]}>Offline AI Engine (Llama 3.2)</Text>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={[styles.statusText, { color: '#22C55E' }]}>Ready (Local On-Device Engine)</Text>
        </View>

        <View style={styles.specGrid}>
          <View style={styles.specItem}>
            <Text style={[styles.specLabel, { color: colors.mutedForeground }]}>Model</Text>
            <Text style={[styles.specValue, { color: colors.foreground }]}>{llamaStatus.name} {llamaStatus.version}</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={[styles.specLabel, { color: colors.mutedForeground }]}>Format</Text>
            <Text style={[styles.specValue, { color: colors.foreground }]}>{llamaStatus.format} ({llamaStatus.quantization})</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={[styles.specLabel, { color: colors.mutedForeground }]}>Model Size</Text>
            <Text style={[styles.specValue, { color: colors.foreground }]}>{llamaStatus.sizeFormatted}</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={[styles.specLabel, { color: colors.mutedForeground }]}>RAM Usage</Text>
            <Text style={[styles.specValue, { color: colors.foreground }]}>{llamaStatus.ramRequirementFormatted}</Text>
          </View>
        </View>

        <View style={[styles.privacyBox, { backgroundColor: `${colors.primary}12`, borderColor: colors.primary }]}>
          <Feather name="shield" size={16} color={colors.primary} />
          <Text style={[styles.privacyText, { color: colors.foreground }]}>
            Privacy Guarantee: In Offline Mode, camera frames and voice queries never leave this device.
          </Text>
        </View>
      </View>

      {/* Online vs Offline Capability Matrix */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.foreground, marginBottom: 4 }]}>Capability Comparison</Text>
        <View style={styles.matrixTable}>
          {[
            ['Text & Route Queries', '✓ Cloud Gemini', '✓ Llama 3.2'],
            ['Camera Surroundings Scan', '✓ Server Vision', '✓ On-Device Perception'],
            ['Elevator & Campus Guidance', '✓ Server Database', '✓ Cached Campus Map'],
            ['Environmental Memory', '✓ Server Memory', '✓ Local Storage'],
            ['Voice Output (TTS)', '✓ Native TTS', '✓ Native TTS (Offline)'],
            ['Network Requirement', 'Required', 'None (Airplane Mode Safe)'],
          ].map(([feature, online, offline], i) => (
            <View key={i} style={[styles.matrixRow, i % 2 === 1 && { backgroundColor: `${colors.muted}33` }]}>
              <Text style={[styles.matrixFeature, { color: colors.foreground }]}>{feature}</Text>
              <Text style={[styles.matrixOnline, { color: colors.mutedForeground }]}>{online}</Text>
              <Text style={[styles.matrixOffline, { color: '#38BDF8' }]}>{offline}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* User Preferences */}
      {current ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            ['avoidStairs', 'Avoid stairs', 'Prefer routes without stairs.'],
            ['preferElevator', 'Prefer elevator', 'Use elevator access when available.'],
            ['avoidCrowds', 'Avoid crowds', 'Flag crowded areas as a route concern.'],
            ['voiceEnabled', 'Voice output', 'Speak important accessibility results.'],
            ['assistiveMode', 'Assistive mode', 'Announce only meaningful changes while monitoring.'],
            ['storeRawImages', 'Store raw frames', 'Off by default. G Sense stores structured state, not photos.'],
          ].map(([key, label, copy]) => (
            <View key={key} style={styles.preferenceRow}>
              <View style={styles.preferenceCopy}><Text style={[styles.label, { color: colors.foreground }]}>{label}</Text><Text style={[styles.copy, { color: colors.mutedForeground }]}>{copy}</Text></View>
              <Switch value={Boolean((current as unknown as Record<string, unknown>)[key])} onValueChange={(value) => update.mutate({ data: { [key]: value } as never })} trackColor={{ false: colors.muted, true: colors.primary }} thumbColor={colors.foreground} />
            </View>
          ))}
          <Text style={[styles.label, { color: colors.foreground }]}>Current goal</Text>
          <View style={styles.goalRow}>
            <TextInput value={goal || current.goal} onChangeText={setGoal} placeholder="Library" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
            <Pressable accessibilityRole="button" accessibilityLabel="Save goal" onPress={() => update.mutate({ data: { goal: goal || current.goal } })} style={[styles.save, { backgroundColor: colors.primary }]}><Feather name="check" size={18} color={colors.primaryForeground} /></Pressable>
          </View>
        </View>
      ) : <Text style={[styles.copy, { color: colors.mutedForeground }]}>Loading preferences…</Text>}
      <View style={[styles.note, { backgroundColor: colors.secondary, borderColor: colors.border }]}><Feather name="info" size={18} color={colors.accent} /><Text style={[styles.copy, { color: colors.mutedForeground, flex: 1 }]}>Preferences are used for reasoning. They never guarantee a route is safe.</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 23, fontFamily: 'Inter_700Bold' },
  description: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 18 },
  preferenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  preferenceCopy: { flex: 1, gap: 3 },
  label: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  copy: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  goalRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, height: 45, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14, fontFamily: 'Inter_400Regular' },
  save: { width: 45, height: 45, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  note: { borderWidth: 1, borderRadius: 15, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  modelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  statusText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  specItem: { width: '47%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 8, gap: 2 },
  specLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  specValue: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  privacyBox: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1 },
  privacyText: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_500Medium', flex: 1 },
  matrixTable: { gap: 4, marginTop: 4 },
  matrixRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderRadius: 6, alignItems: 'center' },
  matrixFeature: { flex: 1.4, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  matrixOnline: { flex: 1, fontSize: 10, fontFamily: 'Inter_500Medium' },
  matrixOffline: { flex: 1, fontSize: 10, fontFamily: 'Inter_700Bold' },
});