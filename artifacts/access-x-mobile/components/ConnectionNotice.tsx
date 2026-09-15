import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { OFFLINE_MESSAGE } from '@/lib/api-config';

type ConnectionNoticeProps = {
  visible: boolean;
};

/**
 * Shown when the backend cannot be reached, so the user is told the AI service
 * is unavailable instead of being shown stale or invented environment data.
 */
export function ConnectionNotice({ visible }: ConnectionNoticeProps) {
  const colors = useColors();

  if (!visible) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.notice,
        { borderColor: colors.destructive, backgroundColor: `${colors.destructive}14` },
      ]}
    >
      <Feather name="wifi-off" size={18} color={colors.destructive} />
      <Text style={[styles.message, { color: colors.foreground }]}>{OFFLINE_MESSAGE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
  },
  message: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
  },
});
