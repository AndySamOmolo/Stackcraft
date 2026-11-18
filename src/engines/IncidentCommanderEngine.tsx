import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { IncidentCommanderLab } from '../data/types';
import { COLORS, FONTS, androidRipple, triggerHaptic } from '../theme';
import { DynamicIcon } from '../components/DynamicIcon';

interface Props {
  lab: IncidentCommanderLab;
  onComplete: (accuracyPct: number) => void;
}

export function IncidentCommanderEngine({ lab, onComplete }: Props) {
  const [executedProbeIds, setExecutedProbeIds] = useState<string[]>([]);
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<string | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);

  const runProbe = (id: string) => {
    triggerHaptic('selection');
    if (!executedProbeIds.includes(id)) {
      setExecutedProbeIds((prev) => [...prev, id]);
    }
  };

  const minProbesRequired = Math.min(2, lab.probes.length);
  const enoughProbesRun = executedProbeIds.length >= minProbesRequired;
  const probeProgressPct = Math.min(
    100,
    Math.round((executedProbeIds.length / Math.max(1, minProbesRequired)) * 100)
  );

  const selectedHyp = lab.rootCauseHypotheses.find((h) => h.id === selectedHypothesisId);
  const isSolved = Boolean(selectedHyp?.isCorrect);

  const handleSelectHypothesis = (id: string, isCorrect: boolean) => {
    if (!enoughProbesRun || isSolved) {
      triggerHaptic('warning');
      return;
    }
    setSelectedHypothesisId(id);
    if (isCorrect) {
      triggerHaptic('success');
    } else {
      triggerHaptic('error');
      setWrongAttempts((w) => w + 1);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Production Pager Alert Banner */}
      <View style={styles.alertBox} accessible accessibilityRole="summary">
        <View style={styles.alertTopRow}>
          <View style={styles.sevBadge}>
            <DynamicIcon name="alert-triangle" size={12} color="#FFFFFF" />
            <Text style={styles.sevBadgeText}>SEV-1 PAGER</Text>
          </View>
          <Text style={styles.incidentBadge}>{lab.incidentId} · WAR ROOM</Text>
        </View>
        <Text style={styles.alertHeadline}>{lab.alertHeadline}</Text>
        <View style={styles.metricsRow}>
          {lab.symptomMetrics.map((m) => (
            <View
              key={m.label}
              style={[
                styles.metricChip,
                m.severity === 'critical' && styles.metricChipCritical,
                m.severity === 'warn' && styles.metricChipWarn,
              ]}
              accessible
              accessibilityLabel={`${m.label}: ${m.value}, status ${m.severity}`}
            >
              <Text style={styles.metricLabel}>{m.label}</Text>
              <Text
                style={[
                  styles.metricVal,
                  m.severity === 'critical' && { color: COLORS.accentRose },
                  m.severity === 'warn' && { color: COLORS.accentAmber },
                  m.severity === 'normal' && { color: COLORS.accentEmerald },
                ]}
              >
                {m.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.sectionHeader}>
        1. RUN LINUX KERNEL &amp; SOCKET DIAGNOSTIC PROBES ({executedProbeIds.length}/{lab.probes.length} EXECUTED):
      </Text>

      {lab.probes.map((probe) => {
        const isExecuted = executedProbeIds.includes(probe.id);
        return (
          <View key={probe.id} style={styles.probeCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isExecuted }}
              accessibilityLabel={`Diagnostic probe: ${probe.command}, purpose: ${probe.purpose}, status: ${isExecuted ? 'Executed' : 'Tap to execute'}`}
              onPress={() => runProbe(probe.id)}
              android_ripple={androidRipple()}
              style={styles.probeHeader}
            >
              <DynamicIcon
                name="terminal"
                size={16}
                color={isExecuted ? COLORS.accentEmerald : COLORS.accentBlue}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.probeCmd}>
                  <Text style={styles.promptPrefix}>root@prod:~# </Text>
                  {probe.command}
                </Text>
                <Text style={styles.probePurpose}>{probe.purpose}</Text>
              </View>
              <View style={[styles.runPill, isExecuted && styles.runPillDone]}>
                <Text style={[styles.runLabel, isExecuted && styles.runLabelDone]}>
                  {isExecuted ? 'EXIT 0' : 'RUN'}
                </Text>
              </View>
            </Pressable>
            {isExecuted && (
              <View style={styles.terminalOutputBox} accessibilityLiveRegion="polite">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Text style={styles.terminalText}>{probe.terminalOutput}</Text>
                </ScrollView>
                <View style={styles.clueBanner}>
                  <DynamicIcon name="zap" size={13} color={COLORS.accentAmber} />
                  <Text style={styles.clueText}>{probe.revealsClue}</Text>
                </View>
              </View>
            )}
          </View>
        );
      })}

      {/* Evidence Collection Unlock Progress Meter */}
      <View style={styles.unlockBox}>
        <View style={styles.unlockHeaderRow}>
          <Text style={styles.sectionHeaderInline}>
            2. IDENTIFY ROOT CAUSE &amp; EXECUTE REMEDIATION
          </Text>
          <Text
            style={[
              styles.unlockStatusText,
              enoughProbesRun && { color: COLORS.accentEmerald },
            ]}
          >
            {enoughProbesRun
              ? '✓ UNLOCKED'
              : `${executedProbeIds.length}/${minProbesRequired} PROBES`}
          </Text>
        </View>
        <View style={styles.unlockBarTrack}>
          <View
            style={[
              styles.unlockBarFill,
              {
                width: `${probeProgressPct}%`,
                backgroundColor: enoughProbesRun
                  ? COLORS.accentEmerald
                  : COLORS.accentAmber,
              },
            ]}
          />
        </View>
        {!enoughProbesRun && (
          <Text style={styles.gateHint}>
            Run at least {minProbesRequired} diagnostic probes above to gather kernel evidence before locking in a root-cause remediation.
          </Text>
        )}
      </View>

      {lab.rootCauseHypotheses.map((hyp) => {
        const isSelected = selectedHypothesisId === hyp.id;
        return (
          <Pressable
            key={hyp.id}
            onPress={() => handleSelectHypothesis(hyp.id, hyp.isCorrect)}
            disabled={!enoughProbesRun || isSolved}
            accessibilityRole="button"
            accessibilityState={{
              selected: isSelected,
              disabled: !enoughProbesRun || isSolved,
            }}
            accessibilityLabel={`Root cause hypothesis: ${hyp.statement}. Remediation: ${hyp.remediationCommand}`}
            android_ripple={androidRipple()}
            style={[
              styles.hypCard,
              !enoughProbesRun && styles.hypDisabled,
              isSelected && hyp.isCorrect && styles.hypCorrect,
              isSelected && !hyp.isCorrect && styles.hypWrong,
            ]}
          >
            <Text style={styles.hypStatement}>{hyp.statement}</Text>
            <View style={styles.remediationPill}>
              <Text style={styles.hypRemediation}>$ {hyp.remediationCommand}</Text>
            </View>
          </Pressable>
        );
      })}

      {selectedHyp && (
        <View style={styles.explanationBox} accessibilityLiveRegion="polite">
          <Text style={styles.explanationText}>{selectedHyp.explanation}</Text>
          {selectedHyp.isCorrect && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Resolve incident and claim XP"
              onPress={() => {
                const accuracy = Math.max(50, Math.round((1 / (1 + wrongAttempts)) * 100));
                onComplete(accuracy);
              }}
              android_ripple={androidRipple()}
              style={styles.resolveBtn}
            >
              <Text style={styles.resolveBtnText}>Resolve Incident &amp; Claim XP</Text>
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
  alertBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: COLORS.accentRose,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  alertTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sevBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.accentRoseDark,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  sevBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  incidentBadge: { color: COLORS.accentRose, fontSize: 11, fontWeight: '700', fontFamily: FONTS.mono },
  alertHeadline: { color: COLORS.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 10 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricChip: {
    flex: 1,
    minWidth: 92,
    backgroundColor: COLORS.codeBg,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: 8,
    borderRadius: 6,
  },
  metricChipCritical: { borderColor: '#EF444466' },
  metricChipWarn: { borderColor: '#F59E0B66' },
  metricLabel: { color: COLORS.textMuted, fontSize: 10, marginBottom: 2 },
  metricVal: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', fontFamily: FONTS.mono },
  sectionHeader: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  probeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  probeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    gap: 10,
    padding: 12,
  },
  promptPrefix: {
    color: COLORS.textMuted,
    fontFamily: FONTS.mono,
    fontSize: 12,
  },
  probeCmd: { color: COLORS.accentEmerald, fontFamily: FONTS.mono, fontSize: 12.5, fontWeight: '700' },
  probePurpose: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  runPill: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  runPillDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  runLabel: { color: COLORS.accentBlue, fontSize: 10.5, fontWeight: '700', fontFamily: FONTS.mono },
  runLabelDone: { color: COLORS.accentEmerald },
  terminalOutputBox: {
    backgroundColor: COLORS.terminalBg,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  terminalText: { color: '#E2E8F0', fontFamily: FONTS.mono, fontSize: 12, lineHeight: 17 },
  clueBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    padding: 8,
    borderRadius: 6,
  },
  clueText: { color: COLORS.accentAmber, fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },
  unlockBox: {
    marginVertical: 10,
  },
  unlockHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionHeaderInline: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  unlockStatusText: {
    color: COLORS.accentAmber,
    fontSize: 11,
    fontFamily: FONTS.mono,
    fontWeight: '700',
  },
  unlockBarTrack: {
    height: 4,
    backgroundColor: COLORS.codeBg,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  unlockBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  gateHint: {
    color: COLORS.accentAmber,
    fontSize: 12,
    lineHeight: 17,
  },
  hypCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 54,
    marginBottom: 10,
  },
  hypDisabled: { opacity: 0.5 },
  hypCorrect: {
    borderColor: COLORS.accentEmerald,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  hypWrong: {
    borderColor: COLORS.accentRose,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
  },
  hypStatement: { color: COLORS.textPrimary, fontSize: 13.5, fontWeight: '600', marginBottom: 8 },
  remediationPill: {
    backgroundColor: COLORS.codeBg,
    borderRadius: 6,
    padding: 8,
  },
  hypRemediation: { color: '#93C5FD', fontSize: 11.5, fontFamily: FONTS.mono },
  explanationBox: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  explanationText: { color: COLORS.textPrimary, fontSize: 13.5, lineHeight: 19 },
  resolveBtn: {
    backgroundColor: COLORS.accentEmeraldDark,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  resolveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
