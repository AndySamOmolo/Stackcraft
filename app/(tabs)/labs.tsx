import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { CURRICULUM_MODULES } from '../../src/data/curriculum';
import { COLORS, androidRipple } from '../../src/theme';
import { DynamicIcon, IconName } from '../../src/components/DynamicIcon';

const ENGINE_CARDS: {
  type: string;
  title: string;
  icon: IconName;
  color: string;
  summary: string;
}[] = [
  {
    type: 'memory-tracer',
    title: 'Human Debugger (Stack & Heap Tracer)',
    icon: 'layers',
    color: COLORS.accentBlue,
    summary: 'Step through multi-language code while predicting Call Stack frames, Heap pointers, and lexical closures.',
  },
  {
    type: 'ai-auditor',
    title: 'Spot the AI Hallucination (PR Diff Auditor)',
    icon: 'git-pull-request',
    color: COLORS.accentAmber,
    summary: 'Inspect plausible AI-generated pull requests to uncover quadratic O(n^2) loops, TOCTOU race conditions, and SQLi.',
  },
  {
    type: 'chaos-architect',
    title: 'Chaos Architect (Distributed Topology Sim)',
    icon: 'server',
    color: COLORS.accentEmerald,
    summary: 'Toggle Redis read caches, Kafka write queues, and DB replicas to survive 12,000 RPS flash-crowd spikes.',
  },
  {
    type: 'incident-commander',
    title: 'Incident Commander (Linux Kernel War Room)',
    icon: 'terminal',
    color: COLORS.accentPurple,
    summary: 'Run journalctl, /proc/limits, and ss socket probes to diagnose live 502 Bad Gateway outages.',
  },
];

export default function SimulatorsDirectoryScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Interactive Simulation Engines</Text>
      <Text style={styles.subheading}>
        Jump directly into any of the four touch-native engineering engines:
      </Text>

      {ENGINE_CARDS.map((eng) => {
        const matchingModules = CURRICULUM_MODULES.filter((m) => m.engineType === eng.type);
        return (
          <View key={eng.type} style={styles.engineBlock}>
            <View style={styles.engineHeader}>
              <DynamicIcon name={eng.icon} size={20} color={eng.color} />
              <Text style={styles.engineTitle}>{eng.title}</Text>
            </View>
            <Text style={styles.engineSummary}>{eng.summary}</Text>
            {matchingModules.map((mod) => (
              <Pressable
                key={mod.id}
                onPress={() => router.push(`/lab/${mod.id}`)}
                android_ripple={androidRipple()}
                style={styles.launchBtn}
              >
                <Text style={styles.launchText}>Launch: {mod.title}</Text>
                <DynamicIcon name="play" size={15} color={COLORS.accentBlue} />
              </Pressable>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  heading: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  subheading: { color: COLORS.textSecondary, fontSize: 13.5, marginBottom: 18 },
  engineBlock: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  engineHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  engineTitle: { color: COLORS.textPrimary, fontSize: 15.5, fontWeight: '700', flex: 1 },
  engineSummary: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  launchBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 6,
  },
  launchText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
});
