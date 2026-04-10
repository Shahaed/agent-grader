import type { CourseLevel, LevelProfile, NormalizedRubric } from "@/lib/types";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().split("-")[0]}`;
}

export function isoNow() {
  return new Date().toISOString();
}

export function inferLevelProfile(
  level: CourseLevel,
  assignmentType: string,
  rubricText: string,
) {
  const text = `${assignmentType} ${rubricText}`.toLowerCase();

  if (level === "ap") {
    return "ap_lit_analysis" satisfies LevelProfile;
  }

  if (level === "college") {
    if (text.includes("source") || text.includes("reading") || text.includes("citation")) {
      return "college_humanities_source_based" satisfies LevelProfile;
    }

    return "college_fy_comp" satisfies LevelProfile;
  }

  if (level === "esl") {
    return "ell_intermediate" satisfies LevelProfile;
  }

  if (level === "custom") {
    return "custom" satisfies LevelProfile;
  }

  return "high_school_argument" satisfies LevelProfile;
}

export function sumRubricScale(rubric: NormalizedRubric) {
  return rubric.dimensions.reduce((total, dimension) => total + dimension.scaleMax, 0);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function cleanText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

export function splitIntoEvidenceSpans(text: string) {
  const paragraphs = cleanText(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const spanLookup: Record<string, string> = {};
  const taggedParagraphs = paragraphs.map((paragraph, paragraphIndex) => {
    const sentences = paragraph
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    if (sentences.length === 0) {
      const id = `p${paragraphIndex + 1}s1`;
      spanLookup[id] = paragraph;
      return `[${id}] ${paragraph}`;
    }

    return sentences
      .map((sentence, sentenceIndex) => {
        const id = `p${paragraphIndex + 1}s${sentenceIndex + 1}`;
        spanLookup[id] = sentence;
        return `[${id}] ${sentence}`;
      })
      .join("\n");
  });

  return {
    spanLookup,
    taggedEssay: taggedParagraphs.join("\n\n"),
  };
}

