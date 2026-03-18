import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const TOTAL_PAGES = 604;
const DAILY_WIRD = 20;

export default function QuranScreen() {
  const [currentPage, setCurrentPage] = useState(1);
  const [completions, setCompletions] = useState(0);
  const [todayPages, setTodayPages] = useState(0);

  useEffect(() => {
    (async () => {
      const data = await AsyncStorage.getItem('madar_quran');
      if (data) {
        const parsed = JSON.parse(data);
        setCurrentPage(parsed.currentPage ?? 1);
        setCompletions(parsed.completions ?? 0);
        const today = new Date().toISOString().split('T')[0];
        setTodayPages(parsed.todayDate === today ? (parsed.todayPages ?? 0) : 0);
      }
    })();
  }, []);

  const save = async (page: number, comp: number, tp: number) => {
    const today = new Date().toISOString().split('T')[0];
    await AsyncStorage.setItem('madar_quran', JSON.stringify({
      currentPage: page, completions: comp, todayPages: tp, todayDate: today,
    }));
  };

  const addPages = (count: number) => {
    let newPage = currentPage + count;
    let newComp = completions;
    if (newPage > TOTAL_PAGES) {
      newPage = newPage - TOTAL_PAGES;
      newComp += 1;
    }
    const newToday = todayPages + count;
    setCurrentPage(newPage);
    setCompletions(newComp);
    setTodayPages(newToday);
    save(newPage, newComp, newToday);
  };

  const progressPercent = ((currentPage - 1) / TOTAL_PAGES) * 100;
  const wirdPercent = Math.min((todayPages / DAILY_WIRD) * 100, 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.sectionTitle}>📖 تتبع الختمة</Text>
        <View style={styles.mainStat}>
          <Text style={styles.pageNumber}>{currentPage}</Text>
          <Text style={styles.pageLabel}>/ {TOTAL_PAGES} صفحة</Text>
        </View>
        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(progressPercent)}%</Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>الورد اليومي</Text>
        <Text style={styles.wirdText}>{todayPages}/{DAILY_WIRD} صفحة اليوم</Text>
        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${wirdPercent}%`, backgroundColor: colors.success }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(wirdPercent)}%</Text>
        </View>

        <View style={styles.addRow}>
          {[1, 2, 5, 10, 20].map((n) => (
            <TouchableOpacity key={n} style={styles.addBtn} onPress={() => addPages(n)}>
              <Text style={styles.addBtnText}>+{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>عداد الختمات</Text>
        <View style={styles.completionsRow}>
          <Text style={styles.completionsNumber}>{completions}</Text>
          <Text style={styles.completionsLabel}>ختمة مكتملة</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.gold, writingDirection: 'rtl', marginBottom: 12 },
  mainStat: { flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', gap: 4 },
  pageNumber: { fontSize: 48, fontWeight: '700', color: colors.gold },
  pageLabel: { fontSize: 16, color: colors.muted, writingDirection: 'rtl' },
  progressRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 8 },
  progressBar: { flex: 1, height: 8, backgroundColor: colors.cardBorder, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 4 },
  progressText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  wirdText: { fontSize: 16, color: colors.text, textAlign: 'center', writingDirection: 'rtl', marginBottom: 8 },
  addRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 16 },
  addBtn: { backgroundColor: colors.gold, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: colors.navy, fontWeight: '700', fontSize: 14 },
  completionsRow: { alignItems: 'center', gap: 4 },
  completionsNumber: { fontSize: 48, fontWeight: '700', color: colors.gold },
  completionsLabel: { fontSize: 16, color: colors.muted, writingDirection: 'rtl' },
});
