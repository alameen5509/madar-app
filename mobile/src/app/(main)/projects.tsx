import React from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { goalsApi } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export default function ProjectsScreen() {
  const { data: goals, isLoading, refetch } = useQuery({
    queryKey: ['goals'],
    queryFn: async () => { const { data } = await goalsApi.list(); return data; },
  });

  const statusLabels: Record<string, string> = {
    Active: 'نشط', Paused: 'متوقف', Completed: 'مكتمل', Archived: 'مؤرشف',
  };
  const statusColors: Record<string, string> = {
    Active: colors.success, Paused: '#F59E0B', Completed: colors.info, Archived: colors.muted,
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={colors.gold} />}
    >
      <Text style={styles.pageTitle}>📁 المشاريع والأهداف</Text>

      {(goals ?? []).map((goal) => (
        <Card key={goal.id} style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <Text style={styles.goalTitle}>{goal.title}</Text>
            <Badge
              label={statusLabels[goal.status] ?? goal.status}
              color={(statusColors[goal.status] ?? colors.muted) + '30'}
              textColor={statusColors[goal.status] ?? colors.muted}
            />
          </View>
          {goal.description && (
            <Text style={styles.goalDesc}>{goal.description}</Text>
          )}
          <View style={styles.progressRow}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${goal.progressPercent}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(goal.progressPercent)}%</Text>
          </View>
          {goal.targetDate && (
            <Text style={styles.targetDate}>
              الهدف: {new Date(goal.targetDate).toLocaleDateString('ar-SA')}
            </Text>
          )}
          {goal.lifeCircle && (
            <Text style={styles.circleName}>{goal.lifeCircle.name}</Text>
          )}
        </Card>
      ))}

      {(!goals || goals.length === 0) && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>لا توجد مشاريع</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 100 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: colors.gold, writingDirection: 'rtl' },
  goalCard: { gap: 8 },
  goalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  goalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, writingDirection: 'rtl', flex: 1 },
  goalDesc: { fontSize: 14, color: colors.textSecondary, writingDirection: 'rtl' },
  progressRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  progressBar: { flex: 1, height: 6, backgroundColor: colors.cardBorder, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 3 },
  progressText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  targetDate: { fontSize: 12, color: colors.muted, writingDirection: 'rtl' },
  circleName: { fontSize: 12, color: colors.gold, writingDirection: 'rtl' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: colors.muted, fontSize: 16, writingDirection: 'rtl' },
});
