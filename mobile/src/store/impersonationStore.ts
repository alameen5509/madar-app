import { create } from 'zustand';
import { getAccessToken, setTokens } from '../lib/auth';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ADMIN_TOKEN_KEY = 'madar_admin_token_backup';
const ADMIN_REFRESH_KEY = 'madar_admin_refresh_backup';

const isWeb = Platform.OS === 'web';

async function secureGet(key: string): Promise<string | null> {
  if (isWeb) return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
async function secureSet(key: string, value: string): Promise<void> {
  if (isWeb) { await AsyncStorage.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
}
async function secureDelete(key: string): Promise<void> {
  if (isWeb) { await AsyncStorage.removeItem(key); return; }
  await SecureStore.deleteItemAsync(key);
}

interface ImpersonationState {
  isImpersonating: boolean;
  targetUserName: string | null;
  targetUserId: string | null;
  startImpersonation: (userId: string, userName: string, newAccessToken: string, newRefreshToken: string) => Promise<void>;
  stopImpersonation: () => Promise<{ accessToken: string; refreshToken: string } | null>;
}

export const useImpersonationStore = create<ImpersonationState>((set) => ({
  isImpersonating: false,
  targetUserName: null,
  targetUserId: null,

  startImpersonation: async (userId, userName, newAccessToken, newRefreshToken) => {
    // Backup admin's current tokens
    const currentAccess = await getAccessToken();
    const currentRefresh = await secureGet('madar_refresh_token');
    if (currentAccess) await secureSet(ADMIN_TOKEN_KEY, currentAccess);
    if (currentRefresh) await secureSet(ADMIN_REFRESH_KEY, currentRefresh);

    // Set impersonation tokens
    await setTokens(newAccessToken, newRefreshToken);
    set({ isImpersonating: true, targetUserName: userName, targetUserId: userId });
  },

  stopImpersonation: async () => {
    const adminAccess = await secureGet(ADMIN_TOKEN_KEY);
    const adminRefresh = await secureGet(ADMIN_REFRESH_KEY);
    if (adminAccess && adminRefresh) {
      await setTokens(adminAccess, adminRefresh);
      await secureDelete(ADMIN_TOKEN_KEY);
      await secureDelete(ADMIN_REFRESH_KEY);
    }
    set({ isImpersonating: false, targetUserName: null, targetUserId: null });
    return adminAccess && adminRefresh ? { accessToken: adminAccess, refreshToken: adminRefresh } : null;
  },
}));
