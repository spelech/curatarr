import React, { useId } from 'react';

interface CuratarrLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  glow?: boolean;
}

export const CuratarrLogo: React.FC<CuratarrLogoProps> = ({
  size = 28,
  className = '',
  glow = false,
  ...props
}) => {
  const idPrefix = useId().replace(/:/g, '');
  const glowGradId = `curatarr-glow-${idPrefix}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${glow ? 'drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]' : ''} ${className}`}
      aria-label="Curatarr Logo"
      {...props}
    >
      <defs>
        <radialGradient id={glowGradId} cx="64%" cy="50%" r="28%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient glow behind curation sparkle */}
      <circle cx="20.5" cy="16" r="7.5" fill={`url(#${glowGradId})`} />

      {/* 35mm Film Cell forming a bold 'C' with precision sprockets */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 6 2.5 L 26 2.5 C 27.93 2.5 29.5 4.07 29.5 6 L 29.5 9.5 C 29.5 10.33 28.83 11 28 11 L 20.5 11 C 17.74 11 15.5 13.24 15.5 16 C 15.5 18.76 17.74 21 20.5 21 L 28 21 C 28.83 21 29.5 21.67 29.5 22.5 L 29.5 26 C 29.5 27.93 27.93 29.5 26 29.5 L 6 29.5 C 4.07 29.5 2.5 27.93 2.5 26 L 2.5 6 C 2.5 4.07 4.07 2.5 6 2.5 Z M 5 4.5 C 4.45 4.5 4 4.95 4 5.5 L 4 7 C 4 7.55 4.45 8 5 8 L 7.5 8 C 8.05 8 8.5 7.55 8.5 7 L 8.5 5.5 C 8.5 4.95 8.05 4.5 7.5 4.5 Z M 5 10 C 4.45 10 4 10.45 4 11 L 4 12.5 C 4 13.05 4.45 13.5 5 13.5 L 7.5 13.5 C 8.05 13.5 8.5 13.05 8.5 12.5 L 8.5 11 C 8.5 10.45 8.05 10 7.5 10 Z M 5 15.5 C 4.45 15.5 4 15.95 4 16.5 L 4 18 C 4 18.55 4.45 19 5 19 L 7.5 19 C 8.05 19 8.5 18.55 8.5 18 L 8.5 16.5 C 8.5 15.95 8.05 15.5 7.5 15.5 Z M 5 21 C 4.45 21 4 21.45 4 22 L 4 23.5 C 4 24.05 4.45 24.5 5 24.5 L 7.5 24.5 C 8.05 24.5 8.5 24.05 8.5 23.5 L 8.5 22 C 8.5 21.45 8.05 21 7.5 21 Z M 5 26.5 C 4.45 26.5 4 26.95 4 27.5 L 4 28 C 4 28.55 4.45 29 5 29 L 7.5 29 C 8.05 29 8.5 28.55 8.5 28 L 8.5 27.5 C 8.5 26.95 8.05 26.5 7.5 26.5 Z M 23.5 4.5 C 22.95 4.5 22.5 4.95 22.5 5.5 L 22.5 7 C 22.5 7.55 22.95 8 23.5 8 L 26 8 C 26.55 8 27 7.55 27 7 L 27 5.5 C 27 4.95 26.55 4.5 26 4.5 Z M 23.5 24 C 22.95 24 22.5 24.45 22.5 25 L 22.5 26.5 C 22.5 27.05 22.95 27.5 23.5 27.5 L 26 27.5 C 26.55 27.5 27 27.05 27 26.5 L 27 25 C 27 24.45 26.55 24 26 24 Z"
        fill="#10b981"
      />

      {/* 4-point Curation Sparkle Star */}
      <path
        d="M 20.5 9.5 Q 20.5 16 27 16 Q 20.5 16 20.5 22.5 Q 20.5 16 14 16 Q 20.5 16 20.5 9.5 Z"
        fill="#a7f3d0"
      />
      <circle cx="20.5" cy="16" r="1.3" fill="#ffffff" />
    </svg>
  );
};
