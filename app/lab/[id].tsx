import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CURRICULUM_MODULES } from '../../src/data/curriculum';
import { CodeLanguage } from '../../src/data/types';
import {
  loadLearnerProfile,
  completeModuleAndAwardXp,
} from '../../src/lib/storage';
import { MemoryTracerEngine } from '../../src/engines/MemoryTracerEngine';
import { AiAuditorEngine } from '../../src/engines/AiAuditorEngine';
import { ChaosArchitectEngine } from '../../src/engines/ChaosArchitectEngine';
import { IncidentCommanderEngine } from '../../src/engines/IncidentCommanderEngine';
import { COLORS, androidRipple, triggerHaptic } from '../../src/theme';

export default function LabDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [language, setLanguage] = useState<CodeLanguage>('typescript');
  const [completedBanner, setCompletedBanner] = useState<number | null>(null);
  const [showWhyAi, setShowWhyAi] = useState(false);

  const mod = CURRICULUM_MODULES.find((m) => m.id === id) ?? CURRICULUM_MODULES[0];

  useEffect(() => {
    setCompletedBanner(null);
    loadLearnerProfile().then((p) => setLanguage(p.preferredLanguage));
  }, [id]);

  const handleLabComplete = async (accuracyPct: number) => {
    triggerHaptic('success');
    await completeModuleAndAwardXp(mod.id, mod.xpReward, accuracyPct);
    setCompletedBanner(accuracyPct);
  };

  const showLanguageToggle =
    mod.lab.kind === 'memory-tracer' || mod.lab.kind === 'ai-auditor';

  return (
    <View style={styles.container}>
      {/* Top Mental Model Header & Language Switcher */}
      <View style={styles.topBar}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{mod.title}</Text>
          <Pressable
            onPress={() => {
              triggerHaptic('selection');
              setShowWhyAi((v) => !v);
            }}
            android_ripple={androidRipple()}
            style={styles.whyAiBtn}
          >
            <Text style={styles.whyAiBtnText}>
              {showWhyAi ? 'Hide AI Blindspot' : 'Why AI Fails Here'}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.mentalModel}>{mod.coreMentalModel}</Text>

        {showWhyAi && (
          <View style={styles.whyAiBox}>
            <Text style={styles.whyAiLabel}>WHY LLMS CANNOT REPLACE THIS INTUITION:</Text>
            <Text style={styles.whyAiText}>{mod.whyAiCannotReplaceThis}</Text>
          </View>
        )}

        {showLanguageToggle && (
          <View style={styles.langRow}>
            {(['typescript', 'python', 'c'] as CodeLanguage[]).map((lang) => (
              <Pressable
                key={lang}
                onPress={() => {
                  triggerHaptic('selection');
                  setLanguage(lang);
                }}
                android_ripple={androidRipple()}
                style={[
                  styles.langChip,
                  language === lang && styles.langChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.langChipText,
                    language === lang && styles.langChipTextActive,
                  ]}
                >
                  {lang.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {completedBanner !== null ? (
        <View style={styles.victoryBox}>
          <Text style={styles.victoryTitle}>Lab Completed! +{mod.xpReward} XP</Text>
          <Text style={styles.victorySub}>
            Diagnostic Precision: {completedBanner}% · Flashcards unlocked in your FSRS Vault.
          </Text>
          <Pressable
            onPress={() => router.back()}
            android_ripple={androidRipple()}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>Return to Skill Tree</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {mod.lab.kind === 'memory-tracer' && (
            <MemoryTracerEngine
              key={mod.id}
              lab={mod.lab}
              language={language}
              onComplete={handleLabComplete}
            />
          )}
          {mod.lab.kind === 'ai-auditor' && (
            <AiAuditorEngine
              key={mod.id}
              lab={mod.lab}
              language={language}
              onComplete={handleLabComplete}
            />
          )}
          {mod.lab.kind === 'chaos-architect' && (
            <ChaosArchitectEngine
              key={mod.id}
              lab={mod.lab}
              onComplete={handleLabComplete}
            />
          )}
          {mod.lab.kind === 'incident-commander' && (
            <IncidentCommanderEngine
              key={mod.id}
              lab={mod.lab}
              onComplete={handleLabComplete}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: { color: COLORS.textPrimary, fontSize: 15.5, fontWeight: '700', flex: 1 },
  whyAiBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 1,
    borderColor: COLORS.accentAmber,
  },
  whyAiBtnText: { color: COLORS.accentAmber, fontSize: 10.5, fontWeight: '700' },
  mentalModel: { color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 17 },
  whyAiBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accentAmber,
  },
  whyAiLabel: { color: COLORS.accentAmber, fontSize: 10, fontWeight: '700', marginBottom: 3 },
  whyAiText: { color: COLORS.textPrimary, fontSize: 12, lineHeight: 17 },
  langRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  langChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  langChipActive: {
    borderColor: COLORS.accentBlue,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  langChipText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  langChipTextActive: { color: '#FFFFFF' },
  victoryBox: {
    margin: 20,
    padding: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accentEmerald,
    alignItems: 'center',
  },
  victoryTitle: { color: COLORS.accentEmerald, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  victorySub: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  backBtn: {
    backgroundColor: COLORS.accentBlue,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 8,
  },
  backBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
