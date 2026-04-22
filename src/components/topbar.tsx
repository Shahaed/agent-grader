"use client";

interface TopbarProps {
  breadcrumbs: Array<{ label: string; muted?: boolean; onClick?: () => void }>;
  tabs?: Array<{ label: string; count?: number; active?: boolean; onClick?: () => void }>;
  actions?: React.ReactNode;
}

export function Topbar({ breadcrumbs, tabs, actions }: TopbarProps) {
  return (
    <div
      className="sticky top-0 z-10 flex items-center justify-between border-b px-9 py-3.5"
      style={{
        borderColor: "var(--line)",
        background: "color-mix(in oklab, var(--bg) 92%, transparent)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-[13px]">
        {breadcrumbs.map((crumb) => {
          const key = crumb.label;
          return (
            <span key={key}>
              {breadcrumbs.indexOf(crumb) > 0 && (
                <span className="mx-1.5" style={{ color: "var(--ink-3)" }}>
                  /
                </span>
              )}
              {crumb.onClick ? (
                <button
                  type="button"
                  onClick={crumb.onClick}
                  className="font-medium"
                  style={{
                    color: "var(--ink-2)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    font: "inherit",
                    fontSize: "13px",
                  }}
                >
                  {crumb.label}
                </button>
              ) : crumb.muted ? (
                <span className="caps" style={{ color: "var(--ink-3)" }}>
                  {crumb.label}
                </span>
              ) : (
                <span className="font-medium" style={{ color: "var(--ink)" }}>
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {/* Tabs */}
        {tabs && tabs.length > 0 && (
          <div
            className="flex rounded-[9px] p-[3px]"
            style={{
              background: "var(--bg-sunk)",
              border: "1px solid var(--line)",
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.label}
                type="button"
                onClick={tab.onClick}
                className="btn flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[13px] font-medium transition-all"
                style={{
                  background: tab.active ? "var(--paper)" : "transparent",
                  color: tab.active ? "var(--ink)" : "var(--ink-3)",
                  boxShadow: tab.active
                    ? "0 1px 2px oklch(0 0 0 / 0.06)"
                    : "none",
                }}
              >
                {tab.label}
                {tab.count != null && (
                  <span
                    className="mono text-[10px]"
                    style={{ color: tab.active ? "var(--accent)" : "var(--ink-3)" }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        {actions}
      </div>
    </div>
  );
}
