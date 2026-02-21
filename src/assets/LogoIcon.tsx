type LogoIconProps = {
  size?: number;
  className?: string;
};

export function LogoIcon({ size = 28, className }: LogoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Hub radial gradient — accent blue with highlight */}
        <radialGradient id="cv-hub-fill" cx="38%" cy="34%" r="65%">
          <stop offset="0%" stopColor="#6b91f7" />
          <stop offset="100%" stopColor="#2f59d4" />
        </radialGradient>

        {/* Satellite fill — neumorphic light surface */}
        <radialGradient id="cv-node-fill" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#f4f7fc" />
          <stop offset="100%" stopColor="#dde1e8" />
        </radialGradient>

        {/* Soft drop shadow for hub */}
        <filter id="cv-hub-shadow" x="-45%" y="-45%" width="190%" height="190%">
          <feDropShadow
            dx="1"
            dy="1.5"
            stdDeviation="1.8"
            floodColor="rgba(55,90,185,0.38)"
          />
        </filter>

        {/* Soft drop shadow for satellite nodes */}
        <filter
          id="cv-node-shadow"
          x="-55%"
          y="-55%"
          width="210%"
          height="210%"
        >
          <feDropShadow
            dx="1"
            dy="1"
            stdDeviation="1.2"
            floodColor="rgba(112,122,148,0.28)"
          />
          <feDropShadow
            dx="-0.5"
            dy="-0.5"
            stdDeviation="0.7"
            floodColor="rgba(255,255,255,0.6)"
          />
        </filter>
      </defs>

      {/* ── Edges ── (drawn first, behind nodes) */}

      {/* hub → top-left */}
      <line
        x1="18"
        y1="21"
        x2="8"
        y2="10"
        stroke="#8a9dc4"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.72"
      />
      {/* hub → top-right */}
      <line
        x1="18"
        y1="21"
        x2="28"
        y2="10"
        stroke="#8a9dc4"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.72"
      />
      {/* top-left ↔ top-right  (peer edge) */}
      <line
        x1="8"
        y1="10"
        x2="28"
        y2="10"
        stroke="#8a9dc4"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* hub → bottom satellite */}
      <line
        x1="18"
        y1="21"
        x2="18"
        y2="31"
        stroke="#8a9dc4"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.45"
      />

      {/* ── Satellite nodes ── */}

      {/* top-left */}
      <circle
        cx="8"
        cy="10"
        r="4"
        fill="url(#cv-node-fill)"
        stroke="rgba(65,109,242,0.38)"
        strokeWidth="0.9"
        filter="url(#cv-node-shadow)"
      />
      {/* top-right */}
      <circle
        cx="28"
        cy="10"
        r="4"
        fill="url(#cv-node-fill)"
        stroke="rgba(65,109,242,0.38)"
        strokeWidth="0.9"
        filter="url(#cv-node-shadow)"
      />
      {/* bottom */}
      <circle
        cx="18"
        cy="31"
        r="3"
        fill="url(#cv-node-fill)"
        stroke="rgba(65,109,242,0.3)"
        strokeWidth="0.9"
        filter="url(#cv-node-shadow)"
      />

      {/* ── Hub (central node) ── */}
      <circle
        cx="18"
        cy="21"
        r="6.5"
        fill="url(#cv-hub-fill)"
        filter="url(#cv-hub-shadow)"
      />
      {/* glass sheen on hub */}
      <ellipse
        cx="16.5"
        cy="18.8"
        rx="3.2"
        ry="2"
        fill="rgba(255,255,255,0.22)"
        transform="rotate(-18 16.5 18.8)"
      />
    </svg>
  );
}
