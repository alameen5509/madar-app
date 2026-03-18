import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert, RefreshControl, Modal, FlatList, Animated,
} from 'react-native';
import { useTasks, useCreateTask, useUpdateTaskStatus } from '../../hooks/useTasks';
import { useCircles } from '../../hooks/useCircles';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import type { SmartTask, TaskStatus } from '../../lib/types';

type TabFilter = 'all' | 'Inbox' | 'Todo' | 'InProgress' | 'Completed';

const tabs: { key: TabFilter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'Inbox', label: 'وارد' },
  { key: 'Todo', label: 'مخطط' },
  { key: 'InProgress', label: 'جاري' },
  { key: 'Completed', label: 'مكتمل' },
];

const priorityLabels: Record<number, string> = {
  1: 'منخفضة', 2: 'عادية', 3: 'متوسطة', 4: 'عالية', 5: 'حرجة',
};

const priorityColors: Record<number, string> = {
  1: '#6B7280', 2: '#3B82F6', 3: '#F59E0B', 4: '#EF4444', 5: '#DC2626',
};

export default function TasksScreen() {
  const { data: tasks, isLoading, refetch } = useTasks();
  const { data: circles } = useCircles();
  const createTask = useCreateTask();
  const updateStatus = useUpdateTaskStatus();
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [showNewTask, setShowNewTask] = useState(false);
  const [showFocus, setShowFocus] = useState(false);

  // New task form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(3);
  const [cogLoad, setCogLoad] = useState('Medium');
  const [context, setContext] = useState('Anywhere');
  const [selectedCircle, setSelectedCircle] = useState<string | undefined>();

  // Focus timer
  const [focusTask, setFocusTask] = useState<SmartTask | null>(null);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [focusRunning, setFocusRunning] = useState(false);
  const focusInterval = useRef<NodeJS.Timeout | null>(null);
  const FOCUS_DURATION = 25 * 60;

  useEffect(() => {
    if (focusRunning) {
      focusInterval.current = setInterval(() => {
        setFocusSeconds((s) => {
          if (s + 1 >= FOCUS_DURATION) {
            setFocusRunning(false);
            Alert.alert('أحسنت! 🎉', 'انتهت جلسة التركيز');
            return 0;
          }
          return s + 1;
        });
      }, 1000);
    }
    return () => { if (focusInterval.current) clearInterval(focusInterval.current); };
  }, [focusRunning]);

  const filtered = (tasks ?? []).filter((t) =>
    activeTab === 'all' ? true : t.status === activeTab
  );

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('تنبيه', 'العنوان مطلوب'); return; }
    try {
      await createTask.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        userPriority: priority,
        cognitiveLoad: cogLoad,
        taskContext: context,
        lifeCircleId: selectedCircle,
      });
      setTitle(''); setDescription(''); setPriority(3);
      setShowNewTask(false);
    } catch {
      Alert.alert('خطأ', 'فشل إنشاء المهمة');
    }
  };

  const handleStatusChange = (id: string, status: TaskStatus) => {
    updateStatus.mutate({ id, status });
  };

  const startFocus = (task: SmartTask) => {
    setFocusTask(task);
    setFocusSeconds(0);
    setFocusRunning(true);
    setShowFocus(true);
    if (task.status !== 'InProgress') {
      updateStatus.mutate({ id: task.id, status: 'InProgress' });
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderTask = (task: SmartTask) => {
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed';
    const circleColor = task.lifeCircle?.colorHex || colors.gold;

    return (
      <Card key={task.id} style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <View style={styles.taskTitleRow}>
            <View style={[styles.circleDot, { backgroundColor: circleColor }]} />
            <Text style={[styles.taskTitle, task.status === 'Completed' && styles.taskDone]}
              numberOfLines={2}>
              {task.title}
            </Text>
          </View>
          {isOverdue && <Badge label="متأخرة" color={colors.danger} textColor="#FFF" />}
        </View>

        <View style={styles.taskMeta}>
          <Badge
            label={priorityLabels[task.userPriority] ?? 'متوسطة'}
            color={priorityColors[task.userPriority] ?? colors.gold}
            textColor="#FFF"
          />
          {task.lifeCircle && (
            <Text style={styles.circleName}>{task.lifeCircle.name}</Text>
          )}
          {task.dueDate && (
            <Text style={[styles.dueDate, isOverdue && { color: colors.danger }]}>
              {new Date(task.dueDate).toLocaleDateString('ar-SA')}
            </Text>
          )}
          {task.isRecurring && <Text style={styles.recurring}>🔁</Text>}
        </View>

        <View style={styles.taskActions}>
          {task.status !== 'Completed' && (
            <>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleStatusChange(task.id, 'Completed')}
              >
                <Text style={styles.actionText}>✓ إتمام</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => startFocus(task)}
              >
                <Text style={styles.actionText}>🎯 تركيز</Text>
              </TouchableOpacity>
              {task.status === 'Inbox' && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleStatusChange(task.id, 'Todo')}
                >
                  <Text style={styles.actionText}>📋 تخطيط</Text>
                </TouchableOpacity>
              )}
            </>
          )}
          {task.status !== 'Deferred' && task.status !== 'Completed' && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleStatusChange(task.id, 'Deferred')}
            >
              <Text style={styles.actionText}>⏳ تأجيل</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}
        contentContainerStyle={styles.tabsContent}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Task list */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={colors.gold} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>لا توجد مهام</Text>
          </View>
        ) : (
          filtered.map(renderTask)
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowNewTask(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* New Task Modal */}
      <Modal visible={showNewTask} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>مهمة جديدة</Text>

            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="عنوان المهمة"
              placeholderTextColor={colors.muted}
              textAlign="right"
            />
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="الوصف (اختياري)"
              placeholderTextColor={colors.muted}
              textAlign="right"
              multiline
              numberOfLines={3}
            />

            <Text style={styles.fieldLabel}>الأولوية</Text>
            <View style={styles.priorityRow}>
              {[1, 2, 3, 4, 5].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityBtn, priority === p && { backgroundColor: priorityColors[p] }]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[styles.priorityText, priority === p && { color: '#FFF' }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>السياق</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['Anywhere', 'Home', 'Office', 'Car', 'Online', 'Phone'].map((c) => {
                const labels: Record<string, string> = {
                  Anywhere: 'أي مكان', Home: 'المنزل', Office: 'المكتب',
                  Car: 'السيارة', Online: 'أونلاين', Phone: 'الهاتف',
                };
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.contextBtn, context === c && styles.contextActive]}
                    onPress={() => setContext(c)}
                  >
                    <Text style={[styles.contextText, context === c && styles.contextTextActive]}>
                      {labels[c]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {circles && circles.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>دائرة الحياة</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {circles.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.contextBtn,
                        selectedCircle === c.id && { backgroundColor: c.colorHex || colors.gold },
                      ]}
                      onPress={() => setSelectedCircle(selectedCircle === c.id ? undefined : c.id)}
                    >
                      <Text style={[
                        styles.contextText,
                        selectedCircle === c.id && { color: colors.navy },
                      ]}>
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <View style={styles.modalActions}>
              <Button title="إنشاء" onPress={handleCreate} loading={createTask.isPending} />
              <Button title="إلغاء" variant="ghost" onPress={() => setShowNewTask(false)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Focus Timer Modal */}
      <Modal visible={showFocus} animationType="fade" transparent>
        <View style={styles.focusOverlay}>
          <View style={styles.focusContent}>
            <Text style={styles.focusTitle}>🎯 وقت التركيز</Text>
            <Text style={styles.focusTaskTitle}>{focusTask?.title}</Text>
            <Text style={styles.focusTimer}>{formatTime(focusSeconds)}</Text>
            <Text style={styles.focusRemaining}>
              المتبقي: {formatTime(FOCUS_DURATION - focusSeconds)}
            </Text>
            <View style={styles.focusActions}>
              <Button
                title={focusRunning ? '⏸ إيقاف مؤقت' : '▶ استمرار'}
                onPress={() => setFocusRunning(!focusRunning)}
              />
              <Button
                title="✓ إنهاء الجلسة"
                variant="secondary"
                onPress={() => {
                  setShowFocus(false);
                  setFocusRunning(false);
                  if (focusTask) handleStatusChange(focusTask.id, 'Completed');
                }}
              />
              <Button
                title="✕ إلغاء"
                variant="ghost"
                onPress={() => { setShowFocus(false); setFocusRunning(false); }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  tabs: { maxHeight: 48 },
  tabsContent: { flexDirection: 'row-reverse', paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card },
  tabActive: { backgroundColor: colors.gold },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '600', writingDirection: 'rtl' },
  tabTextActive: { color: colors.navy },
  list: { flex: 1 },
  listContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: 100 },
  taskCard: { gap: 8 },
  taskHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' },
  taskTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 },
  circleDot: { width: 10, height: 10, borderRadius: 5 },
  taskTitle: { fontSize: 15, fontWeight: '600', color: colors.text, writingDirection: 'rtl', flex: 1 },
  taskDone: { textDecorationLine: 'line-through', color: colors.muted },
  taskMeta: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  circleName: { fontSize: 12, color: colors.muted, writingDirection: 'rtl' },
  dueDate: { fontSize: 12, color: colors.textSecondary },
  recurring: { fontSize: 14 },
  taskActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 4 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(212,175,55,0.1)', borderRadius: 8 },
  actionText: { fontSize: 12, color: colors.gold, writingDirection: 'rtl' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: colors.muted, fontSize: 16, writingDirection: 'rtl' },
  fab: {
    position: 'absolute', bottom: 90, left: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.gold, justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: colors.gold, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6,
  },
  fabText: { fontSize: 28, color: colors.navy, fontWeight: '700', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.navyDark, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.xxl, gap: spacing.md, maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.gold, textAlign: 'center', writingDirection: 'rtl' },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
    borderRadius: borderRadius.md, padding: spacing.md,
    color: colors.text, fontSize: 15, writingDirection: 'rtl',
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '600', writingDirection: 'rtl' },
  priorityRow: { flexDirection: 'row-reverse', gap: 8 },
  priorityBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder,
  },
  priorityText: { fontSize: 16, fontWeight: '700', color: colors.text },
  contextBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card, marginLeft: 8 },
  contextActive: { backgroundColor: colors.gold },
  contextText: { fontSize: 13, color: colors.text, writingDirection: 'rtl' },
  contextTextActive: { color: colors.navy },
  modalActions: { flexDirection: 'row-reverse', gap: 12, marginTop: spacing.md },
  focusOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  focusContent: { backgroundColor: colors.navyDark, borderRadius: 20, padding: 40, alignItems: 'center', width: '85%' },
  focusTitle: { fontSize: 22, fontWeight: '700', color: colors.gold, marginBottom: 8 },
  focusTaskTitle: { fontSize: 16, color: colors.text, writingDirection: 'rtl', marginBottom: 24, textAlign: 'center' },
  focusTimer: { fontSize: 64, fontWeight: '700', color: colors.gold, fontVariant: ['tabular-nums'] },
  focusRemaining: { fontSize: 14, color: colors.muted, marginTop: 8, marginBottom: 24, writingDirection: 'rtl' },
  focusActions: { gap: 12, width: '100%' },
});
