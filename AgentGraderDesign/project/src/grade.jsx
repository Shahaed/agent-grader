// Grade / upload + run view
const { useState: useStateGrade, useEffect: useEffectGrade } = React;

function GradeView({ assignment, onComplete, onBackToResults, hideHeader }) {
  const [files, setFiles] = useStateGrade([]);
  const [running, setRunning] = useStateGrade(false);
  const [progress, setProgress] = useStateGrade({ step: 0, stepLabel: "", subStep: "" });

  const handleFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    setFiles(f => [...f, ...picked.map(x => ({
      id: "f_" + Math.random().toString(36).slice(2, 8),
      name: x.name,
      size: x.size,
      status: "queued",
    }))]);
  };

  const removeFile = (id) => setFiles(f => f.filter(x => x.id !== id));

  const startGrading = async () => {
    if (files.length === 0) return;
    setRunning(true);

    const prompts = assignment.promptSet;
    const total = files.length * (prompts.length + 2); // segment + per-prompt + aggregate
    let done = 0;

    for (let fi = 0; fi < files.length; fi++) {
      const f = files[fi];
      setFiles(list => list.map(x => x.id === f.id ? { ...x, status: "running" } : x));

      setProgress({ step: ++done, stepLabel: f.name, subStep: "Segmenting submission into prompt answers…" });
      await sleep(700);

      for (let pi = 0; pi < prompts.length; pi++) {
        setProgress({ step: ++done, stepLabel: f.name, subStep: `Grading prompt ${pi+1}: ${prompts[pi].title}` });
        await sleep(650);
      }

      setProgress({ step: ++done, stepLabel: f.name, subStep: "Aggregating overall score…" });
      await sleep(500);

      setFiles(list => list.map(x => x.id === f.id ? { ...x, status: "done" } : x));
    }

    setRunning(false);
    setProgress({ step: 0, stepLabel: "", subStep: "Complete" });
    onComplete(files.length);
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  return (
    <div className={hideHeader ? "" : "view"}>
      {!hideHeader && (
      <div className="view-header">
        <div className="caps view-eyebrow">Grading · new run</div>
        <h1 className="view-title">Upload submissions.<br/>Each runs in its <em>own isolated pass</em>.</h1>
        <p className="view-sub">
          Every submission gets its own grading run. The shared rubric, prompt set, and readings are reused;
          student work from one run is never reused as context in another.
        </p>
      </div>
      )}

      <div style={{display:"grid", gridTemplateColumns:"1.3fr 1fr", gap: 20, alignItems:"start"}}>
        <div className="card">
          <div className="metadata-card-title">Submissions queue</div>
          <div className="card-sub">Accepts .pdf, .docx, .txt, .md</div>

          <label className="file-drop" style={{marginBottom: 14}}>
            <input type="file" multiple style={{display:"none"}} onChange={handleFiles} accept=".pdf,.docx,.txt,.md" />
            <Icon.Upload style={{color:"var(--ink-3)"}} />
            <div className="primary">Drop student submissions or click to select</div>
            <div className="secondary mono">multiple files · pdf · docx · txt · md</div>
          </label>

          {files.length > 0 && (
            <div className="run-list">
              {files.map((f, i) => (
                <div key={f.id} className="run-item">
                  <div className={"run-status " + (f.status === "done" ? "done" : f.status === "running" ? "active" : "")}>
                    {f.status === "done" && <Icon.Check />}
                  </div>
                  <div>
                    <div className="run-text">{f.name}</div>
                    <div className="run-sub">
                      {f.status === "queued" && "queued"}
                      {f.status === "running" && (progress.subStep || "running…")}
                      {f.status === "done" && "graded · ready for review"}
                    </div>
                  </div>
                  <div style={{display:"flex", gap: 4}}>
                    {f.status !== "running" && (
                      <button className="icon-btn" onClick={() => removeFile(f.id)}><Icon.X /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {files.length === 0 && (
            <div style={{textAlign:"center", padding: "20px 10px", color:"var(--ink-3)", fontSize: 13}}>
              No submissions queued. Add files above.
            </div>
          )}

          <div className="sticky-footer" style={{padding: "20px 0 0"}}>
            <button className="btn btn-secondary" disabled={running || files.length===0}
              onClick={() => setFiles([])}>Clear queue</button>
            <button
              className="btn btn-primary"
              disabled={running || files.length===0}
              onClick={startGrading}
              style={{minWidth: 180}}
            >
              {running ? <>Grading… <span className="mono" style={{opacity:0.7, fontSize:11, marginLeft:4}}>{progress.step}/{files.length * (assignment.promptSet.length + 2)}</span></>
                : <>Run graded batch <Icon.Arrow /></>}
            </button>
          </div>

          {running && (
            <div style={{marginTop: 14}}>
              <div className="mini-progress">
                <div style={{ width: `${(progress.step / (files.length * (assignment.promptSet.length + 2))) * 100}%` }} />
              </div>
              <div style={{marginTop: 8, fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--mono)"}}>
                {progress.stepLabel} · {progress.subStep}
              </div>
            </div>
          )}
        </div>

        <div style={{display:"flex", flexDirection:"column", gap: 16, position:"sticky", top: 80}}>
          <div className="card">
            <div className="metadata-card-title" style={{fontSize: 20}}>What the grader does</div>
            <hr className="hr" />
            <div className="info-list">
              <div className="info-row">
                <div className="info-bullet">i.</div>
                <p><strong>Segments</strong> each submission into prompt-specific answers using the prompt set you reviewed.</p>
              </div>
              <div className="info-row">
                <div className="info-bullet">ii.</div>
                <p><strong>Grades each prompt</strong> independently against the dimensions scoped to it.</p>
              </div>
              <div className="info-row">
                <div className="info-bullet">iii.</div>
                <p><strong>Aggregates</strong> the overall score per the weights you set in the rubric matrix.</p>
              </div>
              <div className="info-row">
                <div className="info-bullet">iv.</div>
                <p><strong>Drafts feedback</strong> in your voice — a teacher summary and student-facing notes.</p>
              </div>
            </div>
          </div>

          {assignment.submissions && assignment.submissions.length > 0 && (
            <div className="card" style={{background:"var(--bg-sunk)"}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 8}}>
                <div style={{fontSize: 13, fontWeight: 500}}>Previously graded</div>
                <span className="chip">{assignment.submissions.length}</span>
              </div>
              <div style={{fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5, marginBottom: 10}}>
                {assignment.submissions.length} submission{assignment.submissions.length > 1 ? "s" : ""} already graded for this assignment.
              </div>
              <button className="btn btn-secondary btn-sm btn-full" onClick={onBackToResults}>
                Review results <Icon.Arrow />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.GradeView = GradeView;
