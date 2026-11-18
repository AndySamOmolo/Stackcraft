import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { ChaosArchitectLab } from '../data/types';
import { COLORS, FONTS, androidRipple, triggerHaptic } from '../theme';
import { DynamicIcon, IconName } from '../components/DynamicIcon';

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

  const activeNodeList = lab.nodes.filter((n) => Boolean(activeNodes[n.id]));
  const activeCaches = activeNodeList.filter((n) => n.role === 'cache');
  const activeQueues = activeNodeList.filter((n) => n.role === 'queue');
  const activeWorkers = activeNodeList.filter((n) => n.role === 'worker');
  const activeDbs = activeNodeList.filter((n) => n.role === 'db');

  const primaryDb =
    lab.nodes.find((n) => n.role === 'db' && !n.optionalToggle) ??
    activeDbs[activeDbs.length - 1] ?? {
      id: 'db-primary',
      label: 'Primary DB',
      role: 'db',
      baseCapacityRps: 2200,
      baseLatencyMs: 35,
      enabledByDefault: true,
    };

  const activeReplicas = activeDbs.filter((n) => n.id !== primaryDb.id);

  const readRps = Math.round(scenario.incomingRps * scenario.readWriteRatio);
  const writeRps = Math.round(scenario.incomingRps * (1 - scenario.readWriteRatio));

  const totalCacheCapacity = activeCaches.reduce((sum, n) => sum + n.baseCapacityRps, 0);
  const absorbedByCache =
    activeCaches.length > 0 ? Math.round(Math.min(readRps * 0.9, totalCacheCapacity)) : 0;
  const uncachedReadRps = Math.max(0, readRps - absorbedByCache);

  const totalReplicaCapacity = activeReplicas.reduce((sum, n) => sum + n.baseCapacityRps, 0);
  const offloadedToReplicas =
    activeReplicas.length > 0 ? Math.round(Math.min(uncachedReadRps * 0.75, totalReplicaCapacity)) : 0;
  const primaryReadLoad = Math.max(0, uncachedReadRps - offloadedToReplicas);

  const topologyHasWorkers = lab.nodes.some((n) => n.role === 'worker');
  const totalQueueCapacity = activeQueues.reduce((sum, n) => sum + n.baseCapacityRps, 0);
  const totalWorkerCapacity = topologyHasWorkers
    ? activeWorkers.reduce((sum, n) => sum + n.baseCapacityRps, 0)
    : Infinity;
  const hasWriteSmoothing =
    activeQueues.length > 0 &&
    (!topologyHasWorkers || activeWorkers.length > 0) &&
    writeRps <= Math.min(totalQueueCapacity, totalWorkerCapacity);

  const smoothedWriteCap = Math.round(primaryDb.baseCapacityRps * 0.5);
  const primaryWriteLoad = hasWriteSmoothing
    ? Math.min(writeRps, smoothedWriteCap)
    : writeRps;
  const bufferedWrites = Math.max(0, writeRps - primaryWriteLoad);

  const totalPrimaryLoad = Math.round(primaryReadLoad + primaryWriteLoad);
  const dbCapacity = primaryDb.baseCapacityRps;
  const overloadFactor = Math.max(1, totalPrimaryLoad / Math.max(1, dbCapacity));
  const dbUtilizationPct = Math.min(100, Math.round((totalPrimaryLoad / Math.max(1, dbCapacity)) * 100));

  const simulatedLatencyMs = Math.round(
    overloadFactor > 1
      ? 45 * Math.pow(overloadFactor, 2.2)
      : 24 +
          (activeCaches.length > 0 ? 4 : 30) +
          (hasWriteSmoothing ? 6 : 18) +
          (activeReplicas.length > 0 ? 0 : 12)
  );
  const latencyPct = Math.min(
    100,
    Math.round((simulatedLatencyMs / Math.max(1, scenario.targetMaxLatencyMs)) * 100)
  );

  const simulatedAvailabilityPct = Number(
    (overloadFactor > 1
      ? Math.max(42, 100 - (overloadFactor - 1) * 35)
      : 99.92
    ).toFixed(2)
  );

  const missingRequiredNodes = scenario.requiredActiveNodes
    .filter((id) => !activeNodes[id])
    .map((id) => lab.nodes.find((n) => n.id === id)?.label || id);

  const allRequiredActive = missingRequiredNodes.length === 0;

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
      if (!solvedScenarios[scenario.id]) {
        setFailedRuns((f) => f + 1);
      }
    }
  };

  const allScenariosSolved = lab.scenarios.every(
    (s) => solvedScenarios[s.id] || (s.id === scenario.id && isTargetMet && simulated)
  );

  const roleMeta: Record<string, { col: string; icon: IconName }> = {
    lb: { col: COLORS.accentBlue, icon: 'globe' },
    api: { col: COLORS.accentCyan, icon: 'cpu' },
    cache: { col: COLORS.accentEmerald, icon: 'zap' },
    queue: { col: COLORS.accentAmber, icon: 'layers' },
    worker: { col: COLORS.accentPurple, icon: 'activity' },
    db: { col: COLORS.accentPink, icon: 'database' },
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerBox}>
        <Text style={styles.systemTitle}>{lab.systemName}</Text>
        <Text style={styles.goalText}>{lab.architectureGoal}</Text>

        {lab.scenarios.length > 1 && (
          <View style={styles.scenarioTabs} accessibilityRole="tablist">
            {lab.scenarios.map((s, idx) => {
              const isCurrent = idx === scenarioIdx;
              const isSolved = Boolean(solvedScenarios[s.id]);
              return (
                <Pressable
                  key={s.id}
                  hitSlop={8}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isCurrent }}
                  accessibilityLabel={`Traffic Wave ${idx + 1}${isSolved ? ', solved' : ''}`}
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

      {/* Live Telemetry Bar + Traffic Flow Waterfall */}
      <View style={styles.telemetryContainer}>
        <View style={styles.metricsRow}>
          <View
            style={styles.metricCard}
            accessible
            accessibilityLabel={`Primary database load: ${totalPrimaryLoad} of ${dbCapacity} requests per second`}
          >
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
              {totalPrimaryLoad} / {dbCapacity}
            </Text>
            <View style={styles.gaugeTrack}>
              <View
                style={[
                  styles.gaugeFill,
                  {
                    width: `${dbUtilizationPct}%`,
                    backgroundColor:
                      totalPrimaryLoad <= dbCapacity
                        ? COLORS.accentEmerald
                        : COLORS.accentRose,
                  },
                ]}
              />
            </View>
          </View>
          <View
            style={styles.metricCard}
            accessible
            accessibilityLabel={`Simulated P99 latency: ${simulatedLatencyMs} milliseconds, target maximum ${scenario.targetMaxLatencyMs} milliseconds`}
          >
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
              {simulatedLatencyMs}ms (≤{scenario.targetMaxLatencyMs})
            </Text>
            <View style={styles.gaugeTrack}>
              <View
                style={[
                  styles.gaugeFill,
                  {
                    width: `${latencyPct}%`,
                    backgroundColor:
                      simulatedLatencyMs <= scenario.targetMaxLatencyMs
                        ? COLORS.accentEmerald
                        : COLORS.accentRose,
                  },
                ]}
              />
            </View>
          </View>
          <View
            style={styles.metricCard}
            accessible
            accessibilityLabel={`Simulated availability: ${simulatedAvailabilityPct} percent`}
          >
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
            <View style={styles.gaugeTrack}>
              <View
                style={[
                  styles.gaugeFill,
                  {
                    width: `${Math.round(simulatedAvailabilityPct)}%`,
                    backgroundColor:
                      simulatedAvailabilityPct >= scenario.targetMinAvailabilityPct
                        ? COLORS.accentEmerald
                        : COLORS.accentRose,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Live RPS Flow Waterfall Breakdown */}
        <View style={styles.flowCard}>
          <Text style={styles.flowHeader}>
            LIVE REQUEST ROUTING WATERFALL ({scenario.incomingRps.toLocaleString()} RPS INGRESS)
          </Text>
          <View style={styles.flowRow}>
            <Text style={styles.flowStepLabel}>1. Edge Read Split ({Math.round(scenario.readWriteRatio * 100)}%)</Text>
            <Text style={styles.flowStepVal}>
              {readRps.toLocaleString()} R/s →{' '}
              <Text style={{ color: COLORS.accentCyan }}>
                -{absorbedByCache.toLocaleString()} Cache
              </Text>{' '}
              ·{' '}
              <Text style={{ color: COLORS.accentPurple }}>
                -{offloadedToReplicas.toLocaleString()} Replica
              </Text>
            </Text>
          </View>
          <View style={styles.flowRow}>
            <Text style={styles.flowStepLabel}>2. Write Ingestion ({Math.round((1 - scenario.readWriteRatio) * 100)}%)</Text>
            <Text style={styles.flowStepVal}>
              {writeRps.toLocaleString()} W/s →{' '}
              <Text style={{ color: COLORS.accentAmber }}>
                -{bufferedWrites.toLocaleString()} Queued
              </Text>{' '}
              ({primaryWriteLoad.toLocaleString()} hit DB)
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        TAP OPTIONAL INFRASTRUCTURE NODES TO WIRE TOPOLOGY:
      </Text>

      {lab.nodes.map((node, nIdx) => {
        const isEnabled = Boolean(activeNodes[node.id]);
        const meta = roleMeta[node.role] || { col: COLORS.accentBlue, icon: 'server' };
        return (
          <View key={node.id}>
            {nIdx > 0 && (
              <View style={styles.busConnectorRow}>
                <View
                  style={[
                    styles.busLine,
                    isEnabled && { backgroundColor: meta.col },
                  ]}
                />
                <Text style={styles.busLatencyLabel}>
                  {isEnabled ? `▼ +${node.baseLatencyMs}ms hop` : '┆ bypassed'}
                </Text>
              </View>
            )}
            <Pressable
              disabled={!node.optionalToggle}
              accessibilityRole="switch"
              accessibilityState={{
                checked: isEnabled,
                disabled: !node.optionalToggle,
              }}
              accessibilityLabel={`${node.label}, ${node.optionalToggle ? 'Optional toggle' : 'Core node'}, role ${node.role}, capacity ${node.baseCapacityRps} RPS, status ${isEnabled ? 'Online' : 'Bypassed'}`}
              onPress={() => toggleNode(node.id, node.optionalToggle)}
              android_ripple={androidRipple()}
              style={[
                styles.nodeCard,
                { borderLeftWidth: 3, borderLeftColor: meta.col },
                isEnabled && styles.nodeCardActive,
              ]}
            >
              <View style={[styles.roleIconBox, { backgroundColor: `${meta.col}22` }]}>
                <DynamicIcon name={meta.icon} size={16} color={meta.col} />
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.nodeLabel}>
                  {node.label} {node.optionalToggle ? '' : '· Core'}
                </Text>
                <Text style={styles.nodeSpecs}>
                  {node.role.toUpperCase()} · Cap: {node.baseCapacityRps.toLocaleString()} RPS · +{node.baseLatencyMs}ms
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
          </View>
        );
      })}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Run ${scenario.incomingRps.toLocaleString()} RPS traffic spike simulation`}
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
          accessibilityLiveRegion="polite"
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
          {!isTargetMet && missingRequiredNodes.length > 0 && (
            <View style={styles.missingNodesBox}>
              <Text style={styles.missingNodesLabel}>
                MISSING REQUIRED TOPOLOGY NODES:
              </Text>
              {missingRequiredNodes.map((lbl) => (
                <Text key={lbl} style={styles.missingNodeItem}>
                  • {lbl} (currently BYPASSED)
                </Text>
              ))}
            </View>
          )}
          {isTargetMet && !allScenariosSolved && scenarioIdx < lab.scenarios.length - 1 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Advance to next traffic wave"
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
              accessibilityRole="button"
              accessibilityLabel="Lock in architecture and claim XP"
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
    minHeight: 40,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
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
  telemetryContainer: { marginBottom: 16 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  metricCard: {
    flex: 1,
    minWidth: 92,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricLabel: { color: COLORS.textMuted, fontSize: 9.5, fontWeight: '700', marginBottom: 4 },
  metricValue: { fontSize: 12.5, fontWeight: '700', fontFamily: FONTS.mono },
  gaugeTrack: {
    height: 4,
    backgroundColor: COLORS.codeBg,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 2,
  },
  flowCard: {
    backgroundColor: COLORS.codeBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
  },
  flowHeader: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FONTS.mono,
    marginBottom: 6,
  },
  flowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingVertical: 2,
  },
  flowStepLabel: { color: COLORS.textSecondary, fontSize: 11.5 },
  flowStepVal: { color: COLORS.textPrimary, fontSize: 11, fontFamily: FONTS.mono, fontWeight: '600' },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  busConnectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    height: 18,
    gap: 8,
  },
  busLine: {
    width: 2,
    height: '100%',
    backgroundColor: COLORS.border,
  },
  busLatencyLabel: {
    color: COLORS.textMuted,
    fontSize: 9.5,
    fontFamily: FONTS.mono,
  },
  nodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 56,
  },
  nodeCardActive: {
    borderColor: COLORS.accentBlue,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  roleIconBox: {
    width: 32,
    height: 32,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeLabel: { color: COLORS.textPrimary, fontSize: 13.5, fontWeight: '700', marginBottom: 3 },
  nodeSpecs: { color: COLORS.textMuted, fontSize: 11, fontFamily: FONTS.mono },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  pillActive: { backgroundColor: 'rgba(16, 185, 129, 0.25)' },
  pillInactive: { backgroundColor: 'rgba(148, 163, 184, 0.2)' },
  pillText: { color: COLORS.textPrimary, fontSize: 10.5, fontWeight: '700', fontFamily: FONTS.mono },
  simBtn: {
    backgroundColor: COLORS.accentBlueDark,
    borderRadius: 10,
    minHeight: 48,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
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
  missingNodesBox: {
    marginTop: 10,
    backgroundColor: COLORS.codeBg,
    borderRadius: 6,
    padding: 10,
  },
  missingNodesLabel: {
    color: COLORS.accentAmber,
    fontSize: 10,
    fontFamily: FONTS.mono,
    fontWeight: '700',
    marginBottom: 4,
  },
  missingNodeItem: {
    color: '#FCA5A5',
    fontSize: 12,
    fontFamily: FONTS.mono,
  },
  finishBtn: {
    backgroundColor: COLORS.accentEmeraldDark,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  finishBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
