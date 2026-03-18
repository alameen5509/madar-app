import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../lib/api';
import { useImpersonation } from '../../hooks/useImpersonation';
import { Card } from '../../components/ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export default function UserScreensScreen() {
  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: async () => { const { data } = await usersApi.list(); return data; },
  });
  const { impersonate } = useImpersonation();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={colors.gold} />}
    >
      {(users ?? []).map((user) => (
        <Card key={user.id}>
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.fullName?.charAt(0) || '?'}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{user.fullName}</Text>
              <Text style={styles.email}>{user.email}</Text>
            </View>
            <TouchableOpacity
              style={styles.enterBtn}
              onPress={() => impersonate(user.id, user.fullName)}
            >
              <Text style={styles.enterText}>👁 دخول</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gold, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.navy },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text, writingDirection: 'rtl' },
  email: { fontSize: 12, color: colors.muted },
  enterBtn: { backgroundColor: colors.impersonation, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  enterText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
});
