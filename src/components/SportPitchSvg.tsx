import React from 'react';
import { SportId } from '../types/studio';

export const SportPitchSvg: React.FC<{ sport: SportId }> = ({ sport }) => {
  if (sport === 'futebol') {
    return (
      <svg
        viewBox="0 0 100 140"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {/* Vibrant manicured grass field with alternating mowed turf stripes */}
        <defs>
          <pattern id="grassStripes" width="100" height="20" patternUnits="userSpaceOnUse">
            <rect width="100" height="10" fill="#15803D" />
            <rect y="10" width="100" height="10" fill="#16A34A" />
          </pattern>
        </defs>
        <rect width="100" height="140" fill="url(#grassStripes)" />

        {/* Outer touchline & goal lines */}
        <rect
          x="5"
          y="5"
          width="90"
          height="130"
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="0.7"
        />

        {/* Corner arcs */}
        <path d="M 5 8.5 A 3.5 3.5 0 0 0 8.5 5" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.6" />
        <path d="M 91.5 5 A 3.5 3.5 0 0 0 95 8.5" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.6" />
        <path d="M 5 131.5 A 3.5 3.5 0 0 1 8.5 135" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.6" />
        <path d="M 91.5 135 A 3.5 3.5 0 0 1 95 131.5" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.6" />

        {/* Halfway line & center circle */}
        <line x1="5" y1="70" x2="95" y2="70" stroke="rgba(255,255,255,0.9)" strokeWidth="0.7" />
        <circle cx="50" cy="70" r="13" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="0.7" />
        <circle cx="50" cy="70" r="1.1" fill="#FFFFFF" />

        {/* Top Goal + Penalty Box + 6-yard Box + Penalty Spot + Penalty Arc */}
        <rect x="42" y="2.5" width="16" height="2.5" fill="rgba(255,255,255,0.18)" stroke="#FFFFFF" strokeWidth="0.6" />
        <rect x="23" y="5" width="54" height="21" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="0.7" />
        <rect x="37" y="5" width="26" height="8" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.6" />
        <circle cx="50" cy="18.5" r="0.9" fill="#FFFFFF" />
        <path d="M 38 26 A 14 14 0 0 0 62 26" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="0.7" />

        {/* Bottom Goal + Penalty Box + 6-yard Box + Penalty Spot + Penalty Arc */}
        <rect x="42" y="135" width="16" height="2.5" fill="rgba(255,255,255,0.18)" stroke="#FFFFFF" strokeWidth="0.6" />
        <rect x="23" y="114" width="54" height="21" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="0.7" />
        <rect x="37" y="127" width="26" height="8" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.6" />
        <circle cx="50" cy="121.5" r="0.9" fill="#FFFFFF" />
        <path d="M 38 114 A 14 14 0 0 1 62 114" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="0.7" />
      </svg>
    );
  }

  if (sport === 'futsal') {
    return (
      <svg
        viewBox="0 0 100 140"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {/* Indoor Futsal Court: Warm maple apron + crisp Tournament Royal-Blue playing surface */}
        <rect width="100" height="140" fill="#E9CBA0" />
        <rect x="6" y="6" width="88" height="128" fill="#1D4ED8" stroke="#FFFFFF" strokeWidth="0.9" />

        {/* Subtle indoor court sheen bands */}
        <rect x="6" y="6" width="88" height="64" fill="rgba(255,255,255,0.03)" />

        {/* Halfway line & center circle */}
        <line x1="6" y1="70" x2="94" y2="70" stroke="#FFFFFF" strokeWidth="0.85" />
        <circle cx="50" cy="70" r="10.5" fill="none" stroke="#FFFFFF" strokeWidth="0.85" />
        <circle cx="50" cy="70" r="1.2" fill="#FFFFFF" />

        {/* Substitution Zone Hash Marks on right touchline */}
        <line x1="92" y1="56" x2="96" y2="56" stroke="#FFFFFF" strokeWidth="0.8" />
        <line x1="92" y1="67" x2="96" y2="67" stroke="#FFFFFF" strokeWidth="0.8" />
        <line x1="92" y1="73" x2="96" y2="73" stroke="#FFFFFF" strokeWidth="0.8" />
        <line x1="92" y1="84" x2="96" y2="84" stroke="#FFFFFF" strokeWidth="0.8" />

        {/* Corner Quarter Circles */}
        <path d="M 6 9 A 3 3 0 0 0 9 6" fill="none" stroke="#FFFFFF" strokeWidth="0.7" />
        <path d="M 91 6 A 3 3 0 0 0 94 9" fill="none" stroke="#FFFFFF" strokeWidth="0.7" />
        <path d="M 6 131 A 3 3 0 0 1 9 134" fill="none" stroke="#FFFFFF" strokeWidth="0.7" />
        <path d="M 91 134 A 3 3 0 0 1 94 131" fill="none" stroke="#FFFFFF" strokeWidth="0.7" />

        {/* Top Futsal D-Arc (6m Semicircular Penalty Area) + 6m & 10m Spots + Goal */}
        <rect x="43" y="3" width="14" height="3" fill="rgba(255,255,255,0.28)" stroke="#FFFFFF" strokeWidth="0.7" />
        <path
          d="M 27 6 A 23 19 0 0 0 73 6 Z"
          fill="rgba(15,23,42,0.16)"
          stroke="#FFFFFF"
          strokeWidth="0.9"
        />
        <circle cx="50" cy="19" r="1.0" fill="#FFFFFF" />
        <circle cx="50" cy="30" r="0.9" fill="#FDE047" />

        {/* Bottom Futsal D-Arc (6m Semicircular Penalty Area) + 6m & 10m Spots + Goal */}
        <rect x="43" y="134" width="14" height="3" fill="rgba(255,255,255,0.28)" stroke="#FFFFFF" strokeWidth="0.7" />
        <path
          d="M 27 134 A 23 19 0 0 1 73 134 Z"
          fill="rgba(15,23,42,0.16)"
          stroke="#FFFFFF"
          strokeWidth="0.9"
        />
        <circle cx="50" cy="121" r="1.0" fill="#FFFFFF" />
        <circle cx="50" cy="110" r="0.9" fill="#FDE047" />
      </svg>
    );
  }

  if (sport === 'basquete') {
    return (
      <svg
        viewBox="0 0 100 140"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {/* Maple hardwood basketball court */}
        <defs>
          <pattern id="parquet" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#F1D4A6" />
            <rect width="10" height="20" fill="#ECC993" />
          </pattern>
        </defs>
        <rect width="100" height="140" fill="url(#parquet)" />
        <rect x="5" y="5" width="90" height="130" fill="none" stroke="#0F172A" strokeWidth="0.9" />
        <line x1="5" y1="70" x2="95" y2="70" stroke="#0F172A" strokeWidth="0.8" />
        <circle cx="50" cy="70" r="11" fill="#0F766E" fillOpacity="0.18" stroke="#0F172A" strokeWidth="0.8" />

        {/* Top key, free throw circle & 3pt arc */}
        <rect x="36" y="5" width="28" height="26" fill="#0F766E" fillOpacity="0.85" stroke="#FFFFFF" strokeWidth="0.7" />
        <circle cx="50" cy="31" r="9.5" fill="none" stroke="#0F172A" strokeWidth="0.7" />
        <path d="M 13 5 V 22 A 39 36 0 0 0 87 22 V 5" fill="none" stroke="#0F172A" strokeWidth="0.85" />
        <line x1="43" y1="9" x2="57" y2="9" stroke="#FFFFFF" strokeWidth="1" />
        <circle cx="50" cy="11.5" r="2" fill="none" stroke="#EA580C" strokeWidth="0.9" />

        {/* Bottom key, free throw circle & 3pt arc */}
        <rect x="36" y="109" width="28" height="26" fill="#0F766E" fillOpacity="0.85" stroke="#FFFFFF" strokeWidth="0.7" />
        <circle cx="50" cy="109" r="9.5" fill="none" stroke="#0F172A" strokeWidth="0.7" />
        <path d="M 13 135 V 118 A 39 36 0 0 1 87 118 V 135" fill="none" stroke="#0F172A" strokeWidth="0.85" />
        <line x1="43" y1="131" x2="57" y2="131" stroke="#FFFFFF" strokeWidth="1" />
        <circle cx="50" cy="128.5" r="2" fill="none" stroke="#EA580C" strokeWidth="0.9" />
      </svg>
    );
  }

  // Vôlei
  return (
    <svg
      viewBox="0 0 100 140"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {/* Indoor Volleyball Court: Sky apron + warm court interior */}
      <rect width="100" height="140" fill="#BAE6FD" />
      <rect x="8" y="8" width="84" height="124" fill="#FDE68A" stroke="#FFFFFF" strokeWidth="1" />
      {/* Front attack zones */}
      <rect x="8" y="48" width="84" height="44" fill="#F59E0B" fillOpacity="0.22" />
      {/* Attack lines (3m) */}
      <line x1="8" y1="48" x2="92" y2="48" stroke="#FFFFFF" strokeWidth="0.85" />
      <line x1="8" y1="92" x2="92" y2="92" stroke="#FFFFFF" strokeWidth="0.85" />
      {/* Net line + antennas */}
      <line x1="4" y1="70" x2="96" y2="70" stroke="#0F172A" strokeWidth="1.5" strokeDasharray="2.5 1.5" />
      <circle cx="8" cy="70" r="1.5" fill="#DC2626" />
      <circle cx="92" cy="70" r="1.5" fill="#DC2626" />
    </svg>
  );
};
