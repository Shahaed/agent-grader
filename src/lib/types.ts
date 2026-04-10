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
  | "essay";

export interface CourseProfile {
  courseName: string;
  level: CourseLevel;
  subject: string;
  teacherPreferences: string;
}

export interface AssignmentProfile {
  essayPrompt: string;
  assignmentType: string;
  citationExpectations: string;
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
  localPath: string;
  openAiFileId?: string;
  createdAt: string;
}

export interface AssignmentRecord {
  id: string;
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

export interface GradingResultRecord {
  submissionId: string;
  submissionName: string;
  createdAt: string;
  overallScore: number;
  scaleMax: number;
  confidence: number;
  dimensions: GradedDimension[];
  review: ReviewDecision;
  feedback: GradingFeedback;
  evidenceLookup: Record<string, string>;
  retrievalSources: string[];
  sourceAsset: StoredAsset;
}

export interface CalibrationFlag {
  submissionId: string;
  submissionName: string;
  reasons: string[];
  recommendation: string;
}

export interface CalibrationRecord {
  createdAt: string;
  batchSummary: string;
  patterns: string[];
  flaggedSubmissions: CalibrationFlag[];
}

export interface AssignmentBundle {
  assignment: AssignmentRecord;
  results: GradingResultRecord[];
  calibration?: CalibrationRecord;
}
