import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { CodeLanguage, MemoryTracerLab } from '../data/types';
import { COLORS, FONTS, androidRipple, triggerHaptic } from '../theme';
import { DynamicIcon } from '../components/DynamicIcon';

interface Props {
  lab: MemoryTracerLab;
  language: CodeLanguage;
  onComplete: (accuracyPct: number) => void;
}

export function MemoryTracerEngine({ lab, language, onComplete }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const stackColumnsVertically = width < 400 || fontScale > 1.15;

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

  const heapBadgeColors = useMemo(() => {
    const palette = [
      COLORS.accentAmber,
      COLORS.accentCyan,
      COLORS.accentPurple,
      COLORS.accentPink,
      COLORS.accentEmerald,
    ];
    const map: Record<string, string> = {};
    let idx = 0;
    for (const s of lab.steps) {
      for (const h of s.heap) {
        if (!map[h.id]) {
          map[h.id] = palette[idx % palette.length];
          idx++;
        }
      }
    }
    return map;
  }, [lab]);

  const activeLinkedHeap = useMemo(() => {
    if (!highlightedHeapId) return null;
    return currentStep.heap.find((h) => h.id === highlightedHeapId) ?? null;
  }, [currentStep, highlightedHeapId]);

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

  const canJumpToStep = (targetIdx: number): boolean => {
    if (targetIdx <= stepIdx) return true;
    for (let i = 0; i < targetIdx; i++) {
      if (lab.steps[i].question && !answeredSteps[i]) {
        return false;
      }
    }
    return true;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Interactive Frame Timeline Scrubber */}
      <View style={styles.timelineCard}>
        <View style={styles.stepBar}>
          <View style={styles.stepTitleGroup}>
            <DynamicIcon name="activity" size={14} color={COLORS.accentBlue} />
            <Text style={styles.stepBadge} accessibilityRole="header">
              EXECUTION FRAME {stepIdx + 1} OF {lab.steps.length}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              triggerHaptic('selection');
              setStepIdx(0);
              setSelectedOption(null);
              setAnsweredSteps({});
              setMistakes(0);
              setHighlightedHeapId(null);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Reset execution trace to frame 1"
            android_ripple={androidRipple()}
            style={styles.resetBtn}
          >
            <DynamicIcon name="rotate-ccw" size={13} color={COLORS.textSecondary} />
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
        </View>

        <View style={styles.scrubberRow} accessibilityRole="tablist">
          {lab.steps.map((s, idx) => {
            const isCurrent = idx === stepIdx;
            const isPast = idx < stepIdx;
            const hasQ = Boolean(s.question);
            const qSolved = Boolean(answeredSteps[idx]);
            const unlocked = canJumpToStep(idx);
            return (
              <Pressable
                key={s.stepIndex}
                disabled={!unlocked}
                hitSlop={6}
                accessibilityRole="tab"
                accessibilityState={{ selected: isCurrent, disabled: !unlocked }}
                accessibilityLabel={`Execution Frame ${idx + 1}${hasQ ? (qSolved ? ', checkpoint solved' : ', has checkpoint question') : ''}`}
                onPress={() => {
                  if (unlocked) {
                    triggerHaptic('selection');
                    setStepIdx(idx);
                    setSelectedOption(null);
                    setHighlightedHeapId(null);
                  }
                }}
                style={[
                  styles.scrubberNode,
                  isPast && styles.scrubberNodePast,
                  isCurrent && styles.scrubberNodeCurrent,
                  hasQ && !qSolved && !isCurrent && styles.scrubberNodeQuiz,
                  !unlocked && styles.scrubberNodeLocked,
                ]}
              >
                <Text
                  style={[
                    styles.scrubberText,
                    (isCurrent || isPast) && styles.scrubberTextActive,
                  ]}
                >
                  F{idx + 1}
                  {hasQ ? (qSolved ? '✓' : '?') : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Code Viewport with Active Breakpoint Gutter & Horizontal Scroll */}
      <View style={styles.codeCard}>
        <View style={styles.codeCardHeader}>
          <View style={styles.windowDots}>
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
            <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
          </View>
          <Text style={styles.codeFileLabel}>
            {language === 'typescript'
              ? 'trace.ts'
              : language === 'python'
              ? 'trace.py'
              : 'trace.c'}{' '}
            · IP → L{activeLineNumber}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.codeInner}>
            {codeLines.map((line, i) => {
              const lineNum = i + 1;
              const isCurrent = lineNum === activeLineNumber;
              return (
                <View
                  key={lineNum}
                  accessible
                  accessibilityLabel={`Line ${lineNum}${isCurrent ? ', active execution line' : ''}: ${line}`}
                  style={[styles.codeRow, isCurrent && styles.codeRowActive]}
                >
                  <Text style={[styles.bpIndicator, isCurrent && styles.bpActive]}>
                    {isCurrent ? '▶' : ' '}
                  </Text>
                  <Text style={[styles.lineNum, isCurrent && styles.lineNumActive]}>
                    {lineNum}
                  </Text>
                  <Text style={[styles.codeText, isCurrent && styles.codeTextActive]}>
                    {line}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Narration Box */}
      <View style={styles.narrationBox} accessibilityLiveRegion="polite">
        <View style={styles.narrationHeader}>
          <DynamicIcon name="cpu" size={14} color={COLORS.accentEmerald} />
          <Text style={styles.narrationLabel}>CPU &amp; MEMORY BUS NARRATION</Text>
        </View>
        <Text style={styles.narrationText}>{currentStep.narration}</Text>
      </View>

      {/* Pointer Link Status / Affordance Micro-Banner */}
      <View style={styles.pointerHintBar} accessibilityLiveRegion="polite">
        <DynamicIcon
          name="eye"
          size={13}
          color={activeLinkedHeap ? COLORS.accentAmber : COLORS.textMuted}
        />
        <Text
          style={[
            styles.pointerHintText,
            activeLinkedHeap && { color: COLORS.accentAmber, fontWeight: '700' },
          ]}
        >
          {activeLinkedHeap
            ? `ACTIVE POINTER LINK → @${activeLinkedHeap.address} (${activeLinkedHeap.label}, rc=${activeLinkedHeap.refCount})`
            : 'Tip: Tap any @0x... reference or Heap block below to trace pointer aliasing'}
        </Text>
      </View>

      {/* Dual Memory Visualizer: Call Stack & Heap */}
      <View
        style={[
          styles.memoryGrid,
          stackColumnsVertically && styles.memoryGridStacked,
        ]}
      >
        {/* Call Stack Column */}
        <View style={styles.memoryColumn}>
          <View style={styles.colHeader}>
            <DynamicIcon name="layers" size={15} color={COLORS.accentBlue} />
            <Text style={styles.colTitle}>
              CALL STACK ({currentStep.stack.length} FRAME{currentStep.stack.length === 1 ? '' : 'S'})
            </Text>
          </View>
          {currentStep.stack.map((frame, fIdx) => {
            const resolvedFrameLine =
              typeof frame.line === 'number' ? frame.line : frame.line[language];
            const isTopFrame = fIdx === currentStep.stack.length - 1;
            return (
              <View
                key={frame.id}
                style={[styles.stackFrame, isTopFrame && styles.stackFrameTop]}
              >
                <View style={styles.frameHeaderRow}>
                  <Text style={styles.frameTitle}>{frame.functionName}</Text>
                  <Text style={styles.frameLineTag}>L{resolvedFrameLine}</Text>
                </View>
                {frame.variables.length === 0 ? (
                  <Text style={styles.emptyText}>(no local slots)</Text>
                ) : (
                  frame.variables.map((v) => {
                    const isRefLinked =
                      Boolean(v.pointsToHeapId) &&
                      highlightedHeapId === v.pointsToHeapId;
                    const badgeCol = v.pointsToHeapId
                      ? heapBadgeColors[v.pointsToHeapId] || COLORS.accentAmber
                      : undefined;
                    return (
                      <Pressable
                        key={v.name}
                        disabled={!v.pointsToHeapId}
                        accessibilityRole={v.pointsToHeapId ? 'button' : 'text'}
                        accessibilityState={{
                          selected: isRefLinked,
                          disabled: !v.pointsToHeapId,
                        }}
                        accessibilityLabel={`Stack variable ${v.name}, value ${v.value}, ${v.type}${v.pointsToHeapId ? ', tap to highlight linked heap object' : ''}`}
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
                        <View style={styles.varLeftGroup}>
                          {badgeCol && (
                            <View
                              style={[styles.ptrDot, { backgroundColor: badgeCol }]}
                            />
                          )}
                          <Text style={styles.varName}>{v.name}</Text>
                        </View>
                        <View style={styles.varRightGroup}>
                          <Text
                            style={[
                              styles.varValue,
                              v.type === 'reference' && { color: badgeCol || COLORS.accentAmber },
                              v.changed && styles.varChanged,
                            ]}
                          >
                            {v.value}
                          </Text>
                          {v.changed && (
                            <View style={styles.mutatedBadge}>
                              <Text style={styles.mutatedBadgeText}>NEW</Text>
                            </View>
                          )}
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            );
          })}
        </View>

        {/* Heap Memory Column */}
        <View style={styles.memoryColumn}>
          <View style={styles.colHeader}>
            <DynamicIcon name="database" size={15} color={COLORS.accentEmerald} />
            <Text style={styles.colTitle}>
              HEAP ALLOCATIONS ({currentStep.heap.length})
            </Text>
          </View>
          {currentStep.heap.length === 0 ? (
            <View style={styles.emptyHeap}>
              <Text style={styles.emptyText}>0 active heap blocks</Text>
            </View>
          ) : (
            currentStep.heap.map((obj) => {
              const isHighlighted = highlightedHeapId === obj.id;
              const isCollected = Boolean(obj.collected || obj.refCount === 0);
              const badgeCol = isCollected
                ? COLORS.accentRose
                : heapBadgeColors[obj.id] || COLORS.accentAmber;
              return (
                <Pressable
                  key={obj.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isHighlighted }}
                  accessibilityLabel={`Heap object ${obj.label} at address ${obj.address}, reference count ${obj.refCount}${isCollected ? ', garbage collected' : ''}`}
                  onPress={() => {
                    triggerHaptic('selection');
                    setHighlightedHeapId((prev) =>
                      prev === obj.id ? null : obj.id
                    );
                  }}
                  style={[
                    styles.heapObject,
                    { borderLeftWidth: 3, borderLeftColor: badgeCol },
                    isCollected && styles.heapObjectCollected,
                    isHighlighted && styles.heapObjectHighlighted,
                  ]}
                >
                  <View style={styles.heapHeader}>
                    <Text style={[styles.heapAddr, { color: badgeCol }]}>
                      @{obj.address}
                    </Text>
                    <View
                      style={[
                        styles.refCountPill,
                        isCollected && styles.refCountPillCollected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.heapRef,
                          isCollected && { color: '#FCA5A5', fontWeight: '700' },
                        ]}
                      >
                        {isCollected ? 'GC FREED (rc=0)' : `rc=${obj.refCount}`}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.heapLabel,
                      isCollected && { color: COLORS.accentRose },
                    ]}
                  >
                    {obj.label}
                  </Text>
                  {obj.fields.map((f) => (
                    <View key={f.key} style={styles.varRow}>
                      <Text style={styles.varName}>.{f.key}</Text>
                      <View style={styles.varRightGroup}>
                        <Text
                          style={[styles.varValue, f.changed && styles.varChanged]}
                        >
                          {f.value}
                        </Text>
                        {f.changed && (
                          <View style={styles.mutatedBadge}>
                            <Text style={styles.mutatedBadgeText}>MUT</Text>
                          </View>
                        )}
                      </View>
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
          <View style={styles.questionHeaderRow}>
            <DynamicIcon name="zap" size={14} color={COLORS.accentAmber} />
            <Text style={styles.questionHeader}>CHECKPOINT: PREDICT MEMORY STATE</Text>
          </View>
          <Text style={styles.questionPrompt}>{currentStep.question.prompt}</Text>
          {currentStep.question.options.map((opt, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrect = idx === currentStep.question!.correctIndex;
            const showCorrect = (isQuestionSolved && isCorrect) || (isSelected && isCorrect);
            const showWrong = isSelected && !isCorrect;
            return (
              <Pressable
                key={idx}
                disabled={isQuestionSolved}
                accessibilityRole="button"
                accessibilityState={{
                  selected: isSelected || showCorrect,
                  disabled: isQuestionSolved,
                }}
                accessibilityLabel={`Option ${idx + 1}: ${opt}${showCorrect ? ', correct answer' : showWrong ? ', incorrect answer' : ''}`}
                onPress={() => handleSelectOption(idx)}
                android_ripple={androidRipple()}
                style={[
                  styles.optionBtn,
                  showCorrect ? styles.optionCorrect : null,
                  showWrong && styles.optionWrong,
                ]}
              >
                <Text style={styles.optionText}>{opt}</Text>
              </Pressable>
            );
          })}
          {(selectedOption !== null || isQuestionSolved) && (
            <View style={styles.explanationBanner} accessibilityLiveRegion="polite">
              <Text style={styles.explanationText}>
                {currentStep.question.explanation}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Bidirectional Stepper Controls */}
      <View style={styles.stepperRow}>
        <Pressable
          onPress={handlePrevStep}
          disabled={stepIdx === 0}
          accessibilityRole="button"
          accessibilityState={{ disabled: stepIdx === 0 }}
          accessibilityLabel="Step back to previous execution frame"
          android_ripple={androidRipple()}
          style={[styles.prevBtn, stepIdx === 0 && styles.btnDisabled]}
        >
          <DynamicIcon name="chevron-left" size={18} color={COLORS.textPrimary} />
          <Text style={styles.prevBtnText}>Prev Frame</Text>
        </Pressable>

        <Pressable
          onPress={handleNextStep}
          disabled={hasQuestion && !isQuestionSolved}
          accessibilityRole="button"
          accessibilityState={{ disabled: hasQuestion && !isQuestionSolved }}
          accessibilityLabel={
            hasQuestion && !isQuestionSolved
              ? 'Solve checkpoint question above to unlock next frame'
              : stepIdx < lab.steps.length - 1
              ? 'Step forward to next execution frame'
              : 'Complete trace lab and claim XP'
          }
          android_ripple={androidRipple()}
          style={[
            styles.nextBtn,
            hasQuestion && !isQuestionSolved && styles.btnDisabled,
          ]}
        >
          <Text style={styles.nextBtnText}>
            {hasQuestion && !isQuestionSolved
              ? 'Solve Checkpoint Above'
              : stepIdx < lab.steps.length - 1
              ? 'Step Forward'
              : 'Complete Trace Lab'}
          </Text>
          <DynamicIcon
            name={hasQuestion && !isQuestionSolved ? 'lock' : 'chevron-right'}
            size={18}
            color="#FFFFFF"
          />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 48 },
  timelineCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  stepBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stepTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBadge: {
    color: COLORS.accentBlue,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceElevated,
  },
  resetText: { color: COLORS.textSecondary, fontSize: 11.5, fontWeight: '600' },
  scrubberRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  scrubberNode: {
    flex: 1,
    minWidth: 44,
    minHeight: 36,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrubberNodePast: {
    borderColor: '#3B82F688',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  scrubberNodeCurrent: {
    borderColor: COLORS.accentBlue,
    backgroundColor: COLORS.accentBlueDark,
  },
  scrubberNodeQuiz: {
    borderColor: COLORS.accentAmber,
  },
  scrubberNodeLocked: {
    opacity: 0.4,
  },
  scrubberText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: FONTS.mono,
    fontWeight: '700',
  },
  scrubberTextActive: {
    color: '#FFFFFF',
  },
  codeCard: {
    backgroundColor: COLORS.codeBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 14,
  },
  codeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  windowDots: { flexDirection: 'row', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  codeFileLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: FONTS.mono,
    fontWeight: '700',
  },
  codeInner: {
    minWidth: '100%',
    paddingVertical: 8,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  codeRowActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.24)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accentBlue,
  },
  bpIndicator: {
    width: 14,
    fontSize: 10,
    color: 'transparent',
    fontFamily: FONTS.mono,
  },
  bpActive: {
    color: COLORS.accentAmber,
  },
  lineNum: {
    width: 24,
    color: COLORS.textMuted,
    fontFamily: FONTS.mono,
    fontSize: 12.5,
  },
  lineNumActive: {
    color: COLORS.accentBlue,
    fontWeight: '700',
  },
  codeText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.mono,
    fontSize: 13,
  },
  codeTextActive: { color: '#FFFFFF', fontWeight: '700' },
  narrationBox: {
    backgroundColor: COLORS.surface,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accentEmerald,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  narrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  narrationLabel: {
    color: COLORS.accentEmerald,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  narrationText: { color: COLORS.textPrimary, fontSize: 13.5, lineHeight: 20 },
  pointerHintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  pointerHintText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: FONTS.mono,
    flex: 1,
  },
  memoryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  memoryGridStacked: {
    flexDirection: 'column',
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
    borderRadius: 8,
    padding: 9,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3B82F633',
  },
  stackFrameTop: {
    borderColor: COLORS.accentBlue,
  },
  frameHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  frameTitle: {
    color: COLORS.accentBlue,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  frameLineTag: {
    color: COLORS.textMuted,
    fontSize: 10.5,
    fontFamily: FONTS.mono,
    backgroundColor: COLORS.codeBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  varRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  varRowLinked: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
  },
  varLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ptrDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  varRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  varName: { color: COLORS.textSecondary, fontSize: 12, fontFamily: FONTS.mono },
  varValue: { color: COLORS.textPrimary, fontSize: 12, fontFamily: FONTS.mono, fontWeight: '600' },
  varChanged: { color: COLORS.accentEmerald },
  mutatedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  mutatedBadgeText: {
    color: COLORS.accentEmerald,
    fontSize: 9,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  emptyHeap: { paddingVertical: 18, alignItems: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 12, fontStyle: 'italic' },
  heapObject: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 8,
    padding: 9,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#10B98133',
  },
  heapObjectCollected: {
    opacity: 0.65,
    borderColor: '#EF444466',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  heapObjectHighlighted: {
    borderColor: COLORS.accentAmber,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
  },
  heapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  heapAddr: { fontSize: 11, fontFamily: FONTS.mono, fontWeight: '700' },
  refCountPill: {
    backgroundColor: COLORS.codeBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  refCountPillCollected: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
  },
  heapRef: { color: COLORS.textMuted, fontSize: 10.5, fontFamily: FONTS.mono },
  heapLabel: { color: COLORS.accentEmerald, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  questionBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.accentAmber,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  questionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  questionHeader: {
    color: COLORS.accentAmber,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
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
    minHeight: 48,
    justifyContent: 'center',
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
  explanationBanner: {
    backgroundColor: COLORS.codeBg,
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accentBlue,
  },
  explanationText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
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
    minHeight: 48,
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
    backgroundColor: COLORS.accentBlueDark,
    borderRadius: 10,
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  btnDisabled: { opacity: 0.45 },
  nextBtnText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
});
