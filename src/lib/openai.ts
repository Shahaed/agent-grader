import OpenAI from "openai";

let client: OpenAI | undefined;

export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return client;
}

export const models = {
  rubric: process.env.OPENAI_RUBRIC_MODEL ?? "gpt-5.4-mini",
  segmentation: process.env.OPENAI_SEGMENTATION_MODEL ?? "gpt-5.4-mini",
  grading: process.env.OPENAI_GRADING_MODEL ?? "gpt-5.4",
  feedback: process.env.OPENAI_FEEDBACK_MODEL ?? "gpt-5.4-mini",
} as const;
