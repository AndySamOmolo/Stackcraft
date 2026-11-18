export type CodeLanguage = 'typescript' | 'python' | 'c';

export type EngineType =
  | 'memory-tracer'
  | 'ai-auditor'
  | 'chaos-architect'
  | 'incident-commander';

export interface StackVariable {
  name: string;
  value: string;
  type: 'primitive' | 'reference';
  pointsToHeapId?: string;
  changed?: boolean;
}

export interface StackFrame {
  id: string;
  functionName: string;
  line: number | Record<CodeLanguage, number>;
  variables: StackVariable[];
}

export interface HeapObject {
  id: string;
  address: string;
  label: string;
  fields: { key: string; value: string; changed?: boolean }[];
  refCount: number;
  collected?: boolean;
}

export interface MemoryTraceStep {
  stepIndex: number;
  activeLine: Record<CodeLanguage, number>;
  narration: string;
  stack: StackFrame[];
  heap: HeapObject[];
  question?: {
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export interface MemoryTracerLab {
  kind: 'memory-tracer';
  codeSnippets: Record<CodeLanguage, string[]>;
  steps: MemoryTraceStep[];
}

export interface DiffLine {
  lineNumber: number;
  type: 'context' | 'added' | 'removed';
  content: string;
  isBuggyTarget?: boolean;
}

export interface AiAuditorLab {
  kind: 'ai-auditor';
  prTitle: string;
  aiPromptContext: string;
  codeSnippets: Record<CodeLanguage, DiffLine[]>;
  buggyLineNumber: Record<CodeLanguage, number>;
  flawCategory: string;
  symptomQuestion: string;
  patchOptions: {
    id: string;
    label: string;
    codePatch: string;
    isCorrect: boolean;
    feedback: string;
  }[];
  deepDiveExplanation: string;
}

export interface TopologyNode {
  id: string;
  label: string;
  role: 'client' | 'lb' | 'api' | 'cache' | 'db' | 'queue' | 'worker';
  baseCapacityRps: number;
  baseLatencyMs: number;
  optionalToggle?: boolean;
  enabledByDefault: boolean;
}

export interface ChaosScenario {
  id: string;
  name: string;
  incomingRps: number;
  readWriteRatio: number; // e.g., 0.9 means 90% reads
  description: string;
  targetMaxLatencyMs: number;
  targetMinAvailabilityPct: number;
  requiredActiveNodes: string[];
  failureAnalysis: string;
  successAnalysis: string;
}

export interface ChaosArchitectLab {
  kind: 'chaos-architect';
  systemName: string;
  architectureGoal: string;
  nodes: TopologyNode[];
  scenarios: ChaosScenario[];
}

export interface DiagnosticProbe {
  id: string;
  command: string;
  purpose: string;
  terminalOutput: string;
  revealsClue: string;
}

export interface IncidentCommanderLab {
  kind: 'incident-commander';
  incidentId: string;
  alertHeadline: string;
  symptomMetrics: { label: string; value: string; severity: 'critical' | 'warn' | 'normal' }[];
  probes: DiagnosticProbe[];
  rootCauseHypotheses: {
    id: string;
    statement: string;
    remediationCommand: string;
    isCorrect: boolean;
    explanation: string;
  }[];
}

export type LabPayload =
  | MemoryTracerLab
  | AiAuditorLab
  | ChaosArchitectLab
  | IncidentCommanderLab;

export interface FSRSCardSeed {
  id: string;
  conceptTitle: string;
  question: string;
  answer: string;
  mentalModelTip: string;
}

export interface CurriculumModule {
  id: string;
  trackId: string;
  order: number;
  title: string;
  subtitle: string;
  difficulty: 'Foundational' | 'Intermediate' | 'Staff-Level';
  estimatedMinutes: number;
  xpReward: number;
  engineType: EngineType;
  whyAiCannotReplaceThis: string;
  coreMentalModel: string;
  lab: LabPayload;
  flashcards: FSRSCardSeed[];
}

export interface CurriculumTrack {
  id: string;
  number: string;
  title: string;
  tagline: string;
  accentColor: string;
  prerequisiteTrackIds: string[];
  description: string;
}
