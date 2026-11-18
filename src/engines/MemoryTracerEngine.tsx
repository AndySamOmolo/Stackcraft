import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { CodeLanguage, MemoryTracerLab } from '../data/types';
import { COLORS, androidRipple, triggerHaptic } from '../theme';
import { DynamicIcon } from '../components/DynamicIcon';

interface Props {
  lab: MemoryTracerLab;
  language: CodeLanguage;
  onComplete: (accuracyPct: number) => void;
}

export function MemoryTracerEngine({ lab, language, onComplete }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answeredSteps, setAnsweredSteps] = useState<Record<number, boolean>>({});
  const [mistakes, setMistakes] = useState(0);
  const [highlightedHeapId, setHighlightedHeapId] = useState<string | null>(null);

  const currentStep = lab.steps[stepIdx];
  const codeLines = lab.codeSnippets[language];
  const activeLineNumber = currentStep.activeLine[language];

  const hasQuestion = Boolean(currentStep.question);
  const isQuestionSolved = answeredSteps[stepIdx] === true;

  const handleSelectOption = (idx: number) => {
    if (!currentStep.question || isQuestionSolved) return;
    setSelectedOption(idx);
    if (idx === currentStep.question.correctIndex) {
      triggerHaptic('success');
      setAnsweredSteps((prev) => ({ ...prev, [stepIdx]: true }));
    } else {
      triggerHaptic('error');
      setMistakes((m) => m + 1);
    }
  };

  const handlePrevStep = () => {
    if (stepIdx > 0) {
      triggerHaptic('selection');
      setStepIdx((s) => s - 1);
      setSelectedOption(null);
      setHighlightedHeapId(null);
    }
  };

  const handleNextStep = () => {
    triggerHaptic('selection');
    setHighlightedHeapId(null);
    if (stepIdx < lab.steps.length - 1) {
      setStepIdx((s) => s + 1);
      setSelectedOption(null);
    } else {
      const totalQuestions = lab.steps.filter((s) => s.question).length || 1;
      const accuracy = Math.max(
        40,
        Math.round((totalQuestions / (totalQuestions + mistakes)) * 100)
      );
      onComplete(accuracy);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Step Header */}
      <View style={styles.stepBar}>
        <Text style={styles.stepBadge}>
          EXECUTION FRAME {stepIdx + 1} OF {lab.steps.length}
        </Text>
        <Pressable
          onPress={() => {
            triggerHaptic('selection');
            setStepIdx(0);
            setSelectedOption(null);
            setAnsweredSteps({});
            setMistakes(0);
            setHighlightedHeapId(null);
          }}
          android_ripple={androidRipple()}
          style={styles.resetBtn}
        >
          <DynamicIcon name="rotate-ccw" size={15} color={COLORS.textSecondary} />
          <Text style={styles.resetText}>Reset Trace</Text>
        </Pressable>
      </View>

      {/* Code Viewport */}
      <View style={styles.codeCard}>
        {codeLines.map((line, i) => {
          const lineNum = i + 1;
          const isCurrent = lineNum === activeLineNumber;
          return (
            <View
              key={lineNum}
              style={[styles.codeRow, isCurrent && styles.codeRowActive]}
            >
              <Text style={styles.lineNum}>{lineNum}</Text>
              <Text style={[styles.codeText, isCurrent && styles.codeTextActive]}>
                {line}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Narration Box */}
      <View style={styles.narrationBox}>
        <Text style={styles.narrationText}>{currentStep.narration}</Text>
      </View>

      {/* Dual Memory Visualizer: Call Stack & Heap */}
      <View style={styles.memoryGrid}>
        {/* Call Stack Column */}
        <View style={styles.memoryColumn}>
          <View style={styles.colHeader}>
            <DynamicIcon name="layers" size={16} color={COLORS.accentBlue} />
            <Text style={styles.colTitle}>CALL STACK (LIFO)</Text>
          </View>
          {currentStep.stack.map((frame) => (
            <View key={frame.id} style={styles.stackFrame}>
              <Text style={styles.frameTitle}>
                {frame.functionName} : line {frame.line}
              </Text>
              {frame.variables.length === 0 ? (
                <Text style={styles.emptyText}>(no local slots)</Text>
              ) : (
                frame.variables.map((v) => {
                  const isRefLinked =
                    Boolean(v.pointsToHeapId) &&
                    highlightedHeapId === v.pointsToHeapId;
                  return (
                    <Pressable
                      key={v.name}
                      disabled={!v.pointsToHeapId}
                      onPress={() => {
                        if (v.pointsToHeapId) {
                          triggerHaptic('selection');
                          setHighlightedHeapId((prev) =>
                            prev === v.pointsToHeapId ? null : v.pointsToHeapId!
                          );
                        }
                      }}
                      style={[
                        styles.varRow,
                        isRefLinked && styles.varRowLinked,
                      ]}
                    >
                      <Text style={styles.varName}>{v.name}</Text>
                      <Text
                        style={[
                          styles.varValue,
                          v.type === 'reference' && styles.varReference,
                          v.changed && styles.varChanged,
                        ]}
                      >
                        {v.value}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          ))}
        </View>

        {/* Heap Memory Column */}
        <View style={styles.memoryColumn}>
          <View style={styles.colHeader}>
            <DynamicIcon name="cpu" size={16} color={COLORS.accentEmerald} />
            <Text style={styles.colTitle}>HEAP ALLOCATIONS</Text>
          </View>
          {currentStep.heap.length === 0 ? (
            <View style={styles.emptyHeap}>
              <Text style={styles.emptyText}>0 active heap blocks</Text>
            </View>
          ) : (
            currentStep.heap.map((obj) => {
              const isHighlighted = highlightedHeapId === obj.id;
              return (
                <Pressable
                  key={obj.id}
                  onPress={() => {
                    triggerHaptic('selection');
                    setHighlightedHeapId((prev) =>
                      prev === obj.id ? null : obj.id
                    );
                  }}
                  style={[
                    styles.heapObject,
                    isHighlighted && styles.heapObjectHighlighted,
                  ]}
                >
                  <View style={styles.heapHeader}>
                    <Text style={styles.heapAddr}>@{obj.address}</Text>
                    <Text style={styles.heapRef}>refs: {obj.refCount}</Text>
                  </View>
                  <Text style={styles.heapLabel}>{obj.label}</Text>
                  {obj.fields.map((f) => (
                    <View key={f.key} style={styles.varRow}>
                      <Text style={styles.varName}>.{f.key}</Text>
                      <Text
                        style={[styles.varValue, f.changed && styles.varChanged]}
                      >
                        {f.value}
                      </Text>
                    </View>
                  ))}
                </Pressable>
              );
            })
          )}
        </View>
      </View>

      {/* Checkpoint Prediction Question */}
      {currentStep.question && (
        <View style={styles.questionBox}>
          <Text style={styles.questionHeader}>PREDICT THE MEMORY STATE</Text>
          <Text style={styles.questionPrompt}>{currentStep.question.prompt}</Text>
          {currentStep.question.options.map((opt, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrect = idx === currentStep.question!.correctIndex;
            return (
              <Pressable
                key={idx}
                onPress={() => handleSelectOption(idx)}
                android_ripple={androidRipple()}
                style={[
                  styles.optionBtn,
                  (isQuestionSolved && isCorrect) || (isSelected && isCorrect)
                    ? styles.optionCorrect
                    : null,
                  isSelected && !isCorrect && styles.optionWrong,
                ]}
              >
                <Text style={styles.optionText}>{opt}</Text>
              </Pressable>
            );
          })}
          {(selectedOption !== null || isQuestionSolved) && (
            <Text style={styles.explanationText}>
              {currentStep.question.explanation}
            </Text>
          )}
        </View>
      )}

      {/* Bidirectional Stepper Controls */}
      <View style={styles.stepperRow}>
        <Pressable
          onPress={handlePrevStep}
          disabled={stepIdx === 0}
          android_ripple={androidRipple()}
          style={[styles.prevBtn, stepIdx === 0 && styles.btnDisabled]}
        >
          <DynamicIcon name="chevron-left" size={18} color={COLORS.textPrimary} />
          <Text style={styles.prevBtnText}>Step Back</Text>
        </Pressable>

        <Pressable
          onPress={handleNextStep}
          disabled={hasQuestion && !isQuestionSolved}
          android_ripple={androidRipple()}
          style={[
            styles.nextBtn,
            hasQuestion && !isQuestionSolved && styles.btnDisabled,
          ]}
        >
          <Text style={styles.nextBtnText}>
            {stepIdx < lab.steps.length - 1
              ? 'Step Forward'
              : 'Complete Trace Lab'}
          </Text>
          <DynamicIcon name="chevron-right" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 48 },
  stepBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepBadge: {
    color: COLORS.accentBlue,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceElevated,
  },
  resetText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  codeCard: {
    backgroundColor: COLORS.codeBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 14,
  },
  codeRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 12,
  },
  codeRowActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.22)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accentBlue,
  },
  lineNum: {
    width: 26,
    color: COLORS.textMuted,
    fontFamily: 'monospace',
    fontSize: 13,
  },
  codeText: {
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
    fontSize: 13,
    flexShrink: 1,
  },
  codeTextActive: { color: '#FFFFFF', fontWeight: '700' },
  narrationBox: {
    backgroundColor: COLORS.surface,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accentEmerald,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  narrationText: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 20 },
  memoryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  memoryColumn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
  },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  colTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  stackFrame: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 7,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3B82F644',
  },
  frameTitle: {
    color: COLORS.accentBlue,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    fontFamily: 'monospace',
  },
  varRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  varRowLinked: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
  },
  varName: { color: COLORS.textSecondary, fontSize: 12, fontFamily: 'monospace' },
  varValue: { color: COLORS.textPrimary, fontSize: 12, fontFamily: 'monospace', fontWeight: '600' },
  varReference: { color: COLORS.accentAmber },
  varChanged: { color: COLORS.accentEmerald },
  emptyHeap: { paddingVertical: 18, alignItems: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 12, fontStyle: 'italic' },
  heapObject: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 7,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#10B98144',
  },
  heapObjectHighlighted: {
    borderColor: COLORS.accentAmber,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
  },
  heapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  heapAddr: { color: COLORS.accentAmber, fontSize: 11, fontFamily: 'monospace', fontWeight: '700' },
  heapRef: { color: COLORS.textMuted, fontSize: 11, fontFamily: 'monospace' },
  heapLabel: { color: COLORS.accentEmerald, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  questionBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.accentAmber,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  questionHeader: {
    color: COLORS.accentAmber,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  questionPrompt: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    lineHeight: 20,
  },
  optionBtn: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  optionCorrect: {
    borderColor: COLORS.accentEmerald,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
  },
  optionWrong: {
    borderColor: COLORS.accentRose,
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
  },
  optionText: { color: COLORS.textPrimary, fontSize: 13.5, lineHeight: 19 },
  explanationText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 10,
  },
  prevBtn: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  prevBtnText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  nextBtn: {
    flex: 1,
    backgroundColor: COLORS.accentBlue,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  btnDisabled: { opacity: 0.45 },
  nextBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
