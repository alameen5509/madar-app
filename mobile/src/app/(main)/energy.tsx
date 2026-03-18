import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTasks } from '../../hooks/useTasks';
import { Card } from '../../components/ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export default function EnergyScreen() {
  const { data: tasks } = useTasks();

  const stats = useMemo(() => {
    const all = tasks ?? [];
    const completed = all.filter((t) => t.status === 'Completed');
    const pending = all.filter((t) => t.status !== 'Completed' && t.status !== 'Cancelled');
    const overdue = pending.filter((t) => t.dueDate && new Date(t.dueDate) < new Date());
    const totalMinutes = completed.reduce((s, t) => s + (t.actualDurationMinutes ?? 0), 0);
    const avgDuration = completed.length > 0 ? Math.round(totalMinutes / completed.length) : 0;
    const onTime = completed.filter((t) => t.wasCompletedOnTime).length;
    const onTimeRate = completed.length > 0 ? Math.round((onTime / completed.length) * 100) : 0;

    // By priority
    const byPriority = [1, 2, 3, 4, 5].map((p) => ({
      priority: p,
      count: all.filter((t) => t.userPriority === p).length,
      completed: completed.filter((t) => t.userPriority === p).length,
    }));

    // By status
    const byStatus = ['Inbox', 'Todo', 'InProgress', 'Completed', 'Deferred'].map((s) => ({
      status: s,
      count: all.filter((t) => t.status === s).length,
    }));

    return { total: all.length, completed: completed.length, pending: pending.length, overdue: overdue.length, totalMinutes, avgDuration, onTimeRate, byPriority, byStatus };
  }, [tasks]);

  const statusLabels: Record<string, string> = {
    Inbox: 'وارد', Todo: 'مخطط', InProgress: 'جاري', Completed: 'مكتمل', Deferred: 'مؤجل',
  };
  const statusColors: Record<string, string> = {
    Inbox: '#6B7280', Todo: '#3B82F6', InProgress: '#F59E0B', Completed: '#10B981', Deferred: '#8B5CF6',
  };

  const priorityLabels: Record<number, string> = {
    1: 'منخفضة', 2: 'عادية', 3: 'متوسطة', 4: 'عالية', 5: 'حرجة',
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>📈 الإحصائيات</Text>

      {/* Overview */}
      <Card>
        <Text style={styles.sectionTitle}>نظرة عامة</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>إجمالي</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: colors.success }]}>{stats.completed}</Text>
            <Text style={styles.statLabel}>مكتمل</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: colors.warning }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>معلق</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: colors.danger }]}>{stats.overdue}</Text>
            <Text style={styles.statLabel}>متأخر</Text>
          </View>
        </View>
      </Card>

      {/* Focus Stats */}
      <Card>
        <Text style={styles.sectionTitle}>التركيز</Text>
        <View style={styles.focusRow}>
          <View style={styles.focusItem}>
            <Text style={styles.focusNumber}>{Math.round(stats.totalMinutes / 60)}h</Text>
            <Text style={styles.focusLabel}>إجمالي الوقت</Text>
          </View>
          <View style={styles.focusItem}>
            <Text style={styles.focusNumber}>{stats.avgDuration}m</Text>
            <Text style={styles.focusLabel}>متوسط المدة</Text>
          </View>
          <View style={styles.focusItem}>
            <Text style={styles.focusNumber}>{stats.onTimeRate}%</Text>
            <Text style={styles.focusLabel}>في الوقت</Text>
          </View>
        </View>
      </Card>

      {/* By Status - simple bar chart */}
      <Card>
        <Text style={styles.sectionTitle}>حسب الحالة</Text>
        {stats.byStatus.map((s) => (
          <View key={s.status} style={styles.barRow}>
            <Text style={styles.barLabel}>{statusLabels[s.status] ?? s.status}</Text>
            <View style={styles.barTrack}>
              <View
                style={[styles.barFill, {
                  width: `${stats.total > 0 ? (s.count / stats.total) * 100 : 0}%`,
                  backgroundColor: statusColors[s.status] || colors.gold,
                }]}
              />
            </View>
            <Text style={styles.barCount}>{s.count}</Text>
          </View>
        ))}
      </Card>

      {/* By Priority */}
      <Card>
        <Text style={styles.sectionTitle}>حسب الأولوية</Text>
        {stats.byPriority.map((p) => (
          <View key={p.priority} style={styles.barRow}>
            <Text style={styles.barLabel}>{priorityLabels[p.priority]}</Text>
            <View style={styles.barTrack}>
              <View
                style={[styles.barFill, {
                  width: `${stats.total > 0 ? (p.count / stats.total) * 100 : 0}%`,
                  backgroundColor: colors.gold,
                }]}
              />
            </View>
            <Text style={styles.barCount}>{p.completed}/{p.count}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 100 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: colors.gold, writingDirection: 'rtl' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.gold, writingDirection: 'rtl', marginBottom: 12 },
  statsGrid: { flexDirection: 'row-reverse', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '700', color: colors.gold },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 4, writingDirection: 'rtl' },
  focusRow: { flexDirection: 'row-reverse', justifyContent: 'space-around' },
  focusItem: { alignItems: 'center' },
  focusNumber: { fontSize: 28, fontWeight: '700', color: colors.text },
  focusLabel: { fontSize: 12, color: colors.muted, marginTop: 4, writingDirection: 'rtl' },
  barRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 8 },
  barLabel: { width: 60, fontSize: 12, color: colors.text, writingDirection: 'rtl' },
  barTrack: { flex: 1, height: 12, backgroundColor: colors.cardBorder, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  barCount: { width: 40, fontSize: 12, color: colors.muted, textAlign: 'center' },
});
