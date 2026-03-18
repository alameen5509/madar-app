import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useTasks } from '../../hooks/useTasks';
import { Card } from '../../components/ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export default function JobsScreen() {
  const { data: tasks, isLoading, refetch } = useTasks();

  const jobs = useMemo(() => {
    if (!tasks) return [];
    // Group tasks by context (taskContext) as "jobs"
    const map = new Map<string, { name: string; total: number; completed: number; tasks: typeof tasks }>();
    for (const t of tasks) {
      const ctx = t.taskContext || 'عام';
      if (!map.has(ctx)) map.set(ctx, { name: ctx, total: 0, completed: 0, tasks: [] });
      const job = map.get(ctx)!;
      job.total++;
      if (t.status === 'Completed') job.completed++;
      job.tasks.push(t);
    }
    return Array.from(map.values()).sort((a, b) => (b.total - b.completed) - (a.total - a.completed));
  }, [tasks]);

  const contextIcons: Record<string, string> = {
    'عام': '📋', 'عمل': '💼', 'شخصي': '🏠', 'مسجد': '🕌',
    'مكتب': '🏢', 'بيت': '🏡', 'سيارة': '🚗', 'سفر': '✈️',
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={colors.gold} />}
    >
      <Text style={styles.pageTitle}>💼 الوظائف والبيئات</Text>
      <Text style={styles.subtitle}>مهامك مصنفة حسب بيئة العمل</Text>

      {jobs.length === 0 && !isLoading && (
        <Card>
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💼</Text>
            <Text style={styles.emptyText}>لا توجد مهام بعد</Text>
            <Text style={styles.emptyHint}>أضف مهام مع تحديد البيئة (عمل، مسجد، بيت...) وستظهر هنا</Text>
          </View>
        </Card>
      )}

      {jobs.map((job) => {
        const pct = job.total > 0 ? Math.round((job.completed / job.total) * 100) : 0;
        const pending = job.total - job.completed;
        return (
          <Card key={job.name}>
            <View style={styles.jobHeader}>
              <Text style={styles.jobIcon}>{contextIcons[job.name] || '📋'}</Text>
              <View style={styles.jobInfo}>
                <Text style={styles.jobName}>{job.name}</Text>
                <Text style={styles.jobStats}>{pending} معلقة · {job.completed} مكتملة</Text>
              </View>
              <Text style={styles.jobPct}>{pct}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
            {/* Show pending tasks */}
            {job.tasks
              .filter((t) => t.status !== 'Completed' && t.status !== 'Cancelled')
              .slice(0, 5)
              .map((t) => (
                <View key={t.id} style={styles.taskRow}>
                  <View style={[styles.taskDot, t.status === 'InProgress' && { backgroundColor: colors.turquoise }]} />
                  <Text style={styles.taskTitle} numberOfLines={1}>{t.title}</Text>
                  {t.dueDate && (
                    <Text style={styles.taskDate}>
                      {new Date(t.dueDate).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                    </Text>
                  )}
                </View>
              ))}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 100 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: colors.gold, writingDirection: 'rtl' },
  subtitle: { fontSize: 14, color: colors.muted, writingDirection: 'rtl' },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.text, writingDirection: 'rtl' },
  emptyHint: { fontSize: 13, color: colors.muted, writingDirection: 'rtl', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  jobHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 8 },
  jobIcon: { fontSize: 28 },
  jobInfo: { flex: 1, gap: 2 },
  jobName: { fontSize: 16, fontWeight: '700', color: colors.text, writingDirection: 'rtl' },
  jobStats: { fontSize: 12, color: colors.muted, writingDirection: 'rtl' },
  jobPct: { fontSize: 18, fontWeight: '700', color: colors.gold },
  progressBar: { height: 6, backgroundColor: colors.cardBorder, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: colors.turquoise, borderRadius: 3 },
  taskRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  taskDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  taskTitle: { flex: 1, fontSize: 13, color: colors.text, writingDirection: 'rtl' },
  taskDate: { fontSize: 11, color: colors.muted },
});
