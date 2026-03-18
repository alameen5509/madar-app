import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Dimensions, ScrollView, Pressable,
} from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.78;

const drawerItems = [
  { label: 'لوحة التحكم', icon: '📊', route: '/(main)' },
  { label: 'أعمال اليوم', icon: '✅', route: '/(main)/tasks' },
  { label: 'أدوار الحياة', icon: '🎯', route: '/(main)/circles' },
  { label: 'الوظائف', icon: '💼', route: '/(main)/jobs' },
  { label: 'المشاريع', icon: '📁', route: '/(main)/projects' },
  { label: 'العادات', icon: '🔄', route: '/(main)/habits' },
  { label: 'ختمة', icon: '📖', route: '/(main)/quran' },
  { label: 'صندوق الوارد', icon: '📬', route: '/(main)/inbox' },
  { label: 'الإحصائيات', icon: '📈', route: '/(main)/energy' },
  { label: 'الإدارة المالية', icon: '💰', route: '/(main)/finance' },
  { label: 'المستخدمون', icon: '👥', route: '/(main)/users' },
  { label: 'جهات الاتصال', icon: '📱', route: '/(main)/contacts' },
  { label: 'الذكاء الاصطناعي', icon: '🤖', route: '/(main)/ai' },
  { label: 'ربط الساعة', icon: '⌚', route: '/(main)/watch' },
  { label: 'الإعدادات', icon: '⚙️', route: '/(main)/settings' },
];

const tabItems = [
  { name: 'index', label: 'الرئيسية', icon: '🏠' },
  { name: 'tasks', label: 'المهام', icon: '✅' },
  { name: 'circles', label: 'الأدوار', icon: '🎯' },
  { name: 'habits', label: 'العادات', icon: '🔄' },
  { name: 'settings', label: 'الإعدادات', icon: '⚙️' },
];

export default function MainLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const toggleDrawer = useCallback(() => {
    const toOpen = !drawerOpen;
    setDrawerOpen(toOpen);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: toOpen ? 0 : -DRAWER_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: toOpen ? 0.5 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [drawerOpen, slideAnim, overlayAnim]);

  const navigateTo = (route: string) => {
    toggleDrawer();
    router.push(route as any);
  };

  return (
    <View style={styles.container}>
      {/* Main content with tabs */}
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: colors.gold,
          headerTitleStyle: { fontWeight: '600', writingDirection: 'rtl' },
          headerRight: () => (
            <TouchableOpacity onPress={toggleDrawer} style={styles.menuBtn}>
              <Text style={styles.menuIcon}>☰</Text>
            </TouchableOpacity>
          ),
          tabBarStyle: {
            backgroundColor: colors.navy,
            borderTopColor: colors.cardBorder,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
          },
          tabBarActiveTintColor: colors.gold,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', writingDirection: 'rtl' },
        }}
      >
        {tabItems.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.label,
              tabBarIcon: ({ focused }) => (
                <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>{tab.icon}</Text>
              ),
            }}
          />
        ))}
        {/* Hidden screens - accessible via drawer only */}
        <Tabs.Screen name="jobs" options={{ href: null, title: 'الوظائف' }} />
        <Tabs.Screen name="projects" options={{ href: null, title: 'المشاريع' }} />
        <Tabs.Screen name="quran" options={{ href: null, title: 'ختمة' }} />
        <Tabs.Screen name="inbox" options={{ href: null, title: 'صندوق الوارد' }} />
        <Tabs.Screen name="energy" options={{ href: null, title: 'الإحصائيات' }} />
        <Tabs.Screen name="finance" options={{ href: null, title: 'الإدارة المالية' }} />
        <Tabs.Screen name="users" options={{ href: null, title: 'المستخدمون' }} />
        <Tabs.Screen name="contacts" options={{ href: null, title: 'جهات الاتصال' }} />
        <Tabs.Screen name="ai" options={{ href: null, title: 'الذكاء الاصطناعي' }} />
        <Tabs.Screen name="watch" options={{ href: null, title: 'ربط الساعة' }} />
      </Tabs>

      {/* Drawer overlay */}
      {drawerOpen && (
        <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={toggleDrawer} />
        </Animated.View>
      )}

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          { width: DRAWER_WIDTH, paddingTop: insets.top + 16, transform: [{ translateX: slideAnim }] },
        ]}
      >
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerLogo}>مدار</Text>
          <Text style={styles.drawerSubtitle}>إدارة الحياة الذكية</Text>
        </View>
        <ScrollView style={styles.drawerScroll} showsVerticalScrollIndicator={false}>
          {drawerItems.map((item) => {
            const isActive = pathname === item.route || (item.route === '/(main)' && pathname === '/');
            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.drawerItem, isActive && styles.drawerItemActive]}
                onPress={() => navigateTo(item.route)}
              >
                <Text style={styles.drawerIcon}>{item.icon}</Text>
                <Text style={[styles.drawerLabel, isActive && styles.drawerLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  menuBtn: { paddingHorizontal: 16 },
  menuIcon: { color: colors.gold, fontSize: 24 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 10,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.navyDark,
    zIndex: 20,
    borderLeftWidth: 1,
    borderLeftColor: colors.cardBorder,
  },
  drawerHeader: {
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    marginHorizontal: spacing.lg,
  },
  drawerLogo: { fontSize: 32, fontWeight: '700', color: colors.gold },
  drawerSubtitle: { fontSize: 13, color: colors.muted, marginTop: 4, writingDirection: 'rtl' },
  drawerScroll: { flex: 1, paddingTop: spacing.md },
  drawerItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  drawerItemActive: {
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRightWidth: 3,
    borderRightColor: colors.gold,
  },
  drawerIcon: { fontSize: 20 },
  drawerLabel: { fontSize: 15, color: colors.text, writingDirection: 'rtl' },
  drawerLabelActive: { color: colors.gold, fontWeight: '600' },
});
