import { useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';

export function useSettings() {
  const store = useSettingsStore();

  useEffect(() => {
    store.load();
  }, []);

  return store;
}
