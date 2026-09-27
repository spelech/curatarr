import React from 'react';

interface CuratarrLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  glow?: boolean;
}

export const CuratarrLogo: React.FC<CuratarrLogoProps> = ({
  size = 24,
  className = '',
  glow = false,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${glow ? 'drop-shadow-[0_0_10px_rgba(16,185,129,0.55)]' : ''} ${className}`}
      aria-label="Curatarr Logo"
      {...props}
    >
      <defs>
        <linearGradient id="curatarr-grad-primary" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="curatarr-grad-accent" x1="8" y1="8" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <radialGradient id="curatarr-hub-glow" cx="16" cy="16" r="6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="70%" stopColor="#059669" />
          <stop offset="100%" stopColor="#022c22" />
        </radialGradient>
      </defs>

      {/* Outer Monogram 'C' Film Reel Track */}
      <path
        d="M 23.5 8.2 A 11.5 11.5 0 1 0 23.5 23.8"
        stroke="url(#curatarr-grad-primary)"
        strokeWidth="3.6"
        strokeLinecap="round"
      />

      {/* Inner Concentric Reel Guide Track */}
      <path
        d="M 20.8 10.5 A 7.8 7.8 0 1 0 20.8 21.5"
        stroke="url(#curatarr-grad-accent)"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="2 2.5"
        opacity="0.85"
      />

      {/* Central Film Spool Hub */}
      <circle cx="16" cy="16" r="4.2" fill="url(#curatarr-hub-glow)" stroke="#34d399" strokeWidth="0.8" />
      <circle cx="16" cy="16" r="1.6" fill="#040705" />

      {/* 3 Radial Reel Spokes in the 'C' cavity */}
      {/* Upper-Left Spoke */}
      <line
        x1="13.2"
        y1="13.2"
        x2="9.0"
        y2="9.0"
        stroke="url(#curatarr-grad-primary)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Direct-Left Spoke */}
      <line
        x1="11.8"
        y1="16"
        x2="6.2"
        y2="16"
        stroke="url(#curatarr-grad-primary)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Lower-Left Spoke */}
      <line
        x1="13.2"
        y1="18.8"
        x2="9.0"
        y2="23.0"
        stroke="url(#curatarr-grad-primary)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Film Sprocket Perforation Accents along outer rim */}
      <circle cx="16" cy="4.5" r="0.9" fill="#040705" />
      <circle cx="8" cy="8" r="0.9" fill="#040705" />
      <circle cx="4.5" cy="16" r="0.9" fill="#040705" />
      <circle cx="8" cy="24" r="0.9" fill="#040705" />
      <circle cx="16" cy="27.5" r="0.9" fill="#040705" />
    </svg>
  );
};
