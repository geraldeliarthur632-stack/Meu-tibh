import React, { useEffect, useState } from 'react';
import { Lightbulb, X } from 'lucide-react';
import { motion } from 'motion/react';
import { FirstClickOptionTip, subscribeFirstClickTips } from '../lib/firstClickCoach';

export const FirstClickTipBanner: React.FC = () => {
  const [activeTip, setActiveTip] = useState<FirstClickOptionTip | null>(null);

  useEffect(() => {
    const unsub = subscribeFirstClickTips((tip) => {
      setActiveTip(tip);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!activeTip) return;
    const timer = window.setTimeout(() => {
      setActiveTip((curr) => (curr?.key === activeTip.key ? null : curr));
    }, 9500);
    return () => window.clearTimeout(timer);
  }, [activeTip]);

  if (!activeTip) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-16 left-4 z-50 w-[min(370px,calc(100vw-2rem))] md:bottom-5"
    >
      <motion.div
        key={activeTip.key}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-emerald-700">
                1ª vez nesta opção
              </p>
              <h4 className="font-display text-sm font-extrabold text-slate-900">
                {activeTip.title}
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {activeTip.summary}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTip(null)}
            aria-label="Fechar explicação da opção"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => setActiveTip(null)}
            className="btn-studio min-h-[34px] rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-3.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
          >
            Entendi
          </button>
        </div>
      </motion.div>
    </div>
  );
};
