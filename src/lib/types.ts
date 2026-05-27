export type CourseLevel = "high_school" | "college" | "ap" | "esl" | "custom";

export type LevelProfile =
  | "high_school_argument"
  | "ap_lit_analysis"
  | "college_fy_comp"
  | "college_humanities_source_based"
  | "ell_intermediate"
  | "custom";

export type AssetType =
  | "rubric"
  | "prompt"
  | "reading"
  | "anchor"
  | "submission";

export type PromptType =
  | "essay"
  | "long_answer"
  | "short_answer"
  | "written_response";

export type RubricScope = "global" | "prompt";

export interface CourseProfile {
  courseName: string;
  level: CourseLevel;
  subject: string;
  teacherPreferences: string;
}

export interface AssignmentPrompt {
  id: string;
  title: string;
  type: PromptType;
  instructions: string;
  citationExpectations?: string | null;
  maxScore?: number | null;
  order: number;
}

export interface AssignmentProfile {
  assignmentType: string;
  citationExpectations: string;
  promptSet: AssignmentPrompt[];
}

export interface RubricBand {
  label: string;
  scoreRange: {
    min: number;
    max: number;
  };
  descriptor: string;
}

export interface RubricDimension {
  name: string;
  weight: number;
  scaleMax: number;
  descriptor?: string | null;
  bands: RubricBand[];
  scope: RubricScope;
  promptIds: string[];
}

export interface NormalizedRubric {
  rubricId: string;
  gradingMode: "analytic" | "holistic";
  totalScaleMax: number;
  dimensions: RubricDimension[];
  hardRequirements: string[];
  notes?: string | null;
}

export interface StoredAsset {
  id: string;
  assetType: AssetType;
  name: string;
  mimeType: string;
  size: number;
  bucket: string;
  storagePath: string;
  openAiFileId?: string;
  createdAt: string;
}

export interface AssignmentRecord {
  schemaVersion: 2;
  id: string;
  assignmentName: string;
  createdAt: string;
  updatedAt: string;
  courseProfile: CourseProfile;
  assignmentProfile: AssignmentProfile;
  levelProfile: LevelProfile;
  rubricText: string;
  normalizedRubric: NormalizedRubric;
  vectorStoreId?: string;
  contextSummary: string;
  assets: StoredAsset[];
}

export interface GradedDimension {
  name: string;
  score: number;
  scaleMax: number;
  rationale: string;
  evidenceSpans: string[];
  confidence: number;
  flags: string[];
}

export interface GradingFeedback {
  teacherSummary: string;
  studentFeedback: string[];
}

export interface ReviewDecision {
  needsHumanReview: boolean;
  reasons: string[];
}

export interface SubmissionSegment {
  promptId: string;
  promptTitle: string;
  promptType: PromptType;
  answerText: string;
  taggedAnswer: string;
  sourceEvidenceSpans: string[];
  sourceEvidenceLookup: Record<string, string>;
  evidenceLookup: Record<string, string>;
  segmentationConfidence: number;
  isMissing: boolean;
  notes: string[];
}

export interface PromptGradingResult {
  promptId: string;
  promptTitle: string;
  promptType: PromptType;
  overallScore: number;
  scaleMax: number;
  confidence: number;
  dimensions: GradedDimension[];
  review: ReviewDecision;
  feedback: GradingFeedback;
  segment: SubmissionSegment;
  retrievalSources: string[];
}

export interface GradingResultRecord {
  schemaVersion: 2;
  submissionId: string;
  submissionName: string;
  createdAt: string;
  overallScore: number;
  scaleMax: number;
  confidence: number;
  promptResults: PromptGradingResult[];
  review: ReviewDecision;
  feedback: GradingFeedback;
  retrievalSources: string[];
  sourceAsset: StoredAsset;
}

export type GradingBatchStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type GradingJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface GradingJobRecord {
  id: string;
  batchId: string;
  assignmentId: string;
  sourceAsset: StoredAsset;
  submissionName: string;
  status: GradingJobStatus;
  progressLabel: string;
  currentStep: number;
  totalSteps: number;
  error: string | null;
  retryCount: number;
  resultId: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface GradingBatchRecord {
  id: string;
  assignmentId: string;
  workflowRunId: string | null;
  status: GradingBatchStatus;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  jobs: GradingJobRecord[];
}

export interface AssignmentBundle {
  assignment: AssignmentRecord;
  results: GradingResultRecord[];
}
