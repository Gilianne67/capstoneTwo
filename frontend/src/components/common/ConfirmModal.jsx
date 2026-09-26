import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  description = 'Are you sure you want to proceed with this action?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card-bg border border-slate-200/80 rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${isDanger ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-primary'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="text-base font-extrabold text-app-text">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-text-muted hover:text-app-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-text-muted leading-relaxed">
          {description}
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-app-text hover:bg-slate-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow-sm transition-all active:scale-95 ${
              isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary hover:bg-blue-700'
            }`}
          >
            {confirmText}
          </button>
        </div>

      </div>
    </div>
  );
}

export default ConfirmModal;