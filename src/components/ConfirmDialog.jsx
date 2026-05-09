import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';

// Promise-based confirm dialog. Replaces window.confirm() with a styled,
// non-blocking modal that reads the same way (boolean from a Promise) so
// existing handlers can swap one line:
//   if (!confirm('Delete this?')) return;
// becomes
//   if (!(await confirm({ title: 'Delete this?' }))) return;
//
// Mount <ConfirmDialogProvider> once at the app root. Call useConfirm()
// inside any component to grab the function.

const ConfirmContext = createContext(null);

export const useConfirm = () => {
    const ctx = useContext(ConfirmContext);
    if (!ctx) {
        throw new Error('useConfirm must be used within a ConfirmDialogProvider');
    }
    return ctx;
};

export const ConfirmDialogProvider = ({ children }) => {
    const [state, setState] = useState(null); // { title, body, confirmLabel, cancelLabel, destructive, resolve }

    const confirm = useCallback((opts = {}) => {
        return new Promise((resolve) => {
            setState({
                title: opts.title || 'Are you sure?',
                body: opts.body || null,
                confirmLabel: opts.confirmLabel || 'Confirm',
                cancelLabel: opts.cancelLabel || 'Cancel',
                destructive: opts.destructive ?? false,
                resolve,
            });
        });
    }, []);

    const close = (result) => {
        if (!state) return;
        state.resolve(result);
        setState(null);
    };

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {state && (
                <div
                    className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
                    onClick={() => close(false)}
                >
                    <div
                        className="bg-brand-dark border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 flex items-start gap-3">
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    state.destructive
                                        ? 'bg-red-500/20'
                                        : 'bg-brand-green/20'
                                }`}
                            >
                                <AlertTriangle
                                    className={`w-5 h-5 ${
                                        state.destructive ? 'text-red-400' : 'text-brand-green'
                                    }`}
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-bold text-base mb-1">{state.title}</h3>
                                {state.body && (
                                    <p className="text-gray-400 text-sm leading-relaxed">{state.body}</p>
                                )}
                            </div>
                            <button
                                onClick={() => close(false)}
                                className="p-1 -m-1 text-gray-500 hover:text-white"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="px-5 pb-5 flex gap-2 justify-end">
                            <button
                                onClick={() => close(false)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
                            >
                                {state.cancelLabel}
                            </button>
                            <button
                                onClick={() => close(true)}
                                autoFocus
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                                    state.destructive
                                        ? 'bg-red-500 hover:bg-red-600 text-white'
                                        : 'bg-brand-green hover:bg-brand-green/90 text-brand-dark'
                                }`}
                            >
                                {state.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
};
