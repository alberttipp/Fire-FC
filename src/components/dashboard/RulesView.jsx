import React, { useEffect, useState } from 'react';
import { FileText, Download, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import EcnlU11Rules from './EcnlU11Rules';

// League-rules viewer. Team-aware: U11 / ECNL teams get the native Pre-ECNL rules;
// other teams get their bundled league PDF (swap the file in public/docs).
const DOCS = [
    {
        id: 'international-summer-2026',
        title: '2026 International League — Rules & Schedule',
        subtitle: 'Summer season',
        path: '/docs/2026-international-rules-and-schedule-summer.pdf',
    },
];

const RulesView = () => {
    const { profile } = useAuth();
    const [team, setTeam] = useState(null); // null = loading

    useEffect(() => {
        let active = true;
        if (!profile?.team_id) { setTeam({}); return; }
        supabase.from('teams').select('name, age_group').eq('id', profile.team_id).maybeSingle()
            .then(({ data }) => { if (active) setTeam(data || {}); });
        return () => { active = false; };
    }, [profile?.team_id]);

    if (team === null) return null; // brief loading; avoids flashing the wrong ruleset
    const isU11Ecnl = team.age_group === 'U11' || /ecnl/i.test(team.name || '');
    if (isU11Ecnl) return <EcnlU11Rules />;

    return (
        <div className="max-w-5xl mx-auto px-4 md:px-6 pb-24 pt-6 space-y-6">
            <div>
                <h1 className="text-3xl text-white font-display font-bold uppercase tracking-wider">League Rules</h1>
                <p className="text-gray-400 text-sm mt-1">Official league documents — open in the viewer below or download a copy.</p>
            </div>

            {DOCS.map(doc => (
                <div key={doc.id} className="glass-panel p-4 md:p-6 space-y-4">
                    <div className="flex items-start gap-4 flex-wrap">
                        <div className="w-12 h-12 rounded-lg bg-brand-green/10 border border-brand-green/30 flex items-center justify-center shrink-0">
                            <FileText className="w-6 h-6 text-brand-green" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-white font-bold text-lg leading-tight">{doc.title}</h2>
                            <p className="text-gray-500 text-xs uppercase tracking-widest mt-0.5">{doc.subtitle}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href={doc.path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-wider text-gray-300 hover:bg-white/10 flex items-center gap-1.5"
                            >
                                <ExternalLink className="w-3.5 h-3.5" /> Open
                            </a>
                            <a
                                href={doc.path}
                                download
                                className="px-3 py-2 bg-brand-green text-brand-dark rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white flex items-center gap-1.5"
                            >
                                <Download className="w-3.5 h-3.5" /> Download
                            </a>
                        </div>
                    </div>

                    {/* Inline viewer. Mobile browsers fall back to a download
                        prompt rather than rendering — that's expected. */}
                    <div className="rounded-lg overflow-hidden border border-white/10 bg-black/30 hidden md:block">
                        <iframe
                            src={doc.path}
                            title={doc.title}
                            className="w-full h-[75vh] bg-white"
                        />
                    </div>
                    <p className="text-xs text-gray-500 md:hidden">
                        On mobile, tap <span className="text-brand-green font-bold">Open</span> to view in your browser or <span className="text-brand-green font-bold">Download</span> to save it to your phone.
                    </p>
                </div>
            ))}
        </div>
    );
};

export default RulesView;
