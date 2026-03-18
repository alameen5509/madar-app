import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { watchApi } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

type LinkMethod = 'code' | 'qr' | 'bluetooth' | 'approval';

export default function WatchScreen() {
  const [activeMethod, setActiveMethod] = useState<LinkMethod | null>(null);
  const [code, setCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  const doLink = async (linkCode: string) => {
    setLinking(true);
    try {
      await watchApi.link(linkCode);
      Alert.alert('تم ✓', 'تم ربط الساعة بنجاح');
      setCode('');
      setActiveMethod(null);
      setShowQR(false);
    } catch {
      Alert.alert('خطأ', 'فشل ربط الساعة. تأكد من الرمز');
    } finally {
      setLinking(false);
    }
  };

  const handleCodeLink = () => {
    if (code.replace(/\s/g, '').length < 6) {
      Alert.alert('تنبيه', 'يرجى إدخال الرمز المكون من 6 أرقام');
      return;
    }
    doLink(code.replace(/\s/g, ''));
  };

  const handleQRScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('صلاحية مطلوبة', 'يجب السماح بالكاميرا لمسح رمز QR');
        return;
      }
    }
    scannedRef.current = false;
    setShowQR(true);
  };

  const onBarcodeScanned = (result: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setShowQR(false);
    const scannedCode = result.data.replace(/\D/g, '').slice(0, 6);
    if (scannedCode.length === 6) {
      doLink(scannedCode);
    } else {
      Alert.alert('خطأ', 'رمز QR غير صالح');
    }
  };

  const handleBluetoothScan = () => {
    setScanning(true);
    Alert.alert(
      'البلوتوث',
      'البحث عن ساعات قريبة...\nهذه الميزة تتطلب جهاز حقيقي وصلاحيات البلوتوث',
      [{ text: 'حسناً', onPress: () => setScanning(false) }]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>⌚ ربط الساعة</Text>
        <Text style={styles.subtitle}>اختر طريقة ربط ساعتك الذكية</Text>

        {/* Method 1: QR Code */}
        <TouchableOpacity onPress={() => setActiveMethod('qr')}>
          <Card style={activeMethod === 'qr' ? [styles.methodCard, styles.methodActive] : styles.methodCard}>
            <View style={styles.methodHeader}>
              <Text style={styles.methodIcon}>📷</Text>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>مسح رمز QR</Text>
                <Text style={styles.methodDesc}>امسح الرمز المعروض على شاشة الساعة بالكاميرا</Text>
              </View>
            </View>
            {activeMethod === 'qr' && (
              <View style={styles.methodBody}>
                <Button title="📷 فتح الكاميرا" onPress={handleQRScan} />
              </View>
            )}
          </Card>
        </TouchableOpacity>

        {/* Method 2: Code */}
        <TouchableOpacity onPress={() => setActiveMethod('code')}>
          <Card style={activeMethod === 'code' ? [styles.methodCard, styles.methodActive] : styles.methodCard}>
            <View style={styles.methodHeader}>
              <Text style={styles.methodIcon}>🔢</Text>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>إدخال الكود</Text>
                <Text style={styles.methodDesc}>أدخل الرمز المعروض على شاشة الساعة</Text>
              </View>
            </View>
            {activeMethod === 'code' && (
              <View style={styles.methodBody}>
                <TextInput
                  style={styles.codeInput}
                  value={code}
                  onChangeText={(t) => {
                    const raw = t.replace(/\D/g, '').slice(0, 6);
                    const formatted = raw.length > 3 ? raw.slice(0, 3) + ' ' + raw.slice(3) : raw;
                    setCode(formatted);
                  }}
                  placeholder="000 000"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  maxLength={7}
                  textAlign="center"
                />
                <Button title="ربط" onPress={handleCodeLink} loading={linking} />
              </View>
            )}
          </Card>
        </TouchableOpacity>

        {/* Method 3: Bluetooth */}
        <TouchableOpacity onPress={() => setActiveMethod('bluetooth')}>
          <Card style={activeMethod === 'bluetooth' ? [styles.methodCard, styles.methodActive] : styles.methodCard}>
            <View style={styles.methodHeader}>
              <Text style={styles.methodIcon}>📡</Text>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>بلوتوث (BLE)</Text>
                <Text style={styles.methodDesc}>البحث عن الساعة القريبة وربطها تلقائياً</Text>
              </View>
            </View>
            {activeMethod === 'bluetooth' && (
              <View style={styles.methodBody}>
                <Text style={styles.bleNote}>تأكد أن البلوتوث مفعل على الهاتف والساعة</Text>
                <Button
                  title={scanning ? 'جاري البحث...' : '🔍 بحث عن ساعات'}
                  onPress={handleBluetoothScan}
                  loading={scanning}
                />
              </View>
            )}
          </Card>
        </TouchableOpacity>

        {/* Method 4: Approval */}
        <TouchableOpacity onPress={() => setActiveMethod('approval')}>
          <Card style={activeMethod === 'approval' ? [styles.methodCard, styles.methodActive] : styles.methodCard}>
            <View style={styles.methodHeader}>
              <Text style={styles.methodIcon}>✅</Text>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>موافقة من التطبيق</Text>
                <Text style={styles.methodDesc}>الساعة ترسل طلب ربط — وافق من هنا</Text>
              </View>
            </View>
            {activeMethod === 'approval' && (
              <View style={styles.methodBody}>
                <Text style={styles.bleNote}>
                  عند ضغط "ربط" على الساعة، ستصلك إشعار على التطبيق للموافقة أو الرفض
                </Text>
                <Text style={styles.waitingText}>⏳ في انتظار طلب ربط...</Text>
              </View>
            )}
          </Card>
        </TouchableOpacity>

        {/* Instructions */}
        <Card>
          <Text style={styles.instructionTitle}>كيف يعمل؟</Text>
          {[
            '1. افتح تطبيق مدار على الساعة',
            '2. اختر طريقة الربط المناسبة',
            '3. اتبع التعليمات على الشاشتين',
            '4. بعد الربط تتزامن مهامك تلقائياً',
          ].map((step, i) => (
            <Text key={i} style={styles.step}>{step}</Text>
          ))}
        </Card>
      </ScrollView>

      {/* QR Scanner Modal */}
      <Modal visible={showQR} animationType="slide">
        <View style={styles.qrContainer}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onBarcodeScanned}
          />
          <View style={styles.qrOverlay}>
            <View style={styles.qrFrame} />
          </View>
          <View style={styles.qrFooter}>
            <Text style={styles.qrHint}>وجّه الكاميرا نحو رمز QR على الساعة</Text>
            <TouchableOpacity style={styles.qrCancel} onPress={() => setShowQR(false)}>
              <Text style={styles.qrCancelText}>إلغاء</Text>
            </TouchableOpacity>
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
  subtitle: { fontSize: 14, color: colors.muted, writingDirection: 'rtl' },
  methodCard: { gap: 8 },
  methodActive: { borderColor: colors.gold },
  methodHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  methodIcon: { fontSize: 32 },
  methodInfo: { flex: 1, gap: 2 },
  methodTitle: { fontSize: 16, fontWeight: '700', color: colors.text, writingDirection: 'rtl' },
  methodDesc: { fontSize: 13, color: colors.muted, writingDirection: 'rtl' },
  methodBody: { gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  codeInput: {
    backgroundColor: colors.card, borderWidth: 2, borderColor: colors.gold,
    borderRadius: borderRadius.md, padding: spacing.md,
    color: colors.gold, fontSize: 28, fontWeight: '700', letterSpacing: 8,
  },
  bleNote: { fontSize: 13, color: colors.textSecondary, writingDirection: 'rtl', lineHeight: 20 },
  waitingText: { fontSize: 14, color: colors.gold, textAlign: 'center', writingDirection: 'rtl' },
  instructionTitle: { fontSize: 16, fontWeight: '700', color: colors.gold, writingDirection: 'rtl', marginBottom: 8 },
  step: { fontSize: 14, color: colors.text, writingDirection: 'rtl', paddingVertical: 4, lineHeight: 22 },
  // QR Scanner
  qrContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  qrOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  qrFrame: { width: 250, height: 250, borderWidth: 3, borderColor: colors.gold, borderRadius: 20 },
  qrFooter: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', gap: 16 },
  qrHint: { color: '#FFF', fontSize: 16, fontWeight: '600', writingDirection: 'rtl' },
  qrCancel: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24 },
  qrCancelText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
