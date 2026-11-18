import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  loadLearnerProfile,
  saveLearnerProfile,
  resetLearnerProfile,
  LearnerProfile,
} from '../../src/lib/storage';
import { CodeLanguage } from '../../src/data/types';
import { CURRICULUM_MODULES } from '../../src/data/curriculum';
import { COLORS, androidRipple, triggerHaptic } from '../../src/theme';

const LANGUAGES: { id: CodeLanguage; label: string; desc: string }[] = [
  { id: 'typescript', label: 'TypeScript (Node / React Native)', desc: 'Strict static types & async event loops' },
  { id: 'python', label: 'Python 3.12 (AI & Backend)', desc: 'Clean syntax, dict references & nonlocal scopes' },
  { id: 'c', label: 'C / Systems Pointers', desc: 'Explicit pointer dereferencing (*, ->) & structs' },
];

export default function TelemetryProfileScreen() {
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

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

  const selectLanguage = async (lang: CodeLanguage) => {
    if (!profile) return;
    triggerHaptic('selection');
    const next = { ...profile, preferredLanguage: lang };
    setProfile(next);
    await saveLearnerProfile(next);
  };

  const handleReset = async () => {
    if (!confirmReset) {
      triggerHaptic('warning');
      setConfirmReset(true);
      return;
    }
    triggerHaptic('success');
    const fresh = await resetLearnerProfile();
    setProfile(fresh);
    setConfirmReset(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Engineering Telemetry &amp; Settings</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile?.xp ?? 0}</Text>
          <Text style={styles.statLabel}>TOTAL XP</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {profile?.completedModuleIds.length ?? 0} / {CURRICULUM_MODULES.length}
          </Text>
          <Text style={styles.statLabel}>LABS SOLVED</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile?.streakDays ?? 1}d</Text>
          <Text style={styles.statLabel}>ACTIVE STREAK</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>DEFAULT LAB CODE LANGUAGE</Text>
      <Text style={styles.sectionSub}>
        Switch languages anytime to compare how the exact same memory model or bug manifests in TypeScript, Python, and C:
      </Text>

      {LANGUAGES.map((l) => {
        const isSelected = (profile?.preferredLanguage ?? 'typescript') === l.id;
        return (
          <Pressable
            key={l.id}
            onPress={() => selectLanguage(l.id)}
            android_ripple={androidRipple()}
            style={[styles.langCard, isSelected && styles.langCardSelected]}
          >
            <Text style={styles.langTitle}>{l.label}</Text>
            <Text style={styles.langDesc}>{l.desc}</Text>
          </Pressable>
        );
      })}

      <Text style={[styles.sectionHeader, { marginTop: 18 }]}>DIAGNOSTIC TELEMETRY RESET</Text>
      <Pressable
        onPress={handleReset}
        android_ripple={androidRipple()}
        style={[styles.resetCard, confirmReset && styles.resetCardConfirm]}
      >
        <Text style={styles.resetText}>
          {confirmReset
            ? 'Tap Again to Confirm Local Progress & FSRS Reset'
            : 'Reset Local Progress & FSRS Vault'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  heading: { color: COLORS.textPrimary, fontSize: 19, fontWeight: '700', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  statValue: { color: COLORS.accentBlue, fontSize: 20, fontWeight: '700', fontFamily: 'monospace' },
  statLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', marginTop: 4 },
  sectionHeader: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  sectionSub: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  langCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  langCardSelected: {
    borderColor: COLORS.accentBlue,
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
  },
  langTitle: { color: COLORS.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 3 },
  langDesc: { color: COLORS.textSecondary, fontSize: 12.5 },
  resetCard: {
    marginTop: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
  },
  resetCardConfirm: {
    borderColor: COLORS.accentRose,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  resetText: { color: COLORS.accentRose, fontSize: 13, fontWeight: '700' },
});
