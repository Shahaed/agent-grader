// Root app
const { useState: useS, useEffect: useE } = React;

function App() {
  const loadState = () => {
    try {
      const raw = localStorage.getItem("agentgrader_state_v3");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  };
  const saved = loadState();

  const [assignments, setAssignments] = useS(() => saved?.assignments || [window.SEED_ASSIGNMENT]);
  // section: "assignments" | "grading"
  const [section, setSection] = useS(() => saved?.section || "grading");
  // In Assignments: null = index view, otherwise id of open assignment
  const [openAssignmentId, setOpenAssignmentId] = useS(() => saved?.openAssignmentId ?? null);
  // In Grading: null = landing, otherwise id of active batch
  const [gradingId, setGradingId] = useS(() => saved?.gradingId ?? null);
  // Step inside opened assignment workspace: "create" | "review"
  const [step, setStep] = useS(() => saved?.step || "review");
  const [creating, setCreating] = useS(false);

  // Tweaks
  const [tweaks, setTweaks] = useS(() => {
    try {
      const raw = localStorage.getItem("agentgrader_tweaks_v1");
      if (raw) return { ...window.__TWEAK_DEFAULTS, ...JSON.parse(raw) };
    } catch (e) {}
    return window.__TWEAK_DEFAULTS;
  });
  const [tweaksOpen, setTweaksOpen] = useS(false);
  const [editModeActive, setEditModeActive] = useS(false);

  useE(() => {
    localStorage.setItem("agentgrader_state_v3", JSON.stringify({
      assignments, openAssignmentId, gradingId, step, section
    }));
  }, [assignments, openAssignmentId, gradingId, step, section]);

  useE(() => {
    localStorage.setItem("agentgrader_tweaks_v1", JSON.stringify(tweaks));
    document.body.dataset.accent = tweaks.accent;
    document.body.dataset.density = tweaks.density;
  }, [tweaks]);

  useE(() => {
    const handler = (e) => {
      if (!e.data || !e.data.type) return;
      if (e.data.type === "__activate_edit_mode") { setEditModeActive(true); setTweaksOpen(true); }
      if (e.data.type === "__deactivate_edit_mode") { setEditModeActive(false); setTweaksOpen(false); }
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  const updateTweaks = (patch) => {
    const next = { ...tweaks, ...patch };
    setTweaks(next);
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: patch }, "*");
  };

  const openAssignment = openAssignmentId ? assignments.find(a => a.id === openAssignmentId) : null;

  const handleCreate = () => {
    setSection("assignments");
    setCreating(true);
    setOpenAssignmentId(null);
    setStep("create");
  };

  const handleCreated = (draft) => {
    const newId = "asg_" + Math.random().toString(36).slice(2, 8);
    const parsed = {
      ...window.SEED_ASSIGNMENT,
      id: newId,
      assignmentName: draft.assignmentName,
      courseName: draft.courseName,
      subject: draft.subject,
      level: draft.level,
      assignmentType: draft.assignmentType,
      createdAt: new Date().toISOString().slice(0, 10),
      submissionCount: 0,
      submissions: [],
    };
    setAssignments(a => [...a, parsed]);
    setOpenAssignmentId(newId);
    setCreating(false);
    setStep("review");
  };

  const updateAssignment = (next) => {
    setAssignments(list => list.map(a => a.id === next.id ? next : a));
  };

  // Sidebar behavior: clicking an assignment opens it in Assignments section; clicking a grading run opens grading batch
  const onSidebarSelect = (id) => {
    setCreating(false);
    if (section === "assignments") {
      setOpenAssignmentId(id);
      setStep("review");
    } else {
      setGradingId(id);
    }
  };

  // Sidebar section change
  const onSidebarSection = (s) => {
    setCreating(false);
    setSection(s);
    if (s === "assignments") {
      setOpenAssignmentId(null); // land on index
    } else {
      setGradingId(null); // land on grading landing
    }
  };

  // Content
  let content;
  if (section === "assignments") {
    if (creating || step === "create") {
      content = <CreateView onCreated={handleCreated} />;
    } else if (openAssignment) {
      content = <ReviewView assignment={openAssignment} onUpdate={updateAssignment} onContinue={() => setOpenAssignmentId(null)} />;
    } else {
      // Index view
      content = <AssignmentsIndex
        assignments={assignments}
        onOpen={(id) => { setOpenAssignmentId(id); setStep("review"); }}
        onCreate={handleCreate}
      />;
    }
  } else {
    content = <GradingSection
      assignments={assignments}
      currentId={gradingId}
      onPick={(id) => setGradingId(id)}
      onUpdateAssignment={updateAssignment}
    />;
  }

  const sidebarCurrentId = section === "assignments"
    ? (creating ? null : openAssignmentId)
    : gradingId;

  // Topbar assignment: only show for an opened assignment workspace or open grading batch
  const topbarAssignment = section === "assignments"
    ? (creating ? null : openAssignment)
    : (gradingId ? assignments.find(a => a.id === gradingId) : null);

  return (
    <div className="app">
      <Sidebar
        section={section}
        onSection={onSidebarSection}
        assignments={assignments}
        currentId={sidebarCurrentId}
        onSelect={onSidebarSelect}
        onCreate={handleCreate}
      />
      <div className="canvas">
        <TopBar
          section={section}
          assignment={topbarAssignment}
          showTabs={section === "assignments" && (creating || !!openAssignmentId)}
          step={creating ? "create" : step}
          onStep={(s) => {
            if (s === "create") { handleCreate(); }
            else { setCreating(false); setStep(s); }
          }}
          onCreate={handleCreate}
          onBackToIndex={() => { setOpenAssignmentId(null); setCreating(false); }}
        />
        {content}
      </div>

      {!editModeActive && (
        <button className="tweaks-btn" onClick={() => setTweaksOpen(v => !v)}>
          <Icon.Cog /> Tweaks
        </button>
      )}
      <TweaksPanel
        open={tweaksOpen}
        tweaks={tweaks}
        onChange={updateTweaks}
        onClose={() => setTweaksOpen(false)}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
