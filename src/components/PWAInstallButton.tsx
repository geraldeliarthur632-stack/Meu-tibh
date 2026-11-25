import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Monitor,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { BrandLogo } from './BrandLogo';

type PlatformGuideTab = 'pc' | 'android' | 'ios';

interface PWAInstallButtonProps {
  compact?: boolean;
  variant?: 'default' | 'primary';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  variant = 'default',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  const detectedPlatform: PlatformGuideTab = useMemo(() => {
    if (isIOS) return 'ios';
    if (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)) {
      return 'android';
    }
    return 'pc';
  }, [isIOS]);

  const [guideTab, setGuideTab] = useState<PlatformGuideTab>(detectedPlatform);

  if (isInstalled) {
    return null;
  }

  const openModal = () => {
    setGuideTab(detectedPlatform);
    setShowGuideModal(true);
  };

  const buttonClasses =
    variant === 'primary'
      ? 'btn-studio inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 whitespace-nowrap shrink-0 cursor-pointer'
      : 'btn-studio inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-emerald-600/30 border-b-[3px] border-b-emerald-600/40 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap shrink-0 cursor-pointer';

  const platformTabs: { id: PlatformGuideTab; label: string; icon: React.ReactNode }[] = [
    { id: 'pc', label: 'PC', icon: <Monitor className="h-4 w-4" /> },
    { id: 'android', label: 'Android', icon: <Smartphone className="h-4 w-4" /> },
    { id: 'ios', label: 'iOS', icon: <Share className="h-4 w-4" /> },
  ];

  return (
    <>
      <button type="button" onClick={openModal} className={buttonClasses}>
        <Download
          className={`h-4 w-4 shrink-0 ${variant === 'primary' ? 'text-white' : 'text-emerald-600'}`}
        />
        <span>{compact ? 'Instalar' : 'Instalar App'}</span>
      </button>

      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[#F6F8FB] px-6 py-4">
              <div className="flex items-center gap-3.5">
                <BrandLogo sizeClass="h-11 w-11" />
                <div>
                  <h2
                    id="pwa-install-title"
                    className="font-display text-xl font-extrabold text-slate-900"
                  >
                    Instalar Meu Time
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tutorial completo para instalar no PC, Android e iOS
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Fechar tutorial de instalação"
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200/70 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {isInstallable && (
                <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-xs font-extrabold text-emerald-900">
                        Instalação direta disponível
                      </p>
                      <p className="mt-0.5 text-xs text-emerald-700">
                        Seu navegador permite instalar o Meu Time com 1 clique.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await install();
                      if (ok) setShowGuideModal(false);
                    }}
                    className="btn-studio inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Instalar Agora</span>
                  </button>
                </div>
              )}

              {/* Platform Switcher */}
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-100/80 p-1">
                {platformTabs.map((tab) => {
                  const active = guideTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setGuideTab(tab.id)}
                      className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {guideTab === 'pc' && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-sm font-extrabold text-slate-900">
                    Como instalar no Computador (Chrome ou Edge)
                  </p>
                  <ol className="space-y-2.5 text-xs leading-relaxed text-slate-600">
                    <li>
                      <strong className="text-slate-900">1.</strong> No Google Chrome ou Microsoft Edge, procure o ícone de{' '}
                      <strong className="text-emerald-700">Instalar aplicativo</strong> no canto direito da barra de endereço.
                    </li>
                    <li>
                      <strong className="text-slate-900">2.</strong> Se não aparecer o ícone, clique no menu{' '}
                      <strong className="text-slate-900">⋮ / ⋯</strong> (canto superior direito) →{' '}
                      <strong className="text-slate-900">Transmitir, salvar e compartilhar</strong> (ou{' '}
                      <strong className="text-slate-900">Aplicativos</strong>) →{' '}
                      <strong className="text-emerald-700">Instalar Meu Time</strong>.
                    </li>
                    <li>
                      <strong className="text-slate-900">3.</strong> Clique em <strong className="text-slate-900">Instalar</strong> na janela de confirmação. O atalho irá direto para sua Área de Trabalho.
                    </li>
                  </ol>
                </div>
              )}

              {guideTab === 'android' && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-sm font-extrabold text-slate-900">
                    Como instalar no Android (Chrome)
                  </p>
                  <ol className="space-y-2.5 text-xs leading-relaxed text-slate-600">
                    <li>
                      <strong className="text-slate-900">1.</strong> Abra o Meu Time no{' '}
                      <strong className="text-slate-900">Google Chrome</strong>.
                    </li>
                    <li>
                      <strong className="text-slate-900">2.</strong> Toque no menu{' '}
                      <strong className="text-slate-900">⋮</strong> (três pontinhos no canto superior direito) e escolha{' '}
                      <strong className="text-emerald-700">Instalar aplicativo</strong> ou{' '}
                      <strong className="text-emerald-700">Adicionar à tela inicial</strong>.
                    </li>
                    <li>
                      <strong className="text-slate-900">3.</strong> Toque em <strong className="text-slate-900">Instalar</strong>. O aplicativo com o escudo do Meu Time aparecerá na sua tela de apps e suportará notificações push.
                    </li>
                  </ol>
                </div>
              )}

              {guideTab === 'ios' && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-sm font-extrabold text-slate-900">
                    Como instalar no iPhone ou iPad (iOS · Safari)
                  </p>
                  <ol className="space-y-2.5 text-xs leading-relaxed text-slate-600">
                    <li>
                      <strong className="text-slate-900">1.</strong> Abra o Meu Time no navegador{' '}
                      <strong className="text-slate-900">Safari</strong> e toque no botão{' '}
                      <strong className="text-emerald-700">Compartilhar</strong> (quadrado com seta para cima na barra inferior).
                    </li>
                    <li>
                      <strong className="text-slate-900">2.</strong> Role a lista para baixo e toque em{' '}
                      <strong className="text-emerald-700">Adicionar à Tela de Início</strong>.
                    </li>
                    <li>
                      <strong className="text-slate-900">3.</strong> Toque em <strong className="text-slate-900">Adicionar</strong> no topo direito para abrir o Meu Time em tela cheia na tela inicial.
                    </li>
                  </ol>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="btn-studio min-h-[42px] w-full rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-slate-50 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Fechar Tutorial
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};
