// Results view — raw LLM text display per submission
const { useState: useStateResults } = React;

function ResultsView({ assignment, onUpdate, hideHeader }) {
  const subs = assignment.submissions || [];
  const [currentId, setCurrentId] = useStateResults(subs[0]?.id);
  const current = subs.find(s => s.id === currentId) || subs[0];

  if (!current) {
    return (
      <div className="view">
        <div className="empty">
          <div className="big">No graded submissions yet.</div>
          <div className="small">Upload and grade a batch in step 03 to see results here.</div>
        </div>
      </div>
    );
  }

  const updateCurrent = (patch) => {
    const next = subs.map(s => s.id === current.id ? { ...s, ...patch } : s);
    onUpdate({ ...assignment, submissions: next });
  };

  const updatePromptResult = (promptId, patch) => {
    const next = current.promptResults.map(pr =>
      pr.promptId === promptId ? { ...pr, ...patch } : pr
    );
    updateCurrent({ promptResults: next });
  };

  return (
    <div className={hideHeader ? "" : "view wide"}>
      {!hideHeader && (
      <div className="view-header">
        <div className="caps view-eyebrow">Grading · results</div>
        <h1 className="view-title">Review & edit feedback <em>in your voice</em>.</h1>
        <p className="view-sub">
          Generated feedback is shown exactly as the grader returned it. Edit any block — the teacher summary,
          the student-facing notes — and your version is what the student sees.
        </p>
      </div>
      )}

      <div className="results-layout">
        <div className="results-list">
          {subs.map(s => (
            <button
              key={s.id}
              className={"results-list-item " + (s.id === current.id ? "active" : "")}
              onClick={() => setCurrentId(s.id)}
            >
              <div className="rli-name">{s.studentName}</div>
              <div className="rli-meta">
                <span className="rli-score">{s.overallScore}/{s.totalMax}</span>
                <span className="dot" />
                <span>{s.promptResults.length} prompts</span>
              </div>
            </button>
          ))}
        </div>

        <div className="result-detail">
          <div className="result-header">
            <div>
              <div className="result-student-name">{current.studentName}</div>
              <div className="result-file">
                <Icon.File style={{verticalAlign:"middle", marginRight: 4}} />
                {current.fileName} · submitted {current.submittedAt}
              </div>
              <div style={{marginTop: 10, display:"flex", gap: 6}}>
                <span className="chip amber dot">graded</span>
                <span className="chip">{assignment.promptSet.length} prompts</span>
                <span className="chip">rubric {assignment.normalizedRubric.rubricId}</span>
              </div>
            </div>
            <div className="result-overall-score">
              <div className="score-big">
                {current.overallScore}<span className="frac">/{current.totalMax}</span>
              </div>
              <div className="score-pct">{Math.round((current.overallScore / current.totalMax) * 100)}%</div>
            </div>
          </div>

          <div className="result-section">
            <div className="result-section-title">
              <div className="rst-label">Overall feedback</div>
              <div className="rst-meta">from aggregate pass</div>
            </div>

            <EditableBlock
              label="Teacher summary"
              value={current.teacherSummary}
              onChange={v => updateCurrent({ teacherSummary: v })}
            />
            <div style={{height: 10}} />
            <EditableListBlock
              label="Student feedback"
              values={current.studentFeedback}
              onChange={vs => updateCurrent({ studentFeedback: vs })}
            />
          </div>

          {current.promptResults.map(pr => {
            const prompt = assignment.promptSet.find(p => p.id === pr.promptId);
            return (
              <div key={pr.promptId} className="result-section">
                <div className="result-section-title">
                  <div>
                    <div className="rst-label">
                      <span style={{color:"var(--accent)", fontStyle:"italic", marginRight: 8}}>
                        {String(prompt?.order || "").padStart(2,"0")}
                      </span>
                      {prompt?.title || pr.promptId}
                    </div>
                    <div className="rst-meta" style={{marginTop: 4}}>
                      <span className="mono">{pr.score}/{pr.maxScore}</span> · individual pass
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div className="score-big" style={{fontSize: 30}}>
                      {pr.score}<span className="frac" style={{fontSize: 16}}>/{pr.maxScore}</span>
                    </div>
                  </div>
                </div>

                <EditableBlock
                  label="Teacher summary"
                  value={pr.teacherSummary}
                  onChange={v => updatePromptResult(pr.promptId, { teacherSummary: v })}
                />
                <div style={{height: 10}} />
                <EditableListBlock
                  label="Student feedback"
                  values={pr.studentFeedback}
                  onChange={vs => updatePromptResult(pr.promptId, { studentFeedback: vs })}
                />
              </div>
            );
          })}

          <div className="result-section" style={{background: "var(--bg-sunk)"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap: 10}}>
              <div style={{fontSize: 13, color:"var(--ink-2)"}}>
                Review complete? Save your edited feedback to finalize for this student.
              </div>
              <div style={{display:"flex", gap: 8}}>
                <button className="btn btn-secondary btn-sm">Export PDF</button>
                <button className="btn btn-primary btn-sm">Save & send to {current.studentName.split(" ")[0]}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditableBlock({ label, value, onChange }) {
  return (
    <div
      className="llm-block"
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.innerText)}
    >
      <span className="llm-label">{label}</span>
      {value}
    </div>
  );
}

function EditableListBlock({ label, values, onChange }) {
  return (
    <div>
      <span className="llm-label" style={{marginBottom: 8, display:"block"}}>{label}</span>
      <div style={{display:"flex", flexDirection:"column", gap: 8}}>
        {values.map((v, i) => (
          <div
            key={i}
            className="llm-block"
            style={{paddingLeft: 38, position:"relative"}}
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => {
              const next = [...values];
              next[i] = e.currentTarget.innerText.replace(/^\d+\.\s*/, "");
              onChange(next);
            }}
          >
            <span style={{
              position:"absolute", left: 14, top: 14,
              fontFamily:"var(--mono)", fontSize: 11, color:"var(--accent)",
            }}>{String(i+1).padStart(2,"0")}.</span>
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}

window.ResultsView = ResultsView;
