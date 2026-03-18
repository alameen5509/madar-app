import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useTasks } from '../../hooks/useTasks';
import { useHabits } from '../../hooks/useHabits';
import { Card } from '../../components/ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export default function AiScreen() {
  const { data: tasks, isLoading, refetch } = useTasks();
  const { data: habits } = useHabits();
  const [showTips, setShowTips] = useState(true);

  const report = useMemo(() => {
    const all = tasks ?? [];
    const completed = all.filter((t) => t.status === 'Completed');
    const pending = all.filter((t) => t.status !== 'Completed' && t.status !== 'Cancelled');
    const overdue = pending.filter((t) => t.dueDate && new Date(t.dueDate) < new Date());
    const inbox = all.filter((t) => t.status === 'Inbox');
    const highPriority = pending.filter((t) => t.userPriority >= 4);
    const totalMinutes = completed.reduce((s, t) => s + (t.actualDurationMinutes ?? 0), 0);
    const onTimeRate = completed.length > 0
      ? Math.round((completed.filter((t) => t.wasCompletedOnTime).length / completed.length) * 100)
      : 0;

    // Score (0-100)
    const completionRate = all.length > 0 ? Math.round((completed.length / all.length) * 100) : 0;
    const overdueRate = pending.length > 0 ? Math.round((overdue.length / pending.length) * 100) : 0;
    const score = Math.max(0, Math.min(100,
      50 + (completionRate / 2) - (overdueRate / 3) + (onTimeRate / 5)
    ));

    // Tips
    const tips: string[] = [];
    if (inbox.length > 5) tips.push(`لديك ${inbox.length} مهمة في صندوق الوارد — صنفها أولاً`);
    if (overdue.length > 0) tips.push(`${overdue.length} مهمة متأخرة — أعد جدولتها أو أنجزها اليوم`);
    if (highPriority.length > 3) tips.push(`${highPriority.length} مهام عالية الأولوية — ركّز على أهم 3`);
    if (completionRate < 30) tips.push('نسبة الإنجاز منخفضة — قسّم المهام الكبيرة لمهام أصغر');
    if (onTimeRate < 50 && completed.length > 3) tips.push('معظم مهامك تتأخر — حدد أوقات واقعية أكثر');
    if (tips.length === 0) tips.push('أداؤك ممتاز! استمر على هذا المستوى');

    const habitsAll = habits?.filter((h) => !h.isIdea) ?? [];
    const habitsDone = habitsAll.filter((h) => h.todayDone).length;

    return { score, completionRate, onTimeRate, overdue: overdue.length, pending: pending.length, completed: completed.length, totalHours: Math.round(totalMinutes / 60), tips, habitsDone, habitsTotal: habitsAll.length };
  }, [tasks, habits]);

  const scoreColor = report.score >= 70 ? colors.success : report.score >= 40 ? colors.warning : colors.danger;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={colors.gold} />}
    >
      <Text style={styles.pageTitle}>🤖 تقرير التطوير الذاتي</Text>

      {/* Score */}
      <Card style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>مؤشر الأداء</Text>
        <Text style={[styles.scoreNumber, { color: scoreColor }]}>{report.score}</Text>
        <Text style={styles.scoreMax}>/ 100</Text>
        <View style={styles.scoreBar}>
          <View style={[styles.scoreBarFill, { width: `${report.score}%`, backgroundColor: scoreColor }]} />
        </View>
      </Card>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <Card style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.success }]}>{report.completionRate}%</Text>
          <Text style={styles.statLabel}>نسبة الإنجاز</Text>
        </Card>
        <Card style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.turquoise }]}>{report.onTimeRate}%</Text>
          <Text style={styles.statLabel}>في الوقت</Text>
        </Card>
        <Card style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.danger }]}>{report.overdue}</Text>
          <Text style={styles.statLabel}>متأخرة</Text>
        </Card>
        <Card style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.gold }]}>{report.totalHours}h</Text>
          <Text style={styles.statLabel}>ساعات عمل</Text>
        </Card>
      </View>

      {/* Habits */}
      <Card>
        <Text style={styles.sectionTitle}>التزام العادات</Text>
        <View style={styles.habitRow}>
          <Text style={styles.habitCount}>{report.habitsDone}/{report.habitsTotal}</Text>
          <View style={styles.habitBar}>
            <View style={[styles.habitBarFill, { width: `${report.habitsTotal > 0 ? (report.habitsDone / report.habitsTotal) * 100 : 0}%` }]} />
          </View>
        </View>
      </Card>

      {/* AI Tips */}
      <TouchableOpacity onPress={() => setShowTips(!showTips)}>
        <Card>
          <View style={styles.tipsHeader}>
            <Text style={styles.sectionTitle}>💡 توصيات ذكية</Text>
            <Text style={styles.tipsToggle}>{showTips ? '▲' : '▼'}</Text>
          </View>
          {showTips && report.tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </Card>
      </TouchableOpacity>

      {/* Features */}
      <Card>
        <Text style={styles.sectionTitle}>كيف يعمل؟</Text>
        {[
          '📊 تحليل تلقائي لنمط عملك ومعدل إنجازك',
          '🕐 متابعة الالتزام بالمواعيد وأوقات الصلاة',
          '⚡ قياس مستوى الطاقة والإنتاجية',
          '🎯 توصيات مخصصة لتحسين أدائك',
          '📈 تتبع التقدم على مدار الأسابيع',
        ].map((feature, i) => (
          <Text key={i} style={styles.featureItem}>{feature}</Text>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 100 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: colors.gold, writingDirection: 'rtl' },
  scoreCard: { alignItems: 'center', paddingVertical: 20 },
  scoreLabel: { fontSize: 14, color: colors.muted, writingDirection: 'rtl' },
  scoreNumber: { fontSize: 56, fontWeight: '700', marginTop: 4 },
  scoreMax: { fontSize: 16, color: colors.muted, marginTop: -4 },
  scoreBar: { width: '100%', height: 8, backgroundColor: colors.cardBorder, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
  scoreBarFill: { height: '100%', borderRadius: 4 },
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  statItem: { width: '48%', alignItems: 'center', paddingVertical: 12 },
  statNumber: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, color: colors.muted, writingDirection: 'rtl', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.gold, writingDirection: 'rtl', marginBottom: 8 },
  habitRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  habitCount: { fontSize: 18, fontWeight: '700', color: colors.turquoise },
  habitBar: { flex: 1, height: 8, backgroundColor: colors.cardBorder, borderRadius: 4, overflow: 'hidden' },
  habitBarFill: { height: '100%', backgroundColor: colors.turquoise, borderRadius: 4 },
  tipsHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  tipsToggle: { color: colors.muted, fontSize: 14 },
  tipRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold, marginTop: 6 },
  tipText: { flex: 1, fontSize: 14, color: colors.text, writingDirection: 'rtl', lineHeight: 22 },
  featureItem: { fontSize: 14, color: colors.text, writingDirection: 'rtl', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.cardBorder, lineHeight: 22 },
});
