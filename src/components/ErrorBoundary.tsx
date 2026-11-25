import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message;
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed && parsed.error) {
        readable = parsed.error.includes('Missing or insufficient permissions')
          ? 'Permissão negada no banco de dados. Verifique se seu e-mail foi confirmado ou se você faz parte deste time.'
          : parsed.error;
      }
    } catch {
      // keep raw message
    }
    return { hasError: true, message: readable };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-6 text-slate-900">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Interrupção no Estúdio
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {this.state.message || 'Ocorreu um erro inesperado ao sincronizar com o banco em tempo real.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-studio mt-6 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Recarregar aplicativo</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
