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

  const steps = [
    { num: 'STEP 1', label: 'BEFORE', value: data?.change.before || '', icon: 'time-outline' as const, highlight: false },
    { num: 'STEP 2', label: 'CHANGE DETECTED', value: data?.change.change || '', icon: 'pulse-outline' as const, highlight: true },
    { num: 'STEP 3', label: 'CURRENT STATE', value: data?.change.currentState || '', icon: 'location-outline' as const, highlight: false },
    { num: 'STEP 4', label: 'IMPACT ON ROUTE', value: data?.change.impact || '', icon: 'warning-outline' as const, highlight: true },
    { num: 'STEP 5', label: 'RECOMMENDATION', value: data?.change.recommendation || '', icon: 'compass-outline' as const, highlight: true, primary: true },
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={21} color={colors.foreground} />
        </Pressable>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Temporal Change Flow</Text>
          <Text style={[styles.subTitle, { color: colors.mutedForeground }]}>5-Step Reasoning Pipeline</Text>
        </View>
      </View>

      {isLoading || !data ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
      ) : (
        <>
          <View style={[styles.statusBanner, { backgroundColor: data.change.detected ? `${colors.primary}15` : colors.secondary, borderColor: colors.border }]}>
            <Ionicons name={data.change.detected ? "alert-circle" : "checkmark-circle"} size={20} color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.foreground }]}>
              {data.change.detected ? "Temporal Change Detected" : "No Temporal Change"}
            </Text>
          </View>

          <View style={styles.pipeline}>
            {steps.map((step, idx) => (
              <React.Fragment key={step.label}>
                <View style={[
                  styles.card,
                  {
                    backgroundColor: step.primary ? colors.secondary : colors.card,
                    borderColor: step.primary ? colors.primary : colors.border,
                  }
                ]}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.badge, { backgroundColor: step.primary ? colors.primary : colors.secondary }]}>
                      <Ionicons name={step.icon} size={14} color={step.primary ? colors.primaryForeground : colors.foreground} />
                      <Text style={[styles.badgeText, { color: step.primary ? colors.primaryForeground : colors.foreground }]}>
                        {step.num}: {step.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.value, { color: step.primary ? colors.primary : colors.foreground }]}>
                    {step.value}
                  </Text>
                </View>

                {idx < steps.length - 1 && (
                  <View style={styles.arrowRow}>
                    <Ionicons name="arrow-down-outline" size={16} color={colors.primary} />
                  </View>
                )}
              </React.Fragment>
            ))}
          </View>

          <View style={[styles.safety, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark-outline" size={19} color={colors.primary} />
            <Text style={[styles.copy, { color: colors.mutedForeground }]}>{data.safetyMessage}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, fontFamily: 'Inter_700Bold' },
  subTitle: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  statusText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  pipeline: { gap: 4 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 10, letterSpacing: 0.8, fontFamily: 'Inter_700Bold' },
  value: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_500Medium' },
  arrowRow: { alignItems: 'center', marginVertical: 4 },
  safety: { borderWidth: 1, borderRadius: 15, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  copy: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
});