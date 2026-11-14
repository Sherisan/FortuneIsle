/** Polly the parrot, the island's guide (an SVG portrait for the speech bubble). */
export function PollyFace({ size = 64 }: { size?: number }) {
  return (
    <svg className="polly-face" width={size} height={size} viewBox="0 0 64 64" aria-label="Polly the parrot">
      <g stroke="#2c1d3f" strokeWidth="3" strokeLinejoin="round">
        <path d="M18 50 L8 62 L22 58 Z" fill="#3e8ef7" />
        <path d="M24 52 L20 63 L30 58 Z" fill="#ffd23f" />
        <ellipse cx="30" cy="40" rx="17" ry="18" fill="#ff3b4e" />
        <path d="M16 36 Q6 44 14 54 Q24 52 26 42 Z" fill="#2fc36f" />
        <circle cx="34" cy="22" r="15" fill="#ff3b4e" />
        <ellipse cx="40" cy="20" rx="7" ry="8" fill="#fff" />
        <path d="M46 22 Q60 24 52 36 Q46 30 44 28 Z" fill="#ffe27a" />
      </g>
      <circle cx="41" cy="20" r="3.4" fill="#2c1d3f" />
      <circle cx="42" cy="18.6" r="1.2" fill="#fff" />
      <ellipse cx="27" cy="14" rx="5" ry="3" fill="#fff" opacity=".45" />
      <path d="M30 8 Q26 0 34 2 M34 8 Q36 -1 40 4" stroke="#ffd23f" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}
