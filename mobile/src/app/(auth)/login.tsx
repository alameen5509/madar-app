import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { IslamicPattern } from '../../components/ui/IslamicPattern';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

export default function LoginScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('تنبيه', 'يرجى إدخال البريد وكلمة المرور');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (e: any) {
      Alert.alert('خطأ', e?.response?.data?.message || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <IslamicPattern />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.logo}>مدار</Text>
            <Text style={styles.subtitle}>نظام إدارة الحياة الذكي</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>البريد الإلكتروني</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="example@mail.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textAlign="right"
            />

            <Text style={styles.label}>كلمة المرور</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry
              textAlign="right"
            />

            <Button
              title="تسجيل الدخول"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginBtn}
            />

            <Link href="/(auth)/register" style={styles.link}>
              <Text style={styles.linkText}>ليس لديك حساب؟ سجّل الآن</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 48, fontWeight: '700', color: colors.gold, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.textSecondary, writingDirection: 'rtl' },
  form: { gap: spacing.md },
  label: { color: colors.text, fontSize: 14, fontWeight: '600', writingDirection: 'rtl', marginBottom: 4 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    writingDirection: 'rtl',
  },
  loginBtn: { marginTop: spacing.lg },
  link: { alignSelf: 'center', marginTop: spacing.lg },
  linkText: { color: colors.gold, fontSize: 14, writingDirection: 'rtl' },
});
