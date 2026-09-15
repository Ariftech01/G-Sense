import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetPreferences, useUpdatePreferences } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const preferences = useGetPreferences();
  const update = useUpdatePreferences();
  const [goal, setGoal] = useState('');
  const current = preferences.data;

  const toggle = (key: 'avoidStairs' | 'preferElevator' | 'avoidCrowds', value: boolean) => {
    update.mutate({ data: { [key]: value } });
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={21} color={colors.foreground} /></Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Accessibility profile</Text>
      </View>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>ACCESS-X uses these preferences to explain impact and choose the safer route for your goal.</Text>
      {current ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            ['avoidStairs', 'Avoid stairs', 'Prefer routes without stairs.'],
            ['preferElevator', 'Prefer elevator', 'Use elevator access when available.'],
            ['avoidCrowds', 'Avoid crowds', 'Flag crowded areas as a route concern.'],
          ].map(([key, label, copy]) => (
            <View key={key} style={styles.preferenceRow}>
              <View style={styles.preferenceCopy}><Text style={[styles.label, { color: colors.foreground }]}>{label}</Text><Text style={[styles.copy, { color: colors.mutedForeground }]}>{copy}</Text></View>
              <Switch value={Boolean(current[key as keyof typeof current])} onValueChange={(value) => toggle(key as 'avoidStairs' | 'preferElevator' | 'avoidCrowds', value)} trackColor={{ false: colors.muted, true: colors.primary }} thumbColor={colors.foreground} />
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
});