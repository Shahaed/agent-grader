// Tweaks panel
const { useState: useStateTweaks, useEffect: useEffectTweaks } = React;

function TweaksPanel({ open, tweaks, onChange, onClose }) {
  if (!open) return null;
  return (
    <div className="tweaks-panel">
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <h3>Tweaks</h3>
        <button className="icon-btn" onClick={onClose}><Icon.X /></button>
      </div>

      <div className="tweak-row">
        <div className="row-label">Accent color</div>
        <div className="tweak-swatches">
          {[
            { key: "amber", color: "oklch(0.68 0.14 50)" },
            { key: "teal",  color: "oklch(0.6 0.1 195)" },
            { key: "plum",  color: "oklch(0.52 0.14 340)" },
            { key: "moss",  color: "oklch(0.55 0.1 140)" },
          ].map(s => (
            <button
              key={s.key}
              className={"swatch " + (tweaks.accent === s.key ? "active" : "")}
              style={{background: s.color}}
              onClick={() => onChange({ accent: s.key })}
            />
          ))}
        </div>
      </div>

      <div className="tweak-row">
        <div className="row-label">Density</div>
        <div className="seg">
          <button className={tweaks.density === "cozy" ? "active" : ""} onClick={() => onChange({ density: "cozy" })}>Cozy</button>
          <button className={tweaks.density === "compact" ? "active" : ""} onClick={() => onChange({ density: "compact" })}>Compact</button>
        </div>
      </div>

      <div style={{fontSize: 11, color:"var(--ink-3)", borderTop:"1px solid var(--line-soft)", paddingTop: 10}}>
        Tweaks persist across reloads.
      </div>
    </div>
  );
}

window.TweaksPanel = TweaksPanel;
