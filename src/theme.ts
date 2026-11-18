import { Platform, PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';

export const COLORS = {
  bg: '#0B0F19',
  surface: '#111827',
  surfaceElevated: '#1E293B',
  border: '#334155',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  accentBlue: '#3B82F6',
  accentEmerald: '#10B981',
  accentAmber: '#F59E0B',
  accentRose: '#EF4444',
  accentPurple: '#8B5CF6',
  codeBg: '#090D16',
};

export function androidRipple(color = 'rgba(255, 255, 255, 0.12)'): PressableProps['android_ripple'] {
  if (Platform.OS !== 'android') return undefined;
  return { color, borderless: false };
}

export function triggerHaptic(kind: 'selection' | 'success' | 'warning' | 'error' = 'selection'): void {
  if (Platform.OS === 'web') return;
  try {
    if (kind === 'selection') {
      Haptics.selectionAsync();
    } else if (kind === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (kind === 'warning') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  } catch {
    // Ignore on unsupported devices
  }
}
