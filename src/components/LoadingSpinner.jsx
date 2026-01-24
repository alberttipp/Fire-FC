import React from 'react';

const LoadingSpinner = ({ 
    message = "Loading...", 
    size = "default",
    fullScreen = true 
}) => {
    const sizeClasses = {
        small: "w-6 h-6 border-2",
        default: "w-12 h-12 border-4",
        large: "w-16 h-16 border-4"
    };

    const spinner = (
        <div className="text-center">
            <div className={`${sizeClasses[size]} border-brand-green border-t-transparent rounded-full animate-spin mx-auto mb-4`}></div>
            {message && (
                <p className="text-brand-green font-display uppercase tracking-widest text-sm">
                    {message}
                </p>
            )}
        </div>
    );

    if (fullScreen) {
        return (
            <div className="min-h-screen bg-brand-dark flex items-center justify-center text-white">
                {spinner}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center p-8">
            {spinner}
        </div>
    );
};

export default LoadingSpinner;
