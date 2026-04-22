"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import type { AssignmentBundle, GradingResultRecord } from "@/lib/types";
import { formatDate } from "@/lib/utils";

import { DashboardShell } from "./dashboard-shell";
import {
	downloadResults,
	promptScoreLabel,
	readJson,
	readSessionStorage,
	resolveSelectedAssignmentId,
	scoreLabel,
	selectedAssignmentStorageKey,
	type DiagnosticEvent,
} from "./dashboard-shared";

/* ------------------------------------------------------------------ */
/*  Inline SVG icons                                                    */
/* ------------------------------------------------------------------ */

function IconPlus(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			{...props}
		>
			<path d="M8 3v10M3 8h10" />
		</svg>
	);
}

function IconX(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			{...props}
		>
			<path d="M4 4l8 8M12 4l-8 8" />
		</svg>
	);
}

function IconArrow(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			{...props}
		>
			<path d="M3 8h10M9 4l4 4-4 4" />
		</svg>
	);
}

function IconCheck(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			{...props}
		>
			<path d="M3 8.5l3.5 3.5L13 5" />
		</svg>
	);
}

function IconUpload(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			{...props}
		>
			<path d="M8 11V3M5 6l3-3 3 3M3 11v2h10v-2" />
		</svg>
	);
}

function IconSparkle(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.4"
			strokeLinejoin="round"
			{...props}
		>
			<path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" />
		</svg>
	);
}

function IconChevronRight(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			{...props}
		>
			<path d="M6 3l5 5-5 5" />
		</svg>
	);
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface QueuedFile {
	id: string;
	name: string;
	size: number;
	file: File;
	status: "queued" | "running" | "done" | "error";
}

type GradingMode = "landing" | "workspace";

interface GradingDashboardProps {
	hasOpenAIKey: boolean;
	initialAssignments: AssignmentBundle[];
}

/* ------------------------------------------------------------------ */
/*  Assignment picker dialog (Radix)                                   */
/* ------------------------------------------------------------------ */

function AssignmentPickerDialog({
	open,
	onOpenChange,
	assignments,
	onPick,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	assignments: AssignmentBundle[];
	onPick: (id: string) => void;
}) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="dialog-overlay" />
				<Dialog.Content className="dialog-content">
					<div className="dialog-header">
						<div>
							<div
								className="caps"
								style={{ color: "var(--accent)", marginBottom: 4 }}
							>
								New grading batch
							</div>
							<Dialog.Title
								className="serif"
								style={{ fontSize: 24, letterSpacing: "-0.015em", margin: 0 }}
							>
								Which assignment are you grading?
							</Dialog.Title>
						</div>
						<Dialog.Close asChild>
							<button type="button" className="icon-btn">
								<IconX />
							</button>
						</Dialog.Close>
					</div>
					<div
						style={{
							padding: "14px 20px 20px",
							display: "flex",
							flexDirection: "column",
							gap: 8,
							maxHeight: 440,
							overflowY: "auto",
						}}
					>
						{assignments.length === 0 && (
							<div
								style={{
									textAlign: "center",
									padding: 30,
									color: "var(--ink-3)",
								}}
							>
								<div
									className="serif"
									style={{ fontSize: 20, color: "var(--ink)", marginBottom: 8 }}
								>
									No assignments yet.
								</div>
								<div style={{ fontSize: 13 }}>
									Create one on the{" "}
									<Link
										href="/assignments"
										style={{
											color: "var(--accent)",
											textDecoration: "underline",
										}}
									>
										assignments page
									</Link>{" "}
									first.
								</div>
							</div>
						)}
						{assignments.map((bundle) => (
							<button
								type="button"
								key={bundle.assignment.id}
								className="picker-card"
								onClick={() => onPick(bundle.assignment.id)}
							>
								<div>
									<div className="picker-title">
										{bundle.assignment.assignmentName}
									</div>
									<div className="picker-sub">
										<span>{bundle.assignment.courseProfile.courseName}</span>
										<span className="dot" />
										<span>
											{bundle.assignment.assignmentProfile.promptSet.length}{" "}
											prompts
										</span>
										<span className="dot" />
										<span>{bundle.results.length} graded</span>
									</div>
								</div>
								<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
									<span className="chip">
										{bundle.assignment.normalizedRubric.rubricId}
									</span>
									<IconChevronRight style={{ color: "var(--ink-3)" }} />
								</div>
							</button>
						))}
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function GradingDashboard({
	hasOpenAIKey,
	initialAssignments,
}: GradingDashboardProps) {
	const [assignments, setAssignments] = useState(initialAssignments);
	const [selectedAssignmentId, setSelectedAssignmentId] = useState(() =>
		resolveSelectedAssignmentId(
			[readSessionStorage(selectedAssignmentStorageKey)],
			initialAssignments,
		),
	);
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const [currentTask, setCurrentTask] = useState<string | null>(null);
	const [activity, setActivity] = useState<DiagnosticEvent[]>([]);
	const [isPending, startTransition] = useTransition();
	const [activeTab, setActiveTab] = useState<"grade" | "results">("grade");
	const [selectedResultIndex, setSelectedResultIndex] = useState(0);

	const [mode, setMode] = useState<GradingMode>("landing");
	const [pickerOpen, setPickerOpen] = useState(false);
	const [fileQueue, setFileQueue] = useState<QueuedFile[]>([]);
	const [grading, setGrading] = useState(false);
	const [progress, setProgress] = useState({
		step: 0,
		total: 0,
		label: "",
		subStep: "",
	});
	const fileInputRef = useRef<HTMLInputElement>(null);

	const selectedBundle = assignments.find(
		(bundle) => bundle.assignment.id === selectedAssignmentId,
	);

	useEffect(() => {
		window.sessionStorage.setItem(
			selectedAssignmentStorageKey,
			selectedAssignmentId,
		);
	}, [selectedAssignmentId]);

	async function refreshAssignments(nextSelectedId?: string) {
		const response = await fetch("/api/assignments", { cache: "no-store" });
		const payload = await readJson<{ assignments: AssignmentBundle[] }>(
			response,
		);
		setAssignments(payload.assignments);
		setSelectedAssignmentId(
			resolveSelectedAssignmentId(
				[nextSelectedId, selectedAssignmentId],
				payload.assignments,
			),
		);
	}

	function pushActivity(
		kind: DiagnosticEvent["kind"],
		label: string,
		detail: string,
	) {
		setActivity((cur) =>
			[
				{
					id: `${Date.now()}-${cur.length}`,
					kind,
					label,
					detail,
					at: new Date().toISOString(),
				},
				...cur,
			].slice(0, 8),
		);
	}

	function runTask(label: string, task: () => Promise<void>) {
		setError("");
		setCurrentTask(label);
		setStatus(label);
		pushActivity("info", label, "Started");
		startTransition(async () => {
			try {
				await task();
				pushActivity("success", label, "Completed");
			} catch (taskError) {
				const detail =
					taskError instanceof Error
						? taskError.message
						: "Something went wrong.";
				setError(detail);
				setStatus(`${label} failed.`);
				pushActivity("error", label, detail);
			} finally {
				setCurrentTask(null);
			}
		});
	}

	function handlePickAssignment(id: string) {
		setSelectedAssignmentId(id);
		setPickerOpen(false);
		setMode("workspace");
		setActiveTab("grade");
		setFileQueue([]);
	}

	function handleBackToLanding() {
		setMode("landing");
		setFileQueue([]);
	}

	function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
		const picked = Array.from(e.target.files || []);
		setFileQueue((prev) => [
			...prev,
			...picked.map((f) => ({
				id: `f_${Math.random().toString(36).slice(2, 8)}`,
				name: f.name,
				size: f.size,
				file: f,
				status: "queued" as const,
			})),
		]);
		if (fileInputRef.current) fileInputRef.current.value = "";
	}

	function removeFile(id: string) {
		setFileQueue((prev) => prev.filter((f) => f.id !== id));
	}

	function handleBatchGrade() {
		if (!selectedBundle || fileQueue.length === 0) return;
		runTask("Grading submissions independently...", async () => {
			const formData = new FormData();
			for (const qf of fileQueue) {
				formData.append("submissionFiles", qf.file);
			}
			setGrading(true);
			const total =
				fileQueue.length *
				(selectedBundle.assignment.assignmentProfile.promptSet.length + 2);
			setProgress({ step: 0, total, label: "", subStep: "Starting..." });
			try {
				const response = await fetch(
					`/api/assignments/${selectedBundle.assignment.id}/submissions`,
					{ method: "POST", body: formData },
				);
				await readJson(response);
				await refreshAssignments(selectedBundle.assignment.id);
				setStatus("Batch grading completed.");
				setActiveTab("results");
				setFileQueue([]);
			} finally {
				setGrading(false);
				setProgress({ step: 0, total: 0, label: "", subStep: "" });
			}
		});
	}

	function updateFeedbackDraft(
		submissionId: string,
		updater: (result: GradingResultRecord) => GradingResultRecord,
	) {
		setAssignments((current) =>
			current.map((bundle) => {
				if (bundle.assignment.id !== selectedAssignmentId) return bundle;
				return {
					...bundle,
					results: bundle.results.map((r) =>
						r.submissionId === submissionId ? updater(r) : r,
					),
				};
			}),
		);
	}

	function handleSaveFeedback(result: GradingResultRecord) {
		if (!selectedBundle) return;
		runTask(`Saving feedback for ${result.submissionName}...`, async () => {
			const response = await fetch(
				`/api/assignments/${selectedBundle.assignment.id}/results/${result.submissionId}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						feedback: result.feedback,
						promptFeedback: result.promptResults.map((pr) => ({
							promptId: pr.promptId,
							feedback: pr.feedback,
						})),
					}),
				},
			);
			await readJson(response);
			await refreshAssignments(selectedBundle.assignment.id);
			setStatus("Feedback saved.");
		});
	}

	const recentRuns = assignments.filter((b) => b.results.length > 0);

	/* ---------------------------------------------------------------- */
	/*  Shell props                                                      */
	/* ---------------------------------------------------------------- */

	const breadcrumbs =
		mode === "workspace" && selectedBundle
			? [
					{ label: "Grading", muted: false },
					{ label: selectedBundle.assignment.assignmentName, muted: true },
				]
			: [{ label: "Grading", muted: false }];

	const tabs =
		mode === "workspace"
			? [
					{
						label: "Upload & run",
						active: activeTab === "grade",
						onClick: () => setActiveTab("grade"),
					},
					{
						label: "Results",
						count: selectedBundle?.results.length ?? 0,
						active: activeTab === "results",
						onClick: () => setActiveTab("results"),
					},
				]
			: undefined;

	const topbarActions =
		mode === "workspace" && selectedBundle ? (
			<div style={{ display: "flex", gap: 8 }}>
				<button
					type="button"
					className="btn btn-secondary btn-sm"
					onClick={() => setPickerOpen(true)}
				>
					Switch assignment
				</button>
				<button
					type="button"
					className="btn btn-secondary btn-sm"
					onClick={() => downloadResults(selectedBundle)}
				>
					Export JSON
				</button>
			</div>
		) : undefined;

	/* ---------------------------------------------------------------- */
	/*  Render                                                           */
	/* ---------------------------------------------------------------- */

	return (
		<DashboardShell
			activePage="grading"
			assignments={assignments}
			hasOpenAIKey={hasOpenAIKey}
			title="Grade submissions"
			description="Pick a prepared assignment, upload student work, run isolated grading passes."
			status={status}
			error={error}
			currentTask={currentTask}
			activity={activity}
			selectedAssignmentId={selectedAssignmentId}
			onSelectAssignment={handlePickAssignment}
			breadcrumbs={breadcrumbs}
			tabs={tabs}
			topbarActions={topbarActions}
		>
			{/* Radix Dialog for assignment picker */}
			<AssignmentPickerDialog
				open={pickerOpen}
				onOpenChange={setPickerOpen}
				assignments={assignments}
				onPick={handlePickAssignment}
			/>

			{mode === "landing" ? (
				/* ============================================================ */
				/*  LANDING                                                      */
				/* ============================================================ */
				<div>
					{/* Header row */}
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "flex-end",
							gap: 20,
							flexWrap: "wrap",
							marginBottom: 28,
						}}
					>
						<div>
							<div
								className="caps"
								style={{ color: "var(--accent)", marginBottom: 10 }}
							>
								Grading
							</div>
							<h1 className="view-title" style={{ margin: "0 0 10px" }}>
								Grade a <em>new batch</em>.
							</h1>
							<p
								style={{
									fontSize: 15,
									color: "var(--ink-2)",
									maxWidth: 620,
									lineHeight: 1.55,
								}}
							>
								Pick an assignment, drop in student submissions, and each one
								runs in its own isolated pass against the rubric and prompts you
								already built.
							</p>
						</div>
						<button
							type="button"
							className="btn-primary"
							onClick={() => setPickerOpen(true)}
						>
							<IconPlus /> New grading batch
						</button>
					</div>

					{/* CTA card */}
					<div
						style={{
							background: "var(--ink-panel)",
							borderRadius: "var(--radius-lg)",
							overflow: "hidden",
							marginBottom: 28,
						}}
					>
						<div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr" }}>
							<div style={{ padding: "28px 30px" }}>
								<div
									className="caps"
									style={{ color: "var(--accent)", marginBottom: 10 }}
								>
									Start here
								</div>
								<div
									className="serif"
									style={{
										fontSize: 30,
										lineHeight: 1.1,
										letterSpacing: "-0.015em",
										marginBottom: 10,
										color: "var(--bg)",
									}}
								>
									Pick an assignment, upload submissions,
									<br />
									review results in your voice.
								</div>
								<div
									style={{
										fontSize: 13,
										color: "oklch(0.78 0.02 70)",
										lineHeight: 1.55,
										marginBottom: 18,
										maxWidth: 520,
									}}
								>
									Every submission gets its own grading run. Your rubric and
									prompts are reused; student work never leaks between runs.
								</div>
								<button
									type="button"
									className="btn-accent"
									onClick={() => setPickerOpen(true)}
								>
									<IconSparkle /> Start new batch
								</button>
							</div>
							<div
								style={{
									padding: "28px 30px",
									background: "oklch(0.24 0.02 70)",
									display: "flex",
									flexDirection: "column",
									gap: 10,
									justifyContent: "center",
								}}
							>
								<div className="info-row" style={{ color: "var(--bg)" }}>
									<div className="info-bullet">i.</div>
									<p style={{ color: "oklch(0.85 0.02 70)", fontSize: 12 }}>
										<strong style={{ color: "var(--bg)" }}>
											Pick assignment
										</strong>{" "}
										— which rubric to grade against.
									</p>
								</div>
								<div className="info-row">
									<div className="info-bullet">ii.</div>
									<p style={{ color: "oklch(0.85 0.02 70)", fontSize: 12 }}>
										<strong style={{ color: "var(--bg)" }}>
											Upload submissions
										</strong>{" "}
										— pdf, docx, txt.
									</p>
								</div>
								<div className="info-row">
									<div className="info-bullet">iii.</div>
									<p style={{ color: "oklch(0.85 0.02 70)", fontSize: 12 }}>
										<strong style={{ color: "var(--bg)" }}>
											Run &amp; review
										</strong>{" "}
										— edit every feedback block before send.
									</p>
								</div>
							</div>
						</div>
					</div>

					{/* Recent runs */}
					<div
						style={{
							marginBottom: 14,
							display: "flex",
							justifyContent: "space-between",
							alignItems: "baseline",
						}}
					>
						<h2
							className="serif"
							style={{ fontSize: 26, letterSpacing: "-0.015em", margin: 0 }}
						>
							Recent grading runs
						</h2>
						{recentRuns.length > 0 && (
							<span className="caps" style={{ color: "var(--ink-3)" }}>
								{recentRuns.length} assignment
								{recentRuns.length === 1 ? "" : "s"}
							</span>
						)}
					</div>

					{recentRuns.length === 0 ? (
						<div
							style={{
								padding: "50px 20px",
								background: "var(--bg-sunk)",
								borderRadius: "var(--radius-lg)",
								border: "1px dashed var(--line)",
								textAlign: "center",
							}}
						>
							<div
								className="serif"
								style={{ fontSize: 22, color: "var(--ink)", marginBottom: 8 }}
							>
								No grading runs yet.
							</div>
							<div style={{ fontSize: 13, color: "var(--ink-3)" }}>
								Start a new batch above to see it listed here.
							</div>
						</div>
					) : (
						<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
							{recentRuns.map((bundle) => {
								const results = bundle.results;
								const avg = Math.round(
									(results.reduce(
										(s, r) => s + r.overallScore / r.scaleMax,
										0,
									) /
										results.length) *
										100,
								);
								return (
									<button
										type="button"
										key={bundle.assignment.id}
										className="run-summary"
										onClick={() => handlePickAssignment(bundle.assignment.id)}
									>
										<div>
											<div className="run-summary-title">
												{bundle.assignment.assignmentName}
											</div>
											<div className="run-summary-meta">
												<span>
													{bundle.assignment.courseProfile.courseName
														.split("—")[0]
														.trim()}
												</span>
												<span className="dot" />
												<span>
													{results.length} submission
													{results.length === 1 ? "" : "s"}
												</span>
												<span className="dot" />
												<span>graded {formatDate(results[0].createdAt)}</span>
											</div>
										</div>
										<div className="run-summary-scores">
											<div style={{ display: "flex", gap: 4 }}>
												{results.slice(0, 6).map((r) => (
													<div
														key={r.submissionId}
														className="score-pip mono"
														title={r.submissionName}
													>
														{r.overallScore}
													</div>
												))}
											</div>
											<div style={{ textAlign: "right" }}>
												<div
													className="serif"
													style={{ fontSize: 22, lineHeight: 1 }}
												>
													{avg}%
												</div>
												<div
													className="caps"
													style={{ color: "var(--ink-3)", marginTop: 2 }}
												>
													avg
												</div>
											</div>
											<IconChevronRight style={{ color: "var(--ink-3)" }} />
										</div>
									</button>
								);
							})}
						</div>
					)}
				</div>
			) : activeTab === "grade" ? (
				/* ============================================================ */
				/*  WORKSPACE — Upload & Run                                     */
				/* ============================================================ */
				<div>
					<div style={{ marginBottom: 28 }}>
						<button
							type="button"
							className="btn-ghost btn-sm"
							style={{ marginBottom: 12 }}
							onClick={handleBackToLanding}
						>
							← grading
						</button>
					</div>

					<div
						style={{
							display: "grid",
							gridTemplateColumns: "1.3fr 1fr",
							gap: 20,
							alignItems: "start",
						}}
					>
						{/* Left: submissions queue */}
						<div className="card">
							<div className="metadata-card-title">Submissions queue</div>
							<div className="card-sub">Accepts .pdf, .docx, .txt, .md</div>

							<label className="file-drop" style={{ marginBottom: 14 }}>
								<input
									ref={fileInputRef}
									type="file"
									multiple
									style={{ display: "none" }}
									onChange={handleFilesSelected}
									accept=".pdf,.docx,.txt,.md"
								/>
								<IconUpload style={{ color: "var(--ink-3)" }} />
								<div className="primary">
									Drop student submissions or click to select
								</div>
								<div className="secondary mono">
									multiple files · pdf · docx · txt · md
								</div>
							</label>

							{fileQueue.length > 0 ? (
								<div className="run-list">
									{fileQueue.map((f) => (
										<div key={f.id} className="run-item">
											<div
												className={`run-status ${f.status === "done" ? "done" : ""} ${f.status === "running" ? "active" : ""}`}
											>
												{f.status === "done" && <IconCheck />}
											</div>
											<div>
												<div className="run-text">{f.name}</div>
												<div className="run-sub">
													{f.status === "queued" && "queued"}
													{f.status === "running" && "running…"}
													{f.status === "done" && "graded · ready for review"}
													{f.status === "error" && "error"}
												</div>
											</div>
											<div style={{ display: "flex", gap: 4 }}>
												{f.status !== "running" && (
													<button
														type="button"
														className="icon-btn"
														onClick={() => removeFile(f.id)}
													>
														<IconX />
													</button>
												)}
											</div>
										</div>
									))}
								</div>
							) : (
								<div
									style={{
										textAlign: "center",
										padding: "20px 10px",
										color: "var(--ink-3)",
										fontSize: 13,
									}}
								>
									No submissions queued. Add files above.
								</div>
							)}

							<div
								style={{
									display: "flex",
									justifyContent: "flex-end",
									gap: 10,
									paddingTop: 20,
								}}
							>
								<button
									type="button"
									className="btn-secondary"
									disabled={grading || fileQueue.length === 0}
									onClick={() => setFileQueue([])}
								>
									Clear queue
								</button>
								<button
									type="button"
									className="btn-primary"
									disabled={grading || fileQueue.length === 0 || isPending}
									onClick={handleBatchGrade}
									style={{ minWidth: 180 }}
								>
									{isPending || grading ? (
										"Grading…"
									) : (
										<>
											Run graded batch <IconArrow />
										</>
									)}
								</button>
							</div>

							{grading && progress.total > 0 && (
								<div style={{ marginTop: 14 }}>
									<div className="mini-progress">
										<div
											style={{
												width: `${(progress.step / progress.total) * 100}%`,
											}}
										/>
									</div>
									<div
										style={{
											marginTop: 8,
											fontSize: 12,
											color: "var(--ink-3)",
											fontFamily: "var(--mono)",
										}}
									>
										{progress.label} · {progress.subStep}
									</div>
								</div>
							)}
						</div>

						{/* Right: info panel */}
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								gap: 16,
								position: "sticky",
								top: 80,
							}}
						>
							<div className="card">
								<div className="metadata-card-title" style={{ fontSize: 20 }}>
									What the grader does
								</div>
								<hr className="hr" />
								<div className="info-list">
									<div className="info-row">
										<div className="info-bullet">i.</div>
										<p>
											<strong>Segments</strong> each submission into
											prompt-specific answers using the prompt set you reviewed.
										</p>
									</div>
									<div className="info-row">
										<div className="info-bullet">ii.</div>
										<p>
											<strong>Grades each prompt</strong> independently against
											the dimensions scoped to it.
										</p>
									</div>
									<div className="info-row">
										<div className="info-bullet">iii.</div>
										<p>
											<strong>Aggregates</strong> the overall score per the
											weights you set in the rubric matrix.
										</p>
									</div>
									<div className="info-row">
										<div className="info-bullet">iv.</div>
										<p>
											<strong>Drafts feedback</strong> in your voice — a teacher
											summary and student-facing notes.
										</p>
									</div>
								</div>
							</div>

							{selectedBundle && selectedBundle.results.length > 0 && (
								<div className="card" style={{ background: "var(--bg-sunk)" }}>
									<div
										style={{
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
											marginBottom: 8,
										}}
									>
										<div style={{ fontSize: 13, fontWeight: 500 }}>
											Previously graded
										</div>
										<span className="chip">
											{selectedBundle.results.length}
										</span>
									</div>
									<div
										style={{
											fontSize: 12,
											color: "var(--ink-3)",
											lineHeight: 1.5,
											marginBottom: 10,
										}}
									>
										{selectedBundle.results.length} submission
										{selectedBundle.results.length === 1 ? "" : "s"} already
										graded for this assignment.
									</div>
									<button
										type="button"
										className="btn-secondary btn-sm"
										style={{ width: "100%" }}
										onClick={() => setActiveTab("results")}
									>
										Review results <IconArrow />
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			) : (
				/* ============================================================ */
				/*  WORKSPACE — Results                                          */
				/* ============================================================ */
				<div>
					<div style={{ marginBottom: 16 }}>
						<button
							type="button"
							className="btn-ghost btn-sm"
							onClick={handleBackToLanding}
						>
							← grading
						</button>
					</div>

					{selectedBundle?.results.length ? (
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "260px 1fr",
								gap: 20,
							}}
						>
							{/* Sidebar list */}
							<div
								style={{
									background: "var(--paper)",
									border: "1px solid var(--line)",
									borderRadius: "var(--radius-lg)",
									position: "sticky",
									top: 80,
									height: "fit-content",
									maxHeight: "calc(100vh - 100px)",
									overflowY: "auto",
								}}
							>
								<div
									style={{
										padding: 16,
										borderBottom: "1px solid var(--line-soft)",
									}}
								>
									<div
										className="mono"
										style={{
											fontSize: 10,
											textTransform: "uppercase",
											letterSpacing: "0.08em",
											color: "var(--ink-3)",
										}}
									>
										Submissions
									</div>
									<div
										style={{
											fontSize: 15,
											fontWeight: 600,
											color: "var(--ink)",
											marginTop: 4,
										}}
									>
										{selectedBundle.results.length} graded
									</div>
								</div>
								<div style={{ padding: 8 }}>
									{selectedBundle.results.map((result, index) => (
										<button
											key={result.submissionId}
											type="button"
											onClick={() => setSelectedResultIndex(index)}
											style={{
												width: "100%",
												textAlign: "left",
												background:
													selectedResultIndex === index
														? "var(--accent-soft)"
														: "transparent",
												border: "none",
												borderRadius: "var(--radius)",
												padding: "10px 12px",
												cursor: "pointer",
												marginBottom: 4,
												transition: "background 0.15s",
											}}
										>
											<div
												style={{
													fontSize: 13,
													fontWeight: 500,
													color: "var(--ink)",
													marginBottom: 4,
												}}
											>
												{result.submissionName}
											</div>
											<div style={{ fontSize: 11, color: "var(--ink-3)" }}>
												{scoreLabel(result)}
											</div>
										</button>
									))}
								</div>
							</div>

							{/* Detail pane */}
							{(() => {
								const result = selectedBundle.results[selectedResultIndex];
								if (!result) return null;
								return (
									<div style={{ display: "grid", gap: 24 }}>
										{/* Score header card */}
										<div
											style={{
												background: "var(--paper)",
												border: "1px solid var(--line)",
												borderRadius: "var(--radius-lg)",
												padding: 28,
											}}
										>
											<div
												className="mono"
												style={{
													fontSize: 10,
													textTransform: "uppercase",
													letterSpacing: "0.08em",
													color: "var(--ink-3)",
													marginBottom: 8,
												}}
											>
												{formatDate(result.createdAt)}
											</div>
											<h2
												className="serif"
												style={{
													fontSize: 24,
													color: "var(--ink)",
													marginBottom: 16,
												}}
											>
												{result.submissionName}
											</h2>
											<div style={{ marginBottom: 20 }}>
												<div
													className="serif"
													style={{
														fontSize: 42,
														lineHeight: 1,
														color: "var(--ink)",
													}}
												>
													{result.overallScore}
													<span style={{ fontSize: 22, color: "var(--ink-3)" }}>
														/{result.scaleMax}
													</span>
												</div>
											</div>
											<div
												style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
											>
												<span
													className="chip"
													style={{
														background: "var(--bg-sunk)",
														border: "1px solid var(--line-soft)",
														color: "var(--ink-3)",
														padding: "6px 12px",
														borderRadius: "var(--radius-sm)",
														fontSize: 12,
													}}
												>
													Confidence {Math.round(result.confidence * 100)}%
												</span>
												<span
													className="chip"
													style={{
														background: result.review.needsHumanReview
															? "oklch(0.95 0.05 30)"
															: "oklch(0.95 0.05 150)",
														color: result.review.needsHumanReview
															? "oklch(0.45 0.15 30)"
															: "oklch(0.35 0.15 150)",
														padding: "6px 12px",
														borderRadius: "var(--radius-sm)",
														fontSize: 12,
													}}
												>
													{result.review.needsHumanReview
														? "Needs human review"
														: "Ready to review"}
												</span>
											</div>
											<div
												style={{
													background: "var(--bg-sunk)",
													border: "1px solid var(--line-soft)",
													borderRadius: "var(--radius)",
													padding: 16,
													marginTop: 20,
													fontSize: 13,
													lineHeight: 1.65,
													color: "var(--ink-2)",
												}}
											>
												<div
													style={{
														fontWeight: 600,
														color: "var(--ink)",
														marginBottom: 8,
													}}
												>
													Overall teacher summary
												</div>
												{result.feedback.teacherSummary}
											</div>
										</div>

										{/* Prompt results */}
										{result.promptResults.map((pr) => (
											<div
												key={`${result.submissionId}-${pr.promptId}`}
												style={{
													background: "var(--paper)",
													border: "1px solid var(--line)",
													borderRadius: "var(--radius-lg)",
													padding: 24,
												}}
											>
												<div style={{ marginBottom: 16 }}>
													<h3
														className="serif"
														style={{
															fontSize: 19,
															color: "var(--ink)",
															marginBottom: 8,
														}}
													>
														{pr.promptTitle}
													</h3>
													<div
														style={{
															display: "flex",
															gap: 6,
															flexWrap: "wrap",
														}}
													>
														<span
															className="chip"
															style={{
																background: "var(--accent-soft)",
																color: "var(--accent)",
																padding: "4px 10px",
																borderRadius: "var(--radius-sm)",
																fontSize: 11,
																fontWeight: 500,
															}}
														>
															{pr.promptType}
														</span>
														<span
															className="chip"
															style={{
																background: "var(--bg-sunk)",
																border: "1px solid var(--line-soft)",
																color: "var(--ink-3)",
																padding: "4px 10px",
																borderRadius: "var(--radius-sm)",
																fontSize: 11,
																fontWeight: 500,
															}}
														>
															{promptScoreLabel(pr)}
														</span>
													</div>
												</div>
												<div
													style={{
														display: "grid",
														gridTemplateColumns:
															"repeat(auto-fit, minmax(280px, 1fr))",
														gap: 12,
														marginBottom: 20,
													}}
												>
													{pr.dimensions.map((dim) => (
														<div
															key={`${pr.promptId}-${dim.name}`}
															style={{
																background: "var(--bg-sunk)",
																border: "1px solid var(--line-soft)",
																borderRadius: "var(--radius)",
																padding: 16,
															}}
														>
															<div
																style={{
																	display: "flex",
																	justifyContent: "space-between",
																	alignItems: "center",
																	marginBottom: 12,
																}}
															>
																<div
																	style={{
																		fontSize: 14,
																		fontWeight: 600,
																		color: "var(--ink)",
																	}}
																>
																	{dim.name}
																</div>
																<div
																	style={{
																		background: "var(--paper)",
																		padding: "4px 10px",
																		borderRadius: "var(--radius-sm)",
																		fontSize: 13,
																		fontWeight: 600,
																		color: "var(--ink)",
																	}}
																>
																	{dim.score}/{dim.scaleMax}
																</div>
															</div>
															<p
																style={{
																	fontSize: 13,
																	lineHeight: 1.65,
																	color: "var(--ink-2)",
																	marginBottom: 12,
																}}
															>
																{dim.rationale}
															</p>
															<span
																className="chip"
																style={{
																	background: "var(--paper)",
																	border: "1px solid var(--line-soft)",
																	color: "var(--ink-3)",
																	padding: "4px 8px",
																	borderRadius: "var(--radius-sm)",
																	fontSize: 10,
																}}
															>
																Confidence {Math.round(dim.confidence * 100)}%
															</span>
														</div>
													))}
												</div>
												<div
													style={{
														background: "var(--bg-sunk)",
														border: "1px solid var(--line-soft)",
														borderRadius: "var(--radius)",
														padding: 16,
													}}
												>
													<div
														style={{
															fontSize: 13,
															fontWeight: 600,
															color: "var(--ink)",
															marginBottom: 10,
														}}
													>
														Teacher summary
													</div>
													<div
														style={{
															fontSize: 13,
															lineHeight: 1.65,
															color: "var(--ink-2)",
														}}
													>
														{pr.feedback.teacherSummary}
													</div>
												</div>
											</div>
										))}

										{/* Overall feedback editing */}
										<div
											style={{
												background: "var(--paper)",
												border: "1px solid var(--line)",
												borderRadius: "var(--radius-lg)",
												padding: 24,
											}}
										>
											<div style={{ display: "grid", gap: 12 }}>
												<label style={{ display: "grid", gap: 6 }}>
													<span
														style={{
															fontSize: 12,
															fontWeight: 600,
															color: "var(--ink-2)",
														}}
													>
														Overall teacher-facing summary
													</span>
													<textarea
														rows={4}
														value={result.feedback.teacherSummary}
														onChange={(e) =>
															updateFeedbackDraft(result.submissionId, (c) => ({
																...c,
																feedback: {
																	...c.feedback,
																	teacherSummary: e.target.value,
																},
															}))
														}
														style={{
															background: "var(--bg-sunk)",
															border: "1px solid var(--line-soft)",
															borderRadius: "var(--radius)",
															padding: "10px 12px",
															fontSize: 13,
															lineHeight: 1.5,
															color: "var(--ink)",
															outline: "none",
														}}
													/>
												</label>
												<label style={{ display: "grid", gap: 6 }}>
													<span
														style={{
															fontSize: 12,
															fontWeight: 600,
															color: "var(--ink-2)",
														}}
													>
														Overall student feedback points
													</span>
													<textarea
														rows={5}
														value={result.feedback.studentFeedback.join("\n")}
														onChange={(e) =>
															updateFeedbackDraft(result.submissionId, (c) => ({
																...c,
																feedback: {
																	...c.feedback,
																	studentFeedback: e.target.value
																		.split("\n")
																		.map((l) => l.trim())
																		.filter(Boolean),
																},
															}))
														}
														style={{
															background: "var(--bg-sunk)",
															border: "1px solid var(--line-soft)",
															borderRadius: "var(--radius)",
															padding: "10px 12px",
															fontSize: 13,
															lineHeight: 1.5,
															color: "var(--ink)",
															outline: "none",
														}}
													/>
												</label>
												<button
													type="button"
													onClick={() => handleSaveFeedback(result)}
													disabled={isPending}
													className="btn-secondary"
													style={{ justifySelf: "end" }}
												>
													{isPending ? "Saving…" : "Save feedback edits"}
												</button>
											</div>
										</div>
									</div>
								);
							})()}
						</div>
					) : (
						<div
							style={{
								background: "var(--bg-sunk)",
								border: "2px dashed var(--line-soft)",
								borderRadius: "var(--radius-lg)",
								padding: 64,
								textAlign: "center",
								color: "var(--ink-3)",
								fontSize: 14,
							}}
						>
							No graded submissions yet. Upload files and run a batch to see
							results here.
						</div>
					)}
				</div>
			)}
		</DashboardShell>
	);
}
