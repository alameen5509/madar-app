// BLE module for watch connection
// Requires: react-native-ble-plx (install when building native)
// This is a placeholder that provides the interface — actual BLE requires native build

export interface BleDevice {
  id: string;
  name: string | null;
  rssi: number;
}

export interface BleManager {
  startScan: (onDevice: (device: BleDevice) => void) => Promise<void>;
  stopScan: () => void;
  connectAndSendToken: (deviceId: string, pin: string, jwt: string) => Promise<boolean>;
}

// Placeholder implementation for Expo Go
// Real implementation requires development build with react-native-ble-plx
export function createBleManager(): BleManager {
  return {
    startScan: async (_onDevice) => {
      console.warn('BLE scanning requires a native development build');
    },
    stopScan: () => {},
    connectAndSendToken: async (_deviceId, _pin, _jwt) => {
      console.warn('BLE connection requires a native development build');
      return false;
    },
  };
}

// GATT Service UUID for Madar Watch Auth
export const MADAR_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
export const MADAR_TOKEN_CHAR_UUID = '12345678-1234-5678-1234-56789abcdef1';
export const MADAR_PIN_CHAR_UUID = '12345678-1234-5678-1234-56789abcdef2';
