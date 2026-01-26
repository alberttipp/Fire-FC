import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Send, Sparkles, StopCircle, Mail, MessageSquare, Check, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const AIFeedbackModal = ({ recipient, onClose }) => {
    const [viewState, setViewState] = useState('idle'); // idle, recording, processing, review, sent, error
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [aiSummary, setAiSummary] = useState('');
    const [recordingTime, setRecordingTime] = useState(0);
    const [processingStep, setProcessingStep] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const recognitionRef = useRef(null);
    const timerRef = useRef(null);

    // Initialize speech recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event) => {
                let finalText = '';
                let interimText = '';

                for (let i = 0; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        finalText += result[0].transcript + ' ';
                    } else {
                        interimText += result[0].transcript;
                    }
                }

                if (finalText) {
                    setTranscript(prev => prev + finalText);
                }
                setInterimTranscript(interimText);
            };

            recognitionRef.current.onerror = (e) => {
                console.error('Speech recognition error:', e);
                if (e.error !== 'no-speech') {
                    setErrorMessage('Speech recognition error. Please try again.');
                    setViewState('error');
                }
            };

            recognitionRef.current.onend = () => {
                // Don't auto-restart here - let user control
            };
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    // Recording timer
    useEffect(() => {
        if (viewState === 'recording') {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            setRecordingTime(0);
        }
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [viewState]);

    const handleStartRecording = () => {
        if (!recognitionRef.current) {
            setErrorMessage('Speech recognition is not supported in this browser. Please use Chrome.');
            setViewState('error');
            return;
        }

        setViewState('recording');
        setTranscript('');
        setInterimTranscript('');
        setAiSummary('');
        setErrorMessage('');

        try {
            recognitionRef.current.start();
        } catch (e) {
            console.error('Failed to start recording:', e);
        }
    };

    const handleStopRecording = async () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }

        const finalTranscript = transcript + interimTranscript;

        if (!finalTranscript.trim()) {
            setErrorMessage('No speech detected. Please try again.');
            setViewState('error');
            return;
        }

        setTranscript(finalTranscript.trim());
        setInterimTranscript('');
        setViewState('processing');

        // Process with AI
        await processWithAI(finalTranscript.trim());
    };

    const processWithAI = async (rawTranscript) => {
        if (!GEMINI_API_KEY) {
            setErrorMessage('AI API key not configured.');
            setViewState('error');
            return;
        }

        try {
            setProcessingStep('Transcribing audio...');

            // Small delay for UX
            await new Promise(r => setTimeout(r, 500));
            setProcessingStep('Enhancing to professional coach speak...');

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            role: 'user',
                            parts: [{
                                text: `You are an assistant for a youth soccer coach. Transform this raw voice note feedback into a polished, professional message suitable for parents.

The feedback is about a player named "${recipient}".

Raw coach's voice note:
"${rawTranscript}"

Instructions:
1. Keep the tone positive and constructive
2. Maintain all specific observations the coach made
3. Add professional structure (greeting, body, closing)
4. Keep it concise (2-3 short paragraphs max)
5. End with encouragement
6. Don't add any information the coach didn't mention
7. Format for easy reading (no bullet points, flowing prose)

Return ONLY the polished message, nothing else.`
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 512,
                        }
                    })
                }
            );

            const data = await response.json();

            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                setProcessingStep('Finalizing...');
                await new Promise(r => setTimeout(r, 300));

                setAiSummary(data.candidates[0].content.parts[0].text.trim());
                setViewState('review');
            } else {
                throw new Error('Invalid AI response');
            }
        } catch (err) {
            console.error('AI processing error:', err);
            setErrorMessage('Failed to process with AI. Please try again.');
            setViewState('error');
        }
    };

    const handleRegenerate = async () => {
        if (transcript) {
            setViewState('processing');
            await processWithAI(transcript);
        }
    };

    const handleSend = async (method) => {
        // In production, this would send via email/SMS API
        // For now, we'll save to the messages table as a record
        console.log(`Sending via ${method}:`, aiSummary);

        try {
            // Save feedback record to database (optional)
            // await supabase.from('feedback_messages').insert([{
            //     recipient_name: recipient,
            //     raw_transcript: transcript,
            //     polished_message: aiSummary,
            //     sent_via: method,
            //     created_at: new Date().toISOString()
            // }]);

            setViewState('sent');
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err) {
            console.error('Send error:', err);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

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

                    {/* ERROR STATE */}
                    {viewState === 'error' && (
                        <div className="flex flex-col items-center gap-6 animate-fade-in-up">
                            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                                <AlertCircle className="w-8 h-8 text-red-400" />
                            </div>
                            <div className="text-center space-y-2">
                                <h3 className="text-lg text-white font-bold">Something went wrong</h3>
                                <p className="text-gray-400 text-sm max-w-xs">{errorMessage}</p>
                            </div>
                            <button
                                onClick={() => setViewState('idle')}
                                className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

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
                        <div className="flex flex-col items-center gap-6 w-full">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                                <span className="text-white font-mono text-xl">{formatTime(recordingTime)}</span>
                            </div>

                            {/* Audio Visualizer */}
                            <div className="flex items-center justify-center gap-1 h-12">
                                {[...Array(12)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="w-1.5 bg-brand-green rounded-full animate-sound-wave"
                                        style={{ animationDelay: `${i * 0.1}s`, height: `${Math.random() * 100}%` }}
                                    />
                                ))}
                            </div>

                            {/* Live transcript preview */}
                            <div className="w-full max-h-24 overflow-y-auto bg-white/5 rounded-lg p-3 border border-white/10">
                                <p className="text-gray-300 text-sm">
                                    {transcript}
                                    <span className="text-gray-500 italic">{interimTranscript}</span>
                                    {!transcript && !interimTranscript && (
                                        <span className="text-gray-600">Start speaking...</span>
                                    )}
                                </p>
                            </div>

                            <button
                                onClick={handleStopRecording}
                                className="w-20 h-20 rounded-full bg-white text-brand-dark flex items-center justify-center hover:scale-105 transition-all shadow-lg"
                            >
                                <StopCircle className="w-8 h-8 fill-current" />
                            </button>
                            <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Tap to Stop</p>
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
                            {transcript && (
                                <p className="text-gray-600 text-xs italic max-w-xs text-center line-clamp-2 opacity-50">"{transcript.substring(0, 100)}..."</p>
                            )}
                        </div>
                    )}

                    {/* REVIEW STATE */}
                    {viewState === 'review' && (
                        <div className="w-full space-y-6 animate-fade-in-up">

                            {/* Original Transcript Collapsible */}
                            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Your Raw Input</label>
                                <p className="text-gray-400 text-xs italic leading-relaxed line-clamp-3">"{transcript}"</p>
                            </div>

                            {/* AI Result */}
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-brand-gold to-brand-green rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                                <div className="relative bg-black rounded-lg border border-brand-gold/30 p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <label className="text-xs text-brand-gold uppercase font-bold flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" /> Coach Speak Summary
                                        </label>
                                        <button
                                            onClick={handleRegenerate}
                                            className="text-gray-500 hover:text-white transition-colors"
                                            title="Regenerate"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <textarea
                                        value={aiSummary}
                                        onChange={(e) => setAiSummary(e.target.value)}
                                        className="w-full bg-transparent text-white text-sm leading-relaxed focus:outline-none resize-none h-32"
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

                    {/* SENT STATE */}
                    {viewState === 'sent' && (
                        <div className="flex flex-col items-center gap-4 animate-fade-in-up">
                            <div className="w-16 h-16 rounded-full bg-brand-green/20 flex items-center justify-center">
                                <Check className="w-8 h-8 text-brand-green" />
                            </div>
                            <h3 className="text-lg text-white font-bold">Feedback Sent!</h3>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIFeedbackModal;
