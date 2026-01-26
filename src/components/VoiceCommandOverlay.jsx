import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Volume2, Loader2, X, CheckCircle, AlertCircle, Info, Sparkles } from 'lucide-react';
import { useVoiceCommand } from '../context/VoiceCommandContext';

const VoiceCommandOverlay = () => {
    const voiceCommand = useVoiceCommand();
    const [showResult, setShowResult] = useState(false);
    const [showHint, setShowHint] = useState(false);

    // Destructure with defaults for when context is null
    const {
        isListening = false,
        isWakeWordMode = false,
        isProcessing = false,
        transcript = '',
        commandResult = null,
        error = null,
        voiceEnabled = false,
        startListening = () => {},
        stopListening = () => {},
        enableWakeWord = () => {},
        disableWakeWord = () => {},
        clearResult = () => {},
        clearError = () => {}
    } = voiceCommand || {};

    // Show result toast when command completes
    useEffect(() => {
        if (commandResult || error) {
            setShowResult(true);
            const timer = setTimeout(() => {
                setShowResult(false);
                clearResult();
                clearError();
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [commandResult, error, clearResult, clearError]);

    // Get result icon
    const getResultIcon = () => {
        if (error) return <AlertCircle className="w-5 h-5 text-red-400" />;
        if (!commandResult) return null;

        switch (commandResult.type) {
            case 'navigation':
            case 'action':
                return <CheckCircle className="w-5 h-5 text-brand-green" />;
            case 'data':
                return <Info className="w-5 h-5 text-blue-400" />;
            case 'ai':
                return <Sparkles className="w-5 h-5 text-brand-gold" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-400" />;
            default:
                return <Info className="w-5 h-5 text-gray-400" />;
        }
    };

    // Return null if voice commands not available
    if (!voiceCommand || !voiceEnabled) return null;

    return (
        <>
            {/* Voice Control FAB - Bottom Left */}
            <div className="fixed bottom-6 left-6 z-40 flex flex-col items-start gap-3">
                {/* Hints Popup */}
                {showHint && (
                    <div className="bg-brand-dark border border-white/10 rounded-xl p-4 shadow-2xl animate-fade-in-up max-w-xs">
                        <h4 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-brand-gold" />
                            Voice Commands
                        </h4>
                        <ul className="text-xs text-gray-400 space-y-1">
                            <li><span className="text-brand-green">"Hey Fire"</span> - Wake word</li>
                            <li><span className="text-white">"Go to team"</span> - Navigate</li>
                            <li><span className="text-white">"Show stats for Bo"</span> - Query</li>
                            <li><span className="text-white">"When is next practice"</span> - Schedule</li>
                            <li><span className="text-white">"Open chat"</span> - Actions</li>
                        </ul>
                        <button
                            onClick={() => setShowHint(false)}
                            className="mt-3 text-[10px] text-gray-500 hover:text-white"
                        >
                            Got it
                        </button>
                    </div>
                )}

                {/* Main Voice Button */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            if (isListening) {
                                stopListening();
                            } else if (isWakeWordMode) {
                                disableWakeWord();
                            } else {
                                enableWakeWord();
                            }
                        }}
                        onDoubleClick={startListening}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
                            isListening
                                ? 'bg-red-500 text-white animate-pulse shadow-red-500/30'
                                : isWakeWordMode
                                    ? 'bg-brand-gold text-brand-dark shadow-brand-gold/30'
                                    : 'bg-white/10 text-gray-400 hover:bg-white/20 border border-white/10'
                        }`}
                        title={isListening ? 'Listening... (click to stop)' : isWakeWordMode ? '"Hey Fire" mode active' : 'Enable voice commands'}
                    >
                        {isProcessing ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : isListening ? (
                            <Mic className="w-5 h-5" />
                        ) : isWakeWordMode ? (
                            <Volume2 className="w-5 h-5" />
                        ) : (
                            <MicOff className="w-5 h-5" />
                        )}
                    </button>

                    {/* Status text */}
                    {(isWakeWordMode || isListening) && !isProcessing && (
                        <div className="bg-black/80 rounded-lg px-3 py-1.5 animate-fade-in">
                            {isListening ? (
                                <span className="text-xs text-red-400 font-bold">Listening...</span>
                            ) : (
                                <span className="text-xs text-brand-gold">Say "Hey Fire"</span>
                            )}
                        </div>
                    )}

                    {/* Help button */}
                    {!isListening && (
                        <button
                            onClick={() => setShowHint(!showHint)}
                            className="text-gray-600 hover:text-white text-xs"
                        >
                            ?
                        </button>
                    )}
                </div>
            </div>

            {/* Listening Overlay */}
            {isListening && (
                <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
                    {/* Semi-transparent backdrop */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

                    {/* Listening Card */}
                    <div className="relative bg-brand-dark border border-brand-green/30 rounded-2xl p-8 shadow-2xl shadow-brand-green/20 animate-fade-in-up pointer-events-auto max-w-md mx-4">
                        {/* Close button */}
                        <button
                            onClick={stopListening}
                            className="absolute top-4 right-4 text-gray-500 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Mic animation */}
                        <div className="flex justify-center mb-6">
                            <div className="relative">
                                <div className="w-20 h-20 bg-brand-green/20 rounded-full flex items-center justify-center">
                                    <Mic className="w-10 h-10 text-brand-green" />
                                </div>
                                {/* Pulse rings */}
                                <div className="absolute inset-0 rounded-full border-2 border-brand-green/50 animate-ping" />
                                <div className="absolute inset-[-8px] rounded-full border border-brand-green/30 animate-pulse" />
                            </div>
                        </div>

                        {/* Status */}
                        <div className="text-center">
                            <h3 className="text-white font-bold text-lg mb-2">Listening...</h3>
                            <p className="text-gray-400 text-sm min-h-[24px]">
                                {transcript || 'Say your command'}
                            </p>
                        </div>

                        {/* Audio visualizer */}
                        <div className="flex items-center justify-center gap-1 h-8 mt-6">
                            {[...Array(12)].map((_, i) => (
                                <div
                                    key={i}
                                    className="w-1 bg-brand-green rounded-full animate-sound-wave"
                                    style={{
                                        animationDelay: `${i * 0.08}s`,
                                        height: `${Math.random() * 100}%`
                                    }}
                                />
                            ))}
                        </div>

                        {/* Quick hints */}
                        <div className="mt-6 pt-4 border-t border-white/10">
                            <p className="text-[10px] text-gray-500 text-center uppercase tracking-wider">
                                Try: "Go to team" or "Show stats for Bo"
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Result Toast */}
            {showResult && (commandResult || error) && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
                    <div className={`flex items-start gap-3 bg-brand-dark border rounded-xl px-4 py-3 shadow-xl max-w-md ${
                        error || commandResult?.type === 'error'
                            ? 'border-red-500/30'
                            : commandResult?.type === 'ai'
                                ? 'border-brand-gold/30'
                                : 'border-brand-green/30'
                    }`}>
                        {getResultIcon()}
                        <div className="flex-1">
                            <p className="text-white text-sm">
                                {error || commandResult?.message}
                            </p>
                            {commandResult?.type === 'data' && commandResult?.data?.first_name && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Tap to view full card
                                </p>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                setShowResult(false);
                                clearResult();
                                clearError();
                            }}
                            className="text-gray-500 hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default VoiceCommandOverlay;
