import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { CURRICULUM_TRACKS, CURRICULUM_MODULES } from '../../src/data/curriculum';
import { loadLearnerProfile, LearnerProfile } from '../../src/lib/storage';
import { COLORS, androidRipple, triggerHaptic } from '../../src/theme';
import { DynamicIcon } from '../../src/components/DynamicIcon';

export default function SkillTreeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<LearnerProfile | null>(null);

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

  const isTrackCompleted = (trackId: string): boolean => {
    const trackMods = CURRICULUM_MODULES.filter((m) => m.trackId === trackId);
    return trackMods.length > 0 && trackMods.every((m) => completedIds.includes(m.id));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Status Banner */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.eyebrow}>STACKCRAFT AI-PROOF CURRICULUM</Text>
            <Text style={styles.heroTitle}>Mental Execution &amp; Systems Mastery</Text>
          </View>
          <View style={styles.xpBadge}>
            <Text style={styles.xpText}>{profile?.xp ?? 0} XP</Text>
          </View>
        </View>
        <Text style={styles.heroSub}>
          Step through live Call Stack &amp; Heap frames, audit subtle AI pull-request bugs, and survive distributed traffic spikes.
        </Text>
      </View>

      {CURRICULUM_TRACKS.map((track) => {
        const modules = CURRICULUM_MODULES.filter((m) => m.trackId === track.id);
        const solvedCount = modules.filter((m) => completedIds.includes(m.id)).length;
        const prereqTracks = track.prerequisiteTrackIds
          .map((pid) => CURRICULUM_TRACKS.find((t) => t.id === pid))
          .filter(Boolean);
        const prereqsMet = track.prerequisiteTrackIds.every((pid) => isTrackCompleted(pid));

        return (
          <View key={track.id} style={styles.trackBlock}>
            <View style={styles.trackHeader}>
              <View style={[styles.trackNumberBadge, { backgroundColor: track.accentColor }]}>
                <Text style={styles.trackNumberText}>{track.number}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.trackTitleRow}>
                  <Text style={styles.trackTitle}>{track.title}</Text>
                  <Text style={styles.trackProgress}>
                    {solvedCount}/{modules.length}
                  </Text>
                </View>
                <Text style={styles.trackTagline}>{track.tagline}</Text>
                {prereqTracks.length > 0 && (
                  <View style={styles.prereqRow}>
                    <DynamicIcon
                      name={prereqsMet ? 'unlock' : 'lock'}
                      size={12}
                      color={prereqsMet ? COLORS.accentEmerald : COLORS.accentAmber}
                    />
                    <Text
                      style={[
                        styles.prereqText,
                        { color: prereqsMet ? COLORS.accentEmerald : COLORS.accentAmber },
                      ]}
                    >
                      {prereqsMet
                        ? 'Prerequisites Mastered'
                        : `Builds on Track ${prereqTracks.map((t) => t!.number).join(' & ')}`}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {modules.map((mod) => {
              const isDone = completedIds.includes(mod.id);
              const bestScore = scores[mod.id];
              return (
                <Pressable
                  key={mod.id}
                  onPress={() => {
                    triggerHaptic('selection');
                    router.push(`/lab/${mod.id}`);
                  }}
                  android_ripple={androidRipple()}
                  style={[styles.moduleCard, isDone && styles.moduleCardDone]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.moduleMetaRow}>
                      <Text style={[styles.engineTag, { color: track.accentColor }]}>
                        {mod.engineType.toUpperCase()}
                      </Text>
                      <Text style={styles.diffTag}>
                        {mod.difficulty} · {mod.estimatedMinutes}m · +{mod.xpReward} XP
                        {bestScore !== undefined ? ` · ${bestScore}%` : ''}
                      </Text>
                    </View>
                    <Text style={styles.moduleTitle}>{mod.title}</Text>
                    <Text style={styles.moduleSub}>{mod.subtitle}</Text>
                  </View>
                  <DynamicIcon
                    name={isDone ? 'check-circle' : 'chevron-right'}
                    size={20}
                    color={isDone ? COLORS.accentEmerald : COLORS.textMuted}
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
  heroCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 22,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eyebrow: {
    color: COLORS.accentBlue,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  xpBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
  },
  xpText: { color: COLORS.accentBlue, fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  heroSub: { color: COLORS.textSecondary, fontSize: 13.5, lineHeight: 19 },
  trackBlock: { marginBottom: 24 },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  trackNumberBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  trackNumberText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', fontFamily: 'monospace' },
  trackTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', flex: 1 },
  trackProgress: { color: COLORS.textMuted, fontSize: 12, fontFamily: 'monospace', fontWeight: '700' },
  trackTagline: { color: COLORS.textMuted, fontSize: 12.5, marginTop: 2 },
  prereqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  prereqText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  moduleCardDone: {
    borderColor: '#10B98166',
  },
  moduleMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  engineTag: { fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  diffTag: { color: COLORS.textMuted, fontSize: 11 },
  moduleTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  moduleSub: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
});
