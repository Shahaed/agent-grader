// Assignments index — grid of created assignments + new CTA + empty state
function AssignmentsIndex({ assignments, onOpen, onCreate }) {
  return (
    <div className="view">
      <div className="view-header" style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", gap: 20, flexWrap:"wrap"}}>
        <div>
          <div className="caps view-eyebrow">Assignments</div>
          <h1 className="view-title">Your <em>assignments</em>.</h1>
          <p className="view-sub">
            An assignment holds the rubric, prompts, and readings for a piece of student work. Build it once,
            then grade submissions against it in the Grading section.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onCreate}>
          <Icon.Plus /> New assignment
        </button>
      </div>

      {assignments.length === 0 && (
        <div className="empty" style={{padding: "80px 20px"}}>
          <div className="big">No assignments yet.</div>
          <div className="small" style={{marginBottom: 18}}>
            Start by uploading a rubric. The system will parse it into an editable prompt set and normalized grading bands.
          </div>
          <button className="btn btn-primary" onClick={onCreate}>
            <Icon.Plus /> Create your first assignment
          </button>
        </div>
      )}

      {assignments.length > 0 && (
        <div className="assignments-grid">
          {assignments.map(a => {
            const nSubs = a.submissions?.length ?? 0;
            return (
              <button key={a.id} className="assignment-card" onClick={() => onOpen(a.id)}>
                <div className="assignment-card-top">
                  <span className="chip">{a.assignmentType}</span>
                  <span className="chip teal">{a.subject}</span>
                </div>
                <div className="assignment-card-title">{a.assignmentName}</div>
                <div className="assignment-card-course">{a.courseName}</div>
                <div className="assignment-card-stats">
                  <div>
                    <div className="stat-num serif">{a.promptSet?.length || 0}</div>
                    <div className="stat-label">prompts</div>
                  </div>
                  <div>
                    <div className="stat-num serif">{a.normalizedRubric?.dimensions?.length || 0}</div>
                    <div className="stat-label">dimensions</div>
                  </div>
                  <div>
                    <div className="stat-num serif">{nSubs}</div>
                    <div className="stat-label">graded</div>
                  </div>
                </div>
                <div className="assignment-card-footer">
                  <span className="mono" style={{fontSize: 11, color: "var(--ink-3)"}}>
                    created {a.createdAt}
                  </span>
                  <span className="row" style={{color:"var(--ink-2)", fontSize: 12, fontWeight: 500}}>
                    Open <Icon.ChevronRight />
                  </span>
                </div>
              </button>
            );
          })}

          <button className="assignment-card new-card" onClick={onCreate}>
            <div className="new-card-plus"><Icon.Plus /></div>
            <div className="new-card-label">New assignment</div>
            <div className="new-card-sub">Upload a rubric to start</div>
          </button>
        </div>
      )}
    </div>
  );
}

window.AssignmentsIndex = AssignmentsIndex;
