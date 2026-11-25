import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { STUDIO_IMAGES } from '../types/studio';

interface TeamCrestProps {
  photoUrl?: string;
  teamName: string;
  sizeClass?: string;
}

export const TeamCrest: React.FC<TeamCrestProps> = ({
  photoUrl,
  teamName,
  sizeClass = 'h-11 w-11',
}) => {
  const [failed, setFailed] = useState(false);
  const src = !failed ? photoUrl || STUDIO_IMAGES.defaultCrest : '';

  if (!src || failed) {
    return (
      <div
        aria-label={`Escudo de ${teamName}`}
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700`}
      >
        <Shield className="h-1/2 w-1/2" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Escudo do time ${teamName}`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} shrink-0 rounded-xl border border-slate-200 bg-slate-100 object-cover shadow-xs`}
    />
  );
};
