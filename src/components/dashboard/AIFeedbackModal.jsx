import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Send, Sparkles, StopCircle, Mail, MessageSquare, Check, RefreshCw, AlertCircle, Loader2, Type } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const AIFeedbackModal = ({ recipient, player, onClose }) => {
    const { user } = useAuth();
    const recipientName = player?.name || recipient || 'Player';
    // viewState: idle | typing | recording | captured | processing | review | sent | error
    //   'captured' = recording ended (auto or manual) and we have text to review/polish
    const [viewState, setViewState] = useState('idle');
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [aiSummary, setAiSummary] = useState('');
    const [recordingTime, setRecordingTime] = useState(0);
    const [processingStep, setProcessingStep] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [hasSpeechRecognition, setHasSpeechRecognition] = useState(false);
    // Diagnostic data — captured per onresult call, to figure out what the
    // Android Chrome speech engine is actually emitting. Visible as a small
    // panel in the recording UI.
    const [debugInfo, setDebugInfo] = useState(null);
    const recognitionRef = useRef(null);
    const timerRef = useRef(null);
    // SpeechRecognition resets event.results between .start() calls, so when the
    // user taps "Speak more" we snapshot the transcript so far and prefix it to
    // new session text.
    const transcriptBaselineRef = useRef('');

    // Initialize speech recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            try {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = true;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = 'en-US';

                recognitionRef.current.onresult = (event) => {
                    // Rebuild from event.results (accumulates for the whole .start()
                    // session) — OVERWRITE, don't append, so Chrome re-firing an
                    // already-finalized result can never duplicate text.
                    let sessionFinal = '';
                    let interimText = '';
                    const resultSnapshot = [];
                    for (let i = 0; i < event.results.length; i++) {
                        const result = event.results[i];
                        const text = result[0]?.transcript || '';
                        resultSnapshot.push({
                            i,
                            final: !!result.isFinal,
                            text: text.length > 60 ? text.slice(0, 60) + '...' : text,
                        });
                        if (result.isFinal) {
                            sessionFinal += text;
                            if (!sessionFinal.endsWith(' ')) sessionFinal += ' ';
                        } else {
                            interimText += text;
                        }
                    }
                    const baseline = transcriptBaselineRef.current;
                    const joiner = baseline && !baseline.endsWith(' ') ? ' ' : '';
                    setTranscript(baseline + joiner + sessionFinal);
                    setInterimTranscript(interimText);

                    // Capture what the engine actually sent. If duplicates are
                    // coming from the engine itself, they'll show here.
                    setDebugInfo({
                        callCount: (recognitionRef.current.__callCount = (recognitionRef.current.__callCount || 0) + 1),
                        resultIndex: event.resultIndex,
                        resultsLength: event.results.length,
                        finalCount: resultSnapshot.filter(r => r.final).length,
                        interimCount: resultSnapshot.filter(r => !r.final).length,
                        results: resultSnapshot,
                        transcriptLen: (baseline + joiner + sessionFinal).length,
                    });
                };

                recognitionRef.current.onerror = (e) => {
                    console.error('Speech recognition error:', e);
                    setIsListening(false);
                    // Benign errors: silent timeouts, user-initiated aborts
                    if (e.error === 'no-speech' || e.error === 'aborted') {
                        return;
                    }
                    // Show an error message but keep any transcript the user captured
                    setErrorMessage(`Microphone error: ${e.error || 'unknown'}. You can keep the captured text or switch to typing.`);
                };

                recognitionRef.current.onend = () => {
                    // Chrome auto-ends on pause. Flip listening off and, if we have
                    // content, jump to the captured-review step so the user can
                    // polish or speak more — instead of being stuck in "recording".
                    setIsListening(false);
                    setViewState(prev => {
                        if (prev !== 'recording') return prev;
                        return 'captured';
                    });
                };

                setHasSpeechRecognition(true);
            } catch (e) {
                console.warn('Speech recognition init failed:', e);
                setHasSpeechRecognition(false);
            }
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

    const handleStartRecording = (appendToExisting = false) => {
        if (!recognitionRef.current) {
            setViewState('typing');
            return;
        }

        if (appendToExisting) {
            transcriptBaselineRef.current = transcript;
        } else {
            transcriptBaselineRef.current = '';
            setTranscript('');
        }
        setInterimTranscript('');
        setAiSummary('');
        setErrorMessage('');
        setDebugInfo(null);
        // Reset the per-instance call counter so each new recording starts fresh
        if (recognitionRef.current) recognitionRef.current.__callCount = 0;
        setViewState('recording');

        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch (e) {
            console.error('Failed to start recording:', e);
            // InvalidStateError can fire if recognition is already running —
            // force-abort and try again next tick.
            try { recognitionRef.current.abort(); } catch (_) { /* no-op */ }
            setIsListening(false);
            setErrorMessage('Could not start microphone. Check permissions and try again.');
        }
    };

    const handleStopRecording = () => {
        // Safely stop regardless of current recognition state — .stop() on an
        // already-ended instance can throw InvalidStateError in some browsers.
        try {
            if (recognitionRef.current && isListening) {
                recognitionRef.current.stop();
            }
        } catch (e) {
            console.warn('Stop threw (safe to ignore):', e);
        }
        setIsListening(false);

        const captured = (transcript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
        if (!captured) {
            setErrorMessage('No speech detected. Try again or switch to typing.');
            return;
        }
        setTranscript(captured);
        setInterimTranscript('');
        setViewState('captured');
    };

    const handleCreateFromCaptured = async () => {
        const text = transcript.trim();
        if (!text) return;
        setViewState('processing');
        await processWithAI(text);
    };

    const handleSpeakMore = () => {
        handleStartRecording(true);
    };

    const handleDiscardAndRestart = () => {
        transcriptBaselineRef.current = '';
        setTranscript('');
        setInterimTranscript('');
        setErrorMessage('');
        setViewState('idle');
    };

    const handleTextSubmit = async () => {
        if (!transcript.trim()) return;

        setViewState('processing');
        await processWithAI(transcript.trim());
    };

    const processWithAI = async (rawTranscript) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            setErrorMessage('Supabase env vars missing on the deploy. Please check Vercel settings.');
            setViewState('error');
            return;
        }

        try {
            setProcessingStep('Sending to Coach AI...');
            await new Promise(r => setTimeout(r, 300));
            setProcessingStep('Polishing into coach speak...');

            const response = await fetch(`${supabaseUrl}/functions/v1/ai-polish-feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                    recipientName,
                    rawTranscript,
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                console.error('ai-polish-feedback error:', response.status, data);
                throw new Error(data?.error || `Server error ${response.status}`);
            }

            const polished = (data?.polishedText || '').trim();
            if (!polished) {
                throw new Error('AI returned an empty response. Try again.');
            }

            setProcessingStep('Finalizing...');
            await new Promise(r => setTimeout(r, 200));

            setAiSummary(polished);
            setViewState('review');
        } catch (err) {
            console.error('AI processing error:', err);
            setErrorMessage(`Could not polish feedback: ${err.message || 'unknown error'}`);
            setViewState('error');
        }
    };

    const handleRegenerate = async () => {
        if (transcript) {
            setViewState('processing');
            await processWithAI(transcript);
        }
    };

    const saveCoachNote = async (method, extraTags = []) => {
        if (!player?.id || !user?.id) {
            console.warn('AIFeedbackModal: no player or user — skipping note save');
            return { ok: true };
        }
        const { error: insertError } = await supabase.from('coach_notes').insert([{
            player_id: player.id,
            coach_id: user.id,
            note_text: aiSummary,
            tags: ['parent_feedback', method, ...extraTags],
        }]);
        if (insertError) {
            console.error('Save feedback error:', insertError);
            return { ok: false, error: insertError.message || 'Insert failed' };
        }
        return { ok: true };
    };

    const callFeedbackEndpoint = async (mode) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!accessToken) throw new Error('Not signed in — log out and back in.');

        const resp = await fetch(`${supabaseUrl}/functions/v1/send-coach-feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': anonKey,
                // JWT (not anon) so the function can verify.getUser() — required for
                // team_memberships auth check.
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                playerId: player?.id,
                polishedText: aiSummary,
                rawTranscript: transcript,
                mode,
            }),
        });
        const body = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            throw new Error(body?.error || `Server error ${resp.status}`);
        }
        return body;
    };

    const handleSend = async (method) => {
        if (!aiSummary?.trim()) return;
        if (!player?.id) {
            setErrorMessage('Missing player context — cannot send.');
            setViewState('error');
            return;
        }

        setViewState('processing');
        setProcessingStep(method === 'email' ? 'Sending to parents...' : 'Opening your messages app...');

        try {
            if (method === 'email') {
                const result = await callFeedbackEndpoint('email');
                const sent = result?.sentTo || [];
                const failures = result?.failures || [];
                if (sent.length === 0) {
                    const firstErr = failures[0]?.error || 'No recipients delivered.';
                    throw new Error(firstErr);
                }
                await saveCoachNote('email', sent.map(e => `to:${e}`));
                if (failures.length > 0) {
                    setErrorMessage(`Sent to ${sent.length}, ${failures.length} failed: ${failures.map(f => f.email).join(', ')}`);
                }
                setViewState('sent');
                setTimeout(() => onClose(), 2200);
                return;
            }

            // SMS path: fetch guardian contacts, open sms: link with body
            // pre-filled. If we have a phone, include it; otherwise let the
            // coach pick the contact in their native app.
            const result = await callFeedbackEndpoint('sms');
            const guardians = result?.guardians || [];
            const phoneGuardian = guardians.find(g => g.phone);
            const phone = phoneGuardian?.phone || '';
            const encoded = encodeURIComponent(aiSummary);
            // iOS uses ?body=, Android tolerates both. sms:<number>?body=<msg>
            const smsUrl = phone ? `sms:${phone}?body=${encoded}` : `sms:?body=${encoded}`;
            await saveCoachNote('sms', phone ? [`to:${phone}`] : ['to:manual']);
            window.location.href = smsUrl;
            // If no phone was on file, let the coach know to pick a contact.
            if (!phone) {
                setErrorMessage('No guardian phone on file — please choose a contact in your messages app.');
            }
            setViewState('sent');
            setTimeout(() => onClose(), 1500);
            return;

        } catch (err) {
            console.error('Send error:', err);
            setErrorMessage(err.message || 'Could not send. Please try again.');
            setViewState('error');
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-4 bg-black/90 backdrop-blur-md animate-fade-in">
            <div className={`bg-brand-dark border border-white/10 w-full md:max-w-lg rounded-t-2xl md:rounded-2xl shadow-2xl relative overflow-hidden transition-all duration-500 max-h-[90vh] overflow-y-auto ${viewState === 'sent' ? 'scale-90 opacity-0' : 'scale-100 opacity-100'}`}>

                {/* Header */}
                <div className="bg-gradient-to-r from-brand-dark to-gray-900 p-4 border-b border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-gold/10 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-brand-gold" />
                        </div>
                        <div>
                            <h2 className="text-white font-display uppercase font-bold tracking-wider text-sm">AI Coach Feedback</h2>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Powered by Claude</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 min-h-[400px] flex flex-col items-center justify-center relative">

                    {/* Inline error banner — visible in any state when set */}
                    {errorMessage && viewState !== 'error' && (
                        <div className="absolute top-2 left-2 right-2 z-10 p-3 rounded-lg bg-red-500/15 border border-red-500/40 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-200 leading-relaxed flex-1">{errorMessage}</p>
                            <button
                                onClick={() => setErrorMessage('')}
                                className="text-red-300 hover:text-white text-xs shrink-0"
                                aria-label="Dismiss"
                            >
                                ✕
                            </button>
                        </div>
                    )}

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
                        <div className="flex flex-col items-center gap-6 animate-fade-in-up">
                            <div className="text-center space-y-2">
                                <h3 className="text-xl text-white font-bold">Feedback for <span className="text-brand-green">{recipientName}</span></h3>
                                <p className="text-gray-400 text-sm max-w-xs mx-auto">
                                    {hasSpeechRecognition
                                        ? 'Record or type your thoughts. AI will polish them for parents.'
                                        : 'Type your thoughts. AI will polish them for parents.'}
                                </p>
                            </div>

                            <div className="flex items-center gap-4">
                                {hasSpeechRecognition && (
                                    <button
                                        onClick={() => handleStartRecording(false)}
                                        className="w-20 h-20 rounded-full bg-brand-green/10 border-2 border-brand-green flex items-center justify-center hover:bg-brand-green/20 hover:scale-105 transition-all shadow-[0_0_30px_rgba(59,130,246,0.2)] group"
                                    >
                                        <Mic className="w-8 h-8 text-brand-green group-hover:text-white transition-colors" />
                                    </button>
                                )}
                                <button
                                    onClick={() => { setTranscript(''); setViewState('typing'); }}
                                    className={`${hasSpeechRecognition ? 'w-20 h-20' : 'w-24 h-24'} rounded-full bg-blue-500/10 border-2 border-blue-400 flex items-center justify-center hover:bg-blue-500/20 hover:scale-105 transition-all group`}
                                >
                                    <Type className={`${hasSpeechRecognition ? 'w-8 h-8' : 'w-10 h-10'} text-blue-400 group-hover:text-white transition-colors`} />
                                </button>
                            </div>
                            <div className="flex gap-6 text-xs text-gray-500 uppercase font-bold tracking-widest">
                                {hasSpeechRecognition && <span>Voice</span>}
                                <span>Type</span>
                            </div>
                        </div>
                    )}

                    {/* TYPING STATE */}
                    {viewState === 'typing' && (
                        <div className="w-full space-y-4 animate-fade-in-up">
                            <div className="text-center space-y-1">
                                <h3 className="text-lg text-white font-bold">Feedback for <span className="text-brand-green">{recipientName}</span></h3>
                                <p className="text-gray-500 text-xs">Type your raw thoughts, then AI will polish them.</p>
                            </div>
                            <textarea
                                value={transcript}
                                onChange={(e) => setTranscript(e.target.value)}
                                placeholder="e.g. Great effort at practice today. Working on first touch and positioning. Needs to communicate more on the field..."
                                className="w-full h-36 bg-white/5 border border-white/10 rounded-lg p-4 text-white text-sm focus:border-brand-green outline-none resize-none placeholder:text-gray-600"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                {hasSpeechRecognition && (
                                    <button
                                        onClick={() => handleStartRecording(false)}
                                        className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2 text-sm"
                                    >
                                        <Mic className="w-4 h-4" /> Record Instead
                                    </button>
                                )}
                                <button
                                    onClick={handleTextSubmit}
                                    disabled={!transcript.trim()}
                                    className="flex-1 py-2.5 bg-brand-green text-brand-dark font-bold rounded-lg hover:bg-brand-green/90 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Sparkles className="w-4 h-4" /> Polish with AI
                                </button>
                            </div>
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

                            {/* DIAGNOSTIC — temporary, tells us what the
                                browser's speech engine is actually emitting. */}
                            {debugInfo && (
                                <div className="w-full bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-[10px] text-yellow-200 font-mono leading-tight">
                                    <div className="font-bold mb-1">
                                        debug · call {debugInfo.callCount} · resultIndex={debugInfo.resultIndex} · len={debugInfo.resultsLength} · final={debugInfo.finalCount} · interim={debugInfo.interimCount} · chars={debugInfo.transcriptLen}
                                    </div>
                                    <div className="max-h-24 overflow-y-auto space-y-0.5">
                                        {debugInfo.results.map(r => (
                                            <div key={r.i} className={r.final ? 'text-yellow-100' : 'text-yellow-400/70'}>
                                                [{r.i}] {r.final ? 'F' : 'i'} "{r.text}"
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* CAPTURED STATE — recording ended (manually or on pause),
                        user can polish what was captured or add more */}
                    {viewState === 'captured' && (
                        <div className="w-full space-y-4 animate-fade-in-up">
                            <div className="text-center space-y-1">
                                <h3 className="text-lg text-white font-bold">Captured feedback for <span className="text-brand-green">{recipientName}</span></h3>
                                <p className="text-gray-500 text-xs">Review and edit before polishing — or keep speaking.</p>
                            </div>
                            <textarea
                                value={transcript}
                                onChange={(e) => setTranscript(e.target.value)}
                                className="w-full h-36 bg-white/5 border border-white/10 rounded-lg p-4 text-white text-sm focus:border-brand-green outline-none resize-none placeholder:text-gray-600"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                {hasSpeechRecognition && (
                                    <button
                                        onClick={handleSpeakMore}
                                        className="py-2.5 bg-white/5 border border-white/10 rounded-lg text-gray-300 hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-sm"
                                    >
                                        <Mic className="w-4 h-4" /> Speak More
                                    </button>
                                )}
                                <button
                                    onClick={handleCreateFromCaptured}
                                    disabled={!transcript.trim()}
                                    className={`py-2.5 bg-brand-green text-brand-dark font-bold rounded-lg hover:bg-brand-green/90 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-30 disabled:cursor-not-allowed ${hasSpeechRecognition ? '' : 'col-span-2'}`}
                                >
                                    <Sparkles className="w-4 h-4" /> Polish with AI
                                </button>
                            </div>
                            <button
                                onClick={handleDiscardAndRestart}
                                className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
                            >
                                Discard and start over
                            </button>
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
