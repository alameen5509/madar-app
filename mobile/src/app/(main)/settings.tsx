import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Alert, Linking } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import { Card } from '../../components/ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export default function SettingsScreen() {
  const { logout, userEmail, userRole } = useAuth();
  const settings = useSettings();

  const handleLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile */}
      <Card>
        <Text style={styles.sectionTitle}>الحساب</Text>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userEmail?.charAt(0)?.toUpperCase() || 'م'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileEmail}>{userEmail || '—'}</Text>
            <Text style={styles.profileRole}>{userRole === 'Admin' ? 'مشرف النظام' : 'مستخدم'}</Text>
          </View>
        </View>
      </Card>

      {/* Preferences */}
      <Card>
        <Text style={styles.sectionTitle}>التفضيلات</Text>
        <View style={styles.switchRow}>
          <Text style={styles.label}>العمل الليلي</Text>
          <Switch
            value={settings.nightWorkEnabled}
            onValueChange={(val) => settings.setNightWork(val)}
            trackColor={{ false: colors.cardBorder, true: colors.turquoise }}
            thumbColor={colors.white}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.switchRow}>
          <Text style={styles.label}>إشعارات المهام</Text>
          <Switch
            value={settings.notificationsEnabled ?? true}
            onValueChange={(val) => settings.setNotifications?.(val)}
            trackColor={{ false: colors.cardBorder, true: colors.turquoise }}
            thumbColor={colors.white}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.switchRow}>
          <Text style={styles.label}>صوت ذكر الصلاة</Text>
          <Switch
            value={settings.prayerSoundEnabled ?? true}
            onValueChange={(val) => settings.setPrayerSound?.(val)}
            trackColor={{ false: colors.cardBorder, true: colors.turquoise }}
            thumbColor={colors.white}
          />
        </View>
      </Card>

      {/* Pomodoro */}
      <Card>
        <Text style={styles.sectionTitle}>مؤقت التركيز</Text>
        <View style={styles.row}>
          <Text style={styles.label}>مدة التركيز</Text>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => settings.setPomodoroFocus?.(Math.max(5, (settings.pomodoroFocus ?? 25) - 5))}>
              <Text style={styles.stepText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepValue}>{settings.pomodoroFocus ?? 25} دقيقة</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => settings.setPomodoroFocus?.((settings.pomodoroFocus ?? 25) + 5)}>
              <Text style={styles.stepText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>مدة الراحة</Text>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => settings.setPomodoroBreak?.(Math.max(1, (settings.pomodoroBreak ?? 5) - 1))}>
              <Text style={styles.stepText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepValue}>{settings.pomodoroBreak ?? 5} دقيقة</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => settings.setPomodoroBreak?.((settings.pomodoroBreak ?? 5) + 1)}>
              <Text style={styles.stepText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>

      {/* About */}
      <Card>
        <Text style={styles.sectionTitle}>حول التطبيق</Text>
        <View style={styles.row}>
          <Text style={styles.label}>الإصدار</Text>
          <Text style={styles.value}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>المنصة</Text>
          <Text style={styles.value}>Expo SDK 55</Text>
        </View>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://madar-web-ten.vercel.app')}>
          <Text style={styles.label}>الموقع</Text>
          <Text style={[styles.value, { color: colors.turquoise }]}>madar-web-ten.vercel.app</Text>
        </TouchableOpacity>
      </Card>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>تسجيل الخروج</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 100 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.gold, writingDirection: 'rtl', marginBottom: 12 },
  profileHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.purple },
  avatarText: { color: colors.gold, fontSize: 20, fontWeight: '700' },
  profileInfo: { flex: 1, gap: 2 },
  profileEmail: { fontSize: 15, color: colors.text, writingDirection: 'rtl', fontWeight: '600' },
  profileRole: { fontSize: 13, color: colors.muted, writingDirection: 'rtl' },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  switchRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  divider: { height: 1, backgroundColor: colors.cardBorder, marginVertical: 4 },
  label: { fontSize: 14, color: colors.text, writingDirection: 'rtl' },
  value: { fontSize: 14, color: colors.muted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, justifyContent: 'center', alignItems: 'center' },
  stepText: { color: colors.gold, fontSize: 18, fontWeight: '700' },
  stepValue: { fontSize: 14, color: colors.text, minWidth: 70, textAlign: 'center', writingDirection: 'rtl' },
  logoutBtn: { backgroundColor: colors.danger, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: spacing.lg },
  logoutText: { color: '#FFF', fontSize: 16, fontWeight: '700', writingDirection: 'rtl' },
});
