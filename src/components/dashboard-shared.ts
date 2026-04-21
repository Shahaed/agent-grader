import type {
  AssignmentBundle,
  AssignmentPrompt,
  GradingResultRecord,
  NormalizedRubric,
  PromptGradingResult,
  PromptType,
} from "@/lib/types";

export type WorkflowPage = "assignments" | "grading";

export interface DiagnosticEvent {
  id: string;
  kind: "info" | "success" | "error";
  label: string;
  detail: string;
  at: string;
}

export interface AssignmentPromptDraft {
  id: string;
  title: string;
  type: PromptType;
  instructions: string;
  citationExpectations: string;
  maxScore: string;
}

export interface AssignmentFormDraft {
  assignmentName: string;
  courseName: string;
  subject: string;
  level: string;
  assignmentType: string;
}

export interface RubricBandDraft {
  label: string;
  min: string;
  max: string;
  descriptor: string;
}

export interface RubricDimensionDraft {
  name: string;
  weight: string;
  scaleMax: string;
  descriptor: string;
  scope: "global" | "prompt";
  promptIds: string[];
  bands: RubricBandDraft[];
}

export interface RubricFormDraft {
  rubricId: string;
  gradingMode: "analytic" | "holistic";
  totalScaleMax: string;
  hardRequirements: string[];
  notes: string;
  dimensions: RubricDimensionDraft[];
}

function createPromptDraftId() {
  return `prompt_${crypto.randomUUID().split("-")[0]}`;
}

export function emptyPromptDraft(): AssignmentPromptDraft {
  return {
    id: createPromptDraftId(),
    title: "",
    type: "essay",
    instructions: "",
    citationExpectations: "",
    maxScore: "",
  };
}

export const emptyAssignmentForm: AssignmentFormDraft = {
  assignmentName: "",
  courseName: "",
  subject: "",
  level: "high_school",
  assignmentType: "Essay",
};

export const assignmentDraftStorageKey = "agent-grader.assignment-form";
export const rubricDraftStorageKey = "agent-grader.rubric-draft";
export const selectedAssignmentStorageKey = "agent-grader.selected-assignment";

export function readSessionStorage(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(key);
}

function assignmentPromptDraftsFromPromptSet(promptSet: AssignmentPrompt[]) {
  return promptSet
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((prompt) => ({
      id: prompt.id,
      title: prompt.title,
      type: prompt.type,
      instructions: prompt.instructions,
      citationExpectations: prompt.citationExpectations ?? "",
      maxScore: prompt.maxScore ? String(prompt.maxScore) : "",
    }));
}

export function parseStoredAssignmentForm(
  storedValue: string | null,
): AssignmentFormDraft {
  if (!storedValue) {
    return emptyAssignmentForm;
  }

  try {
    const parsed = JSON.parse(storedValue) as Partial<AssignmentFormDraft> & {
      prompts?: AssignmentPromptDraft[];
      essayPrompt?: string;
    };

    if (Array.isArray(parsed.prompts) && parsed.prompts.length > 0) {
      return {
        assignmentName: (parsed as { assignmentName?: string }).assignmentName || "",
        courseName: parsed.courseName || "",
        subject: parsed.subject || "",
        level: parsed.level || "high_school",
        assignmentType: parsed.assignmentType || "Essay",
      };
    }

    if (parsed.essayPrompt) {
      return {
        assignmentName: (parsed as { assignmentName?: string }).assignmentName || "",
        courseName: parsed.courseName || "",
        subject: parsed.subject || "",
        level: parsed.level || "high_school",
        assignmentType: parsed.assignmentType || "Essay",
      };
    }
  } catch {
    return emptyAssignmentForm;
  }

  return emptyAssignmentForm;
}

export async function readJson<T>(response: Response) {
  const rawText = await response.text();
  let payload: (T & { error?: string }) | undefined;

  try {
    payload = rawText
      ? (JSON.parse(rawText) as T & { error?: string })
      : undefined;
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const detail =
      payload?.error ||
      rawText ||
      `HTTP ${response.status} ${response.statusText || "Request failed"}`;
    throw new Error(
      `HTTP ${response.status} ${response.statusText}: ${detail}`,
    );
  }

  return (payload || {}) as T;
}

export function scoreLabel(result: GradingResultRecord) {
  return `${result.overallScore}/${result.scaleMax}`;
}

export function promptScoreLabel(result: PromptGradingResult) {
  return `${result.overallScore}/${result.scaleMax}`;
}

export function emptyBandDraft(): RubricBandDraft {
  return {
    label: "",
    min: "0",
    max: "0",
    descriptor: "",
  };
}

export function emptyDimensionDraft(): RubricDimensionDraft {
  return {
    name: "",
    weight: "0",
    scaleMax: "4",
    descriptor: "",
    scope: "global",
    promptIds: [],
    bands: [emptyBandDraft()],
  };
}

function rubricFormFromNormalizedRubric(
  rubric: NormalizedRubric,
): RubricFormDraft {
  return {
    rubricId: rubric.rubricId,
    gradingMode: rubric.gradingMode,
    totalScaleMax: String(rubric.totalScaleMax),
    hardRequirements:
      rubric.hardRequirements.length > 0 ? rubric.hardRequirements : [""],
    notes: rubric.notes ?? "",
    dimensions: rubric.dimensions.map((dimension) => ({
      name: dimension.name,
      weight: String(dimension.weight),
      scaleMax: String(dimension.scaleMax),
      descriptor: dimension.descriptor ?? "",
      scope: dimension.scope,
      promptIds: dimension.promptIds,
      bands: dimension.bands.map((band) => ({
        label: band.label,
        min: String(band.scoreRange.min),
        max: String(band.scoreRange.max),
        descriptor: band.descriptor,
      })),
    })),
  };
}

function parseNumberField(
  value: string,
  label: string,
  {
    min,
    max,
    allowZero = false,
  }: { min?: number; max?: number; allowZero?: boolean } = {},
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }

  if (!allowZero && parsed <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }

  if (allowZero && parsed < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  if (min !== undefined && parsed < min) {
    throw new Error(`${label} must be at least ${min}.`);
  }

  if (max !== undefined && parsed > max) {
    throw new Error(`${label} must be no more than ${max}.`);
  }

  return parsed;
}

export function serializePromptSetDraft(
  drafts: AssignmentPromptDraft[],
) {
  const prompts = drafts.map((prompt, index) => {
    if (!prompt.title.trim()) {
      throw new Error(`Prompt ${index + 1} needs a title.`);
    }

    if (!prompt.instructions.trim()) {
      throw new Error(`Prompt ${index + 1} needs instructions.`);
    }

    return {
      id: prompt.id.trim() || createPromptDraftId(),
      title: prompt.title.trim(),
      type: prompt.type,
      instructions: prompt.instructions.trim(),
      citationExpectations: prompt.citationExpectations.trim() || null,
      maxScore: prompt.maxScore.trim()
        ? parseNumberField(prompt.maxScore, `Max score for ${prompt.title}`, {
            min: 0,
          })
        : null,
      order: index,
    } satisfies AssignmentPrompt;
  });

  return JSON.stringify(prompts);
}

export function normalizedRubricFromFormDraft(
  draft: RubricFormDraft,
  validPromptIds: string[],
): NormalizedRubric {
  const dimensions = draft.dimensions.map((dimension, dimensionIndex) => {
    if (!dimension.name.trim()) {
      throw new Error(`Criterion ${dimensionIndex + 1} needs a name.`);
    }

    if (dimension.bands.length === 0) {
      throw new Error(
        `Criterion ${dimensionIndex + 1} needs at least one performance band.`,
      );
    }

    const promptIds = dimension.promptIds.filter((promptId) =>
      validPromptIds.includes(promptId),
    );

    if (dimension.scope === "prompt" && promptIds.length === 0) {
      throw new Error(
        `Prompt-scoped criterion "${dimension.name}" must target at least one prompt.`,
      );
    }

    return {
      name: dimension.name.trim(),
      weight: parseNumberField(
        dimension.weight,
        `Weight for ${dimension.name || `criterion ${dimensionIndex + 1}`}`,
        {
          min: 0,
          max: 1,
          allowZero: true,
        },
      ),
      scaleMax: parseNumberField(
        dimension.scaleMax,
        `Maximum score for ${dimension.name || `criterion ${dimensionIndex + 1}`}`,
      ),
      descriptor: dimension.descriptor.trim() || null,
      scope: dimension.scope,
      promptIds: dimension.scope === "prompt" ? promptIds : [],
      bands: dimension.bands.map((band, bandIndex) => {
        if (!band.label.trim()) {
          throw new Error(
            `Band ${bandIndex + 1} in ${dimension.name || `criterion ${dimensionIndex + 1}`} needs a label.`,
          );
        }

        if (!band.descriptor.trim()) {
          throw new Error(
            `Band ${band.label || bandIndex + 1} in ${dimension.name || `criterion ${dimensionIndex + 1}`} needs a description.`,
          );
        }

        const rangeStart = parseNumberField(
          band.min,
          `Range start for ${band.label || `band ${bandIndex + 1}`}`,
          {
            min: 0,
            allowZero: true,
          },
        );
        const rangeEnd = parseNumberField(
          band.max,
          `Range end for ${band.label || `band ${bandIndex + 1}`}`,
          {
            min: 0,
            allowZero: true,
          },
        );

        if (rangeEnd < rangeStart) {
          throw new Error(
            `Score range for ${band.label || `band ${bandIndex + 1}`} cannot end before it starts.`,
          );
        }

        return {
          label: band.label.trim(),
          scoreRange: {
            min: rangeStart,
            max: rangeEnd,
          },
          descriptor: band.descriptor.trim(),
        };
      }),
    };
  });

  if (!draft.rubricId.trim()) {
    throw new Error("Rubric ID is required.");
  }

  return {
    rubricId: draft.rubricId.trim(),
    gradingMode: draft.gradingMode,
    totalScaleMax: parseNumberField(draft.totalScaleMax, "Total rubric scale"),
    dimensions,
    hardRequirements: draft.hardRequirements
      .map((requirement) => requirement.trim())
      .filter(Boolean),
    notes: draft.notes.trim() || null,
  };
}

export function rubricFormFor(
  assignmentId: string,
  bundles: AssignmentBundle[],
): RubricFormDraft {
  const bundle = bundles.find((entry) => entry.assignment.id === assignmentId);
  return bundle
    ? rubricFormFromNormalizedRubric(bundle.assignment.normalizedRubric)
    : {
        rubricId: "",
        gradingMode: "analytic",
        totalScaleMax: "",
        hardRequirements: [""],
        notes: "",
        dimensions: [emptyDimensionDraft()],
      };
}

export function promptSetDraftFor(
  assignmentId: string,
  bundles: AssignmentBundle[],
) {
  const bundle = bundles.find((entry) => entry.assignment.id === assignmentId);
  return bundle
    ? assignmentPromptDraftsFromPromptSet(bundle.assignment.assignmentProfile.promptSet)
    : [emptyPromptDraft()];
}

export function parseStoredRubricDraft(
  storedValue: string | null,
  fallback: RubricFormDraft,
) {
  if (!storedValue) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(storedValue) as unknown;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "dimensions" in parsed &&
      Array.isArray(parsed.dimensions) &&
      "totalScaleMax" in parsed &&
      typeof (parsed as { totalScaleMax?: unknown }).totalScaleMax === "number"
    ) {
      return rubricFormFromNormalizedRubric({
        ...(parsed as NormalizedRubric),
        dimensions: (parsed as NormalizedRubric).dimensions.map((dimension) => ({
          ...dimension,
          scope: dimension.scope || "global",
          promptIds: dimension.promptIds || [],
        })),
      });
    }

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "dimensions" in parsed &&
      Array.isArray(parsed.dimensions)
    ) {
      const draft = parsed as RubricFormDraft;
      return {
        ...draft,
        dimensions: draft.dimensions.map((dimension) => ({
          ...dimension,
          scope: dimension.scope || "global",
          promptIds: dimension.promptIds || [],
        })),
      };
    }
  } catch {
    // Fall back to the current assignment copy if session storage is stale.
  }

  return fallback;
}

export function resolveSelectedAssignmentId(
  preferredIds: Array<string | null | undefined>,
  bundles: AssignmentBundle[],
) {
  for (const preferredId of preferredIds) {
    if (
      preferredId &&
      bundles.some((bundle) => bundle.assignment.id === preferredId)
    ) {
      return preferredId;
    }
  }

  return bundles[0]?.assignment.id ?? "";
}

export function downloadResults(bundle: AssignmentBundle) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const safeName = (bundle.assignment.assignmentName || bundle.assignment.id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  anchor.download = `${safeName || bundle.assignment.id}-results.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
