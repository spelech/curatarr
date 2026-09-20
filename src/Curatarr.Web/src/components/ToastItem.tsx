import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';
import { Toast } from '../stores/useToastStore';

export interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

export const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const [isActionLoading, setIsActionLoading] = useState(false);

  const renderIcon = () => {
    switch (toast.type) {
      case 'info':
        if (toast.title.toLowerCase().includes('pruning') || toast.title.endsWith('...')) {
          return <Loader2 className="w-5 h-5 text-sky-400 animate-spin flex-shrink-0" data-testid="toast-icon-loader" />;
        }
        return <Info className="w-5 h-5 text-sky-400 flex-shrink-0" data-testid="toast-icon-info" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" data-testid="toast-icon-success" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" data-testid="toast-icon-warning" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" data-testid="toast-icon-error" />;
    }
  };

  const handleActionClick = async () => {
    if (!toast.action || isActionLoading) return;
    setIsActionLoading(true);
    try {
      await toast.action.onClick();
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div
      role="status"
      className="bg-slate-900/95 border border-slate-800 text-slate-100 rounded-xl p-4 shadow-2xl backdrop-blur-md transition-all duration-200 pointer-events-auto w-full"
    >
      <div className="flex items-start gap-3">
        {renderIcon()}

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white leading-tight">{toast.title}</h4>
          {toast.message && (
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{toast.message}</p>
          )}

          {/* Manual steps checklist */}
          {toast.manualSteps && toast.manualSteps.length > 0 && (
            <div className="mt-2.5 p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg">
              <ul className="space-y-1.5 text-xs text-slate-300">
                {toast.manualSteps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action button */}
          {toast.action && (
            <div className="mt-3 flex items-center justify-end">
              <button
                type="button"
                onClick={handleActionClick}
                disabled={isActionLoading}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium shadow transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${
                  toast.type === 'warning'
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40'
                    : 'bg-sky-600 hover:bg-sky-500 text-white'
                }`}
              >
                {isActionLoading && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" data-testid="action-spinner" />
                )}
                <span>{toast.action.label}</span>
              </button>
            </div>
          )}
        </div>

        {/* Dismiss 'X' button (min-w-[24px] min-h-[24px] for touch/click ergonomics) */}
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition min-w-[24px] min-h-[24px] flex items-center justify-center flex-shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
