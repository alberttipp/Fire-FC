import React, { useState, useEffect } from 'react';
import { X, Mic, Send, Sparkles, StopCircle, Mail, MessageSquare, Check, RefreshCw } from 'lucide-react';

const AIFeedbackModal = ({ recipient, onClose }) => {
    const [viewState, setViewState] = useState('idle'); // idle, recording, processing, review, sent
    const [transcript, setTranscript] = useState('');
    const [aiSummary, setAiSummary] = useState('');
    const [recordingTime, setRecordingTime] = useState(0);
    const [processingStep, setProcessingStep] = useState(''); // Transcribing, Polishing, Finalizing

    // Mock Timer
    useEffect(() => {
        let interval;
        if (viewState === 'recording') {
            interval = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } else {
            setRecordingTime(0);
        }
        return () => clearInterval(interval);
    }, [viewState]);

    const handleStartRecording = () => {
        setViewState('recording');
        setTranscript('');
        setAiSummary('');
    };

    const handleStopRecording = () => {
        setViewState('processing');

        // Simulate AI Steps
        setProcessingStep('Transcribing audio...');
        setTimeout(() => {
            setTranscript("You guys did a really good job today specifically on the passing drills I liked how Leo was moving off the ball and finding space but we need to work on our defensive shape specifically when we lose possession in the middle third.");
            setProcessingStep('Enhancing to professional coach speak...');
        }, 1500);

        setTimeout(() => {
            setProcessingStep('Generating action items...');
        }, 3000);

        setTimeout(() => {
            setAiSummary("Excellent work on the passing drills today! Leo demonstrated great awareness moving off the ball to find space. moving forward, let's focus on maintaining our defensive shape, particularly during transition moments in the middle third. Keep up the intensity!");
            setViewState('review');
        }, 4500);
    };

    const handleSend = (method) => {
        // method: 'email' or 'text'
        console.log(`Sending via ${method}:`, aiSummary);
        setViewState('sent');
        setTimeout(() => {
            onClose();
        }, 2000);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
            <div className={`bg-brand-dark border border-white/10 w-full max-w-lg rounded-2xl shadow-2xl relative overflow-hidden transition-all duration-500 ${viewState === 'sent' ? 'scale-90 opacity-0' : 'scale-100 opacity-100'}`}>

                {/* Header */}
                <div className="bg-gradient-to-r from-brand-dark to-gray-900 p-4 border-b border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-gold/10 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-brand-gold" />
                        </div>
                        <div>
                            <h2 className="text-white font-display uppercase font-bold tracking-wider text-sm">AI Coach Feedback</h2>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Powered by Gemini</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 min-h-[400px] flex flex-col items-center justify-center relative">

                    {/* IDLE STATE */}
                    {viewState === 'idle' && (
                        <div className="flex flex-col items-center gap-8 animate-fade-in-up">
                            <div className="text-center space-y-2">
                                <h3 className="text-xl text-white font-bold">Feedback for <span className="text-brand-green">{recipient}</span></h3>
                                <p className="text-gray-400 text-sm max-w-xs mx-auto">
                                    Record your raw thoughts. The AI will summarize, polish, and format them for parents.
                                </p>
                            </div>

                            <button
                                onClick={handleStartRecording}
                                className="w-24 h-24 rounded-full bg-brand-green/10 border-2 border-brand-green flex items-center justify-center hover:bg-brand-green/20 hover:scale-105 transition-all shadow-[0_0_30px_rgba(204,255,0,0.2)] group"
                            >
                                <Mic className="w-10 h-10 text-brand-green group-hover:text-white transition-colors" />
                            </button>
                            <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Tap to Record</p>
                        </div>
                    )}

                    {/* RECORDING STATE */}
                    {viewState === 'recording' && (
                        <div className="flex flex-col items-center gap-8">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                                <span className="text-white font-mono text-xl">{formatTime(recordingTime)}</span>
                            </div>

                            {/* Audio Visualizer Mock */}
                            <div className="flex items-center justify-center gap-1 h-12">
                                {[...Array(12)].map((_, i) => (
                                    <div key={i} className="w-1.5 bg-brand-green rounded-full animate-sound-wave" style={{ animationDelay: `${i * 0.1}s`, height: `${Math.random() * 100}%` }}></div>
                                ))}
                            </div>

                            <button
                                onClick={handleStopRecording}
                                className="w-20 h-20 rounded-full bg-white text-brand-dark flex items-center justify-center hover:scale-105 transition-all shadow-lg"
                            >
                                <StopCircle className="w-8 h-8 fill-current" />
                            </button>
                            <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Listening...</p>
                        </div>
                    )}

                    {/* PROCESSING STATE */}
                    {viewState === 'processing' && (
                        <div className="flex flex-col items-center gap-6">
                            <div className="relative">
                                <div className="w-20 h-20 border-4 border-brand-gold/30 rounded-full"></div>
                                <div className="w-20 h-20 border-4 border-brand-gold border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                                <Sparkles className="w-6 h-6 text-brand-gold absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                            </div>
                            <div className="text-center">
                                <h4 className="text-white font-bold text-lg mb-1">AI Magic in Progress</h4>
                                <p className="text-brand-gold text-xs uppercase font-bold tracking-widest animate-pulse">{processingStep}</p>
                            </div>
                            {/* Transcript Preview fade in */}
                            {transcript && (
                                <p className="text-gray-600 text-xs italic max-w-xs text-center line-clamp-2 opacity-50">"{transcript}"</p>
                            )}
                        </div>
                    )}

                    {/* REVIEW STATE */}
                    {viewState === 'review' && (
                        <div className="w-full space-y-6 animate-fade-in-up">

                            {/* Original Transcript Collapsible */}
                            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Your Raw Input</label>
                                <p className="text-gray-400 text-xs italic leading-relaxed">"{transcript}"</p>
                            </div>

                            {/* AI Result */}
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-brand-gold to-brand-green rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                                <div className="relative bg-black rounded-lg border border-brand-gold/30 p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <label className="text-xs text-brand-gold uppercase font-bold flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" /> Coach Speak Summary
                                        </label>
                                        <button className="text-gray-500 hover:text-white transition-colors" title="Regenerate">
                                            <RefreshCw className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <textarea
                                        value={aiSummary}
                                        onChange={(e) => setAiSummary(e.target.value)}
                                        className="w-full bg-transparent text-white text-sm leading-relaxed focus:outline-none resize-none h-24"
                                    />
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <button
                                    onClick={() => handleSend('email')}
                                    className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 hover:bg-brand-green/20 border border-white/10 hover:border-brand-green/50 rounded-xl transition-all group"
                                >
                                    <Mail className="w-6 h-6 text-gray-300 group-hover:text-brand-green" />
                                    <span className="text-xs font-bold text-gray-300 group-hover:text-white uppercase tracking-wider">Email Parents</span>
                                </button>
                                <button
                                    onClick={() => handleSend('text')}
                                    className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/50 rounded-xl transition-all group"
                                >
                                    <MessageSquare className="w-6 h-6 text-gray-300 group-hover:text-blue-400" />
                                    <span className="text-xs font-bold text-gray-300 group-hover:text-white uppercase tracking-wider">Text Parents</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIFeedbackModal;
