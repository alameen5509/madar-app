import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { usePrayers } from '../../hooks/usePrayers';
import { useTasks } from '../../hooks/useTasks';
import { useHabits } from '../../hooks/useHabits';
import { Card } from '../../components/ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

/* ─── Hijri date helper ─────────────────────────── */
function getHijriDate(): string {
  try {
    const formatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'long', year: 'numeric',
      weekday: 'long',
    });
    return formatter.format(new Date());
  } catch {
    return '';
  }
}

export default function DashboardScreen() {
  const router = useRouter();
  const { data: prayers, isLoading: pLoading } = usePrayers();
  const { data: tasks, isLoading: tLoading, refetch: refetchTasks } = useTasks();
  const { data: habits } = useHabits();

  const pendingTasks = tasks?.filter((t) => t.status !== 'Completed' && t.status !== 'Cancelled') ?? [];
  const todayTasks = pendingTasks.filter((t) => {
    if (!t.dueDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return t.dueDate.startsWith(today);
  });
  const overdueTasks = pendingTasks.filter((t) => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < new Date() && t.status !== 'Completed';
  });
  const habitsToday = habits?.filter((h) => !h.isIdea) ?? [];
  const habitsDone = habitsToday.filter((h) => h.todayDone).length;

  const prayerNames: Record<string, string> = {
    fajr: 'الفجر', shuruq: 'الشروق', dhuhr: 'الظهر',
    asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء',
  };

  const getNextPrayer = () => {
    if (!prayers) return null;
    const now = new Date();
    const times = ['fajr', 'shuruq', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
    for (const name of times) {
      const time = prayers[name];
      if (!time) continue;
      const [h, m] = time.split(':').map(Number);
      const prayerDate = new Date();
      prayerDate.setHours(h, m, 0, 0);
      if (prayerDate > now) return { name, time, label: prayerNames[name] };
    }
    return { name: 'fajr', time: prayers.fajr, label: 'الفجر (غداً)' };
  };

  const nextPrayer = getNextPrayer();
  const hijriDate = useMemo(() => getHijriDate(), []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={tLoading && pLoading} onRefresh={() => refetchTasks()} tintColor={colors.gold} />}
    >
      {/* Hijri Date */}
      {hijriDate ? (
        <Card style={styles.hijriCard}>
          <Text style={styles.hijriText}>{hijriDate}</Text>
        </Card>
      ) : null}

      {/* Prayer Times */}
      <Card style={styles.prayerCard}>
        <Text style={styles.sectionTitle}>أوقات الصلاة</Text>
        {nextPrayer && (
          <View style={styles.nextPrayer}>
            <Text style={styles.nextPrayerLabel}>الصلاة القادمة</Text>
            <Text style={styles.nextPrayerName}>{nextPrayer.label}</Text>
            <Text style={styles.nextPrayerTime}>{nextPrayer.time}</Text>
          </View>
        )}
        {prayers && (
          <View style={styles.prayerGrid}>
            {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((p) => (
              <View key={p} style={styles.prayerItem}>
                <Text style={styles.prayerName}>{prayerNames[p]}</Text>
                <Text style={styles.prayerTime}>{prayers[p]}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Tasks Summary */}
      <Card style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>ملخص المهام</Text>
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statBox} onPress={() => router.push('/(main)/tasks')}>
            <Text style={styles.statNumber}>{pendingTasks.length}</Text>
            <Text style={styles.statLabel}>معلقة</Text>
          </TouchableOpacity>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: colors.success }]}>{todayTasks.length}</Text>
            <Text style={styles.statLabel}>اليوم</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: colors.danger }]}>{overdueTasks.length}</Text>
            <Text style={styles.statLabel}>متأخرة</Text>
          </View>
        </View>
      </Card>

      {/* Habits Summary */}
      <Card>
        <Text style={styles.sectionTitle}>العادات اليومية</Text>
        <View style={styles.habitProgress}>
          <Text style={styles.habitCount}>{habitsDone}/{habitsToday.length}</Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${habitsToday.length > 0 ? (habitsDone / habitsToday.length) * 100 : 0}%` },
              ]}
            />
          </View>
        </View>
      </Card>

      {/* Quick Actions */}
      <Card>
        <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(main)/tasks')}>
            <Text style={styles.actionIcon}>➕</Text>
            <Text style={styles.actionLabel}>مهمة جديدة</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(main)/habits')}>
            <Text style={styles.actionIcon}>🔄</Text>
            <Text style={styles.actionLabel}>العادات</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(main)/watch')}>
            <Text style={styles.actionIcon}>⌚</Text>
            <Text style={styles.actionLabel}>ربط الساعة</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(main)/quran')}>
            <Text style={styles.actionIcon}>📖</Text>
            <Text style={styles.actionLabel}>ختمة</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 100 },
  hijriCard: { alignItems: 'center', paddingVertical: 12, backgroundColor: colors.purple + '20', borderColor: colors.purple + '40' },
  hijriText: { fontSize: 16, fontWeight: '600', color: colors.turquoise, writingDirection: 'rtl', textAlign: 'center' },
  prayerCard: {},
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.gold, writingDirection: 'rtl', marginBottom: 12 },
  nextPrayer: { alignItems: 'center', marginBottom: 16 },
  nextPrayerLabel: { fontSize: 13, color: colors.muted, writingDirection: 'rtl' },
  nextPrayerName: { fontSize: 24, fontWeight: '700', color: colors.text, marginVertical: 4 },
  nextPrayerTime: { fontSize: 20, fontWeight: '600', color: colors.gold },
  prayerGrid: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  prayerItem: { alignItems: 'center' },
  prayerName: { fontSize: 12, color: colors.muted, marginBottom: 4, writingDirection: 'rtl' },
  prayerTime: { fontSize: 14, color: colors.text, fontWeight: '600' },
  summaryCard: {},
  statsRow: { flexDirection: 'row-reverse', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  statNumber: { fontSize: 28, fontWeight: '700', color: colors.gold },
  statLabel: { fontSize: 13, color: colors.muted, marginTop: 4, writingDirection: 'rtl' },
  habitProgress: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  habitCount: { fontSize: 18, fontWeight: '700', color: colors.gold },
  progressBar: { flex: 1, height: 8, backgroundColor: colors.cardBorder, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 4 },
  actionsRow: { flexDirection: 'row-reverse', justifyContent: 'space-around' },
  actionBtn: { alignItems: 'center', gap: 6 },
  actionIcon: { fontSize: 28 },
  actionLabel: { fontSize: 12, color: colors.text, writingDirection: 'rtl' },
});
