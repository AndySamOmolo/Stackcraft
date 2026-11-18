import React, { useCallback, useState } from 'react';
import { Tabs, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../src/theme';
import { DynamicIcon } from '../../src/components/DynamicIcon';
import { loadLearnerProfile } from '../../src/lib/storage';
import { CURRICULUM_MODULES } from '../../src/data/curriculum';
import { isCardDue } from '../../src/lib/fsrs';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(8, insets.bottom);
  const [dueCount, setDueCount] = useState<number>(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadLearnerProfile().then((p) => {
        if (!active) return;
        const completedSet = new Set(p.completedModuleIds);
        let due = 0;
        for (const m of CURRICULUM_MODULES) {
          for (const c of m.flashcards) {
            const st = p.fsrsStates[c.id];
            const unlocked =
              completedSet.has(m.id) ||
              Boolean(st && st.reps > 0) ||
              m.trackId === 'track-1-memory';
            if (unlocked && (!st || isCardDue(st))) {
              due++;
            }
          }
        }
        setDueCount(due);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: { fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 54 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarActiveTintColor: COLORS.accentBlue,
        tabBarInactiveTintColor: COLORS.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Skill Tree',
          tabBarAccessibilityLabel: 'Skill Tree tab',
          tabBarIcon: ({ color }) => <DynamicIcon name="layers" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="labs"
        options={{
          title: 'Simulators',
          tabBarAccessibilityLabel: 'Interactive Simulators tab',
          tabBarIcon: ({ color }) => <DynamicIcon name="cpu" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: 'FSRS Vault',
          tabBarBadge: dueCount > 0 ? dueCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: COLORS.accentAmber,
            color: COLORS.bg,
            fontFamily: FONTS.mono,
            fontWeight: '700',
            fontSize: 10,
          },
          tabBarAccessibilityLabel: `FSRS Spaced Repetition Vault tab${dueCount > 0 ? `, ${dueCount} cards due` : ''}`,
          tabBarIcon: ({ color }) => <DynamicIcon name="book-open" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Telemetry',
          tabBarAccessibilityLabel: 'Engineering Telemetry and Settings tab',
          tabBarIcon: ({ color }) => <DynamicIcon name="award" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}
