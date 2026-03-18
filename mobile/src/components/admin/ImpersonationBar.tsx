import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useImpersonation } from '../../hooks/useImpersonation';
import { colors } from '../../theme/colors';

export function ImpersonationBar() {
  const { isImpersonating, targetUserName, stop } = useImpersonation();
  const insets = useSafeAreaInsets();

  if (!isImpersonating) return null;

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 4 }]}>
      <Text style={styles.text}>أنت تستعرض: {targetUserName}</Text>
      <TouchableOpacity onPress={stop} style={styles.stopBtn}>
        <Text style={styles.stopText}>إيقاف الاستعراض</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.impersonation,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 9999,
  },
  text: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  stopBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stopText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
});
