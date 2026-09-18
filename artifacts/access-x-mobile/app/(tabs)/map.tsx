import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetEnvironment } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

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

export default function RouteContextScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const environment = useGetEnvironment();

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

  const triggerHaptic = () => {
    if (current?.pathStatus === 'blocked') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 },
      ]}
    >
      <View style={styles.header}>
        <Feather name="map-pin" size={24} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Route Context</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {current?.locationLabel ?? 'Live campus read'}
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

      {/* Recommended Path Card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>RECOMMENDED STEP</Text>
        <Text style={[styles.recommendation, { color: colors.foreground }]}>
          {environment.data?.recommendation ?? 'Loading route guidance...'}
        </Text>
      </View>

      {/* Clock Face Spatial Directions */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>CLOCK-FACE ORIENTATION</Text>
        <View style={styles.clockGrid}>
          <ClockRow label="12 o'clock (Ahead)" value={spatial.clockDirections.ahead} danger={current?.pathStatus === 'blocked'} />
          <ClockRow label="3 o'clock (Right)" value={spatial.clockDirections.right} />
          <ClockRow label="9 o'clock (Left)" value={spatial.clockDirections.left} />
          <ClockRow label="6 o'clock (Behind)" value={spatial.clockDirections.behind} />
        </View>
      </View>

      {/* Waypoints List */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>SPATIAL WAYPOINTS</Text>
        {spatial.waypoints.map((wp) => (
          <View key={wp.id} style={styles.waypointRow}>
            <Ionicons
              name={wp.status === 'blocked' ? 'alert-circle' : wp.status === 'caution' ? 'warning' : 'checkmark-circle'}
              size={18}
              color={wp.status === 'blocked' ? colors.destructive : wp.status === 'caution' ? colors.accent : colors.primary}
            />
            <Text style={[styles.wpLabel, { color: colors.foreground }]}>{wp.label}</Text>
            <Text
              style={[
                styles.wpStatus,
                { color: wp.status === 'blocked' ? colors.destructive : colors.mutedForeground },
              ]}
            >
              {wp.status.toUpperCase()}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function ClockRow({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.clockRow, { borderColor: colors.border }]}>
      <Text style={[styles.clockLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.clockValue, { color: danger ? colors.destructive : colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  hapticBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  eyebrow: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  recommendation: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_600SemiBold' },
  clockGrid: { gap: 8, marginTop: 4 },
  clockRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  clockLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  clockValue: { fontSize: 12, fontFamily: 'Inter_600SemiBold', maxWidth: '60%', textAlign: 'right' },
  waypointRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  wpLabel: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  wpStatus: { fontSize: 10, fontFamily: 'Inter_700Bold' },
});
