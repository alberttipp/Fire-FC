import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Copy, Plus, RefreshCw, Key, Shield, User } from 'lucide-react';

const InviteManager = ({ teamId }) => {
    const { user, profile } = useAuth();
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    // Fetch existing invites
    const fetchInvites = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('team_invites')
                .select('*')
                .eq('team_id', teamId);

            if (error) throw error;
            setInvites(data || []);
        } catch (err) {
            console.error("Error fetching invites:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (teamId) fetchInvites();
    }, [teamId]);

    // Generate Code
    const generateCode = async (role) => {
        setGenerating(true);
        try {
            // 1. Generate Random 6-char code
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 1, 0
            let code = 'FC-';
            for (let i = 0; i < 4; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            // 2. Insert/Upsert
            const { data, error } = await supabase
                .from('team_invites')
                .upsert({
                    team_id: teamId,
                    role: role,
                    code: code,
                    created_by: profile.id
                }, { onConflict: 'team_id, role' })
                .select()
                .single();

            if (error) throw error;

            // 3. Update State
            fetchInvites();

        } catch (err) {
            console.error("Error generating code:", err);
            alert("Failed to generate code.");
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = (code) => {
        navigator.clipboard.writeText(code);
        alert(`Copied: ${code}`);
    };

    // Role Config
    const roles = [
        { key: 'player', label: 'Player', icon: User, color: 'text-brand-green' },
        { key: 'assistant_coach', label: 'Assistant Coach', icon: Shield, color: 'text-blue-400' },
        { key: 'coach', label: 'Head Coach', icon: Key, color: 'text-brand-gold', managerOnly: true },
        { key: 'manager', label: 'Manager', icon: Shield, color: 'text-purple-400', managerOnly: true },
    ];

    const canManageRole = (roleKey) => {
        // Manager can do all
        if (profile?.role === 'manager' || user?.role === 'manager') return true;
        // Coach can do player/assistant
        if (profile?.role === 'coach' || user?.role === 'coach') return roleKey === 'player' || roleKey === 'assistant_coach';
        return false;
    };

    return (
        <div className="glass-panel p-6 border-l-4 border-brand-green">
            <h3 className="text-xl text-white font-display uppercase font-bold mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-brand-gold" /> Invite Codes
            </h3>

            <div className="space-y-4">
                {roles.filter(r => canManageRole(r.key)).map((role) => {
                    const existingInvite = invites.find(i => i.role === role.key);
                    const Icon = role.icon;

                    return (
                        <div key={role.key} className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/10">
                            <div className="flex items-center gap-3">
                                <Icon className={`w-5 h-5 ${role.color}`} />
                                <span className="text-white font-bold text-sm tracking-wide">{role.label}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                {existingInvite ? (
                                    <>
                                        <span className="font-mono text-brand-green font-bold text-lg tracking-widest">{existingInvite.code}</span>
                                        <button
                                            onClick={() => copyToClipboard(existingInvite.code)}
                                            className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                                            title="Copy Code"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => generateCode(role.key)}
                                            className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                                            title="Regenerate"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => generateCode(role.key)}
                                        disabled={generating}
                                        className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-white font-bold uppercase transition-colors"
                                    >
                                        Generate
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default InviteManager;
