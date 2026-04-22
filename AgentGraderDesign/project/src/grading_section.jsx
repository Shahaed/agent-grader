// Grading section — landing shows "start new batch" + recent runs.
// Selecting an assignment opens the run workspace (upload → run → results).
const { useState: useStateGradingSec } = React;

function GradingSection({ assignments, currentId, onPick, onUpdateAssignment }) {
  const assignment = assignments.find(a => a.id === currentId);

  if (!assignment) {
    return <GradingLanding assignments={assignments} onPick={onPick} />;
  }
  return (
    <GradingWorkspace
      assignment={assignment}
      assignments={assignments}
      onPick={onPick}
      onUpdate={onUpdateAssignment}
      onBackToLanding={() => onPick(null)}
    />
  );
}

function GradingLanding({ assignments, onPick }) {
  const [pickerOpen, setPickerOpen] = useStateGradingSec(false);
  const recentRuns = assignments.filter(a => (a.submissions?.length ?? 0) > 0);

  return (
    <div className="view">
      <div className="view-header" style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", gap: 20, flexWrap:"wrap"}}>
        <div>
          <div className="caps view-eyebrow">Grading</div>
          <h1 className="view-title">Grade a <em>new batch</em>.</h1>
          <p className="view-sub">
            Pick an assignment, drop in student submissions, and each one runs in its own isolated pass against
            the rubric and prompts you already built.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setPickerOpen(true)}>
          <Icon.Plus /> New grading batch
        </button>
      </div>

      {pickerOpen && (
        <AssignmentPickerModal
          assignments={assignments}
          onCancel={() => setPickerOpen(false)}
          onPick={(id) => { setPickerOpen(false); onPick(id); }}
        />
      )}

      {/* Start-batch CTA card */}
      <div className="card" style={{background:"var(--ink-panel)", color: "var(--bg)", border: "none", padding: 0, overflow:"hidden", marginBottom: 28}}>
        <div style={{display:"grid", gridTemplateColumns:"1.3fr 1fr"}}>
          <div style={{padding: "28px 30px"}}>
            <div className="caps" style={{color:"var(--accent)", marginBottom: 10}}>Start here</div>
            <div className="serif" style={{fontSize: 30, lineHeight: 1.1, letterSpacing:"-0.015em", marginBottom: 10, color: "var(--bg)"}}>
              Pick an assignment, upload submissions,<br/>review results in your voice.
            </div>
            <div style={{fontSize: 13, color: "oklch(0.78 0.02 70)", lineHeight: 1.55, marginBottom: 18, maxWidth: 520}}>
              Every submission gets its own grading run. Your rubric and prompts are reused; student work never
              leaks between runs.
            </div>
            <button className="btn btn-accent" onClick={() => setPickerOpen(true)}>
              <Icon.Sparkle /> Start new batch
            </button>
          </div>
          <div style={{padding: "28px 30px", background: "oklch(0.24 0.02 70)", display:"flex", flexDirection:"column", gap: 10, justifyContent:"center"}}>
            <div className="info-row" style={{color: "var(--bg)"}}>
              <div className="info-bullet">i.</div>
              <p style={{color: "oklch(0.85 0.02 70)", fontSize: 12}}><strong style={{color: "var(--bg)"}}>Pick assignment</strong> — which rubric to grade against.</p>
            </div>
            <div className="info-row">
              <div className="info-bullet">ii.</div>
              <p style={{color: "oklch(0.85 0.02 70)", fontSize: 12}}><strong style={{color: "var(--bg)"}}>Upload submissions</strong> — pdf, docx, txt.</p>
            </div>
            <div className="info-row">
              <div className="info-bullet">iii.</div>
              <p style={{color: "oklch(0.85 0.02 70)", fontSize: 12}}><strong style={{color: "var(--bg)"}}>Run & review</strong> — edit every feedback block before send.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent runs */}
      <div style={{marginBottom: 14, display:"flex", justifyContent:"space-between", alignItems:"baseline"}}>
        <h2 className="serif" style={{fontSize: 26, letterSpacing:"-0.015em", margin: 0}}>Recent grading runs</h2>
        {recentRuns.length > 0 && <span className="caps" style={{color:"var(--ink-3)"}}>{recentRuns.length} assignment{recentRuns.length===1?"":"s"}</span>}
      </div>

      {recentRuns.length === 0 && (
        <div className="empty" style={{padding:"50px 20px", background:"var(--bg-sunk)", borderRadius: "var(--radius-lg)", border: "1px dashed var(--line)"}}>
          <div className="big" style={{fontSize: 22}}>No grading runs yet.</div>
          <div className="small">Start a new batch above to see it listed here.</div>
        </div>
      )}

      {recentRuns.length > 0 && (
        <div style={{display:"flex", flexDirection:"column", gap: 10}}>
          {recentRuns.map(a => {
            const subs = a.submissions;
            const avg = Math.round(subs.reduce((s, x) => s + x.overallScore / x.totalMax, 0) / subs.length * 100);
            return (
              <button key={a.id} className="run-summary" onClick={() => onPick(a.id)}>
                <div>
                  <div className="run-summary-title">{a.assignmentName}</div>
                  <div className="run-summary-meta">
                    <span>{a.courseName.split("—")[0].trim()}</span>
                    <span className="dot" />
                    <span>{subs.length} submission{subs.length===1?"":"s"}</span>
                    <span className="dot" />
                    <span>graded {subs[0].submittedAt}</span>
                  </div>
                </div>
                <div className="run-summary-scores">
                  <div style={{display:"flex", gap: 4}}>
                    {subs.slice(0, 6).map(s => (
                      <div key={s.id} className="score-pip mono" title={s.studentName}>
                        {s.overallScore}
                      </div>
                    ))}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div className="serif" style={{fontSize: 22, lineHeight: 1}}>{avg}%</div>
                    <div className="caps" style={{color:"var(--ink-3)", marginTop: 2}}>avg</div>
                  </div>
                  <Icon.ChevronRight style={{color:"var(--ink-3)"}} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssignmentPickerModal({ assignments, onPick, onCancel }) {
  return (
    <div className="modal-scrim" onClick={onCancel}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="caps view-eyebrow" style={{marginBottom: 4}}>New grading batch</div>
            <div className="serif" style={{fontSize: 24, letterSpacing: "-0.015em"}}>Which assignment are you grading?</div>
          </div>
          <button className="icon-btn" onClick={onCancel}><Icon.X /></button>
        </div>
        <div style={{padding: "14px 20px 20px", display:"flex", flexDirection:"column", gap: 8, maxHeight: 440, overflowY:"auto"}}>
          {assignments.length === 0 && (
            <div className="empty" style={{padding: 30}}>
              <div className="big" style={{fontSize: 20}}>No assignments yet.</div>
              <div className="small">Create one in the Assignments section first.</div>
            </div>
          )}
          {assignments.map(a => (
            <div key={a.id} className="picker-card" onClick={() => onPick(a.id)}>
              <div>
                <div className="picker-title">{a.assignmentName}</div>
                <div className="picker-sub">
                  <span>{a.courseName}</span>
                  <span className="dot" />
                  <span>{a.promptSet?.length || 0} prompts</span>
                  <span className="dot" />
                  <span>{(a.submissions?.length ?? 0)} graded</span>
                </div>
              </div>
              <div style={{display:"flex", gap: 8, alignItems:"center"}}>
                <span className="chip">rubric {a.normalizedRubric?.rubricId || "—"}</span>
                <Icon.ChevronRight style={{color:"var(--ink-3)"}} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GradingWorkspace({ assignment, assignments, onPick, onUpdate, onBackToLanding }) {
  const hasSubs = (assignment.submissions?.length ?? 0) > 0;
  const [mode, setMode] = useStateGradingSec(hasSubs ? "results" : "run");
  const [pickerOpen, setPickerOpen] = useStateGradingSec(false);

  return (
    <div className="view wide">
      <div className="view-header">
        <div className="caps view-eyebrow" style={{display:"flex", gap: 8, alignItems:"center"}}>
          <button className="btn btn-ghost btn-sm" style={{padding:"2px 6px", fontSize:10, letterSpacing: "0.14em"}} onClick={onBackToLanding}>
            ← grading
          </button>
          <span>·</span>
          <span>Batch workspace</span>
        </div>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap: 20, flexWrap:"wrap", marginTop: 8}}>
          <div>
            <h1 className="view-title" style={{marginBottom: 4}}>{assignment.assignmentName}</h1>
            <p className="view-sub">{assignment.courseName}</p>
          </div>
          <div style={{display:"flex", gap: 8}}>
            <button className="btn btn-secondary btn-sm" onClick={() => setPickerOpen(true)}>
              Switch assignment
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setMode("run")}>
              <Icon.Plus /> New batch
            </button>
          </div>
        </div>
      </div>

      <div style={{display:"flex", gap: 10, marginBottom: 18, alignItems:"center"}}>
        <div className="tabs" style={{background:"var(--paper)"}}>
          <button className={"tab " + (mode === "run" ? "active" : "")} onClick={() => setMode("run")}>
            <span className="tab-num">A</span>Upload & run
          </button>
          <button
            className={"tab " + (mode === "results" ? "active" : "")}
            disabled={!hasSubs}
            onClick={() => setMode("results")}
          >
            <span className="tab-num">B</span>Results · {assignment.submissions?.length || 0}
          </button>
        </div>
      </div>

      {pickerOpen && (
        <AssignmentPickerModal
          assignments={assignments}
          onCancel={() => setPickerOpen(false)}
          onPick={(id) => { setPickerOpen(false); onPick(id); }}
        />
      )}

      {mode === "run" && (
        <GradeView
          assignment={assignment}
          onComplete={() => setMode("results")}
          onBackToResults={() => setMode("results")}
          hideHeader
        />
      )}
      {mode === "results" && hasSubs && (
        <ResultsView assignment={assignment} onUpdate={onUpdate} hideHeader />
      )}
    </div>
  );
}

window.GradingSection = GradingSection;
