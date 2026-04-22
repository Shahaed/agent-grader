// App shell: sidebar + topbar
const { useState } = React;

function Sidebar({ section, onSection, assignments, currentId, onSelect, onCreate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">a</div>
        <div className="brand-text">Agent <em>Grader</em></div>
      </div>

      {/* Top-level nav */}
      <div className="sidebar-section" style={{paddingBottom: 4}}>
        <div className="nav-list">
          <button
            className={"nav-item " + (section === "assignments" ? "active" : "")}
            onClick={() => onSection("assignments")}
          >
            <Icon.Book />
            <span>Assignments</span>
            <span className="nav-count mono">{assignments.length}</span>
          </button>
          <button
            className={"nav-item " + (section === "grading" ? "active" : "")}
            onClick={() => onSection("grading")}
          >
            <Icon.Sparkle />
            <span>Grading</span>
          </button>
        </div>
      </div>

      {/* Contextual list under nav */}
      {section === "assignments" && (
        <div className="sidebar-section">
          <div className="sidebar-heading">
            <span className="caps">Your assignments</span>
            <button className="new-btn" onClick={onCreate} title="New assignment">
              <Icon.Plus />
            </button>
          </div>
          <div className="assignment-list">
            {assignments.length === 0 && (
              <div style={{padding: "16px 8px", fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5}}>
                No assignments yet. Press <strong style={{color:"var(--ink-2)"}}>+</strong> to begin.
              </div>
            )}
            {assignments.map(a => (
              <button
                key={a.id}
                className={"assignment-item " + (a.id === currentId ? "active" : "")}
                onClick={() => onSelect(a.id)}
              >
                <div className="assignment-item-title">{a.assignmentName}</div>
                <div className="assignment-item-meta">
                  <span>{a.courseName.split("—")[0].trim()}</span>
                  <span className="dot" />
                  <span>{(a.submissions?.length ?? a.submissionCount ?? 0)} graded</span>
                </div>
              </button>
            ))}
            <button
              className="assignment-item"
              onClick={onCreate}
              style={{color:"var(--ink-3)", fontSize:12}}
            >
              + New assignment
            </button>
          </div>
        </div>
      )}

      {section === "grading" && (
        <div className="sidebar-section">
          <div className="sidebar-heading">
            <span className="caps">Recent runs</span>
          </div>
          <div className="assignment-list">
            {assignments
              .filter(a => (a.submissions?.length ?? 0) > 0)
              .map(a => (
                <button
                  key={a.id}
                  className={"assignment-item " + (a.id === currentId ? "active" : "")}
                  onClick={() => onSelect(a.id)}
                >
                  <div className="assignment-item-title">{a.assignmentName}</div>
                  <div className="assignment-item-meta">
                    <span>{a.submissions.length} submission{a.submissions.length === 1 ? "" : "s"}</span>
                  </div>
                </button>
              ))}
            {assignments.every(a => (a.submissions?.length ?? 0) === 0) && (
              <div style={{padding: "12px 8px", fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5}}>
                No grading runs yet.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="sidebar-footer">
        <div className="avatar">MH</div>
        <div>
          <div className="user-name">Ms. Halverson</div>
          <div className="user-role">AP English · period 3</div>
        </div>
      </div>
    </aside>
  );
}

function TopBar({ section, assignment, step, onStep, onCreate, showTabs, onBackToIndex }) {
  if (section === "grading") {
    return (
      <div className="topbar">
        <div className="crumb">
          <span className="caps">Grading</span>
          <span className="crumb-sep">/</span>
          <span className="crumb-title">
            {assignment ? assignment.assignmentName : "All runs"}
          </span>
        </div>
        <div className="topbar-actions">
          <span className="chip">isolated runs</span>
        </div>
      </div>
    );
  }

  // Assignments index view (no open assignment)
  if (!showTabs) {
    return (
      <div className="topbar">
        <div className="crumb">
          <span className="caps">Assignments</span>
          <span className="crumb-sep">/</span>
          <span className="crumb-title">All assignments</span>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-secondary btn-sm" onClick={onCreate}>
            <Icon.Plus /> New
          </button>
        </div>
      </div>
    );
  }

  // Assignment workspace (Setup/Context tabs)
  const steps = [
    { key: "create", label: "Setup", num: "01", disabled: false },
    { key: "review", label: "Context", num: "02", disabled: !assignment },
  ];
  return (
    <div className="topbar">
      <div className="crumb">
        <button className="btn btn-ghost btn-sm" style={{padding:"2px 6px", fontSize: 11}} onClick={onBackToIndex}>
          ← Assignments
        </button>
        <span className="crumb-sep">/</span>
        <span className="crumb-title">
          {assignment ? assignment.assignmentName : "New assignment"}
        </span>
      </div>
      <div className="tabs">
        {steps.map(s => (
          <button
            key={s.key}
            className={"tab " + (step === s.key ? "active" : "")}
            disabled={s.disabled}
            onClick={() => onStep(s.key)}
          >
            <span className="tab-num">{s.num}</span>
            {s.label}
          </button>
        ))}
      </div>
      <div className="topbar-actions">
        <button className="btn btn-secondary btn-sm" onClick={onCreate}>
          <Icon.Plus /> New
        </button>
      </div>
    </div>
  );
}

window.Sidebar = Sidebar;
window.TopBar = TopBar;
