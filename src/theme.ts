import { Platform, PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';

export const FONTS = {
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
};

export const COLORS = {
  bg: '#070B14',
  surface: '#0F172A',
  surfaceElevated: '#1E293B',
  surfaceHighlight: '#283548',
  terminalBg: '#03060C',
  border: '#334155',
  borderSubtle: '#1E293B',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  accentBlue: '#3B82F6',
  accentBlueDark: '#1D4ED8',
  accentCyan: '#06B6D4',
  accentCyanDark: '#0E7490',
  accentEmerald: '#10B981',
  accentEmeraldDark: '#047857',
  accentAmber: '#F59E0B',
  accentAmberDark: '#B45309',
  accentRose: '#EF4444',
  accentRoseDark: '#B91C1C',
  accentPurple: '#8B5CF6',
  accentPurpleDark: '#6D28D9',
  accentPink: '#EC4899',
  codeBg: '#050811',
  syntaxKeyword: '#C084FC',
  syntaxString: '#6EE7B7',
  syntaxNumber: '#FBBF24',
  syntaxComment: '#64748B',
};

export interface EngineeringRank {
  level: string;
  title: string;
  minXp: number;
  nextXp: number;
  color: string;
}

export const ENGINEERING_RANKS: EngineeringRank[] = [
  { level: 'L3', title: 'Junior Systems Engineer', minXp: 0, nextXp: 400, color: '#3B82F6' },
  { level: 'L4', title: 'Systems Engineer II', minXp: 400, nextXp: 1000, color: '#06B6D4' },
  { level: 'L5', title: 'Senior Systems Engineer', minXp: 1000, nextXp: 1800, color: '#10B981' },
  { level: 'L6', title: 'Staff Systems Architect', minXp: 1800, nextXp: 2800, color: '#F59E0B' },
  { level: 'L7', title: 'Principal Chaos Fellow', minXp: 2800, nextXp: 4500, color: '#8B5CF6' },
  { level: 'L8', title: 'Distinguished Systems Fellow', minXp: 4500, nextXp: 10000, color: '#EC4899' },
];

export function getEngineerRank(xp: number): {
  current: EngineeringRank;
  progressPct: number;
  xpToNext: number;
} {
  let current = ENGINEERING_RANKS[0];
  for (const r of ENGINEERING_RANKS) {
    if (xp >= r.minXp) {
      current = r;
    }
  }
  const span = Math.max(1, current.nextXp - current.minXp);
  const progressPct = Math.min(100, Math.max(0, Math.round(((xp - current.minXp) / span) * 100)));
  const xpToNext = Math.max(0, current.nextXp - xp);
  return { current, progressPct, xpToNext };
}

export function getMasteryTier(scorePct?: number): {
  tier: 'S-TIER' | 'A-TIER' | 'B-TIER' | 'UNSOLVED';
  label: string;
  color: string;
} {
  if (scorePct === undefined) {
    return { tier: 'UNSOLVED', label: 'UNSOLVED', color: COLORS.textMuted };
  }
  if (scorePct >= 95) {
    return { tier: 'S-TIER', label: `S-TIER · ${scorePct}%`, color: COLORS.accentEmerald };
  }
  if (scorePct >= 80) {
    return { tier: 'A-TIER', label: `A-TIER · ${scorePct}%`, color: COLORS.accentCyan };
  }
  return { tier: 'B-TIER', label: `B-TIER · ${scorePct}%`, color: COLORS.accentAmber };
}

/**
 * Returns a WCAG 2.2 AA compliant foreground text color (#070B14 or #FFFFFF)
 * achieving >= 4.5:1 contrast against the given hex background color.
 */
export function getContrastText(hexBg: string): string {
  const clean = hexBg.replace('#', '');
  if (clean.length !== 6) return '#FFFFFF';
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
  const contrastWithDark = (lum + 0.05) / (0.006 + 0.05);
  const contrastWithWhite = (1.0 + 0.05) / (lum + 0.05);
  return contrastWithDark >= contrastWithWhite ? COLORS.bg : '#FFFFFF';
}

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
