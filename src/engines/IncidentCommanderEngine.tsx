import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { IncidentCommanderLab } from '../data/types';
import { COLORS, androidRipple, triggerHaptic } from '../theme';
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

  const handleSelectHypothesis = (id: string, isCorrect: boolean) => {
    if (!enoughProbesRun) {
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

  const selectedHyp = lab.rootCauseHypotheses.find((h) => h.id === selectedHypothesisId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.alertBox}>
        <Text style={styles.incidentBadge}>{lab.incidentId} · PRODUCTION WAR ROOM</Text>
        <Text style={styles.alertHeadline}>{lab.alertHeadline}</Text>
        <View style={styles.metricsRow}>
          {lab.symptomMetrics.map((m) => (
            <View key={m.label} style={styles.metricChip}>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <Text
                style={[
                  styles.metricVal,
                  m.severity === 'critical' && { color: COLORS.accentRose },
                  m.severity === 'warn' && { color: COLORS.accentAmber },
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
              onPress={() => runProbe(probe.id)}
              android_ripple={androidRipple()}
              style={styles.probeHeader}
            >
              <DynamicIcon name="terminal" size={16} color={COLORS.accentEmerald} />
              <View style={{ flex: 1 }}>
                <Text style={styles.probeCmd}>$ {probe.command}</Text>
                <Text style={styles.probePurpose}>{probe.purpose}</Text>
              </View>
              <Text style={styles.runLabel}>{isExecuted ? 'RAN' : 'EXECUTE'}</Text>
            </Pressable>
            {isExecuted && (
              <View style={styles.terminalOutputBox}>
                <Text style={styles.terminalText}>{probe.terminalOutput}</Text>
                <Text style={styles.clueText}>Clue: {probe.revealsClue}</Text>
              </View>
            )}
          </View>
        );
      })}

      <Text style={styles.sectionHeader}>
        2. IDENTIFY ROOT CAUSE &amp; EXECUTE REMEDIATION:
      </Text>
      {!enoughProbesRun && (
        <Text style={styles.gateHint}>
          Run at least {minProbesRequired} diagnostic probes above to gather kernel evidence before locking in a root-cause remediation.
        </Text>
      )}

      {lab.rootCauseHypotheses.map((hyp) => {
        const isSelected = selectedHypothesisId === hyp.id;
        return (
          <Pressable
            key={hyp.id}
            onPress={() => handleSelectHypothesis(hyp.id, hyp.isCorrect)}
            disabled={!enoughProbesRun}
            android_ripple={androidRipple()}
            style={[
              styles.hypCard,
              !enoughProbesRun && styles.hypDisabled,
              isSelected && hyp.isCorrect && styles.hypCorrect,
              isSelected && !hyp.isCorrect && styles.hypWrong,
            ]}
          >
            <Text style={styles.hypStatement}>{hyp.statement}</Text>
            <Text style={styles.hypRemediation}>Fix: {hyp.remediationCommand}</Text>
          </Pressable>
        );
      })}

      {selectedHyp && (
        <View style={styles.explanationBox}>
          <Text style={styles.explanationText}>{selectedHyp.explanation}</Text>
          {selectedHyp.isCorrect && (
            <Pressable
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
  incidentBadge: { color: COLORS.accentRose, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  alertHeadline: { color: COLORS.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 10 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricChip: {
    flex: 1,
    backgroundColor: COLORS.codeBg,
    padding: 8,
    borderRadius: 6,
  },
  metricLabel: { color: COLORS.textMuted, fontSize: 10, marginBottom: 2 },
  metricVal: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', fontFamily: 'monospace' },
  sectionHeader: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginVertical: 10,
  },
  gateHint: {
    color: COLORS.accentAmber,
    fontSize: 12.5,
    lineHeight: 18,
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
    gap: 10,
    padding: 12,
  },
  probeCmd: { color: COLORS.accentEmerald, fontFamily: 'monospace', fontSize: 12.5, fontWeight: '700' },
  probePurpose: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  runLabel: { color: COLORS.accentBlue, fontSize: 11, fontWeight: '700' },
  terminalOutputBox: {
    backgroundColor: COLORS.codeBg,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  terminalText: { color: '#E2E8F0', fontFamily: 'monospace', fontSize: 12, lineHeight: 17 },
  clueText: { color: COLORS.accentAmber, fontSize: 12.5, marginTop: 8, fontWeight: '600' },
  hypCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
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
  hypStatement: { color: COLORS.textPrimary, fontSize: 13.5, fontWeight: '600', marginBottom: 6 },
  hypRemediation: { color: '#93C5FD', fontSize: 12, fontFamily: 'monospace' },
  explanationBox: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  explanationText: { color: COLORS.textPrimary, fontSize: 13.5, lineHeight: 19 },
  resolveBtn: {
    backgroundColor: COLORS.accentEmerald,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  resolveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
