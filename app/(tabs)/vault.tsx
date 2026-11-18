import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CURRICULUM_MODULES } from '../../src/data/curriculum';
import {
  loadLearnerProfile,
  recordFlashcardReview,
  LearnerProfile,
} from '../../src/lib/storage';
import {
  Rating,
  isCardDue,
  computeRetrievability,
  createInitialCardState,
  scheduleNextReview,
} from '../../src/lib/fsrs';
import { COLORS, FONTS, androidRipple, triggerHaptic } from '../../src/theme';
import { DynamicIcon } from '../../src/components/DynamicIcon';

export default function FsrsVaultScreen() {
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [revealedMap, setRevealedMap] = useState<Record<string, boolean>>({});
  const [filterMode, setFilterMode] = useState<'due' | 'unlocked' | 'all'>('unlocked');
  const [viewMode, setViewMode] = useState<'focus' | 'list'>('focus');
  const [focusIdx, setFocusIdx] = useState(0);

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

  const sortedModules = [...CURRICULUM_MODULES].sort((a, b) => a.order - b.order);
  const completedSet = new Set(profile?.completedModuleIds ?? []);

  const allCards = sortedModules.flatMap((m) =>
    m.flashcards.map((c) => ({
      ...c,
      moduleId: m.id,
      moduleTitle: m.title,
      trackId: m.trackId,
    }))
  );

  const isCardUnlocked = (card: (typeof allCards)[number]): boolean => {
    const st = profile?.fsrsStates[card.id];
    return (
      completedSet.has(card.moduleId) ||
      Boolean(st && st.reps > 0) ||
      card.trackId === 'track-1-memory'
    );
  };

  const unlockedCards = allCards.filter(isCardUnlocked);

  const dueCards = unlockedCards.filter((card) => {
    const st = profile?.fsrsStates[card.id];
    return !st || isCardDue(st);
  });

  const displayedCards =
    filterMode === 'due'
      ? dueCards
      : filterMode === 'unlocked'
      ? unlockedCards
      : allCards;

  const safeFocusIdx =
    displayedCards.length > 0 ? Math.min(focusIdx, displayedCards.length - 1) : 0;
  const activeFocusCard = displayedCards[safeFocusIdx] ?? null;

  const handleGrade = async (cardId: string, rating: Rating) => {
    triggerHaptic(rating >= 3 ? 'success' : 'warning');
    const updated = await recordFlashcardReview(cardId, rating);
    setProfile(updated);
    setRevealedMap((prev) => ({ ...prev, [cardId]: false }));
    if (viewMode === 'focus' && displayedCards.length > 1) {
      setFocusIdx((i) => (i + 1) % displayedCards.length);
    }
  };

  const renderCardItem = (card: (typeof allCards)[number], isFocusCard = false) => {
    const state = profile?.fsrsStates[card.id];
    const unlocked = isCardUnlocked(card);
    const due = !state || isCardDue(state);
    const isRevealed = Boolean(revealedMap[card.id]);
    const retrNum =
      state && state.reps > 0 ? Math.round(computeRetrievability(state) * 100) : null;
    const baseState = state ?? createInitialCardState(card.id);

    return (
      <View key={card.id} style={[styles.cardBox, isFocusCard && styles.cardBoxFocus]}>
        <View style={styles.moduleEyebrowRow}>
          <Text style={styles.moduleEyebrowText}>{card.moduleTitle}</Text>
          <View
            style={[
              styles.statusPill,
              !unlocked
                ? styles.statusPillLocked
                : due
                ? styles.statusPillDue
                : styles.statusPillScheduled,
            ]}
          >
            <Text style={styles.statusPillText}>
              {!unlocked ? 'LOCKED PREVIEW' : due ? 'DUE NOW' : 'SCHEDULED'}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.conceptTag}>{card.conceptTitle}</Text>
          <Text style={styles.stabilityTag}>
            {retrNum !== null ? `R: ${retrNum}% · ` : ''}S: {state?.stability ?? 0}d · D: {state?.difficulty ?? 5.0}
          </Text>
        </View>

        {retrNum !== null && (
          <View style={styles.retentionBarTrack}>
            <View
              style={[
                styles.retentionBarFill,
                {
                  width: `${retrNum}%`,
                  backgroundColor:
                    retrNum >= 85
                      ? COLORS.accentEmerald
                      : retrNum >= 70
                      ? COLORS.accentAmber
                      : COLORS.accentRose,
                },
              ]}
            />
          </View>
        )}

        <Text style={styles.questionText}>{card.question}</Text>

        {!isRevealed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Reveal answer for ${card.conceptTitle}`}
            onPress={() => {
              triggerHaptic('selection');
              setRevealedMap((prev) => ({ ...prev, [card.id]: true }));
            }}
            android_ripple={androidRipple()}
            style={styles.revealBtn}
          >
            <DynamicIcon name="eye" size={15} color={COLORS.textSecondary} />
            <Text style={styles.revealBtnText}>Reveal Mental Model Answer</Text>
          </Pressable>
        ) : (
          <View style={styles.answerSection} accessibilityLiveRegion="polite">
            <Text style={styles.answerText}>{card.answer}</Text>
            <View style={styles.tipBanner}>
              <Text style={styles.tipText}>Mental Model: {card.mentalModelTip}</Text>
            </View>
            <View style={styles.ratingRow}>
              {(
                [
                  { r: 1 as Rating, label: 'Again', col: COLORS.accentRose },
                  { r: 2 as Rating, label: 'Hard', col: COLORS.accentAmber },
                  { r: 3 as Rating, label: 'Good', col: COLORS.accentBlue },
                  { r: 4 as Rating, label: 'Easy', col: COLORS.accentEmerald },
                ]
              ).map((btn) => {
                const nextPreview = scheduleNextReview(baseState, btn.r);
                const nextDays = Math.max(1, Math.round(nextPreview.stability));
                return (
                  <Pressable
                    key={btn.r}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate ${btn.label}, schedules next review in ${nextDays} days`}
                    onPress={() => handleGrade(card.id, btn.r)}
                    android_ripple={androidRipple()}
                    style={[styles.rateBtn, { borderColor: btn.col }]}
                  >
                    <Text style={[styles.rateBtnText, { color: btn.col }]}>
                      {btn.label}
                    </Text>
                    <Text style={styles.rateIntervalText}>{nextDays}d</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={viewMode === 'list' ? displayedCards : []}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heading} accessibilityRole="header">
                FSRS Spaced-Repetition Vault
              </Text>
              <Text style={styles.subheading}>
                Power-law forgetting curve tracking stability (S), difficulty (D), and recall probability (R).
              </Text>
            </View>
          </View>

          {/* View Mode Switcher: Focus Deck vs Browse List */}
          <View style={styles.modeSwitchRow} accessibilityRole="tablist">
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: viewMode === 'focus' }}
              accessibilityLabel="Focus Deck single-card study mode"
              onPress={() => {
                triggerHaptic('selection');
                setViewMode('focus');
              }}
              style={[
                styles.modeBtn,
                viewMode === 'focus' && styles.modeBtnActive,
              ]}
            >
              <DynamicIcon
                name="zap"
                size={14}
                color={viewMode === 'focus' ? '#FFFFFF' : COLORS.textMuted}
              />
              <Text
                style={[
                  styles.modeBtnText,
                  viewMode === 'focus' && styles.modeBtnTextActive,
                ]}
              >
                Focus Deck Mode
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: viewMode === 'list' }}
              accessibilityLabel="Browse all cards list mode"
              onPress={() => {
                triggerHaptic('selection');
                setViewMode('list');
              }}
              style={[
                styles.modeBtn,
                viewMode === 'list' && styles.modeBtnActive,
              ]}
            >
              <DynamicIcon
                name="layers"
                size={14}
                color={viewMode === 'list' ? '#FFFFFF' : COLORS.textMuted}
              />
              <Text
                style={[
                  styles.modeBtnText,
                  viewMode === 'list' && styles.modeBtnTextActive,
                ]}
              >
                Browse List ({displayedCards.length})
              </Text>
            </Pressable>
          </View>

          <View style={styles.filterRow} accessibilityRole="tablist">
            <Pressable
              hitSlop={8}
              accessibilityRole="tab"
              accessibilityState={{ selected: filterMode === 'unlocked' }}
              accessibilityLabel={`Unlocked flashcards, ${unlockedCards.length} cards`}
              onPress={() => {
                triggerHaptic('selection');
                setFilterMode('unlocked');
                setFocusIdx(0);
              }}
              android_ripple={androidRipple()}
              style={[styles.filterChip, filterMode === 'unlocked' && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, filterMode === 'unlocked' && styles.filterChipTextActive]}>
                Unlocked ({unlockedCards.length})
              </Text>
            </Pressable>
            <Pressable
              hitSlop={8}
              accessibilityRole="tab"
              accessibilityState={{ selected: filterMode === 'due' }}
              accessibilityLabel={`Due for review, ${dueCards.length} cards`}
              onPress={() => {
                triggerHaptic('selection');
                setFilterMode('due');
                setFocusIdx(0);
              }}
              android_ripple={androidRipple()}
              style={[styles.filterChip, filterMode === 'due' && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, filterMode === 'due' && styles.filterChipTextActive]}>
                Due Now ({dueCards.length})
              </Text>
            </Pressable>
            <Pressable
              hitSlop={8}
              accessibilityRole="tab"
              accessibilityState={{ selected: filterMode === 'all' }}
              accessibilityLabel={`All curriculum flashcards, ${allCards.length} cards`}
              onPress={() => {
                triggerHaptic('selection');
                setFilterMode('all');
                setFocusIdx(0);
              }}
              android_ripple={androidRipple()}
              style={[styles.filterChip, filterMode === 'all' && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, filterMode === 'all' && styles.filterChipTextActive]}>
                All ({allCards.length})
              </Text>
            </Pressable>
          </View>

          {/* Focus Deck Mode View */}
          {viewMode === 'focus' && activeFocusCard && (
            <View>
              <View style={styles.focusNavBar}>
                <Pressable
                  disabled={displayedCards.length <= 1}
                  accessibilityRole="button"
                  accessibilityLabel="Previous flashcard"
                  onPress={() => {
                    triggerHaptic('selection');
                    setFocusIdx((i) =>
                      i > 0 ? i - 1 : displayedCards.length - 1
                    );
                  }}
                  style={styles.focusNavBtn}
                >
                  <DynamicIcon name="chevron-left" size={16} color={COLORS.textPrimary} />
                  <Text style={styles.focusNavText}>Prev</Text>
                </Pressable>
                <Text style={styles.focusCounterText}>
                  CARD {safeFocusIdx + 1} OF {displayedCards.length} · +15 XP
                </Text>
                <Pressable
                  disabled={displayedCards.length <= 1}
                  accessibilityRole="button"
                  accessibilityLabel="Next flashcard"
                  onPress={() => {
                    triggerHaptic('selection');
                    setFocusIdx((i) => (i + 1) % displayedCards.length);
                  }}
                  style={styles.focusNavBtn}
                >
                  <Text style={styles.focusNavText}>Next</Text>
                  <DynamicIcon name="chevron-right" size={16} color={COLORS.textPrimary} />
                </Pressable>
              </View>
              {renderCardItem(activeFocusCard, true)}
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        displayedCards.length === 0 ? (
          <View style={styles.emptyBox} accessibilityLiveRegion="polite">
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptySub}>
              Zero unlocked cards are currently due. Switch to &quot;Unlocked ({unlockedCards.length})&quot; or &quot;All ({allCards.length})&quot; to drill ahead of schedule.
            </Text>
          </View>
        ) : null
      }
      renderItem={({ item: card }) => renderCardItem(card, false)}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  heading: { color: COLORS.textPrimary, fontSize: 19, fontWeight: '700', marginBottom: 4 },
  subheading: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  modeSwitchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 38,
    borderRadius: 7,
  },
  modeBtnActive: {
    backgroundColor: COLORS.accentBlueDark,
  },
  modeBtnText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  filterChip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    borderColor: COLORS.accentBlue,
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
  },
  filterChipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: '#FFFFFF' },
  focusNavBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  focusNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  focusNavText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '600' },
  focusCounterText: {
    color: COLORS.accentCyan,
    fontSize: 11,
    fontFamily: FONTS.mono,
    fontWeight: '700',
  },
  emptyBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: { color: COLORS.accentEmerald, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySub: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  cardBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  cardBoxFocus: {
    borderColor: COLORS.accentBlue,
    padding: 16,
  },
  moduleEyebrowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  moduleEyebrowText: {
    color: COLORS.textMuted,
    fontSize: 10.5,
    fontFamily: FONTS.mono,
    flex: 1,
    paddingRight: 8,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPillDue: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
  statusPillScheduled: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  statusPillLocked: { backgroundColor: 'rgba(148, 163, 184, 0.16)' },
  statusPillText: {
    color: COLORS.textPrimary,
    fontSize: 9.5,
    fontFamily: FONTS.mono,
    fontWeight: '700',
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  conceptTag: { color: COLORS.accentBlue, fontSize: 13, fontWeight: '700', flex: 1, paddingRight: 8 },
  stabilityTag: { color: COLORS.textMuted, fontSize: 11, fontFamily: FONTS.mono },
  retentionBarTrack: {
    height: 4,
    backgroundColor: COLORS.codeBg,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  retentionBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  questionText: { color: COLORS.textPrimary, fontSize: 14.5, fontWeight: '600', lineHeight: 21, marginBottom: 14 },
  revealBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.surfaceElevated,
    minHeight: 46,
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  revealBtnText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  answerSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  answerText: { color: COLORS.textPrimary, fontSize: 13.5, lineHeight: 20, marginBottom: 10 },
  tipBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accentEmerald,
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  tipText: { color: COLORS.accentEmerald, fontSize: 12.5, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', gap: 8 },
  rateBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 8,
    alignItems: 'center',
  },
  rateBtnText: { fontSize: 12, fontWeight: '700' },
  rateIntervalText: { color: COLORS.textMuted, fontSize: 10.5, fontFamily: FONTS.mono, marginTop: 2 },
});
