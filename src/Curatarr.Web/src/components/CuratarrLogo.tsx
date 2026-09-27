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
      </defs>

      {/* Projector Body Base Chassis */}
      <rect x="5" y="19" width="16" height="9" rx="2" fill={`url(#${primaryGradId})`} />

      {/* Projector Spool Drive Hub */}
      <circle cx="10" cy="23.5" r="1.5" fill="#040705" />

      {/* Projector Optical Lens Assembly */}
      <path d="M 21 21 L 27 18.5 L 27 28.5 L 21 26 Z" fill="#34d399" />

      {/* Projected Light Beam Cone */}
      <path d="M 28 20.5 L 31.5 19 L 31.5 28 L 28 26.5 Z" fill="#6ee7b7" opacity="0.65" />

      {/* Top Reel: Monogram 'C' Film Spool */}
      <path
        d="M 18 6 A 7 7 0 1 0 18 16"
        stroke={`url(#${primaryGradId})`}
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* 2 Radial Reel Spokes in 'C' Spool */}
      <line x1="12" y1="11" x2="7" y2="8" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="11" x2="7" y2="14" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />

      {/* Spool Center Axle Spindle */}
      <circle cx="12" cy="11" r="2.2" fill="#040705" stroke="#34d399" strokeWidth="1.2" />

      {/* Film Threading Down from C Reel into Projector Gate */}
      <path d="M 18 16 L 18 19" stroke="#a7f3d0" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};
