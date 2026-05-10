import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { CheckCircle, Mail, Phone, User, Calendar, FileText, Send, Loader2, AlertCircle } from 'lucide-react';

// Public-facing tryout signup form. No auth required.
//
// Submits via the SECURITY DEFINER RPC `submit_tryout_application`,
// which inserts a row into tryout_waitlist tagged with the org. Staff
// see the new prospect in the Tryouts tab on their dashboard.

const AGE_GROUPS = ['U6', 'U8', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'High School', 'Other'];

const TryoutSignup = () => {
    const [form, setForm] = useState({
        name: '',
        age_group: '',
        email: '',
        phone: '',
        notes: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);

    const update = (field, value) => {
        setForm((f) => ({ ...f, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!form.name.trim()) {
            setError("Player's name is required.");
            return;
        }
        if (!form.email.trim() && !form.phone.trim()) {
            setError('Add at least one way to contact you — email or phone.');
            return;
        }

        setSubmitting(true);
        try {
            const { error: rpcErr } = await supabase.rpc('submit_tryout_application', {
                p_name: form.name.trim(),
                p_email: form.email.trim() || null,
                p_phone: form.phone.trim() || null,
                p_age_group: form.age_group || null,
                p_notes: form.notes.trim() || null,
            });
            if (rpcErr) throw rpcErr;
            setSubmitted(true);
        } catch (err) {
            console.error('Tryout submit error:', err);
            setError(err.message || "Couldn't submit. Try again in a moment.");
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
                <div className="max-w-md w-full glass-panel p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-green/20 flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-brand-green" />
                    </div>
                    <h1 className="text-2xl font-display font-bold text-white uppercase tracking-wider mb-2">
                        You're on the list
                    </h1>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6">
                        Thanks for signing up for the Rockford Fire FC tryout waitlist. A coach will reach out to {form.email || form.phone} with the next steps.
                    </p>
                    <Link to="/login" className="text-brand-green text-sm uppercase tracking-wider hover:text-white">
                        Already a member? Log in →
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-brand-dark overflow-x-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?q=80&w=2500&auto=format&fit=crop')] bg-cover bg-center opacity-20 pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/90 to-transparent pointer-events-none"></div>

            <div className="relative z-10 min-h-screen flex flex-col items-center px-4 py-10">
                {/* Header */}
                <div className="max-w-md w-full text-center mb-6">
                    <div className="inline-flex items-center justify-center w-20 h-20 mb-3 filter drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                        <img src="/branding/logo.png" alt="Rockford Fire FC" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-widest uppercase">
                        Rockford Fire FC
                    </h1>
                    <p className="text-brand-green text-xs uppercase tracking-wider mt-1">Tryout Waitlist</p>
                    <p className="text-gray-400 text-sm mt-4 leading-relaxed">
                        Interested in joining a Fire FC team? Drop your info and a coach will reach out with tryout dates.
                    </p>
                </div>

                {/* Form */}
                <form
                    onSubmit={handleSubmit}
                    className="max-w-md w-full glass-panel border-t-4 border-brand-green p-5 sm:p-6 space-y-4"
                >
                    <div>
                        <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">
                            Player's Name <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => update('name', e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded p-3 pl-10 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                                placeholder="First Last"
                                autoComplete="name"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">
                            Age Group
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                            <select
                                value={form.age_group}
                                onChange={(e) => update('age_group', e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded p-3 pl-10 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none appearance-none"
                            >
                                <option value="">Select age group…</option>
                                {AGE_GROUPS.map((g) => (
                                    <option key={g} value={g} className="bg-gray-800">{g}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">
                            Parent / Guardian Email
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => update('email', e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded p-3 pl-10 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                                placeholder="parent@example.com"
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">
                            Phone
                        </label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={(e) => update('phone', e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded p-3 pl-10 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                                placeholder="(815) 555-0100"
                                autoComplete="tel"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Email or phone — at least one is required.</p>
                    </div>

                    <div>
                        <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">
                            Notes <span className="text-gray-500 normal-case font-normal">(optional)</span>
                        </label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                            <textarea
                                value={form.notes}
                                onChange={(e) => update('notes', e.target.value)}
                                rows={3}
                                className="w-full bg-black/50 border border-white/10 rounded p-3 pl-10 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none resize-none"
                                placeholder="Position, current club, anything we should know…"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded bg-red-500/10 border border-red-500/30">
                            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                            <p className="text-sm text-red-200">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
                            </>
                        ) : (
                            <>
                                Submit <Send className="w-4 h-4" />
                            </>
                        )}
                    </button>

                    <p className="text-[10px] text-gray-600 text-center pt-2">
                        Already a Fire FC family? <Link to="/login" className="text-brand-green hover:text-white">Log in here</Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default TryoutSignup;
