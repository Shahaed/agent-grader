// Review / Rubric matrix editor
const { useState: useStateReview } = React;

function ReviewView({ assignment, onUpdate, onContinue }) {
  if (!assignment) return null;

  const rubric = assignment.normalizedRubric;
  const prompts = assignment.promptSet;

  const updateRubric = (patch) => onUpdate({
    ...assignment,
    normalizedRubric: { ...rubric, ...patch }
  });

  const updateDimension = (dimId, patch) => {
    const next = rubric.dimensions.map(d =>
      d.id === dimId ? { ...d, ...patch } : d
    );
    updateRubric({ dimensions: next });
  };

  const updateBand = (dimId, bandIdx, patch) => {
    const next = rubric.dimensions.map(d => {
      if (d.id !== dimId) return d;
      const bands = d.bands.map((b, i) =>
        i === bandIdx ? { ...b, ...patch } : b
      );
      return { ...d, bands };
    });
    updateRubric({ dimensions: next });
  };

  const updatePrompt = (pid, patch) => {
    const nextPrompts = prompts.map(p => p.id === pid ? { ...p, ...patch } : p);
    onUpdate({ ...assignment, promptSet: nextPrompts });
  };

  const [tab, setTab] = useStateReview("rubric");

  return (
    <div className="view wide">
      <div className="view-header">
        <div className="caps view-eyebrow">Step 02 · Context</div>
        <h1 className="view-title">Review the parsed <em>context package</em>.</h1>
        <p className="view-sub">
          Every cell below is editable. The grading runs will use exactly what you see here — no silent rewrites.
          Make sure prompts are worded the way you'd word them for a TA, and bands read the way you'd read them aloud.
        </p>
      </div>

      <div style={{display:"flex", gap: 10, marginBottom: 18, alignItems:"center"}}>
        <div className="tabs" style={{background:"var(--paper)"}}>
          <button className={"tab " + (tab==="rubric"?"active":"")} onClick={()=>setTab("rubric")}>
            <span className="tab-num">R</span>Rubric matrix
          </button>
          <button className={"tab " + (tab==="prompts"?"active":"")} onClick={()=>setTab("prompts")}>
            <span className="tab-num">P</span>Prompt set · {prompts.length}
          </button>
          <button className={"tab " + (tab==="meta"?"active":"")} onClick={()=>setTab("meta")}>
            <span className="tab-num">M</span>Requirements & notes
          </button>
        </div>
        <div className="spacer" />
        <span className="edit-hint"><Icon.Edit />click any cell to edit</span>
      </div>

      {tab === "rubric" && (
        <RubricMatrix
          rubric={rubric}
          prompts={prompts}
          onDimChange={updateDimension}
          onBandChange={updateBand}
          onRubricChange={updateRubric}
        />
      )}

      {tab === "prompts" && (
        <PromptsEditor prompts={prompts} onChange={updatePrompt} />
      )}

      {tab === "meta" && (
        <MetaEditor rubric={rubric} onChange={updateRubric} />
      )}

      <div className="sticky-footer">
        <button className="btn btn-secondary">Save draft</button>
        <button className="btn btn-primary" onClick={onContinue}>
          Save & finish <Icon.Check />
        </button>
      </div>
    </div>
  );
}

function RubricMatrix({ rubric, prompts, onDimChange, onBandChange, onRubricChange }) {
  // Columns: criteria | scope | weight | max | band1 | band2 | band3 | band4
  const bandLabels = ["Exemplary", "Proficient", "Developing", "Beginning"];
  const cols = `minmax(180px, 1.2fr) 100px 80px 80px repeat(${bandLabels.length}, minmax(180px, 1.1fr))`;

  return (
    <div>
      <div className="rubric-wrap">
        <div className="rubric-toolbar">
          <div style={{display:"flex", gap: 12, alignItems:"center"}}>
            <span className="mono" style={{fontSize: 11, color: "var(--ink-3)"}}>
              {rubric.rubricId}
            </span>
            <span className="chip">{rubric.gradingMode}</span>
            <span className="chip teal">Scale /<input
              className="inline-edit mono"
              style={{width: 28, textAlign:"center"}}
              value={rubric.totalScaleMax}
              onChange={e => onRubricChange({ totalScaleMax: Number(e.target.value) || 0 })}
            /></span>
            <span className="chip">{rubric.dimensions.length} dimensions</span>
          </div>
          <div style={{display:"flex", gap: 6}}>
            <button className="btn btn-ghost btn-sm">
              <Icon.Plus /> Add dimension
            </button>
          </div>
        </div>

        <div className="rubric-scroll">
          <div className="rubric-grid" style={{ gridTemplateColumns: cols }}>
            {/* Header row */}
            <div className="rcell header">Criterion</div>
            <div className="rcell header">Scope</div>
            <div className="rcell header">Weight</div>
            <div className="rcell header">Max</div>
            {bandLabels.map((l) => (
              <div key={l} className="rcell header band">{l}</div>
            ))}

            {/* Dimension rows */}
            {rubric.dimensions.map(dim => (
              <React.Fragment key={dim.id}>
                <div className="rcell dim-name">
                  <input
                    className="inline-edit"
                    style={{fontWeight: 500, fontSize: 13}}
                    value={dim.name}
                    onChange={e => onDimChange(dim.id, { name: e.target.value })}
                  />
                  <div style={{fontSize: 11, color:"var(--ink-3)", lineHeight: 1.4}}>{dim.descriptor}</div>
                </div>
                <div className="rcell dim-meta">
                  <span className={"chip " + (dim.scope === "global" ? "scope-global" : "scope-prompt")}>
                    {dim.scope}
                  </span>
                  {dim.scope === "prompt" && (
                    <div style={{fontSize: 10, marginTop: 4, color:"var(--ink-3)", fontFamily:"var(--mono)"}}>
                      {dim.promptIds.map(id => {
                        const p = prompts.find(pp => pp.id === id);
                        return p ? `P${p.order}` : id;
                      }).join(", ")}
                    </div>
                  )}
                </div>
                <div className="rcell dim-meta">
                  <input
                    className="inline-edit mono"
                    style={{fontSize: 12, color:"var(--accent)"}}
                    value={dim.weight}
                    onChange={e => onDimChange(dim.id, { weight: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="rcell dim-meta">
                  <input
                    className="inline-edit mono"
                    style={{fontSize: 12}}
                    value={dim.scaleMax}
                    onChange={e => onDimChange(dim.id, { scaleMax: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                {dim.bands.map((band, bi) => (
                  <div key={bi} className="rcell band-cell">
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline"}}>
                      <input
                        className="inline-edit band-label"
                        value={band.label}
                        onChange={e => onBandChange(dim.id, bi, { label: e.target.value })}
                      />
                      <span className="band-score">
                        <input
                          className="inline-edit mono"
                          style={{width: 20, textAlign:"right", color:"var(--accent)"}}
                          value={band.scoreRange.min}
                          onChange={e => onBandChange(dim.id, bi, { scoreRange: { ...band.scoreRange, min: Number(e.target.value)||0 } })}
                        />
                        –
                        <input
                          className="inline-edit mono"
                          style={{width: 20, color:"var(--accent)"}}
                          value={band.scoreRange.max}
                          onChange={e => onBandChange(dim.id, bi, { scoreRange: { ...band.scoreRange, max: Number(e.target.value)||0 } })}
                        />
                      </span>
                    </div>
                    <textarea
                      className="cell-editable"
                      value={band.descriptor}
                      onChange={e => onBandChange(dim.id, bi, { descriptor: e.target.value })}
                    />
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:"flex", gap: 10, marginTop: 14, fontSize: 12, color:"var(--ink-3)"}}>
        <span className="edit-hint"><span className="chip scope-global">global</span>applies to every prompt</span>
        <span className="edit-hint"><span className="chip scope-prompt">prompt</span>only scores the listed prompts</span>
      </div>
    </div>
  );
}

function PromptsEditor({ prompts, onChange }) {
  return (
    <div className="prompts-list">
      {prompts.map(p => (
        <div key={p.id} className="prompt-card">
          <div className="prompt-num">{String(p.order).padStart(2,"0")}</div>
          <div className="prompt-body">
            <input
              className="inline-edit prompt-title"
              style={{fontSize: 15, fontWeight: 500}}
              value={p.title}
              onChange={e => onChange(p.id, { title: e.target.value })}
            />
            <textarea
              className="cell-editable"
              style={{fontSize: 13, color:"var(--ink-2)", lineHeight: 1.5, marginTop: 4, minHeight: 52}}
              value={p.instructions}
              onChange={e => onChange(p.id, { instructions: e.target.value })}
            />
            {p.citationExpectations && (
              <div style={{marginTop: 10, fontSize: 12, color:"var(--ink-3)", lineHeight: 1.5, display:"flex", gap: 6}}>
                <span className="chip teal">citations</span>
                <input
                  className="inline-edit"
                  style={{fontSize: 12}}
                  value={p.citationExpectations}
                  onChange={e => onChange(p.id, { citationExpectations: e.target.value })}
                />
              </div>
            )}
            <div className="prompt-meta">
              <span className="chip">{p.type}</span>
              <span className="chip">max {p.maxScore}</span>
            </div>
          </div>
          <div className="prompt-actions">
            <button className="icon-btn" title="Reorder"><Icon.Drag /></button>
            <button className="icon-btn" title="Remove"><Icon.Trash /></button>
          </div>
        </div>
      ))}

      <button className="prompt-card" style={{justifyContent:"center", color:"var(--ink-3)", background:"var(--bg-sunk)", border: "1px dashed var(--line)", gridTemplateColumns: "1fr"}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:6, fontSize: 13}}>
          <Icon.Plus /> Add a prompt
        </div>
      </button>
    </div>
  );
}

function MetaEditor({ rubric, onChange }) {
  const [newReq, setNewReq] = useStateReview("");
  return (
    <div style={{display:"grid", gridTemplateColumns: "1fr 1fr", gap: 16}}>
      <div className="card">
        <div className="metadata-card-title" style={{fontSize: 20}}>Hard requirements</div>
        <div className="card-sub">Non-negotiables. The grader checks each one explicitly.</div>
        <div style={{display:"flex", flexDirection:"column", gap: 8}}>
          {rubric.hardRequirements.map((r, i) => (
            <div key={i} style={{display:"flex", gap: 8, alignItems:"start", padding:"10px 12px", background:"var(--bg-sunk)", borderRadius: 8, border: "1px solid var(--line-soft)"}}>
              <span className="mono" style={{fontSize: 11, color:"var(--accent)", paddingTop: 2}}>
                R{String(i+1).padStart(2,"0")}
              </span>
              <input
                className="inline-edit"
                style={{fontSize: 13, flex: 1}}
                value={r}
                onChange={e => {
                  const next = [...rubric.hardRequirements];
                  next[i] = e.target.value;
                  onChange({ hardRequirements: next });
                }}
              />
              <button className="icon-btn" onClick={() => {
                onChange({ hardRequirements: rubric.hardRequirements.filter((_, j) => j !== i) });
              }}><Icon.X /></button>
            </div>
          ))}
          <div style={{display:"flex", gap: 8, marginTop: 4}}>
            <input
              className="input"
              placeholder="Add a requirement…"
              value={newReq}
              onChange={e => setNewReq(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && newReq.trim()) {
                  onChange({ hardRequirements: [...rubric.hardRequirements, newReq.trim()] });
                  setNewReq("");
                }
              }}
            />
          </div>
        </div>
      </div>

      <div style={{display:"flex", flexDirection:"column", gap: 16}}>
        <div className="card">
          <div className="metadata-card-title" style={{fontSize: 20}}>Grader notes</div>
          <div className="card-sub">Guidance in your voice. Passed to every grading run.</div>
          <textarea
            className="textarea"
            style={{minHeight: 120}}
            value={rubric.notes}
            onChange={e => onChange({ notes: e.target.value })}
          />
        </div>
        <div className="card">
          <div className="metadata-card-title" style={{fontSize: 20}}>Rubric identity</div>
          <div className="card-sub">These values are stored on every graded submission.</div>
          <div style={{display:"flex", flexDirection:"column", gap: 12}}>
            <div className="field">
              <label className="label">Rubric ID</label>
              <input className="input mono" value={rubric.rubricId}
                onChange={e => onChange({ rubricId: e.target.value })} />
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label">Mode</label>
                <select className="select" value={rubric.gradingMode} onChange={e => onChange({ gradingMode: e.target.value })}>
                  <option value="analytic">Analytic</option>
                  <option value="holistic">Holistic</option>
                </select>
              </div>
              <div className="field">
                <label className="label">Total scale max</label>
                <input className="input mono" value={rubric.totalScaleMax}
                  onChange={e => onChange({ totalScaleMax: Number(e.target.value) || 0 })} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ReviewView = ReviewView;
