import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

interface FinanceEntry {
  id: string;
  type: 'income' | 'expense' | 'debt' | 'due';
  title: string;
  amount: number;
  currency: string;
  date: string;
}

export default function FinanceScreen() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState<FinanceEntry['type']>('expense');
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');

  useEffect(() => {
    (async () => {
      const data = await AsyncStorage.getItem('madar_finance');
      if (data) setEntries(JSON.parse(data));
    })();
  }, []);

  const save = (list: FinanceEntry[]) => {
    setEntries(list);
    AsyncStorage.setItem('madar_finance', JSON.stringify(list));
  };

  const handleAdd = () => {
    if (!newTitle.trim() || !newAmount) return;
    const entry: FinanceEntry = {
      id: Date.now().toString(),
      type: newType,
      title: newTitle.trim(),
      amount: parseFloat(newAmount),
      currency: 'SAR',
      date: new Date().toISOString(),
    };
    save([entry, ...entries]);
    setNewTitle(''); setNewAmount(''); setShowAdd(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('حذف', 'هل تريد حذف هذا العنصر؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: () => save(entries.filter((e) => e.id !== id)) },
    ]);
  };

  const totalIncome = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const totalDebt = entries.filter((e) => e.type === 'debt').reduce((s, e) => s + e.amount, 0);
  const totalDue = entries.filter((e) => e.type === 'due').reduce((s, e) => s + e.amount, 0);

  const typeLabels: Record<string, string> = { income: 'دخل', expense: 'مصروف', debt: 'دين', due: 'مستحق' };
  const typeColors: Record<string, string> = {
    income: colors.success, expense: colors.danger, debt: '#F59E0B', due: '#8B5CF6',
  };
  const typeIcons: Record<string, string> = { income: '💵', expense: '💸', debt: '📉', due: '📊' };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>💰 الإدارة المالية</Text>

        {/* Summary */}
        <View style={styles.summaryGrid}>
          {[
            { label: 'الدخل', amount: totalIncome, color: colors.success },
            { label: 'المصروفات', amount: totalExpense, color: colors.danger },
            { label: 'الديون', amount: totalDebt, color: '#F59E0B' },
            { label: 'المستحقات', amount: totalDue, color: '#8B5CF6' },
          ].map((item) => (
            <Card key={item.label} style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={[styles.summaryAmount, { color: item.color }]}>
                {item.amount.toLocaleString()} ر.س
              </Text>
            </Card>
          ))}
        </View>

        {/* Entries */}
        <Text style={styles.sectionTitle}>السجل</Text>
        {entries.length === 0 ? (
          <Text style={styles.emptyText}>لا توجد سجلات</Text>
        ) : (
          entries.map((entry) => (
            <TouchableOpacity key={entry.id} onLongPress={() => handleDelete(entry.id)}>
              <Card style={styles.entryCard}>
                <View style={styles.entryRow}>
                  <Text style={styles.entryIcon}>{typeIcons[entry.type]}</Text>
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryTitle}>{entry.title}</Text>
                    <Text style={styles.entryDate}>
                      {new Date(entry.date).toLocaleDateString('ar-SA')}
                    </Text>
                  </View>
                  <Text style={[styles.entryAmount, { color: typeColors[entry.type] }]}>
                    {entry.type === 'income' ? '+' : '-'}{entry.amount.toLocaleString()} ر.س
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>إضافة عنصر مالي</Text>

            <View style={styles.typeRow}>
              {(['income', 'expense', 'debt', 'due'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, newType === t && { backgroundColor: typeColors[t] }]}
                  onPress={() => setNewType(t)}
                >
                  <Text style={[styles.typeText, newType === t && { color: '#FFF' }]}>
                    {typeIcons[t]} {typeLabels[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="الوصف"
              placeholderTextColor={colors.muted}
              textAlign="right"
            />
            <TextInput
              style={styles.input}
              value={newAmount}
              onChangeText={setNewAmount}
              placeholder="المبلغ"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              textAlign="right"
            />

            <View style={styles.modalActions}>
              <Button title="إضافة" onPress={handleAdd} />
              <Button title="إلغاء" variant="ghost" onPress={() => setShowAdd(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 100 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: colors.gold, writingDirection: 'rtl' },
  summaryGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  summaryItem: { width: '48%', alignItems: 'center', padding: spacing.md },
  summaryLabel: { fontSize: 12, color: colors.muted, writingDirection: 'rtl' },
  summaryAmount: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.gold, writingDirection: 'rtl', marginTop: 8 },
  emptyText: { color: colors.muted, textAlign: 'center', fontSize: 14, paddingVertical: 20, writingDirection: 'rtl' },
  entryCard: {},
  entryRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  entryIcon: { fontSize: 24 },
  entryInfo: { flex: 1, gap: 2 },
  entryTitle: { fontSize: 14, color: colors.text, fontWeight: '600', writingDirection: 'rtl' },
  entryDate: { fontSize: 12, color: colors.muted },
  entryAmount: { fontSize: 16, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 90, left: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.gold, justifyContent: 'center', alignItems: 'center', elevation: 6 },
  fabText: { fontSize: 28, color: colors.navy, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.navyDark, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xxl, gap: spacing.md },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.gold, textAlign: 'center', writingDirection: 'rtl' },
  typeRow: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card },
  typeText: { fontSize: 13, color: colors.text, writingDirection: 'rtl' },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: borderRadius.md, padding: spacing.md, color: colors.text, fontSize: 15, writingDirection: 'rtl' },
  modalActions: { flexDirection: 'row-reverse', gap: 12, marginTop: spacing.md },
});
