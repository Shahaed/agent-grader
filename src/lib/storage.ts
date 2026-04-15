import os from "node:os";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

import type {
  AssignmentBundle,
  AssignmentRecord,
  CalibrationRecord,
  GradingResultRecord,
} from "@/lib/types";

const LEGACY_DATA_ROOT = path.join(process.cwd(), ".data");
const DEFAULT_DATA_ROOT = path.join(os.homedir(), ".agent-grader-data");
const VERCEL_DATA_ROOT = path.join(os.tmpdir(), "agent-grader-data");
const DATA_ROOT =
  process.env.AGENT_GRADER_DATA_DIR ||
  (process.env.VERCEL ? VERCEL_DATA_ROOT :
  (existsSync(LEGACY_DATA_ROOT) && !existsSync(DEFAULT_DATA_ROOT)
    ? LEGACY_DATA_ROOT
    : DEFAULT_DATA_ROOT));
const ASSIGNMENTS_ROOT = path.join(DATA_ROOT, "assignments");

function assignmentDir(assignmentId: string) {
  return path.join(ASSIGNMENTS_ROOT, assignmentId);
}

function assignmentJsonPath(assignmentId: string) {
  return path.join(assignmentDir(assignmentId), "assignment.json");
}

function resultsDir(assignmentId: string) {
  return path.join(assignmentDir(assignmentId), "results");
}

function calibrationPath(assignmentId: string) {
  return path.join(assignmentDir(assignmentId), "calibration.json");
}

export function assignmentAssetDir(assignmentId: string) {
  return path.join(assignmentDir(assignmentId), "assets");
}

export async function ensureDataRoot() {
  await fs.mkdir(ASSIGNMENTS_ROOT, { recursive: true });
}

export async function writeJson(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function readJson<T>(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function readJsonIfExists<T>(filePath: string) {
  try {
    return await readJson<T>(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

export async function saveAssignment(record: AssignmentRecord) {
  await ensureDataRoot();
  await writeJson(assignmentJsonPath(record.id), record);
}

export async function loadAssignment(assignmentId: string) {
  return readJson<AssignmentRecord>(assignmentJsonPath(assignmentId));
}

export async function saveResult(assignmentId: string, result: GradingResultRecord) {
  await writeJson(path.join(resultsDir(assignmentId), `${result.submissionId}.json`), result);
}

export async function loadResults(assignmentId: string) {
  await fs.mkdir(resultsDir(assignmentId), { recursive: true });
  const fileNames = await fs.readdir(resultsDir(assignmentId));
  const results = await Promise.all(
    fileNames
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) =>
        readJson<GradingResultRecord>(path.join(resultsDir(assignmentId), fileName)),
      ),
  );

  return results.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function saveCalibration(assignmentId: string, calibration: CalibrationRecord) {
  await writeJson(calibrationPath(assignmentId), calibration);
}

export async function loadCalibration(assignmentId: string) {
  return readJsonIfExists<CalibrationRecord>(calibrationPath(assignmentId));
}

export async function loadAssignmentBundle(assignmentId: string): Promise<AssignmentBundle> {
  const [assignment, results, calibration] = await Promise.all([
    loadAssignment(assignmentId),
    loadResults(assignmentId),
    loadCalibration(assignmentId),
  ]);

  return {
    assignment,
    results,
    calibration,
  };
}

export async function listAssignmentBundles() {
  await ensureDataRoot();
  const entryNames = await fs.readdir(ASSIGNMENTS_ROOT);
  const directoryEntries = await Promise.all(
    entryNames.map(async (entryName) => ({
      entryName,
      stat: await fs.stat(path.join(ASSIGNMENTS_ROOT, entryName)),
    })),
  );
  const bundles = (
    await Promise.all(
      directoryEntries
        .filter((entry) => entry.stat.isDirectory())
        .map(async (entry) => {
          const manifestPath = assignmentJsonPath(entry.entryName);
          if (!existsSync(manifestPath)) {
            return null;
          }

          try {
            return await loadAssignmentBundle(entry.entryName);
          } catch (error) {
            console.warn(
              `Skipping unreadable assignment directory "${entry.entryName}":`,
              error,
            );
            return null;
          }
        }),
    )
  ).filter((bundle): bundle is AssignmentBundle => bundle !== null);

  return bundles.sort((left, right) =>
    right.assignment.updatedAt.localeCompare(left.assignment.updatedAt),
  );
}
