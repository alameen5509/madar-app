import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useCircles } from '../../hooks/useCircles';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export default function CirclesScreen() {
  const { data: circles, isLoading, refetch } = useCircles();
  const [expanded, setExpanded] = useState<string | null>(null);

  const tierLabels: Record<string, string> = {
    Base: 'الأساس', First: 'المدار الأول', Second: 'المدار الثاني',
    Business: 'الأعمال', Third: 'المدار الثالث', Fourth: 'المدار الرابع', Fifth: 'المدار الخامس',
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={colors.gold} />}
    >
      {(circles ?? []).map((circle) => (
        <Card key={circle.id} style={styles.circleCard}>
          <TouchableOpacity onPress={() => setExpanded(expanded === circle.id ? null : circle.id)}>
            <View style={styles.circleHeader}>
              <View style={styles.circleInfo}>
                <View style={[styles.iconCircle, { backgroundColor: circle.colorHex || colors.gold }]}>
                  <Text style={styles.iconText}>{circle.iconKey || '🎯'}</Text>
                </View>
                <View style={styles.circleTextCol}>
                  <Text style={styles.circleName}>{circle.name}</Text>
                  <Text style={styles.circleTier}>{tierLabels[circle.tier] || circle.tier}</Text>
                </View>
              </View>
              <Text style={styles.expandArrow}>{expanded === circle.id ? '▲' : '▼'}</Text>
            </View>

            {/* Progress bar */}
            <View style={styles.progressRow}>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, {
                    width: `${circle.progressPercent}%`,
                    backgroundColor: circle.colorHex || colors.gold,
                  }]}
                />
              </View>
              <Text style={styles.progressText}>{Math.round(circle.progressPercent)}%</Text>
            </View>

            <View style={styles.statsRow}>
              <Badge label={`${circle.taskCount} مهمة`} color={colors.card} textColor={colors.text} />
              <Badge label={`${circle.completedTaskCount} مكتملة`} color={colors.success + '30'} textColor={colors.success} />
              <Badge label={`${circle.goalCount} أهداف`} color={colors.info + '30'} textColor={colors.info} />
            </View>
          </TouchableOpacity>

          {expanded === circle.id && (
            <View style={styles.expandedContent}>
              {circle.description && (
                <Text style={styles.description}>{circle.description}</Text>
              )}
              {circle.goals.length > 0 && (
                <View style={styles.goalsSection}>
                  <Text style={styles.goalsTitle}>الأهداف</Text>
                  {circle.goals.map((goal) => (
                    <View key={goal.id} style={styles.goalItem}>
                      <Text style={styles.goalTitle}>{goal.title}</Text>
                      <View style={styles.goalProgress}>
                        <View style={[styles.goalBar, { width: `${goal.progressPercent}%` }]} />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 100 },
  circleCard: { gap: 10 },
  circleHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  circleInfo: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 20 },
  circleTextCol: { gap: 2 },
  circleName: { fontSize: 16, fontWeight: '700', color: colors.text, writingDirection: 'rtl' },
  circleTier: { fontSize: 12, color: colors.muted, writingDirection: 'rtl' },
  expandArrow: { color: colors.muted, fontSize: 12 },
  progressRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  progressBar: { flex: 1, height: 6, backgroundColor: colors.cardBorder, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  statsRow: { flexDirection: 'row-reverse', gap: 8 },
  expandedContent: { borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 12, marginTop: 8 },
  description: { fontSize: 14, color: colors.textSecondary, writingDirection: 'rtl', lineHeight: 22 },
  goalsSection: { marginTop: 12, gap: 8 },
  goalsTitle: { fontSize: 14, fontWeight: '600', color: colors.gold, writingDirection: 'rtl' },
  goalItem: { gap: 4 },
  goalTitle: { fontSize: 13, color: colors.text, writingDirection: 'rtl' },
  goalProgress: { height: 4, backgroundColor: colors.cardBorder, borderRadius: 2, overflow: 'hidden' },
  goalBar: { height: '100%', backgroundColor: colors.success, borderRadius: 2 },
});
