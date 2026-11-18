import React from 'react';
import { Tabs } from 'expo-router';
import { COLORS } from '../../src/theme';
import { DynamicIcon } from '../../src/components/DynamicIcon';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: COLORS.accentBlue,
        tabBarInactiveTintColor: COLORS.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Skill Tree',
          tabBarIcon: ({ color }) => <DynamicIcon name="layers" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="labs"
        options={{
          title: 'Simulators',
          tabBarIcon: ({ color }) => <DynamicIcon name="cpu" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: 'FSRS Vault',
          tabBarIcon: ({ color }) => <DynamicIcon name="book-open" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Telemetry',
          tabBarIcon: ({ color }) => <DynamicIcon name="award" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}
