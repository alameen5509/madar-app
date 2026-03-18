import { Stack } from 'expo-router';
import { colors } from '../../theme/colors';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.gold,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="user-screens" options={{ title: 'شاشات المستخدمين' }} />
      <Stack.Screen name="budget" options={{ title: 'ميزانية المشاريع' }} />
    </Stack>
  );
}
