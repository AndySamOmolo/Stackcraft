import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { AiAuditorLab, CodeLanguage } from '../data/types';
import { COLORS, androidRipple, triggerHaptic } from '../theme';
import { DynamicIcon } from '../components/DynamicIcon';

interface Props {
  lab: AiAuditorLab;
  language: CodeLanguage;
  onComplete: (accuracyPct: number) => void;
}

export function AiAuditorEngine({ lab, language, onComplete }: Props) {
  const [tappedLine, setTappedLine] = useState<number | null>(null);
  const [lineFound, setLineFound] = useState(false);
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const lines = lab.codeSnippets[language];
  const targetBugLine = lab.buggyLineNumber[language];

  useEffect(() => {
    if (lineFound) {
      setTappedLine(lab.buggyLineNumber[language]);
    } else {
      setTappedLine(null);
    }
  }, [language, lineFound, lab]);

  const handleTapLine = (lineNumber: number) => {
    setTappedLine(lineNumber);
    setAttempts((a) => a + 1);
    if (lineNumber === targetBugLine) {
      triggerHaptic('success');
      setLineFound(true);
    } else {
      triggerHaptic('error');
    }
  };

  const selectedPatch = lab.patchOptions.find((p) => p.id === selectedPatchId);
  const isPatchCorrect = Boolean(selectedPatch?.isCorrect);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.prBanner}>
        <DynamicIcon name="git-pull-request" size={18} color={COLORS.accentAmber} />
        <View style={{ flex: 1 }}>
          <Text style={styles.prTitle}>{lab.prTitle}</Text>
          <Text style={styles.prContext}>{lab.aiPromptContext}</Text>
        </View>
      </View>

      <Text style={styles.instruction}>{lab.symptomQuestion}</Text>

      {/* Interactive PR Diff Lines */}
      <View style={styles.diffContainer}>
        {lines.map((line) => {
          const isTapped = tappedLine === line.lineNumber;
          const isBug = line.lineNumber === targetBugLine;
          return (
            <Pressable
              key={line.lineNumber}
              onPress={() => handleTapLine(line.lineNumber)}
              android_ripple={androidRipple()}
              style={[
                styles.diffRow,
                line.type === 'added' && styles.diffAdded,
                (lineFound && isBug) || (isTapped && isBug) ? styles.diffBugFound : null,
                isTapped && !isBug && styles.diffWrongLine,
              ]}
            >
              <Text style={styles.lineNum}>{line.lineNumber}</Text>
              <Text style={styles.diffSign}>
                {line.type === 'added' ? '+' : ' '}
              </Text>
              <Text style={styles.codeText}>{line.content}</Text>
            </Pressable>
          );
        })}
      </View>

      {tappedLine !== null && !lineFound && (
        <View style={styles.feedbackWarn}>
          <Text style={styles.feedbackWarnText}>
            Line {tappedLine} is not the primary vulnerability or bottleneck. Inspect the loop or non-atomic state write and tap the exact offending line.
          </Text>
        </View>
      )}

      {lineFound && (
        <View style={styles.patchSection}>
          <View style={styles.flawBadgeRow}>
            <DynamicIcon name="alert-triangle" size={16} color={COLORS.accentAmber} />
            <Text style={styles.flawCategory}>{lab.flawCategory}</Text>
          </View>

          <Text style={styles.patchHeader}>SELECT THE PRODUCTION-SAFE PATCH:</Text>
          {lab.patchOptions.map((patch) => {
            const isSelected = selectedPatchId === patch.id;
            return (
              <Pressable
                key={patch.id}
                onPress={() => {
                  triggerHaptic(patch.isCorrect ? 'success' : 'warning');
                  setSelectedPatchId(patch.id);
                }}
                android_ripple={androidRipple()}
                style={[
                  styles.patchCard,
                  isSelected && patch.isCorrect && styles.patchCorrect,
                  isSelected && !patch.isCorrect && styles.patchWrong,
                ]}
              >
                <Text style={styles.patchLabel}>{patch.label}</Text>
                <View style={styles.patchCodeBox}>
                  <Text style={styles.patchCode}>{patch.codePatch}</Text>
                </View>
              </Pressable>
            );
          })}

          {selectedPatch && (
            <View style={styles.deepDiveBox}>
              <Text style={styles.feedbackText}>{selectedPatch.feedback}</Text>
              {selectedPatch.isCorrect && (
                <Text style={styles.deepDiveText}>{lab.deepDiveExplanation}</Text>
              )}
            </View>
          )}

          {isPatchCorrect && (
            <Pressable
              onPress={() => {
                const accuracy = Math.max(50, Math.round((1 / Math.max(1, attempts)) * 100));
                onComplete(accuracy);
              }}
              android_ripple={androidRipple()}
              style={styles.completeBtn}
            >
              <Text style={styles.completeBtnText}>Approve Patched PR &amp; Claim XP</Text>
              <DynamicIcon name="check-circle" size={18} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 48 },
  prBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  prTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  prContext: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  instruction: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 12,
  },
  diffContainer: {
    backgroundColor: COLORS.codeBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  diffRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B66',
  },
  diffAdded: { backgroundColor: 'rgba(16, 185, 129, 0.08)' },
  diffBugFound: {
    backgroundColor: 'rgba(245, 158, 11, 0.28)',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accentAmber,
  },
  diffWrongLine: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
  },
  lineNum: { width: 24, color: COLORS.textMuted, fontFamily: 'monospace', fontSize: 12 },
  diffSign: { width: 16, color: COLORS.accentEmerald, fontFamily: 'monospace', fontSize: 12 },
  codeText: { color: COLORS.textPrimary, fontFamily: 'monospace', fontSize: 12.5, flex: 1 },
  feedbackWarn: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  feedbackWarnText: { color: '#FCA5A5', fontSize: 13, lineHeight: 18 },
  patchSection: { marginTop: 6 },
  flawBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  flawCategory: { color: COLORS.accentAmber, fontSize: 13, fontWeight: '700', flex: 1 },
  patchHeader: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  patchCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  patchCorrect: {
    borderColor: COLORS.accentEmerald,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  patchWrong: {
    borderColor: COLORS.accentRose,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
  },
  patchLabel: { color: COLORS.textPrimary, fontSize: 13.5, fontWeight: '600', marginBottom: 8 },
  patchCodeBox: {
    backgroundColor: COLORS.codeBg,
    borderRadius: 6,
    padding: 8,
  },
  patchCode: { color: '#93C5FD', fontFamily: 'monospace', fontSize: 12 },
  deepDiveBox: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
  },
  feedbackText: { color: COLORS.textPrimary, fontSize: 13.5, lineHeight: 19, marginBottom: 6 },
  deepDiveText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  completeBtn: {
    backgroundColor: COLORS.accentEmerald,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  completeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
