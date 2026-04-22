// Create Assignment flow
const { useState: useStateCreate } = React;

function FilePicker({ label, multi, value, onChange, accept, required }) {
  const files = multi ? (value || []) : (value ? [value] : []);
  const handleChange = (e) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    if (multi) onChange([...(value || []), ...picked.map(f => ({ name: f.name, size: f.size }))]);
    else onChange({ name: picked[0].name, size: picked[0].size });
  };
  const remove = (idx) => {
    if (multi) onChange((value || []).filter((_, i) => i !== idx));
    else onChange(null);
  };
  const hasFiles = files.length > 0;

  return (
    <div className="field">
      <label className="label">{label}{required && <span className="req">*</span>}</label>
      <label className={"file-drop " + (hasFiles ? "has-file" : "")}>
        <input type="file" multiple={multi} accept={accept} style={{display:"none"}} onChange={handleChange} />
        {!hasFiles && (
          <>
            <Icon.Upload style={{color:"var(--ink-3)"}} />
            <div className="primary">Drop a file or click to browse</div>
            <div className="secondary mono">{accept}</div>
          </>
        )}
        {hasFiles && (
          <div style={{display:"flex", flexWrap:"wrap", gap:4, justifyContent:"center"}}>
            {files.map((f, i) => (
              <span key={i} className="file-pill">
                <span className="file-icon">{(f.name.split(".").pop() || "FILE").toUpperCase()}</span>
                {f.name}
                <span className="x" onClick={(e)=>{e.preventDefault(); remove(i);}}><Icon.X /></span>
              </span>
            ))}
            <span className="file-pill" style={{cursor:"pointer", borderStyle:"dashed", color:"var(--ink-3)"}}>
              <Icon.Plus /> add {multi ? "more" : "another"}
            </span>
          </div>
        )}
      </label>
    </div>
  );
}

function CreateView({ onCreated }) {
  const [draft, setDraft] = useStateCreate(window.EMPTY_ASSIGNMENT_DRAFT);
  const [parsing, setParsing] = useStateCreate(false);

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  const canCreate = draft.assignmentName && draft.courseName && draft.subject && draft.rubricFile;

  const handleCreate = () => {
    setParsing(true);
    setTimeout(() => {
      setParsing(false);
      onCreated(draft);
    }, 1400);
  };

  return (
    <div className="view">
      <div className="view-header">
        <div className="caps view-eyebrow">Step 01 · Setup</div>
        <h1 className="view-title">Build an <em>assignment</em> once.<br/>Grade its essays in isolated runs.</h1>
        <p className="view-sub">
          Upload a rubric and the system will parse it into an editable prompt set and a normalized rubric.
          Neither is grading yet — you'll review and adjust before a single student paper is scored.
        </p>
      </div>

      <div className="create-grid">
        <div style={{display:"flex", flexDirection:"column", gap: 16}}>
          <div className="card">
            <div className="metadata-card-title">Assignment details</div>
            <div className="card-sub">Metadata is locked at creation time — pick carefully.</div>

            <div style={{display:"flex", flexDirection:"column", gap: 14}}>
              <div className="field">
                <label className="label">Assignment name<span className="req">*</span></label>
                <input
                  className="input"
                  placeholder="Rhetorical Analysis: King's Letter from Birmingham Jail"
                  value={draft.assignmentName}
                  onChange={e => set("assignmentName", e.target.value)}
                />
              </div>

              <div className="grid-2">
                <div className="field">
                  <label className="label">Course name<span className="req">*</span></label>
                  <input className="input" placeholder="AP English Literature — Period 3"
                    value={draft.courseName} onChange={e => set("courseName", e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Subject<span className="req">*</span></label>
                  <input className="input" placeholder="English"
                    value={draft.subject} onChange={e => set("subject", e.target.value)} />
                </div>
              </div>

              <div className="grid-2">
                <div className="field">
                  <label className="label">Class level</label>
                  <select className="select" value={draft.level} onChange={e => set("level", e.target.value)}>
                    {window.LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Assignment type</label>
                  <select className="select" value={draft.assignmentType} onChange={e => set("assignmentType", e.target.value)}>
                    {window.ASSIGNMENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="metadata-card-title">Rubric & readings</div>
            <div className="card-sub">Rubric is required — it drives prompt extraction and grading bands.</div>
            <div style={{display:"flex", flexDirection:"column", gap: 14}}>
              <FilePicker
                label="Rubric file"
                required
                value={draft.rubricFile}
                onChange={v => set("rubricFile", v)}
                accept=".pdf, .docx, .txt, .md, .csv, .json"
              />
              <FilePicker
                label="Readings & source materials"
                multi
                value={draft.readingFiles}
                onChange={v => set("readingFiles", v)}
                accept=".pdf, .docx, .txt, .md, .csv, .json"
              />
            </div>
          </div>

          <div className="sticky-footer">
            <button className="btn btn-secondary" onClick={() => setDraft(window.EMPTY_ASSIGNMENT_DRAFT)}>Clear</button>
            <button className="btn btn-primary" disabled={!canCreate || parsing} onClick={handleCreate}>
              {parsing ? <>Parsing rubric…</> : <>Parse & continue <Icon.Arrow /></>}
            </button>
          </div>
        </div>

        <div style={{display:"flex", flexDirection:"column", gap: 16, position:"sticky", top: 80}}>
          <div className="quote-card">
            <div className="q-mark">"</div>
            <div className="q-text">The rubric is the syllabus of attention. Write it once, with care, and grade with both hands free.</div>
            <div className="q-author">Agent Grader · design principle no. 2</div>
          </div>

          <div className="card">
            <div className="metadata-card-title" style={{fontSize: 20}}>What happens next</div>
            <hr className="hr" />
            <div className="info-list">
              <div className="info-row">
                <div className="info-bullet">i.</div>
                <p><strong>The rubric is parsed</strong> into a normalized schema — dimensions, weights, bands. You'll see it as a spreadsheet and can edit every cell.</p>
              </div>
              <div className="info-row">
                <div className="info-bullet">ii.</div>
                <p><strong>Prompts are extracted</strong> from the rubric and any readings. You can add, remove, or reword before grading begins.</p>
              </div>
              <div className="info-row">
                <div className="info-bullet">iii.</div>
                <p><strong>Each student submission</strong> is graded in its own isolated run. No cross-student context bleeds between them.</p>
              </div>
            </div>
          </div>

          <div className="card" style={{background:"var(--bg-sunk)"}}>
            <div className="row" style={{gap: 10, marginBottom: 6}}>
              <span className="chip amber dot">Tip</span>
            </div>
            <div style={{fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55}}>
              The cleaner your rubric document, the less editing you'll do in step 2. A table with criteria as rows
              and performance bands as columns parses best.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.CreateView = CreateView;
