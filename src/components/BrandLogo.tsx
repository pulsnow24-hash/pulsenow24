import Link from "next/link";

export function PulsIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <path
        d="M14 50 H38 L44 30 L52 70 L58 50 H86"
        stroke={color}
        strokeWidth="4"
        opacity="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function BrandLogo({ gradientId }: { gradientId: string }) {
  return (
    <Link className="brand" href="/">
      <svg
        className="brand-mark"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00C2FF" />
            <stop offset="100%" stopColor="#0B6CD8" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="42" stroke={`url(#${gradientId})`} strokeWidth="4" />
        <path
          d="M14 50 H38 L44 26 L52 74 L58 50 H86"
          stroke={`url(#${gradientId})`}
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <span className="brand-text">PulsNow24</span>
    </Link>
  );
}
