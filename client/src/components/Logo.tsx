export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4338ca" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="20" fill="url(#logo-bg)" />
      <rect x="15" y="62" width="20" height="23" rx="4" fill="white" opacity="0.5" />
      <rect x="40" y="47" width="20" height="38" rx="4" fill="white" opacity="0.75" />
      <rect x="65" y="30" width="20" height="55" rx="4" fill="white" />
    </svg>
  );
}
