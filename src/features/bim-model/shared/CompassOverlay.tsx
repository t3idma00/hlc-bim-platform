"use client";

export type CompassMarkerPosition = {
  x: number;
  y: number;
};

type CompassOverlayProps = {
  marker?: CompassMarkerPosition | null;
  className?: string;
};

export function CompassOverlay({ marker = null, className = "h-24 w-24" }: CompassOverlayProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 72 72" className={className}>
      <circle
        cx="36"
        cy="36"
        r="22"
        fill="white"
        fillOpacity="0.9"
        stroke="#fda4af"
        strokeWidth="1.5"
      />
      <path d="M36 16 L31 31 L36 28 L41 31 Z" fill="#be123c" />
      <path d="M36 56 L31 41 L36 44 L41 41 Z" fill="#94a3b8" />
      <path d="M56 36 L41 31 L44 36 L41 41 Z" fill="#94a3b8" />
      <path d="M16 36 L31 31 L28 36 L31 41 Z" fill="#94a3b8" />
      <circle cx="36" cy="36" r="3.2" fill="#0f172b" />
      {marker ? (
        <>
          <path
            d={`M36 36 L${marker.x} ${marker.y}`}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <g transform={`translate(${marker.x} ${marker.y})`}>
            <circle r="7.2" fill="rgba(251, 191, 36, 0.2)" />
            <circle r="4.2" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.1" />
            <path d="M0 -9.6 V-6.4" stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M0 9.6 V6.4" stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M-9.6 0 H-6.4" stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M9.6 0 H6.4" stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M-6.8 -6.8 L-4.8 -4.8" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M6.8 -6.8 L4.8 -4.8" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M-6.8 6.8 L-4.8 4.8" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M6.8 6.8 L4.8 4.8" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </>
      ) : null}
      <text x="36" y="8" textAnchor="middle" fontSize="9" fontWeight="700" fill="#be123c">
        N
      </text>
      <text x="65" y="39" textAnchor="middle" fontSize="9" fontWeight="700" fill="#475569">
        E
      </text>
      <text x="36" y="70" textAnchor="middle" fontSize="9" fontWeight="700" fill="#475569">
        S
      </text>
      <text x="7" y="39" textAnchor="middle" fontSize="9" fontWeight="700" fill="#475569">
        W
      </text>
    </svg>
  );
}

export function getCompassMarkerPosition(azimuth: number) {
  const angle = (azimuth * Math.PI) / 180;
  const radius = 22;

  return {
    x: roundToPrecision(36 + Math.sin(angle) * radius),
    y: roundToPrecision(36 - Math.cos(angle) * radius),
  };
}

function roundToPrecision(value: number) {
  return Math.round(value * 100) / 100;
}
