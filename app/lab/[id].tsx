import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { CURRICULUM_MODULES, CURRICULUM_TRACKS } from '../../src/data/curriculum';
import { CodeLanguage } from '../../src/data/types';
import {
  loadLearnerProfile,
  completeModuleAndAwardXp,
  toggleBookmarkModule,
  recordModuleVisit,
} from '../../src/lib/storage';
import { MemoryTracerEngine } from '../../src/engines/MemoryTracerEngine';
import { AiAuditorEngine } from '../../src/engines/AiAuditorEngine';
import { ChaosArchitectEngine } from '../../src/engines/ChaosArchitectEngine';
import { IncidentCommanderEngine } from '../../src/engines/IncidentCommanderEngine';
import {
  COLORS,
  FONTS,
  androidRipple,
  triggerHaptic,
  getEngineerRank,
  getMasteryTier,
} from '../../src/theme';
import { DynamicIcon } from '../../src/components/DynamicIcon';

export default function LabDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [language, setLanguage] = useState<CodeLanguage>('typescript');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [completedBanner, setCompletedBanner] = useState<number | null>(null);
  const [awardedXp, setAwardedXp] = useState<number>(0);
  const [promotedRankTitle, setPromotedRankTitle] = useState<string | null>(null);
  const [replayCount, setReplayCount] = useState(0);
  const [showWhyAi, setShowWhyAi] = useState(false);

  const sortedModules = [...CURRICULUM_MODULES].sort((a, b) => a.order - b.order);
  const mod = sortedModules.find((m) => m.id === id);
  const track = mod ? CURRICULUM_TRACKS.find((t) => t.id === mod.trackId) : null;
  const nextMod = mod
    ? sortedModules.find((m) => m.order > mod.order) ?? null
    : null;

  useEffect(() => {
    setCompletedBanner(null);
    setPromotedRankTitle(null);
    loadLearnerProfile().then((p) => {
      setLanguage(p.preferredLanguage);
      if (id) {
        setIsBookmarked(p.bookmarkedModuleIds.includes(id));
        recordModuleVisit(id);
      }
    });
  }, [id]);

  if (!mod) {
    return (
      <View style={styles.container}>
        <View style={styles.victoryBox} accessibilityLiveRegion="polite">
          <Text style={styles.notFoundTitle}>Lab Not Found</Text>
          <Text style={styles.victorySub}>
            No engineering simulator matches ID &quot;{String(id)}&quot;.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to Skill Tree"
            onPress={() => router.replace('/')}
            android_ripple={androidRipple()}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>Return to Skill Tree</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const handleToggleBookmark = async () => {
    triggerHaptic('selection');
    const updated = await toggleBookmarkModule(mod.id);
    setIsBookmarked(updated.bookmarkedModuleIds.includes(mod.id));
  };

  const handleLabComplete = async (accuracyPct: number) => {
    triggerHaptic('success');
    const before = await loadLearnerProfile();
    const prevRank = getEngineerRank(before.xp).current;
    const updated = await completeModuleAndAwardXp(mod.id, mod.xpReward, accuracyPct);
    const nextRank = getEngineerRank(updated.xp).current;
    setAwardedXp(Math.max(0, updated.xp - before.xp));
    if (nextRank.level !== prevRank.level) {
      setPromotedRankTitle(`${nextRank.level} · ${nextRank.title}`);
    }
    setCompletedBanner(accuracyPct);
  };

  const showLanguageToggle =
    mod.lab.kind === 'memory-tracer' || mod.lab.kind === 'ai-auditor';
  const mastery = completedBanner !== null ? getMasteryTier(completedBanner) : null;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `TRACK ${track?.number ?? '01'} · ${mod.engineType.toUpperCase()}`,
        }}
      />

      {/* Top Mental Model Header & Language Switcher */}
      <View style={styles.topBar}>
        <View style={styles.hudMetaRow}>
          <Text style={styles.hudMetaText}>
            LAB #{String(mod.order).padStart(2, '0')} · {mod.difficulty.toUpperCase()} · +{mod.xpReward} XP
          </Text>
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            {mod.title}
          </Text>
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ selected: isBookmarked }}
            accessibilityLabel={
              isBookmarked ? 'Remove bookmark from this lab' : 'Bookmark this lab'
            }
            onPress={handleToggleBookmark}
            style={[
              styles.bookmarkIconBtn,
              isBookmarked && styles.bookmarkIconBtnActive,
            ]}
          >
            <DynamicIcon
              name="bookmark"
              size={17}
              color={isBookmarked ? COLORS.accentAmber : COLORS.textMuted}
            />
          </Pressable>
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ expanded: showWhyAi }}
            accessibilityLabel={
              showWhyAi ? 'Hide AI blindspot explanation' : 'Show why AI fails here'
            }
            onPress={() => {
              triggerHaptic('selection');
              setShowWhyAi((v) => !v);
            }}
            android_ripple={androidRipple()}
            style={styles.whyAiBtn}
          >
            <Text style={styles.whyAiBtnText}>
              {showWhyAi ? 'Hide Blindspot' : 'Why AI Fails'}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.mentalModel}>{mod.coreMentalModel}</Text>

        {showWhyAi && (
          <View style={styles.whyAiBox} accessibilityLiveRegion="polite">
            <Text style={styles.whyAiLabel}>WHY LLMS CANNOT REPLACE THIS INTUITION:</Text>
            <Text style={styles.whyAiText}>{mod.whyAiCannotReplaceThis}</Text>
          </View>
        )}

        {showLanguageToggle && (
          <View style={styles.langRow} accessibilityRole="tablist">
            {(['typescript', 'python', 'c'] as CodeLanguage[]).map((lang) => (
              <Pressable
                key={lang}
                hitSlop={8}
                accessibilityRole="tab"
                accessibilityState={{ selected: language === lang }}
                accessibilityLabel={`Switch code language to ${lang}`}
                onPress={() => {
                  triggerHaptic('selection');
                  setLanguage(lang);
                }}
                android_ripple={androidRipple()}
                style={[
                  styles.langChip,
                  language === lang && styles.langChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.langChipText,
                    language === lang && styles.langChipTextActive,
                  ]}
                >
                  {lang.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {completedBanner !== null ? (
        <View style={styles.victoryBox} accessibilityLiveRegion="polite">
          {mastery && (
            <View style={[styles.tierPill, { borderColor: mastery.color }]}>
              <Text style={[styles.tierPillText, { color: mastery.color }]}>
                {mastery.label}
              </Text>
            </View>
          )}
          <Text style={styles.victoryTitle}>
            Lab Completed! +{awardedXp} XP
          </Text>
          {promotedRankTitle && (
            <View style={styles.promotionBanner}>
              <DynamicIcon name="award" size={16} color={COLORS.accentAmber} />
              <Text style={styles.promotionText}>
                CLEARANCE PROMOTION UNLOCKED: {promotedRankTitle}
              </Text>
            </View>
          )}
          <Text style={styles.victorySub}>
            {awardedXp < mod.xpReward
              ? `Replay Mastery Bonus (+25% XP) · 2 Concept Flashcards active in your FSRS Vault:`
              : `First-Solve Full Reward · 2 Concept Flashcards unlocked in your FSRS Vault:`}
          </Text>

          {/* Tappable Unlocked Flashcards CTA */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open FSRS Vault to drill unlocked flashcards"
            onPress={() => {
              triggerHaptic('selection');
              router.push('/(tabs)/vault');
            }}
            android_ripple={androidRipple()}
            style={styles.unlockedCardsList}
          >
            {mod.flashcards.map((fc) => (
              <View key={fc.id} style={styles.unlockedCardItem}>
                <DynamicIcon name="book-open" size={14} color={COLORS.accentCyan} />
                <Text style={styles.unlockedCardText}>{fc.conceptTitle}</Text>
              </View>
            ))}
            <Text style={styles.drillVaultCta}>
              Tap to Drill Unlocked Cards in FSRS Vault →
            </Text>
          </Pressable>

          <View style={styles.victoryActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Replay lab simulation"
              onPress={() => {
                triggerHaptic('selection');
                setReplayCount((c) => c + 1);
                setCompletedBanner(null);
              }}
              android_ripple={androidRipple()}
              style={styles.replayBtn}
            >
              <Text style={styles.replayBtnText}>Replay Lab</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Return to Skill Tree"
              onPress={() => router.back()}
              android_ripple={androidRipple()}
              style={styles.backBtn}
            >
              <Text style={styles.backBtnText}>Skill Tree</Text>
            </Pressable>
          </View>

          {nextMod && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Continue to next lab: ${nextMod.title}`}
              onPress={() => {
                triggerHaptic('selection');
                router.replace(`/lab/${nextMod.id}`);
              }}
              android_ripple={androidRipple()}
              style={styles.nextLabBtn}
            >
              <Text style={styles.nextLabBtnText}>
                Next Lab: {nextMod.title} →
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {mod.lab.kind === 'memory-tracer' && (
            <MemoryTracerEngine
              key={`${mod.id}-${replayCount}`}
              lab={mod.lab}
              language={language}
              onComplete={handleLabComplete}
            />
          )}
          {mod.lab.kind === 'ai-auditor' && (
            <AiAuditorEngine
              key={`${mod.id}-${replayCount}`}
              lab={mod.lab}
              language={language}
              onComplete={handleLabComplete}
            />
          )}
          {mod.lab.kind === 'chaos-architect' && (
            <ChaosArchitectEngine
              key={`${mod.id}-${replayCount}`}
              lab={mod.lab}
              onComplete={handleLabComplete}
            />
          )}
          {mod.lab.kind === 'incident-commander' && (
            <IncidentCommanderEngine
              key={`${mod.id}-${replayCount}`}
              lab={mod.lab}
              onComplete={handleLabComplete}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  hudMetaRow: {
    marginBottom: 3,
  },
  hudMetaText: {
    color: COLORS.accentCyan,
    fontSize: 10,
    fontFamily: FONTS.mono,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: { color: COLORS.textPrimary, fontSize: 15.5, fontWeight: '700', flex: 1 },
  bookmarkIconBtn: {
    padding: 7,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceElevated,
  },
  bookmarkIconBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
  },
  whyAiBtn: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 1,
    borderColor: COLORS.accentAmber,
  },
  whyAiBtnText: { color: COLORS.accentAmber, fontSize: 11, fontWeight: '700' },
  mentalModel: { color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 17 },
  whyAiBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accentAmber,
  },
  whyAiLabel: { color: COLORS.accentAmber, fontSize: 10, fontWeight: '700', marginBottom: 3 },
  whyAiText: { color: COLORS.textPrimary, fontSize: 12, lineHeight: 17 },
  langRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  langChip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  langChipActive: {
    borderColor: COLORS.accentBlue,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  langChipText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', fontFamily: FONTS.mono },
  langChipTextActive: { color: '#FFFFFF' },
  victoryBox: {
    margin: 20,
    padding: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accentEmerald,
    alignItems: 'center',
  },
  tierPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  tierPillText: {
    fontSize: 11,
    fontFamily: FONTS.mono,
    fontWeight: '700',
  },
  notFoundTitle: { color: COLORS.accentAmber, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  victoryTitle: { color: COLORS.accentEmerald, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  promotionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 1,
    borderColor: COLORS.accentAmber,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  promotionText: {
    color: COLORS.accentAmber,
    fontSize: 11.5,
    fontFamily: FONTS.mono,
    fontWeight: '700',
  },
  victorySub: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  unlockedCardsList: {
    width: '100%',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: '#06B6D455',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  unlockedCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unlockedCardText: {
    color: COLORS.textPrimary,
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  drillVaultCta: {
    color: COLORS.accentCyan,
    fontSize: 11.5,
    fontFamily: FONTS.mono,
    fontWeight: '700',
    marginTop: 4,
  },
  victoryActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  replayBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  replayBtnText: { color: COLORS.textPrimary, fontSize: 13.5, fontWeight: '700' },
  backBtn: {
    flex: 1,
    backgroundColor: COLORS.accentBlueDark,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  backBtnText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  nextLabBtn: {
    marginTop: 10,
    width: '100%',
    backgroundColor: COLORS.accentEmeraldDark,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  nextLabBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
