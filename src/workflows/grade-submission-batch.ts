import { gradeStoredSubmission } from "@/lib/grading-service";
import {
  downloadStoredAsset,
  listRunnableGradingJobs,
  loadGradingJob,
  markGradingJobCompleted,
  markGradingJobFailed,
  refreshGradingBatchSummary,
  updateGradingJobProgress,
} from "@/lib/storage";
import { createServiceRoleContext } from "@/lib/supabase/server";

interface GradeSubmissionBatchInput {
  assignmentId: string;
  batchId: string;
  userId: string;
}

class JobCancelledError extends Error {
  constructor() {
    super("Job cancelled.");
  }
}

export async function gradeSubmissionBatchWorkflow(
  input: GradeSubmissionBatchInput,
) {
  "use workflow";

  const jobIds = await listQueuedJobsStep(input);
  for (const jobId of jobIds) {
    await gradeJobStep(input, jobId);
  }
  await refreshBatchSummaryStep(input);

  return {
    batchId: input.batchId,
    processedJobs: jobIds.length,
  };
}

async function listQueuedJobsStep(input: GradeSubmissionBatchInput) {
  "use step";

  const context = createServiceRoleContext(input.userId);
  return listRunnableGradingJobs({
    assignmentId: input.assignmentId,
    batchId: input.batchId,
    userId: input.userId,
    context,
  });
}

async function assertJobIsRunnable(input: GradeSubmissionBatchInput, jobId: string) {
  const context = createServiceRoleContext(input.userId);
  const job = await loadGradingJob({
    assignmentId: input.assignmentId,
    batchId: input.batchId,
    jobId,
    userId: input.userId,
    context,
  });

  if (job.status === "cancelled") {
    throw new JobCancelledError();
  }

  return { context, job };
}

async function gradeJobStep(input: GradeSubmissionBatchInput, jobId: string) {
  "use step";

  try {
    const { context, job } = await assertJobIsRunnable(input, jobId);
    await updateGradingJobProgress({
      assignmentId: input.assignmentId,
      batchId: input.batchId,
      jobId,
      userId: input.userId,
      progressLabel: "Starting",
      currentStep: 0,
      context,
    });

    const bytes = await downloadStoredAsset(job.sourceAsset, context);
    await gradeStoredSubmission({
      assignmentId: input.assignmentId,
      submissionId: job.id,
      sourceAsset: job.sourceAsset,
      bytes,
      context,
      onProgress: async ({ label, currentStep }) => {
        const { context: progressContext } = await assertJobIsRunnable(
          input,
          jobId,
        );
        await updateGradingJobProgress({
          assignmentId: input.assignmentId,
          batchId: input.batchId,
          jobId,
          userId: input.userId,
          progressLabel: label,
          currentStep,
          context: progressContext,
        });
      },
    });

    const { context: completionContext } = await assertJobIsRunnable(input, jobId);
    await markGradingJobCompleted({
      assignmentId: input.assignmentId,
      batchId: input.batchId,
      jobId,
      userId: input.userId,
      context: completionContext,
    });
  } catch (error) {
    if (!(error instanceof JobCancelledError)) {
      const context = createServiceRoleContext(input.userId);
      await markGradingJobFailed({
        assignmentId: input.assignmentId,
        batchId: input.batchId,
        jobId,
        userId: input.userId,
        error: error instanceof Error ? error.message : "Failed to grade submission.",
        context,
      });
    }
  } finally {
    const context = createServiceRoleContext(input.userId);
    await refreshGradingBatchSummary({
      assignmentId: input.assignmentId,
      batchId: input.batchId,
      userId: input.userId,
      context,
    });
  }
}

async function refreshBatchSummaryStep(input: GradeSubmissionBatchInput) {
  "use step";

  const context = createServiceRoleContext(input.userId);
  await refreshGradingBatchSummary({
    assignmentId: input.assignmentId,
    batchId: input.batchId,
    userId: input.userId,
    context,
  });
}
