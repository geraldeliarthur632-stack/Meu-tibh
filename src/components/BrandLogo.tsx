import React, { useId } from 'react';

interface BrandLogoProps {
  sizeClass?: string;
  withWordmark?: boolean;
  wordmarkClass?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  sizeClass = 'h-9 w-9',
  withWordmark = false,
  wordmarkClass = 'font-display text-2xl font-extrabold tracking-tight text-slate-900',
}) => {
  const uid = useId().replace(/:/g, '');
  const bgId = `mtLogoBg_${uid}`;
  const shieldId = `mtLogoShield_${uid}`;

  return (
    <span className="inline-flex items-center gap-2.5 shrink-0">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        aria-hidden="true"
        className={`${sizeClass} shrink-0 rounded-xl shadow-xs`}
      >
        <defs>
          <linearGradient id={bgId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="55%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id={shieldId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#065F46" />
            <stop offset="100%" stopColor="#064E3B" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="512" height="512" rx="116" fill={`url(#${bgId})`} />
        <path
          d="M0 116 C0 52 52 0 116 0 H396 C460 0 512 52 512 116 V220 C380 265 132 265 0 220 Z"
          fill="#FFFFFF"
          fillOpacity="0.18"
        />
        <path
          d="M256 76 L404 130 V248 C404 338 338 406 256 436 C174 406 108 338 108 248 V130 Z"
          fill={`url(#${shieldId})`}
          stroke="#FFFFFF"
          strokeWidth="22"
          strokeLinejoin="round"
        />
        <circle
          cx="256"
          cy="248"
          r="76"
          fill="none"
          stroke="#34D399"
          strokeOpacity="0.3"
          strokeWidth="6"
        />
        <line
          x1="126"
          y1="248"
          x2="386"
          y2="248"
          stroke="#34D399"
          strokeOpacity="0.24"
          strokeWidth="5"
        />
        <path
          d="M174 304 V190 L256 268 L338 190 V304"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="34"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="256" cy="342" r="20" fill="#FBBF24" stroke="#FFFFFF" strokeWidth="6" />
      </svg>
      {withWordmark && (
        <span className={`${wordmarkClass} whitespace-nowrap`}>Meu Time</span>
      )}
    </span>
  );
};
