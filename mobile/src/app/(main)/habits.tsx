import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Modal, TextInput, RefreshControl,
} from 'react-native';
import { useHabits, useToggleHabit, useCreateHabit } from '../../hooks/useHabits';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

const categories = [
  { key: 'worship', label: 'عبادة', icon: '🕌' },
  { key: 'health', label: 'صحة', icon: '💪' },
  { key: 'learning', label: 'تعلم', icon: '📚' },
  { key: 'social', label: 'اجتماعي', icon: '🤝' },
];

export default function HabitsScreen() {
  const { data: habits, isLoading, refetch } = useHabits();
  const toggleHabit = useToggleHabit();
  const createHabit = useCreateHabit();
  const [showCreate, setShowCreate] = useState(false);
  const [showTasbih, setShowTasbih] = useState(false);
  const [tasbihCount, setTasbihCount] = useState(0);
  const [tasbihTarget] = useState(33);
  const [filter, setFilter] = useState<string>('all');

  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [newIcon, setNewIcon] = useState('⭐');
  const [newCategory, setNewCategory] = useState('worship');
  const [newIsIdea, setNewIsIdea] = useState(false);

  const activeHabits = (habits ?? []).filter((h) => !h.isIdea);
  const ideas = (habits ?? []).filter((h) => h.isIdea);
  const filtered = filter === 'all' ? activeHabits
    : filter === 'ideas' ? ideas
    : activeHabits.filter((h) => h.category === filter);

  const doneTodayCount = activeHabits.filter((h) => h.todayDone).length;

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createHabit.mutateAsync({
      title: newTitle.trim(),
      icon: newIcon,
      category: newCategory,
      isIdea: newIsIdea,
    });
    setNewTitle(''); setShowCreate(false);
  };

  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {doneTodayCount}/{activeHabits.length} اليوم
        </Text>
        <View style={styles.streak}>
          <Text style={styles.streakIcon}>🔥</Text>
        </View>
      </View>

      {/* Category filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}
        contentContainerStyle={styles.filtersContent}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>الكل</Text>
        </TouchableOpacity>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.filterBtn, filter === cat.key && styles.filterActive]}
            onPress={() => setFilter(cat.key)}
          >
            <Text style={[styles.filterText, filter === cat.key && styles.filterTextActive]}>
              {cat.icon} {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'ideas' && styles.filterActive]}
          onPress={() => setFilter('ideas')}
        >
          <Text style={[styles.filterText, filter === 'ideas' && styles.filterTextActive]}>💡 بنك الأفكار</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={colors.gold} />}
      >
        {filtered.map((habit) => (
          <TouchableOpacity
            key={habit.id}
            onPress={() => toggleHabit.mutate(habit.id)}
            activeOpacity={0.7}
          >
            <Card style={{...styles.habitCard, ...(habit.todayDone ? styles.habitDone : {})}}>
              <View style={styles.habitRow}>
                <Text style={styles.habitIcon}>{habit.icon}</Text>
                <View style={styles.habitInfo}>
                  <Text style={[styles.habitTitle, habit.todayDone && styles.habitTitleDone]}>
                    {habit.title}
                  </Text>
                  <Text style={styles.habitStreak}>🔥 {habit.streak} يوم</Text>
                </View>
                <View style={[styles.checkCircle, habit.todayDone && styles.checkCircleDone]}>
                  {habit.todayDone && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.tasbihBtn} onPress={() => { setTasbihCount(0); setShowTasbih(true); }}>
          <Text style={styles.tasbihBtnText}>📿 عداد التسبيح</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Tasbih Counter Modal */}
      <Modal visible={showTasbih} animationType="fade" transparent>
        <View style={styles.tasbihOverlay}>
          <TouchableOpacity
            style={styles.tasbihArea}
            activeOpacity={0.9}
            onPress={() => setTasbihCount((c) => c + 1)}
          >
            <Text style={styles.tasbihLabel}>سبحان الله</Text>
            <Text style={styles.tasbihNumber}>{tasbihCount}</Text>
            <Text style={styles.tasbihTarget}>الهدف: {tasbihTarget}</Text>
            {tasbihCount >= tasbihTarget && <Text style={styles.tasbihComplete}>✓ اكتمل</Text>}
            <TouchableOpacity
              style={styles.tasbihClose}
              onPress={() => setShowTasbih(false)}
            >
              <Text style={styles.tasbihCloseText}>إغلاق</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tasbihReset}
              onPress={() => setTasbihCount(0)}
            >
              <Text style={styles.tasbihResetText}>إعادة</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>عادة جديدة</Text>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="عنوان العادة"
              placeholderTextColor={colors.muted}
              textAlign="right"
            />
            <Text style={styles.fieldLabel}>التصنيف</Text>
            <View style={styles.catRow}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.catBtn, newCategory === cat.key && styles.catActive]}
                  onPress={() => setNewCategory(cat.key)}
                >
                  <Text style={styles.catText}>{cat.icon} {cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.ideaToggle}
              onPress={() => setNewIsIdea(!newIsIdea)}
            >
              <View style={[styles.checkbox, newIsIdea && styles.checkboxActive]} />
              <Text style={styles.ideaText}>إضافة كفكرة (بنك الأفكار)</Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <Button title="إنشاء" onPress={handleCreate} loading={createHabit.isPending} />
              <Button title="إلغاء" variant="ghost" onPress={() => setShowCreate(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  summary: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
  summaryText: { fontSize: 18, fontWeight: '700', color: colors.gold, writingDirection: 'rtl' },
  streak: {},
  streakIcon: { fontSize: 24 },
  filters: { maxHeight: 44 },
  filtersContent: { flexDirection: 'row-reverse', paddingHorizontal: spacing.lg, gap: 8, alignItems: 'center' },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card },
  filterActive: { backgroundColor: colors.gold },
  filterText: { fontSize: 13, color: colors.text, writingDirection: 'rtl' },
  filterTextActive: { color: colors.navy },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 120 },
  habitCard: {},
  habitDone: { borderColor: colors.success, opacity: 0.7 },
  habitRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  habitIcon: { fontSize: 28 },
  habitInfo: { flex: 1, gap: 2 },
  habitTitle: { fontSize: 15, fontWeight: '600', color: colors.text, writingDirection: 'rtl' },
  habitTitleDone: { textDecorationLine: 'line-through', color: colors.muted },
  habitStreak: { fontSize: 12, color: colors.muted },
  checkCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.cardBorder, justifyContent: 'center', alignItems: 'center' },
  checkCircleDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  quickActions: { position: 'absolute', bottom: 90, left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tasbihBtn: { backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: colors.cardBorder },
  tasbihBtnText: { color: colors.gold, fontSize: 14, fontWeight: '600', writingDirection: 'rtl' },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.gold, justifyContent: 'center', alignItems: 'center', elevation: 6 },
  fabText: { fontSize: 28, color: colors.navy, fontWeight: '700' },
  tasbihOverlay: { flex: 1, backgroundColor: colors.navyDark },
  tasbihArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tasbihLabel: { fontSize: 24, color: colors.gold, fontWeight: '600', marginBottom: 20, writingDirection: 'rtl' },
  tasbihNumber: { fontSize: 96, fontWeight: '700', color: colors.text },
  tasbihTarget: { fontSize: 16, color: colors.muted, marginTop: 12, writingDirection: 'rtl' },
  tasbihComplete: { fontSize: 20, color: colors.success, marginTop: 12, fontWeight: '700' },
  tasbihClose: { position: 'absolute', top: 60, left: 20, padding: 12 },
  tasbihCloseText: { color: colors.gold, fontSize: 16, writingDirection: 'rtl' },
  tasbihReset: { position: 'absolute', top: 60, right: 20, padding: 12 },
  tasbihResetText: { color: colors.muted, fontSize: 16, writingDirection: 'rtl' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.navyDark, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xxl, gap: spacing.md },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.gold, textAlign: 'center', writingDirection: 'rtl' },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: borderRadius.md, padding: spacing.md, color: colors.text, fontSize: 15, writingDirection: 'rtl' },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '600', writingDirection: 'rtl' },
  catRow: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  catBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card },
  catActive: { backgroundColor: colors.gold },
  catText: { fontSize: 13, color: colors.text, writingDirection: 'rtl' },
  ideaToggle: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.cardBorder },
  checkboxActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  ideaText: { fontSize: 14, color: colors.text, writingDirection: 'rtl' },
  modalActions: { flexDirection: 'row-reverse', gap: 12, marginTop: spacing.md },
});
