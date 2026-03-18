import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  theme: 'dark' | 'light';
  nightWorkEnabled: boolean;
  nightWorkDuration: number;
  pomodoroFocus: number;
  pomodoroBreak: number;
  notificationsEnabled: boolean;
  prayerSoundEnabled: boolean;
  setTheme: (theme: 'dark' | 'light') => void;
  setNightWork: (enabled: boolean, duration?: number) => void;
  setPomodoro: (focus: number, breakTime: number) => void;
  setPomodoroFocus: (focus: number) => void;
  setPomodoroBreak: (breakTime: number) => void;
  setNotifications: (enabled: boolean) => void;
  setPrayerSound: (enabled: boolean) => void;
  load: () => Promise<void>;
}

const persist = (state: SettingsState) => {
  const { theme, nightWorkEnabled, nightWorkDuration, pomodoroFocus, pomodoroBreak, notificationsEnabled, prayerSoundEnabled } = state;
  AsyncStorage.setItem('madar_settings', JSON.stringify({ theme, nightWorkEnabled, nightWorkDuration, pomodoroFocus, pomodoroBreak, notificationsEnabled, prayerSoundEnabled }));
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'dark',
  nightWorkEnabled: false,
  nightWorkDuration: 60,
  pomodoroFocus: 25,
  pomodoroBreak: 5,
  notificationsEnabled: true,
  prayerSoundEnabled: true,
  setTheme: (theme) => { set({ theme }); persist(get()); },
  setNightWork: (enabled, duration) => {
    set({ nightWorkEnabled: enabled, ...(duration !== undefined ? { nightWorkDuration: duration } : {}) });
    persist(get());
  },
  setPomodoro: (focus, breakTime) => { set({ pomodoroFocus: focus, pomodoroBreak: breakTime }); persist(get()); },
  setPomodoroFocus: (focus) => { set({ pomodoroFocus: focus }); persist(get()); },
  setPomodoroBreak: (breakTime) => { set({ pomodoroBreak: breakTime }); persist(get()); },
  setNotifications: (enabled) => { set({ notificationsEnabled: enabled }); persist(get()); },
  setPrayerSound: (enabled) => { set({ prayerSoundEnabled: enabled }); persist(get()); },
  load: async () => {
    const raw = await AsyncStorage.getItem('madar_settings');
    if (raw) {
      const data = JSON.parse(raw);
      set({
        theme: data.theme ?? 'dark',
        nightWorkEnabled: data.nightWorkEnabled ?? false,
        nightWorkDuration: data.nightWorkDuration ?? 60,
        pomodoroFocus: data.pomodoroFocus ?? 25,
        pomodoroBreak: data.pomodoroBreak ?? 5,
        notificationsEnabled: data.notificationsEnabled ?? true,
        prayerSoundEnabled: data.prayerSoundEnabled ?? true,
      });
    }
  },
}));
