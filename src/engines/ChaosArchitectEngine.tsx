import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { ChaosArchitectLab } from '../data/types';
import { COLORS, androidRipple, triggerHaptic } from '../theme';
import { DynamicIcon } from '../components/DynamicIcon';

interface Props {
  lab: ChaosArchitectLab;
  onComplete: (accuracyPct: number) => void;
}

export function ChaosArchitectEngine({ lab, onComplete }: Props) {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [solvedScenarios, setSolvedScenarios] = useState<Record<string, boolean>>({});
  const [activeNodes, setActiveNodes] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const n of lab.nodes) {
      map[n.id] = n.enabledByDefault;
    }
    return map;
  });
  const [simulated, setSimulated] = useState(false);
  const [failedRuns, setFailedRuns] = useState(0);

  const scenario = lab.scenarios[scenarioIdx] ?? lab.scenarios[0];

  const toggleNode = (id: string, optional?: boolean) => {
    if (!optional) return;
    triggerHaptic('selection');
    setActiveNodes((prev) => ({ ...prev, [id]: !prev[id] }));
    setSimulated(false);
  };

  // Dynamic role-based topology physics across arbitrary nodes
  const activeNodeList = lab.nodes.filter((n) => Boolean(activeNodes[n.id]));
  const activeCaches = activeNodeList.filter((n) => n.role === 'cache');
  const activeQueues = activeNodeList.filter((n) => n.role === 'queue');
  const activeWorkers = activeNodeList.filter((n) => n.role === 'worker');
  const activeDbs = activeNodeList.filter((n) => n.role === 'db');

  // Identify primary DB (first non-optional DB node, or lowest capacity DB node) vs read replicas
  const primaryDb =
    lab.nodes.find((n) => n.role === 'db' && !n.optionalToggle) ??
    activeDbs[activeDbs.length - 1] ??
    { id: 'db-primary', label: 'Primary DB', role: 'db', baseCapacityRps: 2200, baseLatencyMs: 35, enabledByDefault: true };

  const activeReplicas = activeDbs.filter((n) => n.id !== primaryDb.id);

  const readRps = scenario.incomingRps * scenario.readWriteRatio;
  const writeRps = scenario.incomingRps * (1 - scenario.readWriteRatio);

  // Cache layers absorb up to 90% of read traffic (capped by total cache capacity)
  const totalCacheCapacity = activeCaches.reduce((sum, n) => sum + n.baseCapacityRps, 0);
  const absorbedByCache =
    activeCaches.length > 0 ? Math.min(readRps * 0.9, totalCacheCapacity) : 0;
  const uncachedReadRps = Math.max(0, readRps - absorbedByCache);

  // Read Replicas offload 75% of uncached reads (capped by replica capacity)
  const totalReplicaCapacity = activeReplicas.reduce((sum, n) => sum + n.baseCapacityRps, 0);
  const offloadedToReplicas =
    activeReplicas.length > 0 ? Math.min(uncachedReadRps * 0.75, totalReplicaCapacity) : 0;
  const primaryReadLoad = Math.max(0, uncachedReadRps - offloadedToReplicas);

  // Write Queues + Workers smooth burst writes down to 50% of primary DB capacity
  const hasWriteSmoothing = activeQueues.length > 0 || activeWorkers.length > 0;
  const smoothedWriteCap = Math.round(primaryDb.baseCapacityRps * 0.5);
  const primaryWriteLoad = hasWriteSmoothing
    ? Math.min(writeRps, smoothedWriteCap)
    : writeRps;

  const totalPrimaryLoad = Math.round(primaryReadLoad + primaryWriteLoad);
  const dbCapacity = primaryDb.baseCapacityRps;
  const overloadFactor = Math.max(1, totalPrimaryLoad / Math.max(1, dbCapacity));

  const simulatedLatencyMs = Math.round(
    overloadFactor > 1
      ? 45 * Math.pow(overloadFactor, 2.2)
      : 24 +
          (activeCaches.length > 0 ? 4 : 30) +
          (hasWriteSmoothing ? 6 : 18) +
          (activeReplicas.length > 0 ? 0 : 12)
  );

  const simulatedAvailabilityPct = Number(
    (overloadFactor > 1
      ? Math.max(42, 100 - (overloadFactor - 1) * 35)
      : 99.92
    ).toFixed(2)
  );

  const allRequiredActive = scenario.requiredActiveNodes.every((id) =>
    Boolean(activeNodes[id])
  );

  const isTargetMet =
    allRequiredActive &&
    simulatedLatencyMs <= scenario.targetMaxLatencyMs &&
    simulatedAvailabilityPct >= scenario.targetMinAvailabilityPct;

  const handleRunSimulation = () => {
    setSimulated(true);
    if (isTargetMet) {
      triggerHaptic('success');
      setSolvedScenarios((prev) => ({ ...prev, [scenario.id]: true }));
    } else {
      triggerHaptic('error');
      setFailedRuns((f) => f + 1);
    }
  };

  const allScenariosSolved = lab.scenarios.every(
    (s) => solvedScenarios[s.id] || (s.id === scenario.id && isTargetMet && simulated)
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerBox}>
        <Text style={styles.systemTitle}>{lab.systemName}</Text>
        <Text style={styles.goalText}>{lab.architectureGoal}</Text>

        {lab.scenarios.length > 1 && (
          <View style={styles.scenarioTabs}>
            {lab.scenarios.map((s, idx) => {
              const isCurrent = idx === scenarioIdx;
              const isSolved = Boolean(solvedScenarios[s.id]);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    triggerHaptic('selection');
                    setScenarioIdx(idx);
                    setSimulated(false);
                  }}
                  android_ripple={androidRipple()}
                  style={[
                    styles.scenarioTab,
                    isCurrent && styles.scenarioTabActive,
                    isSolved && styles.scenarioTabSolved,
                  ]}
                >
                  <Text
                    style={[
                      styles.scenarioTabText,
                      isCurrent && styles.scenarioTabTextActive,
                    ]}
                  >
                    Wave {idx + 1} {isSolved ? '✓' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={styles.scenarioName}>{scenario.name}</Text>
        <Text style={styles.scenarioDesc}>{scenario.description}</Text>
      </View>

      {/* Live Telemetry Bar */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>PRIMARY DB LOAD</Text>
          <Text
            style={[
              styles.metricValue,
              {
                color:
                  totalPrimaryLoad <= dbCapacity
                    ? COLORS.accentEmerald
                    : COLORS.accentRose,
              },
            ]}
          >
            {totalPrimaryLoad} / {dbCapacity} RPS
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>P99 LATENCY</Text>
          <Text
            style={[
              styles.metricValue,
              {
                color:
                  simulatedLatencyMs <= scenario.targetMaxLatencyMs
                    ? COLORS.accentEmerald
                    : COLORS.accentRose,
              },
            ]}
          >
            {simulatedLatencyMs} ms (≤{scenario.targetMaxLatencyMs})
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>AVAILABILITY</Text>
          <Text
            style={[
              styles.metricValue,
              {
                color:
                  simulatedAvailabilityPct >= scenario.targetMinAvailabilityPct
                    ? COLORS.accentEmerald
                    : COLORS.accentRose,
              },
            ]}
          >
            {simulatedAvailabilityPct}%
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        TAP OPTIONAL INFRASTRUCTURE NODES TO WIRE TOPOLOGY:
      </Text>

      {lab.nodes.map((node) => {
        const isEnabled = Boolean(activeNodes[node.id]);
        return (
          <Pressable
            key={node.id}
            onPress={() => toggleNode(node.id, node.optionalToggle)}
            android_ripple={androidRipple()}
            style={[styles.nodeCard, isEnabled && styles.nodeCardActive]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.nodeLabel}>
                {node.label} {node.optionalToggle ? '(Tap to Toggle)' : '(Core)'}
              </Text>
              <Text style={styles.nodeSpecs}>
                Role: {node.role.toUpperCase()} · Cap: {node.baseCapacityRps.toLocaleString()} RPS · {node.baseLatencyMs}ms
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                isEnabled ? styles.pillActive : styles.pillInactive,
              ]}
            >
              <Text style={styles.pillText}>
                {isEnabled ? 'ONLINE' : 'BYPASSED'}
              </Text>
            </View>
          </Pressable>
        );
      })}

      <Pressable
        onPress={handleRunSimulation}
        android_ripple={androidRipple()}
        style={styles.simBtn}
      >
        <DynamicIcon name="zap" size={18} color="#FFFFFF" />
        <Text style={styles.simBtnText}>
          Run {scenario.incomingRps.toLocaleString()} RPS Traffic Spike Simulation
        </Text>
      </Pressable>

      {simulated && (
        <View
          style={[
            styles.resultCard,
            isTargetMet ? styles.resultSuccess : styles.resultFail,
          ]}
        >
          <Text style={styles.resultTitle}>
            {isTargetMet
              ? 'SLA TARGET ACHIEVED (99.92% UP)'
              : 'DATABASE MELTDOWN OR MISSING FAULT-TOLERANCE NODE'}
          </Text>
          <Text style={styles.resultBody}>
            {isTargetMet ? scenario.successAnalysis : scenario.failureAnalysis}
          </Text>
          {isTargetMet && !allScenariosSolved && scenarioIdx < lab.scenarios.length - 1 && (
            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                setScenarioIdx((i) => i + 1);
                setSimulated(false);
              }}
              android_ripple={androidRipple()}
              style={styles.finishBtn}
            >
              <Text style={styles.finishBtnText}>Advance to Next Traffic Wave →</Text>
            </Pressable>
          )}
          {isTargetMet && allScenariosSolved && (
            <Pressable
              onPress={() => {
                const accuracy = Math.max(
                  60,
                  Math.round((1 / (1 + failedRuns)) * 100)
                );
                onComplete(accuracy);
              }}
              android_ripple={androidRipple()}
              style={styles.finishBtn}
            >
              <Text style={styles.finishBtnText}>
                Lock In Architecture &amp; Claim XP
              </Text>
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
  headerBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  systemTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  goalText: { color: COLORS.accentAmber, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  scenarioTabs: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  scenarioTab: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scenarioTabActive: {
    borderColor: COLORS.accentBlue,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  scenarioTabSolved: {
    borderColor: COLORS.accentEmerald,
  },
  scenarioTabText: { color: COLORS.textMuted, fontSize: 11.5, fontWeight: '700' },
  scenarioTabTextActive: { color: '#FFFFFF' },
  scenarioName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  scenarioDesc: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', marginBottom: 4 },
  metricValue: { fontSize: 13, fontWeight: '700', fontFamily: 'monospace' },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  nodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  nodeCardActive: {
    borderColor: COLORS.accentBlue,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  nodeLabel: { color: COLORS.textPrimary, fontSize: 13.5, fontWeight: '700', marginBottom: 3 },
  nodeSpecs: { color: COLORS.textMuted, fontSize: 11.5, fontFamily: 'monospace' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  pillActive: { backgroundColor: 'rgba(16, 185, 129, 0.25)' },
  pillInactive: { backgroundColor: 'rgba(148, 163, 184, 0.2)' },
  pillText: { color: COLORS.textPrimary, fontSize: 11, fontWeight: '700' },
  simBtn: {
    backgroundColor: COLORS.accentBlue,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  simBtnText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
  resultCard: {
    borderRadius: 10,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
  },
  resultSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: COLORS.accentEmerald,
  },
  resultFail: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderColor: COLORS.accentRose,
  },
  resultTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  resultBody: { color: COLORS.textSecondary, fontSize: 13.5, lineHeight: 19 },
  finishBtn: {
    backgroundColor: COLORS.accentEmerald,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  finishBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
