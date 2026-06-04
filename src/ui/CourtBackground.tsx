/**
 * Stylized top-down racquetball court rendered as SVG.
 * Sized to fill the viewport behind app content. Cards on top should stay
 * solid (bg-white) so the court only peeks around the edges.
 */
export function CourtBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <svg
        viewBox="0 0 200 400"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
        aria-hidden="true"
      >
        {/* Wood floor gradient */}
        <defs>
          <linearGradient id="court-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9935b" />
            <stop offset="50%" stopColor="#b07d47" />
            <stop offset="100%" stopColor="#8e6234" />
          </linearGradient>
          <linearGradient id="court-vignette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(15, 23, 42, 0.55)" />
            <stop offset="100%" stopColor="rgba(15, 23, 42, 0.75)" />
          </linearGradient>
        </defs>

        {/* Floor */}
        <rect x="0" y="0" width="200" height="400" fill="url(#court-floor)" />

        {/* Wood plank lines */}
        {Array.from({ length: 24 }).map((_, i) => (
          <line
            key={i}
            x1="0"
            y1={i * 17}
            x2="200"
            y2={i * 17}
            stroke="rgba(40, 25, 15, 0.18)"
            strokeWidth="0.4"
          />
        ))}

        {/* Court boundary */}
        <rect
          x="14"
          y="14"
          width="172"
          height="372"
          fill="none"
          stroke="#f5f5f0"
          strokeWidth="1.2"
          opacity="0.85"
        />

        {/* Short line (across the court at half-depth) */}
        <line
          x1="14"
          y1="200"
          x2="186"
          y2="200"
          stroke="#f5f5f0"
          strokeWidth="1.2"
          opacity="0.85"
        />

        {/* Service line (in front of short line) */}
        <line
          x1="14"
          y1="150"
          x2="186"
          y2="150"
          stroke="#f5f5f0"
          strokeWidth="1.2"
          opacity="0.85"
        />

        {/* Service box divider */}
        <line
          x1="100"
          y1="150"
          x2="100"
          y2="200"
          stroke="#f5f5f0"
          strokeWidth="1.2"
          opacity="0.85"
        />

        {/* Receiving line (back third) */}
        <line
          x1="14"
          y1="265"
          x2="186"
          y2="265"
          stroke="#f5f5f0"
          strokeWidth="0.8"
          opacity="0.6"
          strokeDasharray="4 3"
        />

        {/* Dark overlay so cards/text stay readable */}
        <rect x="0" y="0" width="200" height="400" fill="url(#court-vignette)" />
      </svg>
    </div>
  )
}
