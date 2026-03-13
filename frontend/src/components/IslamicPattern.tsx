export function EightPointedStar({ size = 24, color = "#C9A84C", className = "" }: {
  size?: number;
  color?: string;
  className?: string;
}) {
  const s = size / 2;
  const r1 = s * 0.95;
  const r2 = s * 0.42;
  const points = Array.from({ length: 16 }, (_, i) => {
    const angle = (i * Math.PI) / 8 - Math.PI / 2;
    const r = i % 2 === 0 ? r1 : r2;
    return `${s + r * Math.cos(angle)},${s + r * Math.sin(angle)}`;
  }).join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden
    >
      <polygon points={points} fill={color} />
    </svg>
  );
}

export function GeometricDivider({ label }: { label?: string }) {
  return (
    <div className="star-divider text-xs font-semibold tracking-widest text-[#C9A84C] my-2">
      <EightPointedStar size={14} />
      {label && <span>{label}</span>}
      <EightPointedStar size={14} />
    </div>
  );
}

export function SidebarPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="girih" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          {/* Outer hexagon */}
          <polygon points="40,4 72,22 72,58 40,76 8,58 8,22"
            fill="none" stroke="white" strokeWidth="0.8" />
          {/* Inner hexagon */}
          <polygon points="40,16 62,28 62,52 40,64 18,52 18,28"
            fill="none" stroke="white" strokeWidth="0.8" />
          {/* Spokes */}
          <line x1="40" y1="4"  x2="40" y2="16" stroke="white" strokeWidth="0.8" />
          <line x1="72" y1="22" x2="62" y2="28" stroke="white" strokeWidth="0.8" />
          <line x1="72" y1="58" x2="62" y2="52" stroke="white" strokeWidth="0.8" />
          <line x1="40" y1="76" x2="40" y2="64" stroke="white" strokeWidth="0.8" />
          <line x1="8"  y1="58" x2="18" y2="52" stroke="white" strokeWidth="0.8" />
          <line x1="8"  y1="22" x2="18" y2="28" stroke="white" strokeWidth="0.8" />
          {/* Center 8-pointed star */}
          <polygon
            points="40,22 43,31 52,28 45,35 52,42 43,39 40,48 37,39 28,42 35,35 28,28 37,31"
            fill="none" stroke="white" strokeWidth="0.8"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#girih)" />
    </svg>
  );
}
