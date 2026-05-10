import React, { useState, useEffect, createContext, useContext } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

// Toast Context
const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

// Toast Provider Component
export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    // `action` is an optional { label, onClick } that renders as a button
    // inside the toast. Used for things like "New version — Reload".
    const addToast = (message, type = 'info', duration = 4000, action = null) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type, duration, action }]);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };

    const toast = {
        success: (message, duration, action) => addToast(message, 'success', duration, action),
        error: (message, duration, action) => addToast(message, 'error', duration, action),
        warning: (message, duration, action) => addToast(message, 'warning', duration, action),
        info: (message, duration, action) => addToast(message, 'info', duration, action),
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
};

// Toast Container
const ToastContainer = ({ toasts, removeToast }) => {
    return (
        <div className="fixed bottom-4 right-4 z-[200] space-y-2 pointer-events-none">
            {toasts.map(toast => (
                <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
            ))}
        </div>
    );
};

// Individual Toast
const Toast = ({ id, message, type, duration, action, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Animate in
        setTimeout(() => setIsVisible(true), 10);

        // Auto dismiss
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300); // Wait for exit animation
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const icons = {
        success: <CheckCircle className="w-5 h-5 text-green-400" />,
        error: <XCircle className="w-5 h-5 text-red-400" />,
        warning: <AlertCircle className="w-5 h-5 text-yellow-400" />,
        info: <Info className="w-5 h-5 text-blue-400" />,
    };

    const backgrounds = {
        success: 'bg-green-500/10 border-green-500/30',
        error: 'bg-red-500/10 border-red-500/30',
        warning: 'bg-yellow-500/10 border-yellow-500/30',
        info: 'bg-blue-500/10 border-blue-500/30',
    };

    const actionStyles = {
        success: 'bg-green-500/20 hover:bg-green-500/30 text-green-200 border-green-500/40',
        error: 'bg-red-500/20 hover:bg-red-500/30 text-red-200 border-red-500/40',
        warning: 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 border-yellow-500/40',
        info: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border-blue-500/40',
    };

    return (
        <div
            className={`
                pointer-events-auto flex items-center gap-3 px-4 py-3
                rounded-lg border backdrop-blur-sm shadow-lg
                transform transition-all duration-300 ease-out
                ${backgrounds[type]}
                ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            `}
        >
            {icons[type]}
            <p className="text-white text-sm font-medium flex-1 min-w-0">{message}</p>
            {action?.label && action?.onClick && (
                <button
                    onClick={() => {
                        action.onClick();
                        setIsVisible(false);
                        setTimeout(onClose, 300);
                    }}
                    className={`px-3 py-1.5 rounded border text-xs font-bold uppercase tracking-wider transition-colors ${actionStyles[type]}`}
                >
                    {action.label}
                </button>
            )}
            <button
                onClick={() => {
                    setIsVisible(false);
                    setTimeout(onClose, 300);
                }}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Dismiss"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

export default Toast;
