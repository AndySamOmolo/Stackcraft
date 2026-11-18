import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CURRICULUM_MODULES } from '../../src/data/curriculum';
import {
  loadLearnerProfile,
  recordFlashcardReview,
  LearnerProfile,
} from '../../src/lib/storage';
import { Rating, isCardDue } from '../../src/lib/fsrs';
import { COLORS, androidRipple, triggerHaptic } from '../../src/theme';

export default function FsrsVaultScreen() {
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [revealedMap, setRevealedMap] = useState<Record<string, boolean>>({});
  const [filterMode, setFilterMode] = useState<'due' | 'all'>('all');

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

  const allCards = CURRICULUM_MODULES.flatMap((m) =>
    m.flashcards.map((c) => ({ ...c, moduleTitle: m.title }))
  );

  const dueCards = allCards.filter((card) => {
    const st = profile?.fsrsStates[card.id];
    return !st || isCardDue(st);
  });

  const displayedCards = filterMode === 'due' ? dueCards : allCards;

  const handleGrade = async (cardId: string, rating: Rating) => {
    triggerHaptic(rating >= 3 ? 'success' : 'warning');
    const updated = await recordFlashcardReview(cardId, rating);
    setProfile(updated);
    setRevealedMap((prev) => ({ ...prev, [cardId]: false }));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>FSRS Spaced-Repetition Concept Vault</Text>
      <Text style={styles.subheading}>
        Each review dynamically updates memory stability (S) and difficulty (D) using the Free Spaced Repetition Scheduler.
      </Text>

      <View style={styles.filterRow}>
        <Pressable
          onPress={() => {
            triggerHaptic('selection');
            setFilterMode('all');
          }}
          android_ripple={androidRipple()}
          style={[styles.filterChip, filterMode === 'all' && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, filterMode === 'all' && styles.filterChipTextActive]}>
            All Cards ({allCards.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            triggerHaptic('selection');
            setFilterMode('due');
          }}
          android_ripple={androidRipple()}
          style={[styles.filterChip, filterMode === 'due' && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, filterMode === 'due' && styles.filterChipTextActive]}>
            Due for Review ({dueCards.length})
          </Text>
        </Pressable>
      </View>

      {displayedCards.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>All Caught Up!</Text>
          <Text style={styles.emptySub}>
            Zero cards are currently due. Switch to &quot;All Cards&quot; to browse or drill ahead of schedule.
          </Text>
        </View>
      ) : (
        displayedCards.map((card) => {
          const state = profile?.fsrsStates[card.id];
          const due = !state || isCardDue(state);
          const isRevealed = Boolean(revealedMap[card.id]);
          return (
            <View key={card.id} style={styles.cardBox}>
              <View style={styles.metaRow}>
                <Text style={styles.conceptTag}>{card.conceptTitle}</Text>
                <Text style={styles.stabilityTag}>
                  {due ? 'DUE · ' : ''}S: {state?.stability ?? 0}d · D: {state?.difficulty ?? 5.0}
                </Text>
              </View>
              <Text style={styles.questionText}>{card.question}</Text>

              {!isRevealed ? (
                <Pressable
                  onPress={() => {
                    triggerHaptic('selection');
                    setRevealedMap((prev) => ({ ...prev, [card.id]: true }));
                  }}
                  android_ripple={androidRipple()}
                  style={styles.revealBtn}
                >
                  <Text style={styles.revealBtnText}>Reveal Mental Model Answer</Text>
                </Pressable>
              ) : (
                <View style={styles.answerSection}>
                  <Text style={styles.answerText}>{card.answer}</Text>
                  <Text style={styles.tipText}>Tip: {card.mentalModelTip}</Text>
                  <View style={styles.ratingRow}>
                    {(
                      [
                        { r: 1 as Rating, label: 'Again', col: COLORS.accentRose },
                        { r: 2 as Rating, label: 'Hard', col: COLORS.accentAmber },
                        { r: 3 as Rating, label: 'Good', col: COLORS.accentBlue },
                        { r: 4 as Rating, label: 'Easy', col: COLORS.accentEmerald },
                      ]
                    ).map((btn) => (
                      <Pressable
                        key={btn.r}
                        onPress={() => handleGrade(card.id, btn.r)}
                        android_ripple={androidRipple()}
                        style={[styles.rateBtn, { borderColor: btn.col }]}
                      >
                        <Text style={[styles.rateBtnText, { color: btn.col }]}>
                          {btn.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
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
  heading: { color: COLORS.textPrimary, fontSize: 19, fontWeight: '700', marginBottom: 4 },
  subheading: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 14 },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  filterChip: {
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
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  conceptTag: { color: COLORS.accentBlue, fontSize: 12, fontWeight: '700', flex: 1, paddingRight: 8 },
  stabilityTag: { color: COLORS.textMuted, fontSize: 11, fontFamily: 'monospace' },
  questionText: { color: COLORS.textPrimary, fontSize: 14.5, fontWeight: '600', lineHeight: 20, marginBottom: 12 },
  revealBtn: {
    backgroundColor: COLORS.surfaceElevated,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  revealBtnText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  answerSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  answerText: { color: COLORS.textPrimary, fontSize: 13.5, lineHeight: 19, marginBottom: 8 },
  tipText: { color: COLORS.accentEmerald, fontSize: 12.5, fontStyle: 'italic', marginBottom: 12 },
  ratingRow: { flexDirection: 'row', gap: 8 },
  rateBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  rateBtnText: { fontSize: 12, fontWeight: '700' },
});
