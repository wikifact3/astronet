export function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 520 420"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Connected home with fiber network"
      className="w-full max-w-xl"
    >
      {/* Soft backdrop */}
      <defs>
        <linearGradient id="hero-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#eff6ff" />
        </linearGradient>
        <linearGradient id="tower-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <circle cx="260" cy="210" r="200" fill="url(#hero-grad)" />

      {/* Signal waves */}
      <g stroke="#60a5fa" strokeWidth="1.5" fill="none" opacity="0.6">
        <circle cx="260" cy="160" r="70" />
        <circle cx="260" cy="160" r="120" opacity="0.5" />
        <circle cx="260" cy="160" r="170" opacity="0.25" />
      </g>

      {/* Tower */}
      <path
        d="M260 130 L240 340 L280 340 Z"
        fill="url(#tower-grad)"
      />
      <circle cx="260" cy="120" r="8" fill="#2563eb" />
      <circle cx="260" cy="120" r="14" fill="none" stroke="#2563eb" strokeWidth="1.5" opacity="0.5" />

      {/* Connected home */}
      <g transform="translate(60 230)">
        <path d="M0 40 L50 0 L100 40 L100 100 L0 100 Z" fill="#1e40af" />
        <path d="M0 40 L50 0 L100 40" stroke="#2563eb" strokeWidth="3" fill="none" />
        <rect x="30" y="55" width="15" height="15" fill="#93c5fd" />
        <rect x="55" y="55" width="15" height="15" fill="#93c5fd" />
        <rect x="40" y="78" width="20" height="22" fill="#93c5fd" />
      </g>

      {/* Connected home 2 */}
      <g transform="translate(360 250)">
        <path d="M0 40 L50 0 L100 40 L100 90 L0 90 Z" fill="#1e40af" />
        <path d="M0 40 L50 0 L100 40" stroke="#2563eb" strokeWidth="3" fill="none" />
        <rect x="30" y="55" width="15" height="15" fill="#93c5fd" />
        <rect x="55" y="55" width="15" height="15" fill="#93c5fd" />
      </g>

      {/* Fiber links */}
      <path
        d="M160 270 Q210 250 250 200"
        stroke="#2563eb"
        strokeWidth="2"
        strokeDasharray="4 4"
        fill="none"
      />
      <path
        d="M410 290 Q370 260 270 200"
        stroke="#2563eb"
        strokeWidth="2"
        strokeDasharray="4 4"
        fill="none"
      />

      {/* Device dots */}
      <circle cx="160" cy="270" r="4" fill="#2563eb" />
      <circle cx="410" cy="290" r="4" fill="#2563eb" />

      {/* Bottom ground */}
      <path d="M0 400 Q260 380 520 400" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
