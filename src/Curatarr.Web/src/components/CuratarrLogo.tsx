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
        <linearGradient id={primaryGradId} x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
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

      {/* Outer Reel Flange Rim */}
      <circle cx="16" cy="16" r="14" stroke={`url(#${primaryGradId})`} strokeWidth="2.5" />

      {/* Inner Concentric Film Guide Track */}
      <circle
        cx="16"
        cy="16"
        r="11.5"
        stroke="#059669"
        strokeWidth="1"
        strokeDasharray="2 2"
        opacity="0.6"
      />

      {/* 5 Classic Hollywood Reel Spokes */}
      {/* 1. Straight Up */}
      <line
        x1="16"
        y1="16"
        x2="16"
        y2="3"
        stroke={`url(#${primaryGradId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* 2. Top-Right */}
      <line
        x1="16"
        y1="16"
        x2="28.4"
        y2="12"
        stroke={`url(#${primaryGradId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* 3. Bottom-Right */}
      <line
        x1="16"
        y1="16"
        x2="23.6"
        y2="26.8"
        stroke={`url(#${primaryGradId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* 4. Bottom-Left */}
      <line
        x1="16"
        y1="16"
        x2="8.4"
        y2="26.8"
        stroke={`url(#${primaryGradId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* 5. Top-Left */}
      <line
        x1="16"
        y1="16"
        x2="3.6"
        y2="12"
        stroke={`url(#${primaryGradId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Central Film Spool Hub & Projector Spindle */}
      <circle cx="16" cy="16" r="4.5" fill={`url(#${hubGradId})`} />
      <circle cx="16" cy="16" r="2" fill="#040705" />
    </svg>
  );
};
