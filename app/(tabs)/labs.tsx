import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { CURRICULUM_MODULES } from '../../src/data/curriculum';
import { loadLearnerProfile, LearnerProfile } from '../../src/lib/storage';
import { COLORS, androidRipple, triggerHaptic } from '../../src/theme';
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
    summary: 'Step through multi-language code while predicting Call Stack frames, Heap pointers, closures, and async microtasks.',
  },
  {
    type: 'ai-auditor',
    title: 'Spot the AI Hallucination (PR Diff Auditor)',
    icon: 'git-pull-request',
    color: COLORS.accentAmber,
    summary: 'Inspect plausible AI-generated pull requests to uncover quadratic O(n^2) loops, TOCTOU races, JWT flaws, and SSRF.',
  },
  {
    type: 'chaos-architect',
    title: 'Chaos Architect (Distributed Topology Sim)',
    icon: 'server',
    color: COLORS.accentEmerald,
    summary: 'Toggle Redis caches, Kafka write queues, KEDA workers, and DB replicas to survive 12,000–20,000 RPS flash-crowd spikes.',
  },
  {
    type: 'incident-commander',
    title: 'Incident Commander (Linux & K8s War Room)',
    icon: 'terminal',
    color: COLORS.accentPurple,
    summary: 'Run journalctl, /proc/limits, ss, kubectl, and vLLM metrics probes to diagnose live production outages.',
  },
];

export default function SimulatorsDirectoryScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [diffFilter, setDiffFilter] = useState<'All' | 'Foundational' | 'Intermediate' | 'Staff-Level'>('All');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadLearnerProfile().then((p) => {
        if (active) setProfile(p);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const completedIds = profile?.completedModuleIds || [];
  const scores = profile?.moduleScores || {};

  const pickChallengeLab = () => {
    triggerHaptic('selection');
    const unsolved = CURRICULUM_MODULES.filter((m) => !completedIds.includes(m.id));
    const pool = unsolved.length > 0 ? unsolved : CURRICULUM_MODULES;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    router.push(`/lab/${chosen.id}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading} accessibilityRole="header">
            Simulation Engines ({CURRICULUM_MODULES.length} Labs)
          </Text>
          <Text style={styles.subheading}>
            Drill by engine archetype or launch a surprise Staff-level challenge:
          </Text>
        </View>
      </View>

      {/* Random Challenge Quick-Launch Banner */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Launch random unsolved engineering lab challenge"
        onPress={pickChallengeLab}
        android_ripple={androidRipple()}
        style={styles.challengeBanner}
      >
        <DynamicIcon name="zap" size={20} color={COLORS.accentAmber} />
        <View style={{ flex: 1 }}>
          <Text style={styles.challengeTitle}>Surprise Engineering Drill</Text>
          <Text style={styles.challengeSub}>
            Jump into a random unsolved lab across any of the 4 simulation engines
          </Text>
        </View>
        <DynamicIcon name="chevron-right" size={18} color={COLORS.textPrimary} />
      </Pressable>

      {/* Difficulty Filter Row */}
      <View style={styles.diffRow} accessibilityRole="tablist">
        {(['All', 'Foundational', 'Intermediate', 'Staff-Level'] as const).map((d) => {
          const isActive = diffFilter === d;
          return (
            <Pressable
              key={d}
              hitSlop={6}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Filter simulators by ${d} difficulty`}
              onPress={() => {
                triggerHaptic('selection');
                setDiffFilter(d);
              }}
              android_ripple={androidRipple()}
              style={[styles.diffChip, isActive && styles.diffChipActive]}
            >
              <Text style={[styles.diffChipText, isActive && styles.diffChipTextActive]}>
                {d}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {ENGINE_CARDS.map((eng) => {
        const allEngineMods = CURRICULUM_MODULES
          .filter((m) => m.engineType === eng.type)
          .sort((a, b) => a.order - b.order);
        const solvedInEngine = allEngineMods.filter((m) => completedIds.includes(m.id)).length;
        const matchingModules = allEngineMods.filter(
          (m) => diffFilter === 'All' || m.difficulty === diffFilter
        );

        if (matchingModules.length === 0) return null;

        return (
          <View key={eng.type} style={styles.engineBlock}>
            <View style={styles.engineHeader}>
              <DynamicIcon name={eng.icon} size={20} color={eng.color} />
              <Text style={styles.engineTitle} accessibilityRole="header">
                {eng.title}
              </Text>
              <Text style={styles.engineStat}>
                {solvedInEngine}/{allEngineMods.length}
              </Text>
            </View>
            <Text style={styles.engineSummary}>{eng.summary}</Text>
            {matchingModules.map((mod) => {
              const isDone = completedIds.includes(mod.id);
              const score = scores[mod.id];
              return (
                <Pressable
                  key={mod.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isDone }}
                  accessibilityLabel={`Launch simulator lab: ${mod.title}, ${mod.difficulty}`}
                  onPress={() => {
                    triggerHaptic('selection');
                    router.push(`/lab/${mod.id}`);
                  }}
                  android_ripple={androidRipple()}
                  style={[styles.launchBtn, isDone && styles.launchBtnDone]}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.launchText}>{mod.title}</Text>
                    <Text style={styles.launchMeta}>
                      {mod.difficulty} · {mod.estimatedMinutes}m · +{mod.xpReward} XP
                      {score !== undefined ? ` · Best: ${score}%` : ''}
                    </Text>
                  </View>
                  <DynamicIcon
                    name={isDone ? 'check-circle' : 'play'}
                    size={16}
                    color={isDone ? COLORS.accentEmerald : COLORS.accentBlue}
                  />
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  heading: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  subheading: { color: COLORS.textSecondary, fontSize: 13 },
  challengeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.accentAmber,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  challengeTitle: { color: COLORS.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 },
  challengeSub: { color: COLORS.textSecondary, fontSize: 12 },
  diffRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  diffChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  diffChipActive: {
    borderColor: COLORS.accentBlue,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  diffChipText: { color: COLORS.textMuted, fontSize: 11.5, fontWeight: '700' },
  diffChipTextActive: { color: '#FFFFFF' },
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
  engineStat: { color: COLORS.textMuted, fontSize: 12, fontFamily: 'monospace', fontWeight: '700' },
  engineSummary: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  launchBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 7,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  launchBtnDone: {
    borderColor: '#10B98155',
  },
  launchText: { color: COLORS.textPrimary, fontSize: 13.5, fontWeight: '600', marginBottom: 2 },
  launchMeta: { color: COLORS.textMuted, fontSize: 11, fontFamily: 'monospace' },
});
