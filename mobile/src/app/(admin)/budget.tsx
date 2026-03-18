import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card } from '../../components/ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export default function BudgetScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>💼 ميزانية المشاريع</Text>
      <Card>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>📊</Text>
          <Text style={styles.placeholderText}>
            ميزانية المشاريع — قريباً
          </Text>
          <Text style={styles.placeholderDesc}>
            تتبع تكاليف المهام مقابل ميزانية كل مشروع
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, gap: spacing.lg },
  pageTitle: { fontSize: 22, fontWeight: '700', color: colors.gold, writingDirection: 'rtl' },
  placeholder: { alignItems: 'center', paddingVertical: 40 },
  placeholderIcon: { fontSize: 48, marginBottom: 12 },
  placeholderText: { fontSize: 18, fontWeight: '600', color: colors.text, writingDirection: 'rtl' },
  placeholderDesc: { fontSize: 14, color: colors.muted, writingDirection: 'rtl', textAlign: 'center', marginTop: 8 },
});
