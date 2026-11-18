import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { CURRICULUM_TRACKS, CURRICULUM_MODULES } from '../../src/data/curriculum';
import {
  loadLearnerProfile,
  toggleBookmarkModule,
  LearnerProfile,
} from '../../src/lib/storage';
import {
  COLORS,
  FONTS,
  androidRipple,
  triggerHaptic,
  getContrastText,
  getEngineerRank,
  getMasteryTier,
} from '../../src/theme';
import { DynamicIcon } from '../../src/components/DynamicIcon';

type SkillFilter = 'all' | 'todo' | 'done' | 'bookmarked';

export default function SkillTreeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<SkillFilter>('all');

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
  const bookmarkedIds = profile?.bookmarkedModuleIds || [];
  const scores = profile?.moduleScores || {};
  const rankInfo = getEngineerRank(profile?.xp ?? 0);

  const sortedAllModules = [...CURRICULUM_MODULES].sort((a, b) => a.order - b.order);
  const resumeModule =
    sortedAllModules.find(
      (m) =>
        m.id === profile?.lastVisitedModuleId && !completedIds.includes(m.id)
    ) ||
    sortedAllModules.find((m) => !completedIds.includes(m.id)) ||
    sortedAllModules[0];

  const isTrackCompleted = (trackId: string): boolean => {
    const trackMods = CURRICULUM_MODULES.filter((m) => m.trackId === trackId);
    return trackMods.length > 0 && trackMods.every((m) => completedIds.includes(m.id));
  };

  const handleToggleBookmark = async (moduleId: string) => {
    triggerHaptic('selection');
    const updated = await toggleBookmarkModule(moduleId);
    setProfile(updated);
  };

  const q = searchQuery.trim().toLowerCase();

  const matchesFilterAndSearch = (m: (typeof CURRICULUM_MODULES)[number], trackTitle: string) => {
    const isDone = completedIds.includes(m.id);
    const isBookmarked = bookmarkedIds.includes(m.id);
    if (activeFilter === 'todo' && isDone) return false;
    if (activeFilter === 'done' && !isDone) return false;
    if (activeFilter === 'bookmarked' && !isBookmarked) return false;
    if (q) {
      const hay = `${m.title} ${m.subtitle} ${m.engineType} ${m.difficulty} ${trackTitle}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const totalVisibleModules = CURRICULUM_TRACKS.reduce((acc, t) => {
    const count = CURRICULUM_MODULES.filter(
      (m) => m.trackId === t.id && matchesFilterAndSearch(m, t.title)
    ).length;
    return acc + count;
  }, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Status & Rank Progression Hero Card */}
      <View style={styles.heroCard} accessible accessibilityRole="summary">
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.eyebrow}>
              {rankInfo.current.level} · {rankInfo.current.title.toUpperCase()}
            </Text>
            <Text style={styles.heroTitle}>Mental Execution &amp; Systems Mastery</Text>
          </View>
          <View style={styles.badgeGroup}>
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>{profile?.streakDays ?? 1}d STREAK</Text>
            </View>
            <View style={styles.xpBadge}>
              <Text style={styles.xpText}>{profile?.xp ?? 0} XP</Text>
            </View>
          </View>
        </View>

        {/* Rank Progress Bar */}
        <View style={styles.rankBarContainer}>
          <View style={styles.rankBarTrack}>
            <View
              style={[
                styles.rankBarFill,
                {
                  width: `${rankInfo.progressPct}%`,
                  backgroundColor: rankInfo.current.color,
                },
              ]}
            />
          </View>
          <View style={styles.rankMetaRow}>
            <Text style={styles.rankMetaText}>
              {completedIds.length} / {CURRICULUM_MODULES.length} Labs Mastered
            </Text>
            <Text style={styles.rankMetaText}>
              {rankInfo.xpToNext > 0
                ? `${rankInfo.xpToNext} XP to next rank`
                : 'Max Distinguished Rank Achieved'}
            </Text>
          </View>
        </View>

        {/* Continue / Next Recommended Lab Quick-Launch Card */}
        {resumeModule && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Continue recommended lab: ${resumeModule.title}`}
            onPress={() => {
              triggerHaptic('selection');
              router.push(`/lab/${resumeModule.id}`);
            }}
            android_ripple={androidRipple()}
            style={styles.resumeBanner}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.resumeEyebrow}>
                {completedIds.length === CURRICULUM_MODULES.length
                  ? 'ALL LABS SOLVED · REPLAY RECOMMENDED'
                  : 'NEXT RECOMMENDED LAB'}
              </Text>
              <Text style={styles.resumeTitle}>{resumeModule.title}</Text>
              <Text style={styles.resumeMeta}>
                {resumeModule.engineType.toUpperCase()} · {resumeModule.difficulty} · +{resumeModule.xpReward} XP
              </Text>
            </View>
            <View style={styles.resumePlayCircle}>
              <DynamicIcon name="play" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
        )}
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.searchBox}>
        <DynamicIcon name="search" size={16} color={COLORS.textMuted} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search 24 labs (e.g. OOMKill, TOCTOU, SSRF, vLLM, Redis)..."
          placeholderTextColor={COLORS.textMuted}
          accessibilityLabel="Search curriculum modules"
          style={styles.searchInput}
        />
        {searchQuery.length > 0 && (
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search query"
            onPress={() => setSearchQuery('')}
          >
            <DynamicIcon name="x" size={16} color={COLORS.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.filterRow} accessibilityRole="tablist">
        {(
          [
            { id: 'all' as SkillFilter, label: `All (${CURRICULUM_MODULES.length})` },
            {
              id: 'todo' as SkillFilter,
              label: `Unsolved (${CURRICULUM_MODULES.length - completedIds.length})`,
            },
            { id: 'done' as SkillFilter, label: `Solved (${completedIds.length})` },
            { id: 'bookmarked' as SkillFilter, label: `Saved (${bookmarkedIds.length})` },
          ]
        ).map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <Pressable
              key={tab.id}
              hitSlop={6}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Filter modules by ${tab.label}`}
              onPress={() => {
                triggerHaptic('selection');
                setActiveFilter(tab.id);
              }}
              android_ripple={androidRipple()}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isActive && styles.filterChipTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {totalVisibleModules === 0 ? (
        <View style={styles.emptyStateBox} accessibilityLiveRegion="polite">
          <DynamicIcon name="search" size={24} color={COLORS.accentAmber} />
          <Text style={styles.emptyStateTitle}>No Matching Engineering Labs</Text>
          <Text style={styles.emptyStateSub}>
            No labs match your current filter ({activeFilter.toUpperCase()})
            {q ? ` and search query "${searchQuery}"` : ''}.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset search and filters"
            onPress={() => {
              triggerHaptic('selection');
              setSearchQuery('');
              setActiveFilter('all');
            }}
            style={styles.resetFiltersBtn}
          >
            <Text style={styles.resetFiltersBtnText}>Reset Search &amp; Filters</Text>
          </Pressable>
        </View>
      ) : (
        CURRICULUM_TRACKS.map((track) => {
          const allTrackModules = CURRICULUM_MODULES
            .filter((m) => m.trackId === track.id)
            .sort((a, b) => a.order - b.order);
          const solvedCount = allTrackModules.filter((m) => completedIds.includes(m.id)).length;
          const trackPct = Math.round((solvedCount / Math.max(1, allTrackModules.length)) * 100);

          const filteredModules = allTrackModules.filter((m) =>
            matchesFilterAndSearch(m, track.title)
          );

          if (filteredModules.length === 0) return null;

          const prereqTracks = track.prerequisiteTrackIds
            .map((pid) => CURRICULUM_TRACKS.find((t) => t.id === pid))
            .filter(Boolean);
          const prereqsMet = track.prerequisiteTrackIds.every((pid) => isTrackCompleted(pid));
          const badgeTextColor = getContrastText(track.accentColor);

          return (
            <View key={track.id} style={styles.trackBlock}>
              <View style={styles.trackHeader}>
                <View style={[styles.trackNumberBadge, { backgroundColor: track.accentColor }]}>
                  <Text style={[styles.trackNumberText, { color: badgeTextColor }]}>
                    {track.number}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.trackTitleRow}>
                    <Text style={styles.trackTitle} accessibilityRole="header">
                      {track.title}
                    </Text>
                    <Text style={styles.trackProgress}>
                      {solvedCount}/{allTrackModules.length} ({trackPct}%)
                    </Text>
                  </View>
                  <Text style={styles.trackTagline}>{track.tagline}</Text>
                  <View style={styles.trackMiniBarTrack}>
                    <View
                      style={[
                        styles.trackMiniBarFill,
                        { width: `${trackPct}%`, backgroundColor: track.accentColor },
                      ]}
                    />
                  </View>
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
                          : `Recommended Prerequisite: Track ${prereqTracks.map((t) => t!.number).join(' & ')}`}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {filteredModules.map((mod) => {
                const isDone = completedIds.includes(mod.id);
                const isBookmarked = bookmarkedIds.includes(mod.id);
                const bestScore = scores[mod.id];
                const mastery = getMasteryTier(bestScore);
                return (
                  <View
                    key={mod.id}
                    style={[styles.moduleCard, isDone && styles.moduleCardDone]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: isDone }}
                      accessibilityLabel={`${mod.title}, ${mod.difficulty}, ${mod.estimatedMinutes} minutes, ${mod.xpReward} XP${isDone ? `, completed with ${bestScore ?? 100}% accuracy` : ''}`}
                      onPress={() => {
                        triggerHaptic('selection');
                        router.push(`/lab/${mod.id}`);
                      }}
                      android_ripple={androidRipple()}
                      style={styles.moduleMainPress}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.moduleMetaRow}>
                          <Text style={[styles.engineTag, { color: track.accentColor }]}>
                            {mod.engineType.toUpperCase()}
                          </Text>
                          <View style={styles.metaRightGroup}>
                            <Text style={styles.diffTag}>
                              {mod.difficulty} · {mod.estimatedMinutes}m · +{mod.xpReward} XP
                            </Text>
                            {isDone && (
                              <View
                                style={[
                                  styles.masteryBadge,
                                  { borderColor: mastery.color },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.masteryBadgeText,
                                    { color: mastery.color },
                                  ]}
                                >
                                  {mastery.label}
                                </Text>
                              </View>
                            )}
                          </View>
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
                    <Pressable
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isBookmarked }}
                      accessibilityLabel={`${isBookmarked ? 'Remove bookmark from' : 'Bookmark'} ${mod.title}`}
                      onPress={() => handleToggleBookmark(mod.id)}
                      style={[
                        styles.bookmarkBtn,
                        isBookmarked && styles.bookmarkBtnActive,
                      ]}
                    >
                      <DynamicIcon
                        name="bookmark"
                        size={16}
                        color={isBookmarked ? COLORS.accentAmber : COLORS.textMuted}
                      />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          );
        })
      )}
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
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  eyebrow: {
    color: COLORS.accentCyan,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
    fontFamily: FONTS.mono,
  },
  heroTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  badgeGroup: {
    alignItems: 'flex-end',
    gap: 5,
  },
  streakBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  streakText: {
    color: COLORS.accentAmber,
    fontSize: 10.5,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  xpBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  xpText: { color: COLORS.accentBlue, fontSize: 12, fontWeight: '700', fontFamily: FONTS.mono },
  rankBarContainer: { marginBottom: 12 },
  rankBarTrack: {
    height: 6,
    backgroundColor: COLORS.codeBg,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  rankBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  rankMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rankMetaText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: FONTS.mono,
  },
  resumeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: '#3B82F666',
    borderRadius: 10,
    padding: 12,
  },
  resumeEyebrow: {
    color: COLORS.accentBlue,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  resumeTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  resumeMeta: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: FONTS.mono,
  },
  resumePlayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentBlueDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
    paddingVertical: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  filterChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    borderColor: COLORS.accentBlue,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  filterChipText: { color: COLORS.textMuted, fontSize: 11.5, fontWeight: '700' },
  filterChipTextActive: { color: '#FFFFFF' },
  emptyStateBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyStateTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyStateSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  resetFiltersBtn: {
    marginTop: 6,
    backgroundColor: COLORS.accentBlueDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  resetFiltersBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
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
  trackNumberText: { fontSize: 14, fontWeight: '700', fontFamily: FONTS.mono },
  trackTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', flex: 1 },
  trackProgress: { color: COLORS.textMuted, fontSize: 11.5, fontFamily: FONTS.mono, fontWeight: '700' },
  trackTagline: { color: COLORS.textMuted, fontSize: 12.5, marginTop: 2 },
  trackMiniBarTrack: {
    height: 4,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  trackMiniBarFill: {
    height: '100%',
    borderRadius: 2,
  },
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
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  moduleCardDone: {
    borderColor: '#10B98166',
  },
  moduleMainPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  bookmarkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 18,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookmarkBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  moduleMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  metaRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  engineTag: { fontSize: 11, fontWeight: '700', fontFamily: FONTS.mono },
  diffTag: { color: COLORS.textMuted, fontSize: 11 },
  masteryBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  masteryBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  moduleTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  moduleSub: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
});
