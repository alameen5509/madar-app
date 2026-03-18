import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Linking, RefreshControl, Modal, FlatList } from 'react-native';
import * as Contacts from 'expo-contacts';
import { contactsApi } from '../../lib/api';
import type { Contact } from '../../lib/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

export default function ContactsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Phone contacts for import
  const [phoneContacts, setPhoneContacts] = useState<{ name: string; phone: string; selected: boolean }[]>([]);
  const [importing, setImporting] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await contactsApi.list();
      setContacts(data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const handleAdd = async () => {
    if (!name.trim() || !phone.trim()) { Alert.alert('تنبيه', 'الاسم ورقم الجوال مطلوبان'); return; }
    setSaving(true);
    try {
      await contactsApi.create({ name: name.trim(), phone: phone.trim(), notes: notes.trim() || undefined });
      setName(''); setPhone(''); setNotes('');
      setShowAdd(false);
      loadContacts();
    } catch {
      Alert.alert('خطأ', 'فشل الإضافة — قد تكون جهة الاتصال موجودة');
    } finally { setSaving(false); }
  };

  const handleDelete = (id: string, contactName: string) => {
    Alert.alert('حذف', `حذف "${contactName}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { await contactsApi.delete(id); loadContacts(); } catch {}
      }},
    ]);
  };

  const handleCall = (phoneNum: string) => Linking.openURL(`tel:+${phoneNum}`);
  const handleWhatsApp = (phoneNum: string) => Linking.openURL(`https://wa.me/${phoneNum}`);

  const handleImportFromPhone = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('صلاحية مطلوبة', 'يجب السماح بالوصول لجهات الاتصال');
      return;
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
    });

    const items = data
      .filter(c => c.name && c.phoneNumbers && c.phoneNumbers.length > 0)
      .map(c => ({
        name: c.name!,
        phone: c.phoneNumbers![0].number ?? '',
        selected: false,
      }))
      .filter(c => c.phone.length > 5);

    setPhoneContacts(items);
    setShowImport(true);
  };

  const toggleSelect = (idx: number) => {
    setPhoneContacts(prev => prev.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c));
  };

  const selectAll = () => {
    const allSelected = phoneContacts.every(c => c.selected);
    setPhoneContacts(prev => prev.map(c => ({ ...c, selected: !allSelected })));
  };

  const handleBulkImport = async () => {
    const selected = phoneContacts.filter(c => c.selected);
    if (selected.length === 0) { Alert.alert('تنبيه', 'اختر جهات اتصال أولاً'); return; }
    setImporting(true);
    try {
      const { data } = await contactsApi.import(selected.map(c => ({ name: c.name, phone: c.phone })));
      Alert.alert('تم ✓', `تم استيراد ${data.added} جهة اتصال`);
      setShowImport(false);
      loadContacts();
    } catch {
      Alert.alert('خطأ', 'فشل الاستيراد');
    } finally { setImporting(false); }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadContacts} tintColor={colors.turquoise} />}
      >
        <Text style={styles.pageTitle}>📱 جهات الاتصال</Text>
        <Text style={styles.subtitle}>{contacts.length} جهة اتصال</Text>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowAdd(true)}>
            <Text style={styles.actionText}>+ إضافة يدوية</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.importBtn]} onPress={handleImportFromPhone}>
            <Text style={[styles.actionText, { color: colors.turquoise }]}>📥 استيراد من الجوال</Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        {contacts.length === 0 && !loading && (
          <Card>
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📱</Text>
              <Text style={styles.emptyText}>لا توجد جهات اتصال</Text>
              <Text style={styles.emptyHint}>أضف أشخاصاً أو استورد من جهات الاتصال</Text>
            </View>
          </Card>
        )}

        {contacts.map(c => (
          <Card key={c.id}>
            <View style={styles.contactRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{c.name.charAt(0)}</Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactPhone}>{c.phone}</Text>
                {c.notes ? <Text style={styles.contactNotes}>{c.notes}</Text> : null}
                {c.taskCount > 0 && <Text style={styles.taskBadge}>{c.taskCount} مهمة</Text>}
              </View>
              <View style={styles.contactActions}>
                <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(c.phone)}>
                  <Text style={{ fontSize: 18 }}>📞</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.waBtn} onPress={() => handleWhatsApp(c.phone)}>
                  <Text style={{ fontSize: 18 }}>💬</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(c.id, c.name)}>
                  <Text style={{ fontSize: 14, color: colors.danger }}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* Add Contact Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>إضافة جهة اتصال</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="الاسم" placeholderTextColor={colors.muted} textAlign="right" />
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="رقم الجوال" placeholderTextColor={colors.muted} keyboardType="phone-pad" textAlign="left" />
            <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="ملاحظات (اختياري)" placeholderTextColor={colors.muted} textAlign="right" />
            <View style={styles.modalActions}>
              <Button title="إضافة" onPress={handleAdd} loading={saving} />
              <Button title="إلغاء" variant="ghost" onPress={() => setShowAdd(false)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Import Modal */}
      <Modal visible={showImport} animationType="slide">
        <View style={styles.importContainer}>
          <View style={styles.importHeader}>
            <Text style={styles.importTitle}>استيراد جهات الاتصال</Text>
            <Text style={styles.importSubtitle}>{phoneContacts.filter(c => c.selected).length} / {phoneContacts.length} محدد</Text>
          </View>
          <TouchableOpacity style={styles.selectAllBtn} onPress={selectAll}>
            <Text style={styles.selectAllText}>
              {phoneContacts.every(c => c.selected) ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
            </Text>
          </TouchableOpacity>
          <FlatList
            data={phoneContacts}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item, index }) => (
              <TouchableOpacity style={[styles.importItem, item.selected && styles.importItemSelected]} onPress={() => toggleSelect(index)}>
                <View style={[styles.checkbox, item.selected && styles.checkboxSelected]}>
                  {item.selected && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.importName}>{item.name}</Text>
                  <Text style={styles.importPhone}>{item.phone}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
          <View style={styles.importFooter}>
            <Button title={importing ? 'جارٍ الاستيراد...' : `استيراد (${phoneContacts.filter(c => c.selected).length})`} onPress={handleBulkImport} loading={importing} />
            <Button title="إلغاء" variant="ghost" onPress={() => setShowImport(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 100 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: colors.turquoise, writingDirection: 'rtl' },
  subtitle: { fontSize: 14, color: colors.muted, writingDirection: 'rtl' },
  actionsRow: { flexDirection: 'row-reverse', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.turquoise, alignItems: 'center' },
  importBtn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.turquoise },
  actionText: { color: '#fff', fontSize: 14, fontWeight: '700', writingDirection: 'rtl' },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.text, writingDirection: 'rtl' },
  emptyHint: { fontSize: 13, color: colors.muted, writingDirection: 'rtl', textAlign: 'center', marginTop: 8 },
  contactRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.turquoise, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  contactInfo: { flex: 1, gap: 2 },
  contactName: { fontSize: 15, fontWeight: '700', color: colors.text, writingDirection: 'rtl' },
  contactPhone: { fontSize: 13, color: colors.muted, direction: 'ltr' },
  contactNotes: { fontSize: 11, color: colors.textSecondary, writingDirection: 'rtl' },
  taskBadge: { fontSize: 10, color: colors.gold, fontWeight: '600', writingDirection: 'rtl' },
  contactActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  callBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3D8C5A15', justifyContent: 'center', alignItems: 'center' },
  waBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#25D36615', justifyContent: 'center', alignItems: 'center' },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.navyDark, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xxl, gap: spacing.md },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.turquoise, textAlign: 'center', writingDirection: 'rtl' },
  modalActions: { flexDirection: 'row-reverse', gap: 12, marginTop: spacing.md },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: borderRadius.md, padding: spacing.md, color: colors.text, fontSize: 15, writingDirection: 'rtl' },
  // Import
  importContainer: { flex: 1, backgroundColor: colors.navy },
  importHeader: { padding: spacing.lg, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  importTitle: { fontSize: 20, fontWeight: '700', color: colors.turquoise, writingDirection: 'rtl' },
  importSubtitle: { fontSize: 13, color: colors.muted, writingDirection: 'rtl', marginTop: 4 },
  selectAllBtn: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  selectAllText: { color: colors.gold, fontSize: 14, fontWeight: '600', writingDirection: 'rtl' },
  importItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  importItemSelected: { backgroundColor: colors.turquoise + '10' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.cardBorder, justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: colors.turquoise, borderColor: colors.turquoise },
  importName: { fontSize: 14, fontWeight: '600', color: colors.text, writingDirection: 'rtl' },
  importPhone: { fontSize: 12, color: colors.muted },
  importFooter: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardBorder },
});
