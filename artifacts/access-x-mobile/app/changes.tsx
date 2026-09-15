import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetEnvironment } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

export default function ChangesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading } = useGetEnvironment();
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}><Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={21} color={colors.foreground} /></Pressable><Text style={[styles.title, { color: colors.foreground }]}>What changed</Text></View>
      {isLoading || !data ? <ActivityIndicator color={colors.primary} /> : (
        <>
          <View style={[styles.timeline, { borderColor: colors.border }]}>
            <Step label="BEFORE" value={data.change.before} colors={colors} />
            <View style={[styles.line, { backgroundColor: colors.border }]} />
            <Step label="CHANGE" value={data.change.change} colors={colors} accent />
            <View style={[styles.line, { backgroundColor: colors.border }]} />
            <Step label="CURRENT STATE" value={data.change.currentState} colors={colors} />
            <View style={[styles.line, { backgroundColor: colors.border }]} />
            <Step label="IMPACT" value={data.change.impact} colors={colors} />
            <View style={[styles.line, { backgroundColor: colors.border }]} />
            <Step label="RECOMMENDATION" value={data.change.recommendation} colors={colors} accent />
          </View>
          <View style={[styles.safety, { backgroundColor: colors.secondary, borderColor: colors.border }]}><Ionicons name="shield-checkmark-outline" size={19} color={colors.primary} /><Text style={[styles.copy, { color: colors.mutedForeground }]}>{data.safetyMessage}</Text></View>
        </>
      )}
    </ScrollView>
  );
}
function Step({ label, value, colors, accent = false }: { label: string; value: string; colors: ReturnType<typeof useColors>; accent?: boolean }) {
  return <View style={styles.step}><Text style={[styles.label, { color: accent ? colors.accent : colors.mutedForeground }]}>{label}</Text><Text style={[styles.value, { color: colors.foreground }]}>{value}</Text></View>;
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 23, fontFamily: 'Inter_700Bold' },
  timeline: { borderWidth: 1, borderRadius: 20, padding: 16 },
  step: { gap: 6 },
  label: { fontSize: 10, letterSpacing: 1.2, fontFamily: 'Inter_700Bold' },
  value: { fontSize: 15, lineHeight: 21, fontFamily: 'Inter_600SemiBold' },
  line: { height: 1, marginVertical: 16 },
  safety: { borderWidth: 1, borderRadius: 15, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  copy: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
});