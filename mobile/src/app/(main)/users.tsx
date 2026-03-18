import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useImpersonation } from '../../hooks/useImpersonation';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export default function UsersScreen() {
  const { userRole } = useAuth();
  const { impersonate } = useImpersonation();
  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: async () => { const { data } = await usersApi.list(); return data; },
  });

  const isAdmin = userRole === 'Admin';

  const handleImpersonate = (userId: string, userName: string) => {
    Alert.alert('استعراض المستخدم', `هل تريد الدخول كـ "${userName}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'دخول', onPress: () => impersonate(userId, userName) },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={colors.gold} />}
    >
      <Text style={styles.pageTitle}>👥 المستخدمون</Text>

      {(users ?? []).map((user) => (
        <Card key={user.id} style={styles.userCard}>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.fullName?.charAt(0) || '?'}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.fullName}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              {user.lastLoginAt && (
                <Text style={styles.lastLogin}>
                  آخر دخول: {new Date(user.lastLoginAt).toLocaleDateString('ar-SA')}
                </Text>
              )}
            </View>
            <View style={styles.userActions}>
              <Badge
                label={user.isActive ? 'نشط' : 'غير نشط'}
                color={user.isActive ? colors.success + '30' : colors.danger + '30'}
                textColor={user.isActive ? colors.success : colors.danger}
              />
              {isAdmin && (
                <TouchableOpacity
                  style={styles.impersonateBtn}
                  onPress={() => handleImpersonate(user.id, user.fullName)}
                >
                  <Text style={styles.impersonateText}>👁 دخول</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 100 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: colors.gold, writingDirection: 'rtl' },
  userCard: {},
  userRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.navy },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 15, fontWeight: '600', color: colors.text, writingDirection: 'rtl' },
  userEmail: { fontSize: 13, color: colors.muted },
  lastLogin: { fontSize: 11, color: colors.textSecondary, writingDirection: 'rtl' },
  userActions: { alignItems: 'center', gap: 6 },
  impersonateBtn: { backgroundColor: colors.impersonation + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  impersonateText: { fontSize: 12, color: colors.impersonation, fontWeight: '600', writingDirection: 'rtl' },
});
