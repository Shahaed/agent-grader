// Minimal inline icons — 16px viewBox, 1.5 stroke, no color
const Icon = {
  Plus: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...p}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  ),
  X: (p) => (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...p}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  ),
  Arrow: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  ),
  Check: (p) => (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 8.5l3.5 3.5L13 5" />
    </svg>
  ),
  Upload: (p) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 11V3M5 6l3-3 3 3M3 11v2h10v-2" />
    </svg>
  ),
  File: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 2h5l3 3v9H4z" />
      <path d="M9 2v3h3" />
    </svg>
  ),
  Trash: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 4h10M6 4V2.5h4V4M5 4v9h6V4M7 7v4M9 7v4" />
    </svg>
  ),
  Drag: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...p}>
      <circle cx="6" cy="4" r="0.8" fill="currentColor" stroke="none"/>
      <circle cx="10" cy="4" r="0.8" fill="currentColor" stroke="none"/>
      <circle cx="6" cy="8" r="0.8" fill="currentColor" stroke="none"/>
      <circle cx="10" cy="8" r="0.8" fill="currentColor" stroke="none"/>
      <circle cx="6" cy="12" r="0.8" fill="currentColor" stroke="none"/>
      <circle cx="10" cy="12" r="0.8" fill="currentColor" stroke="none"/>
    </svg>
  ),
  Sparkle: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" {...p}>
      <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" />
    </svg>
  ),
  Edit: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M11 2l3 3-8 8H3v-3z" />
      <path d="M10 3l3 3" />
    </svg>
  ),
  Cog: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" {...p}>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" />
    </svg>
  ),
  Book: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 3h5a2 2 0 012 2v9a1 1 0 00-1-1H3zM13 3H8a2 2 0 00-2 2v9a1 1 0 011-1h6z" />
    </svg>
  ),
  ChevronRight: (p) => (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 3l5 5-5 5" />
    </svg>
  ),
  Dots: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" {...p}>
      <circle cx="4" cy="8" r="1.2"/>
      <circle cx="8" cy="8" r="1.2"/>
      <circle cx="12" cy="8" r="1.2"/>
    </svg>
  ),
};

window.Icon = Icon;
