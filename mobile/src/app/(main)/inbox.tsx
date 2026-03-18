import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../../lib/api';
import { useTasks } from '../../hooks/useTasks';
import { Card } from '../../components/ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { SmartTask } from '../../lib/types';

export default function InboxScreen() {
  const { data: tasks, isLoading, refetch } = useTasks();
  const qc = useQueryClient();

  const inboxTasks = (tasks ?? []).filter((t) => t.status === 'Inbox');

  const acceptMutation = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      tasksApi.accept(id, accept),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const handleAction = (task: SmartTask, accept: boolean) => {
    const action = accept ? 'قبول' : 'رفض';
    Alert.alert(action, `هل تريد ${action} المهمة "${task.title}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: action,
        style: accept ? 'default' : 'destructive',
        onPress: () => acceptMutation.mutate({ id: task.id, accept }),
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={colors.gold} />}
    >
      <Text style={styles.header}>📬 صندوق الوارد</Text>
      <Text style={styles.count}>{inboxTasks.length} عنصر</Text>

      {inboxTasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>صندوق الوارد فارغ</Text>
        </View>
      ) : (
        inboxTasks.map((task) => (
          <Card key={task.id} style={styles.itemCard}>
            <Text style={styles.itemTitle}>{task.title}</Text>
            {task.description && <Text style={styles.itemDesc}>{task.description}</Text>}
            <Text style={styles.itemDate}>
              {new Date(task.createdAt).toLocaleDateString('ar-SA')}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={() => handleAction(task, true)}
              >
                <Text style={styles.acceptText}>✓ قبول</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleAction(task, false)}
              >
                <Text style={styles.rejectText}>✕ رفض</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 100 },
  header: { fontSize: 22, fontWeight: '700', color: colors.gold, writingDirection: 'rtl' },
  count: { fontSize: 14, color: colors.muted, writingDirection: 'rtl' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: colors.muted, writingDirection: 'rtl' },
  itemCard: { gap: 8 },
  itemTitle: { fontSize: 16, fontWeight: '600', color: colors.text, writingDirection: 'rtl' },
  itemDesc: { fontSize: 14, color: colors.textSecondary, writingDirection: 'rtl' },
  itemDate: { fontSize: 12, color: colors.muted },
  actions: { flexDirection: 'row-reverse', gap: 10, marginTop: 4 },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  acceptBtn: { backgroundColor: colors.success + '20' },
  rejectBtn: { backgroundColor: colors.danger + '20' },
  acceptText: { color: colors.success, fontWeight: '600', writingDirection: 'rtl' },
  rejectText: { color: colors.danger, fontWeight: '600', writingDirection: 'rtl' },
});
