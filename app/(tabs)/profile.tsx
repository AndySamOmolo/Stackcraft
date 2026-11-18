import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Share,
  TextInput,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  loadLearnerProfile,
  saveLearnerProfile,
  resetLearnerProfile,
  importLearnerProfileJson,
  getLocalDateString,
  LearnerProfile,
} from '../../src/lib/storage';
import { CodeLanguage } from '../../src/data/types';
import { CURRICULUM_MODULES, CURRICULUM_TRACKS } from '../../src/data/curriculum';
import {
  COLORS,
  FONTS,
  ENGINEERING_RANKS,
  androidRipple,
  triggerHaptic,
  getEngineerRank,
} from '../../src/theme';
import { DynamicIcon } from '../../src/components/DynamicIcon';

const LANGUAGES: { id: CodeLanguage; label: string; desc: string }[] = [
  { id: 'typescript', label: 'TypeScript (Node / React Native)', desc: 'Strict static types & async event loops' },
  { id: 'python', label: 'Python 3.12 (AI & Backend)', desc: 'Clean syntax, dict references & nonlocal scopes' },
  { id: 'c', label: 'C / Systems Pointers', desc: 'Explicit pointer dereferencing (*, ->) & structs' },
];

export default function TelemetryProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showImportBox, setShowImportBox] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setConfirmReset(false);
      setBackupStatus(null);
      loadLearnerProfile().then((p) => {
        if (active) setProfile(p);
      });
      return () => {
        active = false;
        setConfirmReset(false);
      };
    }, [])
  );

  useEffect(() => {
    if (!confirmReset) return;
    const timer = setTimeout(() => setConfirmReset(false), 5000);
    return () => clearTimeout(timer);
  }, [confirmReset]);

  const rankInfo = getEngineerRank(profile?.xp ?? 0);

  const last14Days = useMemo(() => {
    const days: { dateStr: string; shortLabel: string; count: number; isToday: boolean }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = getLocalDateString(d);
      const count = profile?.activityLog?.[dateStr] ?? 0;
      const shortLabel = d.toLocaleDateString('en-US', { weekday: 'narrow' });
      days.push({ dateStr, shortLabel, count, isToday: i === 0 });
    }
    return days;
  }, [profile]);

  const total14DayActions = useMemo(
    () => last14Days.reduce((s, d) => s + d.count, 0),
    [last14Days]
  );

  const avgPrecision = useMemo(() => {
    const vals = Object.values(profile?.moduleScores || {});
    if (vals.length === 0) return 100;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [profile]);

  const selectLanguage = async (lang: CodeLanguage) => {
    if (!profile) return;
    triggerHaptic('selection');
    const next = { ...profile, preferredLanguage: lang };
    setProfile(next);
    await saveLearnerProfile(next);
  };

  const handleExportBackup = async () => {
    if (!profile) return;
    triggerHaptic('selection');
    try {
      const payload = JSON.stringify(profile, null, 2);
      await Share.share({
        title: 'StackCraft Telemetry & FSRS Backup',
        message: payload,
      });
      setBackupStatus('Backup JSON opened in native share sheet.');
    } catch {
      setBackupStatus('Could not open share sheet on this device.');
    }
  };

  const handleImportBackup = async () => {
    if (!importJsonText.trim()) return;
    try {
      const restored = await importLearnerProfileJson(importJsonText.trim());
      triggerHaptic('success');
      setProfile(restored);
      setImportJsonText('');
      setShowImportBox(false);
      setBackupStatus('Telemetry & FSRS Vault backup restored successfully.');
    } catch {
      triggerHaptic('error');
      setBackupStatus('Invalid backup JSON format. Check your pasted payload.');
    }
  };

  const handleReset = async () => {
    if (!confirmReset) {
      triggerHaptic('warning');
      setConfirmReset(true);
      return;
    }
    triggerHaptic('success');
    const fresh = await resetLearnerProfile();
    setProfile(fresh);
    setConfirmReset(false);
    setBackupStatus('Local progress and FSRS states reset.');
  };

  const completedIds = profile?.completedModuleIds || [];
  const reviewedCardCount = Object.values(profile?.fsrsStates || {}).filter(
    (s) => s.reps > 0
  ).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading} accessibilityRole="header">
        Engineering Telemetry &amp; Settings
      </Text>

      {/* Rank Card + 6-Tier Clearance Progression Ladder */}
      <View style={styles.rankCard} accessible accessibilityRole="summary">
        <View style={styles.rankHeaderRow}>
          <View>
            <Text style={[styles.rankLevel, { color: rankInfo.current.color }]}>
              CURRENT CLEARANCE · {rankInfo.current.level}
            </Text>
            <Text style={styles.rankTitle}>{rankInfo.current.title}</Text>
          </View>
          <Text style={styles.rankXp}>{profile?.xp ?? 0} XP</Text>
        </View>
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
        <Text style={styles.rankSub}>
          {rankInfo.xpToNext > 0
            ? `${rankInfo.xpToNext} XP until next engineering level promotion`
            : 'Highest engineering clearance unlocked'}
        </Text>

        <View style={styles.ladderRow}>
          {ENGINEERING_RANKS.map((r) => {
            const isUnlocked = (profile?.xp ?? 0) >= r.minXp;
            const isCurrent = rankInfo.current.level === r.level;
            return (
              <View
                key={r.level}
                style={[
                  styles.ladderPill,
                  isUnlocked && { borderColor: r.color },
                  isCurrent && { backgroundColor: `${r.color}28` },
                ]}
              >
                <Text
                  style={[
                    styles.ladderText,
                    isUnlocked && { color: COLORS.textPrimary },
                  ]}
                >
                  {r.level}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Core Telemetry Metrics (4 KPIs) */}
      <View style={styles.statsGrid}>
        <View
          style={styles.statCard}
          accessible
          accessibilityLabel={`Labs solved: ${completedIds.length} of ${CURRICULUM_MODULES.length}`}
        >
          <Text style={styles.statValue}>
            {completedIds.length}/{CURRICULUM_MODULES.length}
          </Text>
          <Text style={styles.statLabel}>LABS</Text>
        </View>
        <View
          style={styles.statCard}
          accessible
          accessibilityLabel={`Average diagnostic precision: ${avgPrecision} percent`}
        >
          <Text style={[styles.statValue, { color: COLORS.accentCyan }]}>
            {avgPrecision}%
          </Text>
          <Text style={styles.statLabel}>PRECISION</Text>
        </View>
        <View
          style={styles.statCard}
          accessible
          accessibilityLabel={`Cards drilled: ${reviewedCardCount} of 48`}
        >
          <Text style={[styles.statValue, { color: COLORS.accentEmerald }]}>
            {reviewedCardCount}/48
          </Text>
          <Text style={styles.statLabel}>VAULT</Text>
        </View>
        <View
          style={styles.statCard}
          accessible
          accessibilityLabel={`Active streak: ${profile?.streakDays ?? 1} days`}
        >
          <Text style={[styles.statValue, { color: COLORS.accentAmber }]}>
            {profile?.streakDays ?? 1}d
          </Text>
          <Text style={styles.statLabel}>STREAK</Text>
        </View>
      </View>

      {/* 14-Day Activity Heatmap */}
      <View style={styles.heatmapHeaderRow}>
        <Text style={styles.sectionHeader} accessibilityRole="header">
          14-DAY ENGINEERING CADENCE
        </Text>
        <Text style={styles.heatmapSummaryText}>
          {total14DayActions} actions (14d)
        </Text>
      </View>
      <View style={styles.heatmapCard}>
        <View style={styles.heatmapRow}>
          {last14Days.map((day) => {
            const intensity =
              day.count === 0
                ? COLORS.surfaceElevated
                : day.count === 1
                ? 'rgba(16, 185, 129, 0.35)'
                : day.count <= 3
                ? 'rgba(16, 185, 129, 0.65)'
                : COLORS.accentEmerald;
            return (
              <View
                key={day.dateStr}
                style={styles.heatmapCol}
                accessible
                accessibilityLabel={`${day.dateStr}: ${day.count} actions`}
              >
                <View
                  style={[
                    styles.heatmapCell,
                    { backgroundColor: intensity },
                    day.isToday && styles.heatmapCellToday,
                  ]}
                />
                <Text
                  style={[
                    styles.heatmapDayLabel,
                    day.isToday && { color: COLORS.accentCyan, fontWeight: '700' },
                  ]}
                >
                  {day.shortLabel}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Per-Track Mastery Matrix (Tappable to jump to next unsolved lab in track) */}
      <Text style={styles.sectionHeader} accessibilityRole="header">
        DOMAIN MASTERY BREAKDOWN (TAP TRACK TO DRILL)
      </Text>
      <View style={styles.masteryCard}>
        {CURRICULUM_TRACKS.map((t) => {
          const mods = CURRICULUM_MODULES
            .filter((m) => m.trackId === t.id)
            .sort((a, b) => a.order - b.order);
          const done = mods.filter((m) => completedIds.includes(m.id)).length;
          const pct = Math.round((done / Math.max(1, mods.length)) * 100);
          const targetMod =
            mods.find((m) => !completedIds.includes(m.id)) ?? mods[0];
          return (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={`Track ${t.number} ${t.title}, ${done} of ${mods.length} labs solved, tap to launch ${targetMod.title}`}
              onPress={() => {
                triggerHaptic('selection');
                router.push(`/lab/${targetMod.id}`);
              }}
              style={styles.masteryRow}
            >
              <View style={styles.masteryLabelRow}>
                <Text style={styles.masteryTrackTitle}>
                  {t.number}. {t.title}
                </Text>
                <Text style={styles.masteryPctText}>
                  {done}/{mods.length} ({pct}%)
                </Text>
              </View>
              <View style={styles.masteryBarTrack}>
                <View
                  style={[
                    styles.masteryBarFill,
                    { width: `${pct}%`, backgroundColor: t.accentColor },
                  ]}
                />
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionHeader} accessibilityRole="header">
        DEFAULT LAB CODE LANGUAGE
      </Text>
      <Text style={styles.sectionSub}>
        Switch languages anytime to compare how the exact same memory model or bug manifests in TypeScript, Python, and C:
      </Text>

      {LANGUAGES.map((l) => {
        const isSelected = (profile?.preferredLanguage ?? 'typescript') === l.id;
        return (
          <Pressable
            key={l.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={`${l.label}: ${l.desc}`}
            onPress={() => selectLanguage(l.id)}
            android_ripple={androidRipple()}
            style={[styles.langCard, isSelected && styles.langCardSelected]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.langTitle}>{l.label}</Text>
              <Text style={styles.langDesc}>{l.desc}</Text>
            </View>
            <DynamicIcon
              name={isSelected ? 'check-circle' : 'code'}
              size={18}
              color={isSelected ? COLORS.accentBlue : COLORS.textMuted}
            />
          </Pressable>
        );
      })}

      <Text style={[styles.sectionHeader, { marginTop: 18 }]} accessibilityRole="header">
        OFFLINE JSON BACKUP &amp; RESTORE
      </Text>
      <View style={styles.backupRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Export telemetry and FSRS vault JSON backup"
          onPress={handleExportBackup}
          android_ripple={androidRipple()}
          style={styles.backupBtn}
        >
          <Text style={styles.backupBtnText}>Export Backup JSON</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showImportBox }}
          accessibilityLabel="Toggle import telemetry JSON form"
          onPress={() => {
            triggerHaptic('selection');
            setShowImportBox((v) => !v);
          }}
          android_ripple={androidRipple()}
          style={styles.backupBtn}
        >
          <Text style={styles.backupBtnText}>
            {showImportBox ? 'Close Import' : 'Import Backup JSON'}
          </Text>
        </Pressable>
      </View>

      {showImportBox && (
        <View style={styles.importBox}>
          <TextInput
            value={importJsonText}
            onChangeText={setImportJsonText}
            placeholder="Paste exported StackCraft JSON backup here..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            accessibilityLabel="Backup JSON input field"
            style={styles.importInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restore pasted JSON backup"
            onPress={handleImportBackup}
            android_ripple={androidRipple()}
            style={styles.restoreConfirmBtn}
          >
            <Text style={styles.restoreConfirmText}>Restore Telemetry Backup</Text>
          </Pressable>
        </View>
      )}

      {backupStatus && (
        <Text style={styles.statusBanner} accessibilityLiveRegion="polite">
          {backupStatus}
        </Text>
      )}

      <Text style={[styles.sectionHeader, { marginTop: 18 }]} accessibilityRole="header">
        DIAGNOSTIC TELEMETRY RESET
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          confirmReset
            ? 'Confirm reset local progress and FSRS vault'
            : 'Reset local progress and FSRS vault'
        }
        onPress={handleReset}
        android_ripple={androidRipple()}
        style={[styles.resetCard, confirmReset && styles.resetCardConfirm]}
      >
        <Text style={styles.resetText}>
          {confirmReset
            ? 'Tap Again Within 5s to Confirm Local Progress & FSRS Reset'
            : 'Reset Local Progress & FSRS Vault'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  heading: { color: COLORS.textPrimary, fontSize: 19, fontWeight: '700', marginBottom: 14 },
  rankCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  rankHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rankLevel: { fontSize: 10.5, fontWeight: '700', fontFamily: FONTS.mono, letterSpacing: 0.7 },
  rankTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 2 },
  rankXp: { color: COLORS.accentBlue, fontSize: 16, fontWeight: '700', fontFamily: FONTS.mono },
  rankBarTrack: {
    height: 6,
    backgroundColor: COLORS.codeBg,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  rankBarFill: { height: '100%', borderRadius: 3 },
  rankSub: { color: COLORS.textMuted, fontSize: 11.5, marginBottom: 10 },
  ladderRow: {
    flexDirection: 'row',
    gap: 6,
  },
  ladderPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    paddingVertical: 4,
    alignItems: 'center',
  },
  ladderText: {
    color: COLORS.textMuted,
    fontSize: 10.5,
    fontFamily: FONTS.mono,
    fontWeight: '700',
  },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statValue: { color: COLORS.accentBlue, fontSize: 16, fontWeight: '700', fontFamily: FONTS.mono },
  statLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '700', marginTop: 4 },
  heatmapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  heatmapSummaryText: {
    color: COLORS.accentEmerald,
    fontSize: 11,
    fontFamily: FONTS.mono,
    fontWeight: '700',
  },
  sectionHeader: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  sectionSub: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  heatmapCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  heatmapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heatmapCol: {
    alignItems: 'center',
    gap: 4,
  },
  heatmapCell: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  heatmapCellToday: {
    borderWidth: 1.5,
    borderColor: COLORS.accentCyan,
  },
  heatmapDayLabel: {
    color: COLORS.textMuted,
    fontSize: 9.5,
    fontFamily: FONTS.mono,
  },
  masteryCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  masteryRow: {
    paddingVertical: 2,
  },
  masteryLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  masteryTrackTitle: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '600' },
  masteryPctText: { color: COLORS.textMuted, fontSize: 11, fontFamily: FONTS.mono },
  masteryBarTrack: {
    height: 5,
    backgroundColor: COLORS.codeBg,
    borderRadius: 3,
    overflow: 'hidden',
  },
  masteryBarFill: { height: '100%', borderRadius: 3 },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    minHeight: 54,
    padding: 14,
    marginBottom: 10,
  },
  langCardSelected: {
    borderColor: COLORS.accentBlue,
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
  },
  langTitle: { color: COLORS.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 3 },
  langDesc: { color: COLORS.textSecondary, fontSize: 12.5 },
  backupRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  backupBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    minHeight: 46,
    justifyContent: 'center',
    paddingVertical: 11,
    alignItems: 'center',
  },
  backupBtnText: { color: COLORS.textPrimary, fontSize: 12.5, fontWeight: '700' },
  importBox: {
    marginTop: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
  },
  importInput: {
    backgroundColor: COLORS.codeBg,
    color: COLORS.textPrimary,
    fontFamily: FONTS.mono,
    fontSize: 12,
    minHeight: 80,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    textAlignVertical: 'top',
  },
  restoreConfirmBtn: {
    backgroundColor: COLORS.accentBlueDark,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  restoreConfirmText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  statusBanner: {
    marginTop: 8,
    color: COLORS.accentEmerald,
    fontSize: 12.5,
    fontWeight: '600',
  },
  resetCard: {
    marginTop: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    padding: 13,
    alignItems: 'center',
  },
  resetCardConfirm: {
    borderColor: COLORS.accentRose,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  resetText: { color: COLORS.accentRose, fontSize: 13, fontWeight: '700' },
});
