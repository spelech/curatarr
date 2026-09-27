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
  const primaryGradId = `curatarr-grad-primary-${idPrefix}`;
  const hubGradId = `curatarr-hub-grad-${idPrefix}`;

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
        <linearGradient id={primaryGradId} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="60%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <radialGradient id={hubGradId} cx="16" cy="16" r="4.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="60%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </radialGradient>
      </defs>

      {/* Bold Monogram 'C' Outer Film Reel Track */}
      <path
        d="M 23.5 8.5 A 11.5 11.5 0 1 0 23.5 23.5"
        stroke={`url(#${primaryGradId})`}
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Central Film Spool Hub with Axle Spindle */}
      <circle cx="16" cy="16" r="4.5" fill={`url(#${hubGradId})`} />
      <circle cx="16" cy="16" r="2.2" fill="#040705" />

      {/* 3 Bold Structural Radial Spokes connecting Hub to C-Track */}
      {/* Upper Spoke */}
      <line
        x1="12.8"
        y1="12.8"
        x2="7.5"
        y2="7.5"
        stroke={`url(#${primaryGradId})`}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      {/* Middle Horizontal Spoke */}
      <line
        x1="11.5"
        y1="16"
        x2="5.2"
        y2="16"
        stroke={`url(#${primaryGradId})`}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      {/* Lower Spoke */}
      <line
        x1="12.8"
        y1="19.2"
        x2="7.5"
        y2="24.5"
        stroke={`url(#${primaryGradId})`}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
};
