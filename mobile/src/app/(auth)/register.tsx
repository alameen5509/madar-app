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

export default function RegisterScreen() {
  const { register } = useAuth();
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('تنبيه', 'يرجى ملء جميع الحقول');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('تنبيه', 'كلمتا المرور غير متطابقتين');
      return;
    }
    setLoading(true);
    try {
      await register(fullName, email, password);
    } catch (e: any) {
      Alert.alert('خطأ', e?.response?.data?.errors?.[0] || 'فشل إنشاء الحساب');
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
            <Text style={styles.subtitle}>إنشاء حساب جديد</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>الاسم الكامل</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="محمد عبدالله"
              placeholderTextColor={colors.muted}
              textAlign="right"
            />

            <Text style={styles.label}>البريد الإلكتروني</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="example@mail.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
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

            <Text style={styles.label}>تأكيد كلمة المرور</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry
              textAlign="right"
            />

            <Button
              title="إنشاء الحساب"
              onPress={handleRegister}
              loading={loading}
              style={styles.registerBtn}
            />

            <Link href="/(auth)/login" style={styles.link}>
              <Text style={styles.linkText}>لديك حساب؟ سجّل الدخول</Text>
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
  registerBtn: { marginTop: spacing.lg },
  link: { alignSelf: 'center', marginTop: spacing.lg },
  linkText: { color: colors.gold, fontSize: 14, writingDirection: 'rtl' },
});
